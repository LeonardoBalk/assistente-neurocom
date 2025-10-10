import bcrypt from "bcrypt";
import { signToken } from "../middlewares/auth.js";
import {
  createUser,
  findUserByEmail,
  findUserByGoogleId,
  getUserPublicById,
  linkGoogleToUser,
} from "../repositories/user.repository.js";
import { verifyGoogleIdToken } from "./googleToken.service.js";

export async function registerLocal({ nome, email, senha }) {
  const hashed = await bcrypt.hash(senha, 10);
  const usuario = await createUser({ nome, email, senha: hashed });
  const token = signToken({ id: usuario.id, email: usuario.email, nome: usuario.nome });
  return { usuario, token };
}

export async function loginLocal({ email, senha }) {
  const user = await findUserByEmail(email);
  if (!user) throw Object.assign(new Error("Credenciais inválidas"), { status: 401 });

  // Compatibilidade: se senha em texto puro coincidir, aceita; caso contrário, tenta bcrypt
  const plainMatch = user.senha && user.senha === senha;
  const bcryptMatch = user.senha ? await bcrypt.compare(senha, user.senha) : false;
  if (!plainMatch && !bcryptMatch) {
    throw Object.assign(new Error("Credenciais inválidas"), { status: 401 });
  }

  const token = signToken({ id: user.id, nome: user.nome, email: user.email });
  return { token };
}

export async function loginWithGoogleIdToken(credential) {
  const payload = await verifyGoogleIdToken(credential);
  const { sub: googleSub, email, name, picture, email_verified } = payload;

  if (!email) throw Object.assign(new Error("Email não disponível"), { status: 400 });
  if (email_verified === false) {
    throw Object.assign(new Error("Email Google não verificado"), { status: 403 });
  }

  let user = await findUserByGoogleId(googleSub);

  if (!user) {
    const byEmail = await findUserByEmail(email);
    if (byEmail && !byEmail.google_id) {
      user = await linkGoogleToUser(byEmail.id, {
        google_id: googleSub,
        provider: "google",
        nome: byEmail.nome || name || "Usuário",
        avatar_url: picture || byEmail.avatar_url,
      });
    } else if (!byEmail) {
      user = await createUser({
        nome: name || "Usuário",
        email,
        senha: null,
        google_id: googleSub,
        provider: "google",
        avatar_url: picture || null,
      });
    }
  }

  if (!user) throw Object.assign(new Error("Falha na autenticação Google"), { status: 401 });

  const token = signToken({ id: user.id, email: user.email, nome: user.nome });
  const usuario = await getUserPublicById(user.id);
  return { token, usuario };
}