const batchWriter = require('../src/socket/batchWriter');

describe('BatchWriter Persistence Queue', () => {
  afterAll(async () => {
    await batchWriter.destroy();
  });

  test('should queue updates and report accurate pending stats', () => {
    const roomId = 'batch-test-room';

    batchWriter.queueUpdate(roomId, {
      id: 'el-1',
      type: 'rectangle',
      data: { x: 10, y: 10 }
    });

    batchWriter.queueUpdate(roomId, {
      id: 'el-2',
      type: 'circle',
      data: { radius: 15 }
    });

    const stats = batchWriter.getStats();
    expect(stats.pendingCount).toBeGreaterThanOrEqual(2);
    expect(stats.activeRooms).toBeGreaterThanOrEqual(1);
  });
});
