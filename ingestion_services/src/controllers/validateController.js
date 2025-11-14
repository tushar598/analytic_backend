import { eventProducer } from '../queue/eventProducer.js';
import { validateEvent } from '../utils/validateEvent.js';

const validateController = async (req , res) => {
    // Validate quickly (sync)
const { error, value } = validateEvent(req.body);
if (error)
  return res.status(400).json({ success: false, error: error.message });

try {

  await eventProducer(value); 

  return res.status(202).json({ success: true });
} catch (err) {
  console.error("Failed to enqueue event", err);
  return res.status(500).json({ success: false, error: "Failed to enqueue" });
}
}

export { validateController };