const Redis = require("ioredis");

const redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

redis.on("error", (err) => {
    console.error("Redis connection error:", err);
});

redis.on("connect", () => {
    console.log("✅ Redis connected successfully");
});

module.exports = {
    redis,
    get: async (key) => {
        try {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error(`Redis Get Error [${key}]:`, err);
            return null;
        }
    },
    set: async (key, value, ttlSeconds = 3600) => {
        try {
            if (ttlSeconds) {
                await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
            } else {
                await redis.set(key, JSON.stringify(value));
            }
        } catch (err) {
            console.error(`Redis Set Error [${key}]:`, err);
        }
    },
    // For binary data like PDF chunks
    getBuffer: async (key) => {
        try {
            return await redis.getBuffer(key);
        } catch (err) {
            console.error(`Redis GetBuffer Error [${key}]:`, err);
            return null;
        }
    },
    setBuffer: async (key, buffer, ttlSeconds = 3600) => {
        try {
            if (ttlSeconds) {
                await redis.set(key, buffer, "EX", ttlSeconds);
            } else {
                await redis.set(key, buffer);
            }
        } catch (err) {
            console.error(`Redis SetBuffer Error [${key}]:`, err);
        }
    },
    del: async (key) => {
        try {
            await redis.del(key);
        } catch (err) {
            console.error(`Redis Del Error [${key}]:`, err);
        }
    }
};
