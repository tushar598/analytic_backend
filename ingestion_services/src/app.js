import express from "express";
import cors from "cors";
import eventRouter from "./routes/event.route.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => res.send("Ingestion service is up"));
app.use("/event", eventRouter);

export default app;
