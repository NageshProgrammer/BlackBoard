const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const logger = require('../utils/logger');

// In-memory fallback map if MongoDB is unreachable
const memoryRooms = new Map();

// Helper to get or create fallback room
const getFallbackRoom = (roomId, defaultName = 'Whiteboard Session') => {
  if (!memoryRooms.has(roomId)) {
    memoryRooms.set(roomId, {
      roomId,
      name: defaultName,
      elements: [],
      users: [],
      lastUpdated: new Date()
    });
  }
  return memoryRooms.get(roomId);
};

// @desc    Create a new collaborative room
// @route   POST /api/rooms
exports.createRoom = async (req, res) => {
  try {
    const { name, isPrivate, passcode } = req.body;
    const roomId = uuidv4().substring(0, 8);
    const userId = req.user ? req.user._id || req.user.id : null;

    let session;
    try {
      session = await Session.create({
        roomId,
        name: name || `Board ${roomId}`,
        isPrivate: Boolean(isPrivate),
        passcode: passcode || '',
        owner: userId && !req.user?.isGuest ? userId : null,
        elements: [],
        users: []
      });
    } catch (dbErr) {
      logger.warn(`Mongo write failed, using memory fallback: ${dbErr.message}`);
      session = {
        roomId,
        name: name || `Board ${roomId}`,
        isPrivate: Boolean(isPrivate),
        passcode: passcode || '',
        elements: [],
        users: [],
        lastUpdated: new Date()
      };
      memoryRooms.set(roomId, session);
    }

    res.status(201).json({
      success: true,
      room: {
        roomId: session.roomId,
        name: session.name,
        isPrivate: session.isPrivate,
        createdAt: session.createdAt || new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get room state / verify access
// @route   GET /api/rooms/:id
exports.getRoom = async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { passcode } = req.query;

    let session = null;
    try {
      session = await Session.findOne({ roomId });
    } catch (err) {
      logger.warn(`Mongo query error: ${err.message}. Checking memory store.`);
    }

    if (!session) {
      session = memoryRooms.get(roomId);
    }

    // Auto-create room if it does not exist yet (makes direct join link easy to use)
    if (!session) {
      try {
        session = await Session.create({
          roomId,
          name: `Board ${roomId}`,
          elements: [],
          users: []
        });
      } catch {
        session = getFallbackRoom(roomId);
      }
    }

    // Passcode check if room is private
    if (session.isPrivate && session.passcode) {
      if (session.passcode !== passcode) {
        return res.status(403).json({
          success: false,
          requiresPasscode: true,
          message: 'Passcode required or incorrect'
        });
      }
    }

    // Active elements filtering (exclude deleted)
    const activeElements = (session.elements || []).filter(el => !el.isDeleted);

    res.json({
      success: true,
      room: {
        roomId: session.roomId,
        name: session.name,
        isPrivate: session.isPrivate,
        owner: session.owner,
        elementCount: activeElements.length,
        elements: activeElements,
        lastUpdated: session.lastUpdated
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    List rooms
// @route   GET /api/rooms
exports.listRooms = async (req, res) => {
  try {
    let rooms = [];
    try {
      rooms = await Session.find({ isPrivate: false })
        .select('roomId name lastUpdated elements createdAt')
        .sort({ lastUpdated: -1 })
        .limit(20);
    } catch {
      rooms = Array.from(memoryRooms.values()).map(r => ({
        roomId: r.roomId,
        name: r.name,
        lastUpdated: r.lastUpdated,
        elementCount: r.elements?.length || 0
      }));
    }

    res.json({
      success: true,
      rooms: rooms.map(r => ({
        roomId: r.roomId,
        name: r.name,
        elementCount: r.elements ? r.elements.length : (r.elementCount || 0),
        lastUpdated: r.lastUpdated
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export room elements (JSON, SVG metadata, summary)
// @route   POST /api/rooms/:id/export
exports.exportRoom = async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { format = 'json' } = req.body;

    let session = null;
    try {
      session = await Session.findOne({ roomId });
    } catch {
      session = memoryRooms.get(roomId);
    }

    if (!session) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const elements = (session.elements || []).filter(el => !el.isDeleted);

    if (format === 'svg') {
      // Build lightweight server-side SVG representation
      let svgElements = '';
      let minX = 0, minY = 0, maxX = 1920, maxY = 1080;

      elements.forEach(el => {
        const d = el.data || {};
        if (el.type === 'rectangle') {
          svgElements += `<rect x="${d.x || 0}" y="${d.y || 0}" width="${d.width || 100}" height="${d.height || 100}" fill="${d.fill || 'transparent'}" stroke="${d.stroke || '#000'}" stroke-width="${d.strokeWidth || 2}" />\n`;
        } else if (el.type === 'circle') {
          const r = (d.radius || (d.width ? d.width / 2 : 50));
          svgElements += `<circle cx="${(d.x || 0) + r}" cy="${(d.y || 0) + r}" r="${r}" fill="${d.fill || 'transparent'}" stroke="${d.stroke || '#000'}" stroke-width="${d.strokeWidth || 2}" />\n`;
        } else if (el.type === 'stroke' && Array.isArray(d.points) && d.points.length >= 2) {
          const pathStr = d.points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
          svgElements += `<path d="${pathStr}" fill="none" stroke="${d.stroke || '#000'}" stroke-width="${d.strokeWidth || 2}" stroke-linecap="round" stroke-linejoin="round" />\n`;
        } else if (el.type === 'text') {
          svgElements += `<text x="${d.x || 0}" y="${(d.y || 0) + (d.fontSize || 16)}" fill="${d.fill || '#000'}" font-size="${d.fontSize || 16}" font-family="sans-serif">${d.text || ''}</text>\n`;
        }
      });

      const svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
        <rect width="100%" height="100%" fill="#ffffff"/>
        ${svgElements}
      </svg>`;

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="board-${roomId}.svg"`);
      return res.send(svgData);
    }

    // Default JSON export
    res.json({
      success: true,
      metadata: {
        roomId: session.roomId,
        name: session.name,
        exportedAt: new Date().toISOString(),
        totalElements: elements.length
      },
      elements
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
