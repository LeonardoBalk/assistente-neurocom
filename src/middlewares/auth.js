// middleware de autenticação JWT
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export function signToken(payload, opts = { expiresIn: "1h" }) {
  return jwt.sign(payload, config.jwtSecret, opts);
}

export function authenticateJWT(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ erro: "Token não fornecido" });

  jwt.verify(token, config.jwtSecret, (err, usuario) => {
    if (err) return res.status(403).json({ erro: "Token inválido" });
    req.usuario = usuario;
    next();
  });
}