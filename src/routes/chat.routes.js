import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.js";
import { chatRag } from "../controllers/chat.controller.js";

const router = Router();

router.post("/chat-rag", authenticateJWT, chatRag);

export default router;