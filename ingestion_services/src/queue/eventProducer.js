import {Queue} from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
});

const queueName = process.env.QUEUE_NAME || "eventQueue";
const queue = new Queue(queueName, { connection });

 export const eventProducer = async (event) => {
  // small job options; short TTL
  await queue.add("ingest-event", event, {
    removeOnComplete: true,
    removeOnFail: true,
  });
};

