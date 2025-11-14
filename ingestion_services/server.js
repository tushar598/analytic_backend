import dotenv from "dotenv";
import app from "./src/app.js";

dotenv.config();
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () =>
  console.log(`Ingestion service listening on port ${PORT}`)
);

// graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down ingestion service...");
  server.close(() => process.exit(0));
});
