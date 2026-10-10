/**
 * BoardCollab High-Concurrency Load Simulation Script
 * Simulates 20-50 concurrent users drawing strokes and moving shapes
 * to measure round-trip WebSocket synchronization latency and server batching throughput.
 */

const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const NUM_USERS = parseInt(process.env.USERS || '20', 10);
const TEST_ROOM = process.env.ROOM_ID || 'load-test-room';
const TEST_DURATION_MS = parseInt(process.env.DURATION || '15000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_boardcollab_jwt_key_2026';

console.log(`=======================================================`);
console.log(` Starting BoardCollab Concurrency Benchmark`);
console.log(` Target Server:  ${SERVER_URL}`);
console.log(` Room ID:        ${TEST_ROOM}`);
console.log(` Virtual Users:  ${NUM_USERS}`);
console.log(` Test Duration:  ${TEST_DURATION_MS / 1000}s`);
console.log(`=======================================================\n`);

const latencies = [];
let totalOpsSent = 0;
let totalOpsReceived = 0;
const sockets = [];

const createClient = (index) => {
  const userId = `user_${index}_${Math.floor(Math.random() * 10000)}`;
  const username = `Tester_${index}`;
  const token = jwt.sign(
    { id: userId, username, color: '#3B82F6', isGuest: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false
  });

  socket.on('connect', () => {
    socket.emit('join-room', { roomId: TEST_ROOM }, (res) => {
      // Joined room
    });
  });

  socket.on('element-synced', (data) => {
    totalOpsReceived++;
    if (data.op && data.op.timestamp) {
      const latency = Date.now() - data.op.timestamp;
      if (latency >= 0 && latency < 5000) {
        latencies.push(latency);
      }
    }
  });

  return { socket, userId, index };
};

// Launch virtual users
for (let i = 0; i < NUM_USERS; i++) {
  sockets.push(createClient(i));
}

// Generate continuous drawing activity
const interval = setInterval(() => {
  sockets.forEach(({ socket, userId, index }) => {
    if (!socket.connected) return;

    const opId = `load_el_${index}_${Date.now()}_${Math.random()}`;
    const payload = {
      type: 'element-update',
      action: 'UPDATE',
      element: {
        id: opId,
        type: 'stroke',
        data: {
          points: [
            { x: Math.random() * 800, y: Math.random() * 600 },
            { x: Math.random() * 800, y: Math.random() * 600 }
          ],
          stroke: '#3B82F6',
          strokeWidth: 3
        }
      },
      isNew: true,
      timestamp: Date.now()
    };

    totalOpsSent++;
    socket.emit('draw-stroke', payload);
  });
}, 200); // Send an operation every 200ms per client

// Finish after test duration
setTimeout(() => {
  clearInterval(interval);

  console.log(`\n--- BENCHMARK RESULTS ---`);
  console.log(`Total Operations Sent:     ${totalOpsSent}`);
  console.log(`Total Operations Received: ${totalOpsReceived}`);

  if (latencies.length > 0) {
    latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const min = latencies[0];
    const max = latencies[latencies.length - 1];

    console.log(`Sync Latency Min:          ${min} ms`);
    console.log(`Sync Latency Avg:          ${avg.toFixed(2)} ms`);
    console.log(`Sync Latency P50 (Median): ${p50} ms`);
    console.log(`Sync Latency P95:          ${p95} ms`);
    console.log(`Sync Latency P99:          ${p99} ms`);
    console.log(`Sync Latency Max:          ${max} ms`);
    console.log(`Target SLA (< 100ms):      ${p95 < 100 ? 'PASSED (STABLE)' : 'OPTIMIZATION NEEDED'}`);
  } else {
    console.log(`No latencies recorded (server might not be running at ${SERVER_URL}).`);
  }

  sockets.forEach(({ socket }) => socket.disconnect());
  process.exit(0);
}, TEST_DURATION_MS);
