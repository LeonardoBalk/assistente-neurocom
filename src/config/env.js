// configura as variáveis de ambiente
import dotenv from "dotenv";
dotenv.config();

function requireEnv(name, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === null || v === "") {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development", 
  port: Number(process.env.PORT || 3000), 
  jwtSecret: requireEnv("JWT_SECRET", "chave"),
  frontUrl: process.env.FRONT_URL || "http://localhost:5173",
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseKey: requireEnv("SUPABASE_KEY"),
  geminiApiKey: requireEnv("GEMINI_API_KEY"),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "654506010613-j279r85vpalccb8mcd8npoa88dj18ebq.apps.googleusercontent.com",
  embedding: {
    model: "text-embedding-004", // modelo de embedding do google
    dimensions: 768, // dimensões do embedding
  },
};