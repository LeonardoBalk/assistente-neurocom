import { asyncHandler } from "../utils/asyncHandler.js";
import { loginLocal, registerLocal, loginWithGoogleIdToken } from "../services/auth.service.js";
import { getUserPublicById } from "../repositories/user.repository.js";
import { supabase } from "../clients/supabase.js";

export const createUser = asyncHandler(async (req, res) => {
  const { nome, email, senha } = req.body || {};
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: "Nome, email e senha são obrigatórios" });
  }
  const { usuario, token } = await registerLocal({ nome, email, senha });
  res.json({ usuario, token });
});

export const login = asyncHandler(async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ erro: "Email e senha são obrigatórios" });
  const { token } = await loginLocal({ email, senha });
  res.json({ token });
});

export const loginGoogleToken = asyncHandler(async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ erro: "Credential (ID token) é obrigatório" });
  const { token, usuario } = await loginWithGoogleIdToken(credential);
  res.json({ token, usuario });
});

export const me = asyncHandler(async (req, res) => {
  const data = await getUserPublicById(req.usuario.id);
  if (!data) return res.status(404).json({ erro: "Usuário não encontrado" });
  res.json(data);
});

// Endpoint de teste de conexão com Supabase
export const testeSupabase = asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("usuarios").select("id,nome,email").limit(5);
  if (error) throw error;
  res.json({ ok: true, usuarios: data });
});