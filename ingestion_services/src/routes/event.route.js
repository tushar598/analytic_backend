import { Router } from "express";
import { validateController } from "../controllers/validateController.js";
const router = Router();

router.post("/", validateController);

export default router;
