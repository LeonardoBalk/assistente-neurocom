import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.js";
import { getChatHistorico } from "../controllers/history.controller.js";

const router = Router();

router.get("/chat-historico/:sessionId", authenticateJWT, getChatHistorico);

export default router;