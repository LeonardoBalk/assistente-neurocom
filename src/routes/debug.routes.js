import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.js";
import { ragSearch } from "../controllers/debug.controller.js";

const router = Router();

// Proteja esse endpoint conforme necessidade (ex.: apenas em dev)
router.get("/debug/rag-search", authenticateJWT, ragSearch);

export default router;