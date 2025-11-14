import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import statsRouter from "./routes/stats.route.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Reporting service is up"));
app.use("/stats", statsRouter);

export default app;
