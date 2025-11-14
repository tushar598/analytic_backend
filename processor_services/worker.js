import dotenv from "dotenv";
import { Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import connectDB from "./src/config/db.js";
import Event from "./src/model/Event.model.js";

dotenv.config();
const redisOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

const connection = new IORedis(redisOptions);
const queueName = process.env.QUEUE_NAME || "eventQueue";
const concurrency = Number(process.env.WORKER_CONCURRENCY || 5);

async function start() {
  const MONGO_URI =
    process.env.MONGO_URI || "mongodb://localhost:27017/analytics";
  await connectDB(MONGO_URI);

  const worker = new Worker(
    queueName,
    async (job) => {
      try {
        const data = job.data;
        // sanitize and parse timestamp
        const doc = {
          site_id: data.site_id,
          event_type: data.event_type,
          path: data.path,
          user_id: data.user_id || null,
          timestamp: new Date(data.timestamp),
        };
        // Insert into MongoDB
        await Event.create(doc);
        // completed automatically
      } catch (err) {
        console.error("Error processing job", err);
        throw err;
      }
    },
    { connection: redisOptions, concurrency }
  );

  const qe = new QueueEvents(queueName, { connection: redisOptions });
  qe.on("failed", ({ jobId, failedReason }) =>
    console.error("Job failed", jobId, failedReason)
  );
  qe.on("completed", ({ jobId }) => {
    /* optionally log */
    console.log("Job completed", jobId);
  });

  worker.on("error", (err) => console.error("Worker error", err));

  console.log(
    `Worker started for queue "${queueName}" with concurrency ${concurrency}`
  );

  // graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Shutting down worker...");
    await worker.close();
    await qe.close();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
