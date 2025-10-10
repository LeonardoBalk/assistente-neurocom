import express from "express";
import cors from "cors";
import { config } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/error.js";

console.log("Iniciando app.js");

export function createApp() {
  const app = express();
  console.log("Iniciando app.js");

  app.use(express.json());
  app.use(
    cors({
      origin: config.frontUrl,
      credentials: true,
    })
  );

  app.use(routes);

  app.use((req, res) => res.status(404).json({ erro: "Rota não encontrada" }));
  app.use(errorHandler);

  return app;
}