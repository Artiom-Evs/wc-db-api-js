import { createClient } from "redis";

const url = process.env.REDIS_URL;

if (!url)
    throw new Error(`"REDIS_URL" environment variable is required.`);

const redis = createClient({ url });

redis.on("error", (error) => {
    console.error("Redis error:", error);
});

process.once("SIGINT", () => {
    redis.quit();
});

process.once("SIGTERM", () => {
    redis.quit();
});

redis.connect()
    .then(() => {
        console.log("Redis connected.");
    })
    .catch((error) => {
        console.error("Redis connection error:", error);
    });

export default redis;
