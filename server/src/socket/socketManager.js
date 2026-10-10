const jwt = require('jsonwebtoken');
const otEngine = require('./otEngine');
const batchWriter = require('./batchWriter');
const undoRedoManager = require('./undoRedoManager');
const Session = require('../models/Session');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

// Store active room participants in-memory: roomId -> Map(socketId -> userData)
const roomParticipants = new Map();

const setupSocketHandlers = (io) => {
  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_boardcollab_jwt_key_2026');
      socket.user = {
        id: decoded.id,
        username: decoded.username || 'Anonymous',
        color: decoded.color || '#3B82F6',
        isGuest: Boolean(decoded.isGuest)
      };
      next();
    } catch (err) {
      logger.warn(`Socket auth rejected: ${err.message}`);
      return next(new Error('Invalid or expired authentication token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user.username} - ${socket.user.id})`);

    let currentRoomId = null;

    /**
     * 1. JOIN ROOM
     */
    socket.on('join-room', async ({ roomId, passcode }, callback) => {
      try {
        currentRoomId = roomId;
        socket.join(roomId);

        // Track participant
        if (!roomParticipants.has(roomId)) {
          roomParticipants.set(roomId, new Map());
        }
        const participants = roomParticipants.get(roomId);
        const userData = {
          socketId: socket.id,
          userId: socket.user.id,
          username: socket.user.username,
          color: socket.user.color,
          joinedAt: new Date().toISOString()
        };
        participants.set(socket.id, userData);

        // Store session in Redis with 1 hour TTL
        const redis = getRedisClient();
        await redis.set(`session:${socket.user.id}:${roomId}`, JSON.stringify(userData), 'EX', 3600);

        // Ensure room state is in OTEngine
        let elements = otEngine.getElements(roomId);
        if (elements.length === 0) {
          // Attempt loading snapshot from Mongo
          try {
            const dbSession = await Session.findOne({ roomId });
            if (dbSession && dbSession.elements) {
              otEngine.loadSnapshot(roomId, dbSession.elements);
              elements = otEngine.getElements(roomId);
            }
          } catch (dbErr) {
            logger.debug(`Could not load snapshot from DB for ${roomId}: ${dbErr.message}`);
          }
        }

        const activeUsersList = Array.from(participants.values());

        // Notify client with current room canvas & users
        const responseData = {
          success: true,
          roomId,
          elements,
          users: activeUsersList,
          serverTimestamp: Date.now()
        };

        if (typeof callback === 'function') {
          callback(responseData);
        } else {
          socket.emit('room-state', responseData);
        }

        // Broadcast to other users in the room
        socket.to(roomId).emit('user-joined', {
          user: userData,
          users: activeUsersList
        });

        logger.info(`User ${socket.user.username} joined room: ${roomId} (Total: ${activeUsersList.length})`);
      } catch (err) {
        logger.error(`Error in join-room: ${err.message}`);
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    /**
     * 2. DRAW STROKE / DRAW ELEMENT / ELEMENT UPDATE
     * Operational Transformation & Conflict Resolution
     */
    socket.on('draw-stroke', async (data, callback) => {
      handleElementChange(socket, currentRoomId, data, callback);
    });

    socket.on('element-update', async (data, callback) => {
      handleElementChange(socket, currentRoomId, data, callback);
    });

    const handleElementChange = async (sock, roomId, data, callback) => {
      if (!roomId) return;

      const clientOp = {
        type: data.type || 'element-update',
        action: data.action || 'UPDATE',
        element: data.element,
        baseVersion: data.baseVersion || 0,
        userId: sock.user.id,
        timestamp: data.timestamp || Date.now()
      };

      // 1. Process via Operational Transformation engine
      const otResult = otEngine.applyOperation(roomId, clientOp);

      if (!otResult.success) {
        if (typeof callback === 'function') callback({ success: false, reason: otResult.reason });
        return;
      }

      const committedElement = otResult.element;

      // 2. Queue for batched MongoDB persistence (avoids write thrashing)
      batchWriter.queueUpdate(roomId, committedElement);

      // 3. Register with User-isolated Undo Stack
      if (data.previousData) {
        // Record undo inverse operation: restore prior state
        await undoRedoManager.pushUndo(roomId, sock.user.id, {
          action: 'UPDATE',
          elementId: committedElement.id,
          element: {
            ...committedElement,
            data: data.previousData
          },
          forwardOp: {
            action: 'UPDATE',
            elementId: committedElement.id,
            element: committedElement
          }
        });
      } else if (data.isNew) {
        // Record undo inverse operation: delete new element
        await undoRedoManager.pushUndo(roomId, sock.user.id, {
          action: 'DELETE',
          elementId: committedElement.id,
          forwardOp: {
            action: 'RESTORE',
            elementId: committedElement.id,
            element: committedElement
          }
        });
      }

      // 4. Instantly broadcast committed change to all other peers in room
      sock.to(roomId).emit('element-synced', {
        element: committedElement,
        op: otResult.committedOp,
        conflictResolved: otResult.conflictDetected,
        senderId: sock.user.id
      });

      // 5. Acknowledge the sender
      if (typeof callback === 'function') {
        callback({
          success: true,
          element: committedElement,
          version: otResult.committedOp.version,
          conflictResolved: otResult.conflictDetected
        });
      }
    };

    /**
     * 3. ELEMENT DELETE
     */
    socket.on('element-delete', async ({ elementId }, callback) => {
      if (!currentRoomId || !elementId) return;

      const priorElement = otEngine.getElement(currentRoomId, elementId);

      const otResult = otEngine.applyOperation(currentRoomId, {
        action: 'DELETE',
        type: 'DELETE_ELEMENT',
        element: { id: elementId },
        userId: socket.user.id
      });

      // Queue delete in batch writer
      batchWriter.queueDelete(currentRoomId, elementId);

      // Register undo action: restore deleted element
      if (priorElement) {
        await undoRedoManager.pushUndo(currentRoomId, socket.user.id, {
          action: 'RESTORE',
          elementId,
          element: priorElement,
          forwardOp: {
            action: 'DELETE',
            elementId
          }
        });
      }

      // Broadcast deletion
      socket.to(currentRoomId).emit('element-deleted', {
        elementId,
        userId: socket.user.id
      });

      if (typeof callback === 'function') {
        callback({ success: true, elementId });
      }
    });

    /**
     * 4. PER-USER UNDO
     */
    socket.on('undo', async (callback) => {
      if (!currentRoomId) return;
      try {
        const inverseAction = await undoRedoManager.popUndo(currentRoomId, socket.user.id);
        if (!inverseAction) {
          if (typeof callback === 'function') callback({ success: false, message: 'Nothing to undo' });
          return;
        }

        if (inverseAction.action === 'DELETE') {
          // Invert create by deleting
          otEngine.applyOperation(currentRoomId, {
            action: 'DELETE',
            element: { id: inverseAction.elementId },
            userId: socket.user.id
          });
          batchWriter.queueDelete(currentRoomId, inverseAction.elementId);

          io.in(currentRoomId).emit('element-deleted', {
            elementId: inverseAction.elementId,
            userId: socket.user.id,
            isUndo: true
          });
        } else if (inverseAction.action === 'UPDATE' || inverseAction.action === 'RESTORE') {
          // Invert by restoring prior data
          const result = otEngine.applyOperation(currentRoomId, {
            action: 'UPDATE',
            element: inverseAction.element,
            userId: socket.user.id
          });

          if (result.success) {
            batchWriter.queueUpdate(currentRoomId, result.element);
            io.in(currentRoomId).emit('element-synced', {
              element: result.element,
              op: result.committedOp,
              isUndo: true
            });
          }
        }

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        logger.error(`Undo error: ${err.message}`);
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    /**
     * 5. PER-USER REDO
     */
    socket.on('redo', async (callback) => {
      if (!currentRoomId) return;
      try {
        const forwardAction = await undoRedoManager.popRedo(currentRoomId, socket.user.id);
        if (!forwardAction) {
          if (typeof callback === 'function') callback({ success: false, message: 'Nothing to redo' });
          return;
        }

        if (forwardAction.action === 'DELETE') {
          otEngine.applyOperation(currentRoomId, {
            action: 'DELETE',
            element: { id: forwardAction.elementId },
            userId: socket.user.id
          });
          batchWriter.queueDelete(currentRoomId, forwardAction.elementId);

          io.in(currentRoomId).emit('element-deleted', {
            elementId: forwardAction.elementId,
            userId: socket.user.id,
            isRedo: true
          });
        } else if (forwardAction.action === 'UPDATE' || forwardAction.action === 'RESTORE') {
          const result = otEngine.applyOperation(currentRoomId, {
            action: 'UPDATE',
            element: forwardAction.element,
            userId: socket.user.id
          });

          if (result.success) {
            batchWriter.queueUpdate(currentRoomId, result.element);
            io.in(currentRoomId).emit('element-synced', {
              element: result.element,
              op: result.committedOp,
              isRedo: true
            });
          }
        }

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        logger.error(`Redo error: ${err.message}`);
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    /**
     * 6. REAL-TIME CURSOR PRESENCE
     * Volatile high-speed broadcast for collaborative multiplayer cursors
     */
    socket.on('cursor-move', (coords) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).volatile.emit('cursor-update', {
        userId: socket.user.id,
        username: socket.user.username,
        color: socket.user.color,
        x: coords.x,
        y: coords.y
      });
    });

    /**
     * 7. HEARTBEAT (Ping/Pong every 30s)
     */
    socket.on('heartbeat', (data, callback) => {
      if (typeof callback === 'function') {
        callback({
          status: 'pong',
          serverTime: Date.now(),
          clientTime: data?.timestamp
        });
      }
    });

    /**
     * 8. CLEAR CANVAS
     */
    socket.on('clear-canvas', async (callback) => {
      if (!currentRoomId) return;
      otEngine.clearRoom(currentRoomId);

      try {
        await Session.findOneAndUpdate(
          { roomId: currentRoomId },
          { $set: { elements: [], lastUpdated: new Date() } }
        );
      } catch (err) {
        logger.error(`Error clearing canvas in DB: ${err.message}`);
      }

      io.in(currentRoomId).emit('canvas-cleared', {
        clearedBy: socket.user.username,
        timestamp: Date.now()
      });

      if (typeof callback === 'function') callback({ success: true });
    });

    /**
     * 9. DISCONNECT & CLEANUP
     */
    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${socket.id}`);
      if (currentRoomId && roomParticipants.has(currentRoomId)) {
        const participants = roomParticipants.get(currentRoomId);
        participants.delete(socket.id);

        const remainingUsers = Array.from(participants.values());
        socket.to(currentRoomId).emit('user-left', {
          socketId: socket.id,
          userId: socket.user.id,
          username: socket.user.username,
          users: remainingUsers
        });

        if (participants.size === 0) {
          // Trigger immediate flush of any pending writes for empty room
          await batchWriter.flushRoom(currentRoomId);
          roomParticipants.delete(currentRoomId);
        }
      }
    });
  });
};

module.exports = setupSocketHandlers;
