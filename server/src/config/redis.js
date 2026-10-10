const Redis = require('ioredis');
const logger = require('../utils/logger');

let pubClient = null;
let subClient = null;
let redisClient = null;
let isRedisAvailable = false;

// In-memory fallback if Redis is not running
class MemoryCache {
  constructor() {
    this.store = new Map();
  }
  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiry && item.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }
  async set(key, value, ex, ttlSeconds) {
    const expiry = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.store.set(key, { value, expiry });
    return 'OK';
  }
  async del(key) {
    return this.store.delete(key) ? 1 : 0;
  }
  async lpush(key, ...values) {
    const list = (await this.get(key)) || [];
    const parsed = typeof list === 'string' ? JSON.parse(list) : list;
    parsed.unshift(...values);
    await this.set(key, JSON.stringify(parsed));
    return parsed.length;
  }
  async lpop(key) {
    const list = (await this.get(key)) || [];
    const parsed = typeof list === 'string' ? JSON.parse(list) : list;
    if (parsed.length === 0) return null;
    const item = parsed.shift();
    await this.set(key, JSON.stringify(parsed));
    return item;
  }
  async rpop(key) {
    const list = (await this.get(key)) || [];
    const parsed = typeof list === 'string' ? JSON.parse(list) : list;
    if (parsed.length === 0) return null;
    const item = parsed.pop();
    await this.set(key, JSON.stringify(parsed));
    return item;
  }
  async lrange(key, start, stop) {
    const list = (await this.get(key)) || [];
    const parsed = typeof list === 'string' ? JSON.parse(list) : list;
    if (stop === -1) return parsed.slice(start);
    return parsed.slice(start, stop + 1);
  }
}

const memoryFallback = new MemoryCache();

const initRedis = () => {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);

  try {
    const clientOptions = {
      host,
      port,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn(`Redis connection retry limit reached (${times}). Falling back to in-memory adapter.`);
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      maxRetriesPerRequest: 1,
      lazyConnect: true
    };

    redisClient = new Redis(clientOptions);
    pubClient = new Redis(clientOptions);
    subClient = pubClient.duplicate();

    redisClient.connect().then(() => {
      isRedisAvailable = true;
      logger.info(`Redis Connected successfully at ${host}:${port}`);
    }).catch(err => {
      isRedisAvailable = false;
      logger.warn(`Redis connection failed (${err.message}). Using in-memory fallback store.`);
    });

    pubClient.on('error', (err) => {
      logger.debug('Redis Pub Client Error:', err.message);
    });
    subClient.on('error', (err) => {
      logger.debug('Redis Sub Client Error:', err.message);
    });

  } catch (err) {
    logger.warn(`Redis initialization error: ${err.message}. Using in-memory fallback.`);
    isRedisAvailable = false;
  }

  return { pubClient, subClient, redisClient };
};

const getRedisClient = () => {
  if (isRedisAvailable && redisClient && redisClient.status === 'ready') {
    return redisClient;
  }
  return memoryFallback;
};

module.exports = {
  initRedis,
  getRedisClient,
  isRedisConnected: () => isRedisAvailable,
  getPubSubClients: () => ({ pubClient, subClient })
};
