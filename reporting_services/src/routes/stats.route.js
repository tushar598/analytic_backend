import { Router } from "express";
import eventController from "../controller/eventController.js";

const router = Router();
router.get("/", eventController);

export default router;
