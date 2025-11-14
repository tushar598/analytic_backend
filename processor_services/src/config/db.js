import mongoose from "mongoose";

const connectDB = async (uri) => {
  const opts = {
    autoIndex: true,
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000,
  };
  await mongoose.connect(uri, opts);
  console.log("Processor connected to MongoDB");
};
export default connectDB;
