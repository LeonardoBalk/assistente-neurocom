import { asyncHandler } from "../utils/asyncHandler.js";
import { getSessionIfOwned } from "../repositories/session.repository.js";
import { listHistoryRaw } from "../repositories/history.repository.js";

export const getChatHistorico = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const sess = await getSessionIfOwned(sessionId, req.usuario.id);
  if (!sess) return res.status(404).json({ erro: "Sessão não encontrada" });
  const mensagens = await listHistoryRaw(req.usuario.id, sessionId);
  res.json({ mensagens });
});