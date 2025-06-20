const { createClient } = require("redis");
const logger = require("./logger");

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD,
  family: 0, // Enable dual stack (IPv4 + IPv6) for Railway compatibility
});

redisClient.on("error", (err) => logger.error("Redis Client Error", err));

(async () => {
  try {
    await redisClient.connect();
    logger.info("Connected to Redis for caching");
  } catch (err) {
    logger.error("Failed to connect to Redis:", err);
  }
})();

async function getJSON(key) {
  const value = await redisClient.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

async function setJSON(key, value, ttlSeconds = 3600) {
  await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
}

module.exports = {
  redisClient,
  getJSON,
  setJSON,
};
