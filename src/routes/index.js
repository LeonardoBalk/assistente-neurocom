import { Router } from "express";
import authRoutes from "./auth.routes.js";
import sessionsRoutes from "./sessions.routes.js";
import historyRoutes from "./history.routes.js";
import chatRoutes from "./chat.routes.js";
import debugRoutes from "./debug.routes.js";

const router = Router();

router.use(authRoutes);
router.use(sessionsRoutes);
router.use(historyRoutes);
router.use(chatRoutes);
router.use(debugRoutes);

export default router;