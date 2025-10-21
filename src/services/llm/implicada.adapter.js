import { generateImplicada } from "./engine.js";
import { embedText } from "../embedding.service.js";

export async function responderImplicada({ gemini, mensagem, contexto, historico, posicao }) {
  const j = await generateImplicada({ gemini, mensagem, contexto, historico, posicao });

  // followups vêm do próprio JSON
  const followups = Array.isArray(j.perguntas) ? j.perguntas : [];

  // texto a persistir no histórico continua sendo a devolução
  const resposta = String(j.devolucao || "").trim();

  // embedding (opcional) do par pergunta + devolução
  let embedding = null;
  try {
    embedding = await embedText(`${mensagem}\n${resposta}`);
  } catch {}

  return {
    resposta,
    followups,
    meta: {
      apontamentos_nao_compreendidos: j.apontamentos_nao_compreendidos || [],
      limite: j.limite || { fora_de_escopo: false, observacao: "" },
      silencio: j.silencio || { sugerido: false, duracao_s: 0 },
      posicao: j.posicao || String(posicao || "TU").toUpperCase(),
      etica: j.etica || { tensoes: [], nota: "" },
      embedding,
    },
  };
}