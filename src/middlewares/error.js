// middleware de tratamento de erros
import { config } from "../config/env.js";

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const payload = {
    ok: false,
    erro: status === 500 && config.nodeEnv === "production" ? "Erro interno" : err.message,
  };
  if (config.nodeEnv !== "production") {
    payload.stack = err.stack;
    payload.details = err.details;
  }
  console.error("Error:", { message: err.message, details: err.details, code: err.code });
  res.status(status).json(payload);
}