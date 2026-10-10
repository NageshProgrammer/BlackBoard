const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

class UndoRedoManager {
  /**
   * Push an operation onto a user's undo stack
   */
  async pushUndo(roomId, userId, inverseOp) {
    if (!roomId || !userId || !inverseOp) return;
    const redis = getRedisClient();
    const undoKey = `undo:${roomId}:${userId}`;
    const redoKey = `redo:${roomId}:${userId}`;

    try {
      await redis.lpush(undoKey, JSON.stringify(inverseOp));
      // Max 50 undo steps per user
      if (typeof redis.ltrim === 'function') {
        await redis.ltrim(undoKey, 0, 49);
      }
      // Clear redo stack on new action
      await redis.del(redoKey);
    } catch (err) {
      logger.error(`Error pushing undo: ${err.message}`);
    }
  }

  /**
   * Pop the last undo action for a user and return the inverse operation to apply
   */
  async popUndo(roomId, userId) {
    if (!roomId || !userId) return null;
    const redis = getRedisClient();
    const undoKey = `undo:${roomId}:${userId}`;
    const redoKey = `redo:${roomId}:${userId}`;

    try {
      const raw = await redis.lpop(undoKey);
      if (!raw) return null;

      const op = typeof raw === 'string' ? JSON.parse(raw) : raw;

      // Push forward counterpart onto redo stack
      if (op.forwardOp) {
        await redis.lpush(redoKey, JSON.stringify(op.forwardOp));
      }

      return op;
    } catch (err) {
      logger.error(`Error popping undo: ${err.message}`);
      return null;
    }
  }

  /**
   * Pop the last redo action for a user
   */
  async popRedo(roomId, userId) {
    if (!roomId || !userId) return null;
    const redis = getRedisClient();
    const undoKey = `undo:${roomId}:${userId}`;
    const redoKey = `redo:${roomId}:${userId}`;

    try {
      const raw = await redis.lpop(redoKey);
      if (!raw) return null;

      const op = typeof raw === 'string' ? JSON.parse(raw) : raw;

      // Push inverse back onto undo stack
      if (op.inverseOp) {
        await redis.lpush(undoKey, JSON.stringify(op.inverseOp));
      }

      return op;
    } catch (err) {
      logger.error(`Error popping redo: ${err.message}`);
      return null;
    }
  }

  /**
   * Clear stacks for a room or user
   */
  async clearUser(roomId, userId) {
    const redis = getRedisClient();
    await redis.del(`undo:${roomId}:${userId}`);
    await redis.del(`redo:${roomId}:${userId}`);
  }
}

module.exports = new UndoRedoManager();
