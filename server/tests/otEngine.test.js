const otEngine = require('../src/socket/otEngine');

describe('Operational Transformation & Conflict Resolution Engine', () => {
  const roomId = 'test-room-ot';

  beforeEach(() => {
    otEngine.clearRoom(roomId);
  });

  test('should insert new element cleanly', () => {
    const op = {
      type: 'INSERT_ELEMENT',
      element: {
        id: 'rect-1',
        type: 'rectangle',
        data: { x: 50, y: 50, width: 100, height: 100, fill: '#ff0000' }
      },
      userId: 'user-1'
    };

    const res = otEngine.applyOperation(roomId, op);
    expect(res.success).toBe(true);
    expect(res.element.id).toBe('rect-1');
    expect(res.element.data.x).toBe(50);
  });

  test('should merge disjoint concurrent properties on same element without loss', () => {
    // 1. Initial element
    otEngine.applyOperation(roomId, {
      type: 'INSERT_ELEMENT',
      element: {
        id: 'shape-10',
        type: 'rectangle',
        data: { x: 100, y: 100, fill: '#000000', stroke: '#ffffff' }
      },
      userId: 'user-initial'
    });

    // 2. User A updates fill color at t=100
    const opA = {
      type: 'UPDATE_ELEMENT',
      element: {
        id: 'shape-10',
        data: { fill: '#3B82F6' } // Blue
      },
      baseVersion: 1,
      userId: 'user-a',
      timestamp: 100
    };
    otEngine.applyOperation(roomId, opA);

    // 3. User B concurrently updates position x/y at t=101 with stale baseVersion = 1
    const opB = {
      type: 'UPDATE_ELEMENT',
      element: {
        id: 'shape-10',
        data: { x: 250, y: 350 }
      },
      baseVersion: 1, // Stale base version triggers OT transform!
      userId: 'user-b',
      timestamp: 101
    };

    const resB = otEngine.applyOperation(roomId, opB);
    expect(resB.success).toBe(true);
    expect(resB.conflictDetected).toBe(true);

    // Verify merged result contains both User A's fill and User B's new position!
    const finalElement = otEngine.getElement(roomId, 'shape-10');
    expect(finalElement.data.fill).toBe('#3B82F6'); // Preserved from User A
    expect(finalElement.data.x).toBe(250);        // Merged from User B
    expect(finalElement.data.y).toBe(350);        // Merged from User B
  });

  test('should resolve direct property collision deterministically using timestamps', () => {
    otEngine.applyOperation(roomId, {
      type: 'INSERT_ELEMENT',
      element: { id: 'colliding-rect', type: 'rectangle', data: { x: 0, y: 0 } },
      userId: 'user-1'
    });

    // User A changes x to 100 at timestamp 1000
    otEngine.applyOperation(roomId, {
      type: 'UPDATE_ELEMENT',
      element: { id: 'colliding-rect', data: { x: 100 } },
      baseVersion: 1,
      userId: 'user-a',
      timestamp: 1000
    });

    // User B changes x to 200 at timestamp 2000 (newer)
    const resB = otEngine.applyOperation(roomId, {
      type: 'UPDATE_ELEMENT',
      element: { id: 'colliding-rect', data: { x: 200 } },
      baseVersion: 1, // Stale
      userId: 'user-b',
      timestamp: 2000
    });

    expect(resB.success).toBe(true);
    const finalElement = otEngine.getElement(roomId, 'colliding-rect');
    expect(finalElement.data.x).toBe(200); // Newer timestamp wins
  });

  test('should safely tombstone deleted element and reject updates to deleted item', () => {
    otEngine.applyOperation(roomId, {
      type: 'INSERT_ELEMENT',
      element: { id: 'del-item', type: 'circle', data: { radius: 20 } },
      userId: 'user-1'
    });

    // User 1 deletes
    otEngine.applyOperation(roomId, {
      action: 'DELETE',
      element: { id: 'del-item' },
      userId: 'user-1'
    });

    const activeList = otEngine.getElements(roomId);
    expect(activeList.find(el => el.id === 'del-item')).toBeUndefined();

    // User 2 concurrently tries to update deleted item
    const res = otEngine.applyOperation(roomId, {
      type: 'UPDATE_ELEMENT',
      element: { id: 'del-item', data: { radius: 40 } },
      baseVersion: 1,
      userId: 'user-2'
    });

    expect(res.committedOp.cancelled).toBe(true);
  });
});
