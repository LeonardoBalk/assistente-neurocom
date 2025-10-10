// serviço de verificação de token do Google
// login com Google
import { OAuth2Client } from "google-auth-library";
import { config } from "../config/env.js";

const client = new OAuth2Client(config.googleClientId || undefined);

export async function verifyGoogleIdToken(credential) {
  if (!credential) throw new Error("Credential ausente");
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: config.googleClientId || undefined,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error("Token Google inválido");
  return payload;
}