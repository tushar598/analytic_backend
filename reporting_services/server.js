import connectDB from "./src/config/db.js";
import app from "./src/app.js";
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

connectDB(MONGO_URI).catch((err) => {
  console.error("Failed to connect to MongoDB", err);
  process.exit(1);
});



const server = app.listen(PORT, () =>
  console.log(`Reporting service listening on ${PORT}`)
);

process.on("SIGINT", () => {
  console.log("Shutting down reporting service...");
  server.close(() => process.exit(0));
});
