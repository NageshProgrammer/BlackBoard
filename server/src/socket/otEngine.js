/**
 * Operational Transformation (OT) & Conflict Resolution Engine for Collaborative Canvas
 * 
 * Supports:
 * 1. INSERT_ELEMENT: Deterministic element creation & z-indexing
 * 2. UPDATE_ELEMENT: Concurrent property-level merge (disjoint property merge + Lamport timestamp tie-breaking)
 * 3. DELETE_ELEMENT: Safe tombstone handling
 * 4. APPEND_POINTS: Continuous freehand stroke streaming
 */

class OTEngine {
  constructor() {
    // In-memory room state: roomId -> Map(elementId -> element)
    this.roomStates = new Map();
    // In-memory operation history for OT transforms: roomId -> Array<Op>
    this.roomHistories = new Map();
    // Element version vector: roomId:elementId -> versionNumber
    this.versions = new Map();
  }

  /**
   * Initialize or retrieve room state
   */
  getRoomState(roomId) {
    if (!this.roomStates.has(roomId)) {
      this.roomStates.set(roomId, new Map());
      this.roomHistories.set(roomId, []);
    }
    return this.roomStates.get(roomId);
  }

  /**
   * Load snapshot into room state (from MongoDB on room activation)
   */
  loadSnapshot(roomId, elements = []) {
    const state = this.getRoomState(roomId);
    state.clear();
    elements.forEach((el) => {
      if (el && el.id) {
        state.set(el.id, {
          ...el,
          version: el.version || 1,
          updatedAt: el.timestamp ? new Date(el.timestamp).getTime() : Date.now()
        });
        this.versions.set(`${roomId}:${el.id}`, el.version || 1);
      }
    });
  }

  /**
   * Export all active elements in a room
   */
  getElements(roomId) {
    const state = this.getRoomState(roomId);
    return Array.from(state.values()).filter((el) => !el.isDeleted);
  }

  /**
   * Get single element
   */
  getElement(roomId, elementId) {
    const state = this.getRoomState(roomId);
    return state.get(elementId) || null;
  }

  /**
   * Primary Operational Transformation Entrypoint:
   * Transforms incoming client operation against concurrent server operations
   * and applies the resolved state.
   */
  applyOperation(roomId, clientOp) {
    const state = this.getRoomState(roomId);
    const history = this.roomHistories.get(roomId) || [];
    const element = clientOp.element || {};
    const elementId = element.id;

    if (!elementId) {
      return { success: false, reason: 'Missing element ID' };
    }

    const currentVersionKey = `${roomId}:${elementId}`;
    const currentVersion = this.versions.get(currentVersionKey) || 0;
    const clientBaseVersion = clientOp.baseVersion || 0;

    let transformedOp = { ...clientOp };
    let conflictDetected = false;

    // Check if client had a stale base version
    if (clientBaseVersion < currentVersion && state.has(elementId)) {
      conflictDetected = true;
      // Perform operational transformation against intermediate operations
      transformedOp = this.transformAgainstHistory(roomId, clientOp, clientBaseVersion);
    }

    if (transformedOp.cancelled) {
      return {
        success: false,
        reason: transformedOp.reason,
        committedOp: transformedOp
      };
    }

    // Apply the transformed operation to server state
    const result = this.executeOp(roomId, transformedOp);

    // Bump version and record into history log (sliding window of 200 ops)
    const newVersion = currentVersion + 1;
    this.versions.set(currentVersionKey, newVersion);

    const committedOp = {
      ...transformedOp,
      version: newVersion,
      serverTimestamp: Date.now(),
      conflictResolved: conflictDetected
    };

    history.push(committedOp);
    if (history.length > 200) {
      history.shift();
    }

    return {
      success: true,
      committedOp,
      element: result.element,
      conflictDetected
    };
  }

  /**
   * Operational Transformation Logic
   * Finds intervening operations and resolves conflicts on overlapping properties.
   */
  transformAgainstHistory(roomId, incomingOp, clientBaseVersion) {
    const state = this.getRoomState(roomId);
    const history = this.roomHistories.get(roomId) || [];
    const existingElement = state.get(incomingOp.element.id);

    if (!existingElement) {
      return incomingOp;
    }

    // If incoming is delete, deletion wins over in-flight updates
    if (incomingOp.action === 'DELETE' || incomingOp.type === 'DELETE_ELEMENT') {
      return incomingOp;
    }

    // If existing element is already deleted, cannot update
    if (existingElement.isDeleted) {
      return {
        ...incomingOp,
        cancelled: true,
        reason: 'Element was already deleted concurrently'
      };
    }

    // Find all intervening operations for this element since client's baseVersion
    const interveningOps = history.filter(
      (op) => op.element && op.element.id === incomingOp.element.id && (op.version > clientBaseVersion)
    );

    const transformedData = { ...(incomingOp.element.data || {}) };
    const incomingTimestamp = incomingOp.timestamp || Date.now();

    for (const prevOp of interveningOps) {
      const prevData = prevOp.element?.data || {};
      const prevTimestamp = prevOp.timestamp || prevOp.serverTimestamp || 0;

      for (const key of Object.keys(prevData)) {
        if (transformedData[key] !== undefined) {
          // Both operations modified the same property 'key' -> Conflict!
          const incomingWins =
            incomingTimestamp > prevTimestamp ||
            (incomingTimestamp === prevTimestamp && (incomingOp.userId || '') >= (prevOp.userId || ''));

          if (!incomingWins) {
            transformedData[key] = prevData[key];
          }
        }
      }
    }

    return {
      ...incomingOp,
      element: {
        ...incomingOp.element,
        data: transformedData
      }
    };
  }

  /**
   * Execute transformed operation on internal room state
   */
  executeOp(roomId, op) {
    const state = this.getRoomState(roomId);
    const element = op.element;
    const elementId = element.id;

    if (op.action === 'DELETE' || op.type === 'DELETE_ELEMENT') {
      if (state.has(elementId)) {
        const existing = state.get(elementId);
        existing.isDeleted = true;
        existing.updatedAt = op.timestamp || Date.now();
        existing.updatedBy = op.userId;
        return { action: 'DELETED', element: existing };
      }
      return { action: 'NOOP', element: null };
    }

    if (op.action === 'APPEND_POINTS' && state.has(elementId)) {
      const existing = state.get(elementId);
      if (existing.type === 'stroke' && Array.isArray(op.newPoints)) {
        const points = existing.data.points || [];
        existing.data.points = points.concat(op.newPoints);
        existing.updatedAt = op.timestamp || Date.now();
        return { action: 'UPDATED', element: existing };
      }
    }

    if (state.has(elementId)) {
      // Update existing
      const existing = state.get(elementId);
      const updated = {
        ...existing,
        ...element,
        data: {
          ...(existing.data || {}),
          ...(element.data || {})
        },
        isDeleted: false,
        updatedBy: op.userId || existing.updatedBy,
        updatedAt: op.timestamp || Date.now()
      };
      state.set(elementId, updated);
      return { action: 'UPDATED', element: updated };
    } else {
      // Insert new
      const created = {
        ...element,
        isDeleted: false,
        createdBy: op.userId,
        updatedBy: op.userId,
        updatedAt: op.timestamp || Date.now()
      };
      state.set(elementId, created);
      return { action: 'INSERTED', element: created };
    }
  }

  /**
   * Reset room state
   */
  clearRoom(roomId) {
    const state = this.getRoomState(roomId);
    state.clear();
    this.roomHistories.set(roomId, []);
  }
}

module.exports = new OTEngine();
