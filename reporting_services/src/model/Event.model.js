import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    site_id: { type: String, required: true, index: true },
    event_type: { type: String, required: true },
    path: { type: String, required: true },
    user_id: { type: String, default: null },
    timestamp: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

 export const Event = mongoose.model("Event", EventSchema);


