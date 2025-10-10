import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createSession,
  getSessionIfOwned,
  listSessionsOrdered,
  renameSession,
} from "../repositories/session.repository.js";

export const create = asyncHandler(async (req, res) => {
  const { titulo } = req.body || {};
  const nova = await createSession(req.usuario.id, titulo || null);
  res.status(201).json({ sessao: nova });
});

export const list = asyncHandler(async (req, res) => {
  const sessoes = await listSessionsOrdered(req.usuario.id);
  res.json({ sessoes });
});

export const updateTitle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { titulo } = req.body || {};
  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ erro: "Título é obrigatório" });
  }
  const sess = await getSessionIfOwned(id, req.usuario.id);
  if (!sess) return res.status(404).json({ erro: "Sessão não encontrada" });

  const data = await renameSession(id, req.usuario.id, titulo);
  res.json({ sessao: data });
});