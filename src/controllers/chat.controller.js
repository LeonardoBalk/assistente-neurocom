import { asyncHandler } from "../utils/asyncHandler.js";
import { processarChat } from "../services/chat.service.js";

export const chatRag = asyncHandler(async (req, res) => {
  const { mensagem, sessionId, user_position, gerar_perguntas } = req.body || {};
  if (!mensagem) return res.status(400).json({ erro: "Mensagem obrigatória" });

  const result = await processarChat({
    mensagem,
    sessionId,
    usuarioId: req.usuario.id,
    user_position,
    gerar_perguntas,
  });

  res.json(result);
});