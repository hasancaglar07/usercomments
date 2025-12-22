import { createClient, type RedisClientType } from "redis";
import { env } from "../env";

let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<RedisClientType> | null = null;

export function isRedisEnabled(): boolean {
  return Boolean(env.REDIS_URL);
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({ url: env.REDIS_URL });
    redisClient.on("error", (error) => {
      console.error(
        JSON.stringify({
          level: "error",
          message: "redis_error",
          error: error instanceof Error ? error.message : String(error),
        })
      );
    });
  }

  if (redisClient.isOpen) {
    return redisClient;
  }

  if (!redisConnectPromise) {
    redisConnectPromise = redisClient
      .connect()
      .then(() => redisClient as RedisClientType)
      .catch((error) => {
        console.error(
          JSON.stringify({
            level: "error",
            message: "redis_connect_failed",
            error: error instanceof Error ? error.message : String(error),
          })
        );
        redisConnectPromise = null;
        return redisClient as RedisClientType;
      });
  }

  return redisConnectPromise;
}
