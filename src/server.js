import http from "http";
import { createApp } from "./app.js";
import { config } from "./config/env.js";


const app = createApp();
const server = http.createServer(app);


server.listen(config.port, () => {
  console.log(`Servidor rodando na porta ${config.port}`);
});