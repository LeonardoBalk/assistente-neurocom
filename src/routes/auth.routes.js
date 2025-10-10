import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.js";
import { createUser, login, loginGoogleToken, me, testeSupabase } from "../controllers/auth.controller.js";

const router = Router();

router.get("/teste-supabase", testeSupabase);
router.post("/usuarios", createUser);
router.post("/login", login);
router.post("/auth/google-token", loginGoogleToken);
router.get("/me", authenticateJWT, me);

export default router;