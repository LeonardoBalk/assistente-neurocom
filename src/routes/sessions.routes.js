import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.js";
import { create, list, updateTitle } from "../controllers/sessions.controller.js";

const router = Router();

router.post("/sessoes", authenticateJWT, create);
router.get("/sessoes", authenticateJWT, list);
router.patch("/sessoes/:id", authenticateJWT, updateTitle);

export default router;