# Website Analytics Backend

A high-performance backend system for capturing website analytics events with a fast ingestion API, asynchronous processing via Redis (local), and a reporting API that reads from MongoDB Atlas.

This project uses Node.js (Express) and follows a microservice pattern with three independent backend services:

- **ingestion_service** — FAST POST /event (validates + enqueues)
- **processor_service** — background worker (consumes queue → writes to MongoDB)
- **reporting_service** — GET /stats (aggregations)

**Note:** This setup uses local Redis and MongoDB Atlas. Docker is not used.

## Table of Contents

- [What this project implements (requirements)](#what-this-project-implements-requirements)
- [Architecture & design decision (queue)](#architecture--design-decision-queue)
- [Folder structure (final)](#folder-structure-final)
- [Database schema](#database-schema)
- [Environment variables](#environment-variables)
- [Prerequisites](#prerequisites)
- [Step-by-step setup & run (no Docker)](#step-by-step-setup--run-no-docker)
- [API endpoints & curl examples](#api-endpoints--curl-examples)
- [Postman / test plan summary](#postman--test-plan-summary)
- [How the queue & worker operate (detailed)](#how-the-queue--worker-operate-detailed)
- [Aggregation logic (reporting)](#aggregation-logic-reporting)
- [Recommended indexes](#recommended-indexes)
- [Scaling, optimizations & production notes](#scaling-optimizations--production-notes)
- [Troubleshooting & common issues](#troubleshooting--common-issues)
- [Deliverable checklist (for submission)](#deliverable-checklist-for-submission)

## What this project implements (requirements)

The system satisfies the PDF requirements:

- Very fast ingestion API (POST /event) — validates the payload and immediately enqueues the event to Redis (BullMQ). Client is not blocked by DB writes.
- Background processor — consumes jobs from Redis, processes them, and stores normalized events in MongoDB Atlas.
- Reporting API (GET /stats) — returns aggregated statistics (total views, unique users, top paths) for a site_id and optional date.
- Clear deliverables: source code, README describing architecture, DB schema, setup instructions, and example curl commands.

## Architecture & design decision (queue)

### Overview

```
Client → ingestion_service → Redis (BullMQ queue) → processor_service (worker) → MongoDB Atlas → reporting_service
```

### Why Redis + BullMQ?

- **Speed:** enqueue is an in-memory, O(1) operation — ideal for a fast ingestion endpoint.
- **Reliability:** BullMQ supports retries, backoff, job persistence, and monitoring hooks.
- **Simplicity for local dev:** Redis is easy to run locally; BullMQ integrates nicely with Node.js.
- **Scalability:** Multiple worker instances can concurrently process the queue; producer and consumers are decoupled.

### Behavioral decision

The ingestion endpoint does not write to the database. It only validates and enqueues, returning success immediately (HTTP 202 or 200 depending on your implementation). The worker is responsible for final writes.

## Folder structure (final)

```
analytics-backend/
│
├── ingestion_service/          # FAST API (POST /event)
│   ├── src/
│   │   ├── app.js
│   │   ├── controllers/
│   │   │   └── eventController.js
│   │   ├── queue/
│   │   │   └── eventProducer.js
│   │   ├── routes/
│   │   │   └── event.route.js
│   │   └── utils/
│   │       └── validateEvent.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── processor_service/          # Worker (consumes queue → MongoDB)
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── models/
│   │   │   └── Event.model.js
│   ├── worker.js
│   ├── package.json
│   └── .env
│
├── reporting_service/          # GET /stats (aggregations)
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── controllers/
│   │   │   └── eventController.js
│   │   ├── models/
│   │   │   └── Event.model.js
│   │   └── routes/
│   │       └── stats.route.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
└── README.md
```

## Database schema

All events are persisted into a single MongoDB collection: `events`.

### Document shape

```json
{
    "_id": ObjectId,
    "site_id": "site-abc-123",
    "event_type": "page_view",
    "path": "/pricing",
    "user_id": "user-xyz-789",
    "timestamp": ISODate("2025-11-12T19:30:01Z"),
    "createdAt": ISODate(...),
    "updatedAt": ISODate(...)
}
```

### Notes

- `timestamp` represents the time the client reported the event (stored as UTC).
- `createdAt` / `updatedAt` are maintained by Mongoose (timestamps: true).

## Environment variables

Create `.env` files (do not commit secrets). Example values below.

### ingestion_service/.env

```env
PORT=3000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
QUEUE_NAME=eventQueue
```

### processor_service/.env

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/analytics?retryWrites=true&w=majority
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
QUEUE_NAME=eventQueue
WORKER_CONCURRENCY=5
```

### reporting_service/.env

```env
PORT=4000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/analytics?retryWrites=true&w=majority
```

Replace `<username>`, `<password>`, `<cluster-url>` with your MongoDB Atlas credentials. Ensure your Atlas network access allows your IP.

## Prerequisites

- Node.js v16+ (recommend v18) and npm
- Redis installed & running locally (default 127.0.0.1:6379)
    - macOS: `brew install redis` → `brew services start redis` or `redis-server`
    - Linux/Windows: follow platform instructions
- MongoDB Atlas cluster (free tier is fine)
    - Add your machine's public IP to Atlas Network Access
    - Create DB user with password and note connection string

## Step-by-step setup & run (no Docker)

Run these commands from `analytics-backend/` root.

### 1. Install dependencies

```bash
# ingestion
cd ingestion_service
npm install

# processor
cd ../processor_service
npm install

# reporting
cd ../reporting_service
npm install

# return to project root
cd ..
```

### 2. Start local Redis

```bash
redis-server
# or if installed via homebrew
brew services start redis
```

Verify:

```bash
redis-cli ping   # should return PONG
```

### 3. Configure MongoDB Atlas

- Add your IP to Atlas network whitelist.
- Copy connection string and set `MONGO_URI` in `.env` files for `processor_service` and `reporting_service`.

### 4. Start services (order recommended)

Start processor (worker) first so queued jobs are consumed:

```bash
cd processor_service
node start
# or for dev:
npm run dev
```

Start ingestion service:

```bash
cd ../ingestion_service
node start
# or npm run dev
```

Start reporting service:

```bash
cd ../reporting_service
node start
# or npm run dev
```

## API endpoints & curl examples

### 1) Ingestion — POST /event

**URL**

```
POST http://localhost:3000/event
```

**Body (JSON)**

```json
{
    "site_id": "site-abc-123",
    "event_type": "page_view",
    "path": "/pricing",
    "user_id": "user-xyz-789",
    "timestamp": "2025-11-12T19:30:01Z"
}
```

**curl**

```bash
curl -X POST http://localhost:3000/event \
    -H "Content-Type: application/json" \
    -d '{
        "site_id":"site-abc-123",
        "event_type":"page_view",
        "path":"/pricing",
        "user_id":"user-xyz-789",
        "timestamp":"2025-11-12T19:30:01Z"
    }'
```

**Expected:** HTTP 202 (Accepted) or 200 with `{ "success": true }` — ingestion enqueues and returns immediately.

### 2) Reporting — GET /stats

**URL**

```
GET http://localhost:4000/stats?site_id=site-abc-123&date=2025-11-12
```

- `date` is optional (YYYY-MM-DD, interpreted as UTC day)

**curl**

```bash
curl "http://localhost:4000/stats?site_id=site-abc-123&date=2025-11-12"
```

**Example response**

```json
{
    "site_id": "site-abc-123",
    "date": "2025-11-12",
    "total_views": 1450,
    "unique_users": 212,
    "top_paths": [
        { "path": "/pricing", "views": 700 },
        { "path": "/blog/post-1", "views": 500 },
        { "path": "/", "views": 250 }
    ]
}
```

## Postman / test plan summary

Suggested Postman tests (or use runner/script):

1. POST /event — valid payload → expect success.
2. POST /event — missing site_id → expect 400 validation error.
3. POST /event — invalid timestamp → expect 400.
4. Bulk ingestion — use Postman Runner to send 100 events → all responses success.
5. Verify worker — check MongoDB Atlas: `db.events.find({site_id:"..."})`.
6. GET /stats — ensure counts match inserted events (optionally filtered by date).

I can provide an exportable Postman collection file on request.

## How the queue & worker operate (detailed)

### Producer (ingestion_service)

1. Validates payload with Joi (or custom validator).
2. Calls `queue.add('ingest-event', payload, options)` to BullMQ (connected to local Redis).
3. Redis acknowledges quickly; request completes immediately.

### Worker (processor_service)

1. BullMQ Worker listens to `eventQueue`.
2. For each job it:
     - Parses `job.data`.
     - Normalizes and converts timestamp to a Date object.
     - Writes a document to MongoDB via Mongoose (`Event.create()`).
3. Worker runs with configurable `WORKER_CONCURRENCY` and logs job results/failures.

### Why this is fast

Enqueue to Redis is in-memory and non-blocking; DB writes are deferred to worker processes.

## Aggregation logic (reporting)

GET /stats runs a single MongoDB aggregation pipeline (using `$facet`) to compute:

- `total_views` — count of documents
- `unique_users` — count of distinct `user_id` (`user_id != null`)
- `top_paths` — top N paths sorted by view count

This single pipeline reduces DB round-trips and is efficient with proper indexes.

## Recommended indexes

Run these in MongoDB (Atlas / shell / migration):

```javascript
db.events.createIndex({ site_id: 1, timestamp: 1 });
db.events.createIndex({ timestamp: 1 });
db.events.createIndex({ site_id: 1, path: 1 });
```

These indexes speed up date-range queries, faceted aggregation, and top-path grouping.

## Scaling, optimizations & production notes

- **Scale workers horizontally:** run multiple processor_service instances for higher throughput.
- **Batched writes:** buffer jobs and `insertMany()` to reduce DB write overhead (useful at very high QPS).
- **Cache reporting results:** cache frequently requested stats in Redis with TTL.
- **Observability:** add metrics (queue length, job latency), logs, and health checks.
- **Durability:** enable Redis persistence (AOF) if losing queued jobs is unacceptable.
- **Security:** add authentication for ingestion/reporting endpoints, rate limiting, and TLS.
- **Backpressure:** monitor queue size; if backlog grows, scale workers or throttle producers.

## Troubleshooting & common issues

- **`redis-cli ping` returns no PONG**  
    Ensure Redis is started and listening on the correct host/port. Check `.env`.

- **Worker reports DB connection error**  
    Check `MONGO_URI` and Atlas IP whitelist. Verify username/password.

- **Events are enqueued but not in MongoDB**  
    Ensure processor_service is running and listening to the same `QUEUE_NAME`. Inspect worker logs.

- **Timestamps parse incorrectly**  
    Use ISO 8601 format with Z (UTC), e.g., `2025-11-12T19:30:01Z`.

- **Large backlog**  
    Increase worker concurrency or run additional worker instances. Consider batched inserts.

## Deliverable checklist (for submission)

- [ ] Source code for ingestion_service/, processor_service/, reporting_service/
- [ ] This README.md (architecture decision, DB schema, setup instructions, API usage)
- [ ] Example curl commands for POST /event and GET /stats (above)
- [ ] Postman collection (optional — attach to repo if you created it)
- [ ] Notes on scaling/optimization (above)
