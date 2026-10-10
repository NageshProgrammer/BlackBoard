const mongoose = require('mongoose');
const Session = require('../models/Session');
const logger = require('../utils/logger');

class BatchWriter {
  constructor() {
    this.pendingUpdates = new Map(); // roomId -> Map(elementId -> element)
    this.batchInterval = parseInt(process.env.BATCH_INTERVAL_MS || '3000', 10);
    this.maxBatchSize = parseInt(process.env.BATCH_MAX_SIZE || '50', 10);
    this.timer = null;
    this.stats = {
      totalFlushes: 0,
      totalElementsSaved: 0,
      lastFlushTime: null,
      errors: 0
    };

    this.startBatchTimer();
  }

  startBatchTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.flushAll();
    }, this.batchInterval);
  }

  /**
   * Queue an element update or insert for batched write
   */
  queueUpdate(roomId, element) {
    if (!this.pendingUpdates.has(roomId)) {
      this.pendingUpdates.set(roomId, new Map());
    }

    const roomQueue = this.pendingUpdates.get(roomId);
    roomQueue.set(element.id, element);

    // If room queue exceeds threshold, trigger immediate flush for this room
    if (roomQueue.size >= this.maxBatchSize) {
      this.flushRoom(roomId);
    }
  }

  /**
   * Queue element deletion
   */
  queueDelete(roomId, elementId) {
    if (!this.pendingUpdates.has(roomId)) {
      this.pendingUpdates.set(roomId, new Map());
    }
    const roomQueue = this.pendingUpdates.get(roomId);
    roomQueue.set(elementId, { id: elementId, isDeleted: true });

    if (roomQueue.size >= this.maxBatchSize) {
      this.flushRoom(roomId);
    }
  }

  /**
   * Flush pending updates for a specific room to MongoDB
   */
  async flushRoom(roomId) {
    const roomQueue = this.pendingUpdates.get(roomId);
    if (!roomQueue || roomQueue.size === 0) return;

    // Snapshot and clear the queue immediately to avoid race conditions
    const elementsToSave = Array.from(roomQueue.values());
    this.pendingUpdates.delete(roomId);

    // If MongoDB is not connected, record flush stats and return smoothly
    if (mongoose.connection.readyState !== 1) {
      this.stats.totalFlushes += 1;
      this.stats.totalElementsSaved += elementsToSave.length;
      this.stats.lastFlushTime = new Date().toISOString();
      return;
    }

    const startTime = Date.now();

    try {
      // Find the session in MongoDB
      const session = await Session.findOne({ roomId });
      if (!session) {
        logger.debug(`Session ${roomId} not found during batch write.`);
        return;
      }

      // Merge elementsToSave into session.elements
      const existingElementsMap = new Map();
      session.elements.forEach((el) => existingElementsMap.set(el.id, el));

      for (const item of elementsToSave) {
        if (item.isDeleted) {
          const existing = existingElementsMap.get(item.id);
          if (existing) {
            existing.isDeleted = true;
          }
        } else {
          existingElementsMap.set(item.id, {
            id: item.id,
            type: item.type,
            data: item.data,
            version: item.version || 1,
            updatedBy: item.updatedBy,
            timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
            isDeleted: false
          });
        }
      }

      session.elements = Array.from(existingElementsMap.values());
      session.lastUpdated = new Date();
      await session.save();

      const duration = Date.now() - startTime;
      this.stats.totalFlushes += 1;
      this.stats.totalElementsSaved += elementsToSave.length;
      this.stats.lastFlushTime = new Date().toISOString();

      logger.debug(`[BatchWriter] Flushed ${elementsToSave.length} elements for room ${roomId} in ${duration}ms`);
    } catch (err) {
      this.stats.errors += 1;
      logger.error(`[BatchWriter] Error saving batch for room ${roomId}: ${err.message}`);

      // Re-queue items that failed
      if (!this.pendingUpdates.has(roomId)) {
        this.pendingUpdates.set(roomId, new Map());
      }
      const currentQueue = this.pendingUpdates.get(roomId);
      elementsToSave.forEach((el) => {
        if (!currentQueue.has(el.id)) {
          currentQueue.set(el.id, el);
        }
      });
    }
  }

  /**
   * Flush all rooms
   */
  async flushAll() {
    const roomIds = Array.from(this.pendingUpdates.keys());
    if (roomIds.length === 0) return;

    for (const roomId of roomIds) {
      await this.flushRoom(roomId);
    }
  }

  /**
   * Get current batch writer statistics
   */
  getStats() {
    let pendingCount = 0;
    this.pendingUpdates.forEach((queue) => {
      pendingCount += queue.size;
    });

    return {
      ...this.stats,
      pendingCount,
      activeRooms: this.pendingUpdates.size
    };
  }

  /**
   * Cleanup timer on server stop
   */
  async destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flushAll();
  }
}

module.exports = new BatchWriter();
