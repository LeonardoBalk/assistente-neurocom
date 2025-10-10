// serviço de geração de embeddings usando o modelo Gemini do Google
import { gemini } from "../clients/gemini.js";
import { config } from "../config/env.js";

const embedModel = gemini.getGenerativeModel({ model: config.embedding.model });

export async function embedText(text) {
  const resp = await embedModel.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: config.embedding.dimensions,
  });
  const vec = resp.embedding?.values || [];
  if (!Array.isArray(vec) || vec.length === 0) throw new Error("Embedding vazio");
  if (vec.length !== config.embedding.dimensions) {
    const e = new Error(
      `Embedding dimension mismatch: got ${vec.length}, expected ${config.embedding.dimensions}`
    );
    e.status = 500;
    throw e;
  }
  return vec;
}