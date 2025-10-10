import { gemini } from "../clients/gemini.js";
import { buscarContexto } from "./rag.service.js";
import { embedText } from "./embedding.service.js";
import {
  listHistory,
  insertHistoricoRPC,
  insertHistoricoFallback,
  updateHistoricoExtras,
} from "../repositories/history.repository.js";
import { createSession, getSessionIfOwned } from "../repositories/session.repository.js";
import { normalizarPosicao } from "../utils/position.js";
import { generateByPosition, gerarPerguntasContinuacao } from "./llm/engine.js";
import { supabase } from "../clients/supabase.js";

export async function ensureSession(sessionId, usuarioId) {
  if (!sessionId) {
    const nova = await createSession(usuarioId, null);
    return nova.id;
  }
  const sess = await getSessionIfOwned(sessionId, usuarioId);
  if (!sess) {
    const nova = await createSession(usuarioId, null);
    return nova.id;
  }
  return sessionId;
}

export async function processarChat({
  mensagem,
  sessionId,
  usuarioId,
  user_position,
  gerar_perguntas = true,
}) {
  const posicao = normalizarPosicao(user_position);
  const sessaoId = await ensureSession(sessionId, usuarioId);

  // Pedido especial: "últimas mensagens"
  const lower = String(mensagem || "").toLowerCase();
  const pedeUltimas =
    (lower.includes("ultimas") || lower.includes("últimas")) &&
    lower.includes("mensagens") &&
    (lower.includes("enviei") ||
      lower.includes("mandei") ||
      lower.includes("te enviei") ||
      lower.includes("te mandei"));

  if (pedeUltimas) {
    let n = 10;
    const m =
      lower.match(/(\d+)\s+(?:mensagens?|msgs?)/) ||
      lower.match(/(?:últimas?|ultimas?)\s+(\d+)\s+(?:mensagens?|msgs?)/);
    if (m) {
      const parsed = parseInt(m[1] || m[2], 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 100) n = parsed;
    }

    const { data: msgs, error: eMsgs } = await supabase
      .from("historico")
      .select("id, pergunta")
      .eq("usuario_id", usuarioId)
      .eq("sessao_id", sessaoId)
      .order("id", { ascending: false })
      .limit(n);
    if (eMsgs) throw eMsgs;

    const lista = (msgs || []).sort((a, b) => a.id - b.id).map((r) => r.pergunta);
    const resposta =
      `Aqui estão as últimas ${lista.length} mensagens (da mais antiga para a mais recente):\n\n` +
      lista.map((t, i) => `${i + 1}. "${t}"`).join("\n");
    return { resposta, sessionId: sessaoId, user_position: posicao };
  }

  const contexto = await buscarContexto({ pergunta: mensagem, sessionId: sessaoId, usuarioId });
  const historico = await listHistory(usuarioId, sessaoId, 10);

  const respostaRaw = await generateByPosition({
    gemini,
    mensagem,
    contexto,
    historico,
    posicao,
  });
  const respostaFinal = respostaRaw;

  let followups = [];
  if (gerar_perguntas !== false) {
    try {
      followups = await gerarPerguntasContinuacao({
        gemini,
        baseText: respostaFinal,
        mensagem,
        posicao,
      });
    } catch (e) {
      console.warn("Falha gerar perguntas:", e?.message);
    }
  }

  try {
    const histEmbeddingText = `${mensagem}\n${respostaFinal}`;
    const histVec = await embedText(histEmbeddingText);

    const { data: insRpc, error: insRpcErr } = await insertHistoricoRPC({
      usuarioId,
      sessaoId,
      pergunta: mensagem,
      resposta: respostaFinal,
      embedding: histVec,
    });

    if (insRpcErr) {
      await insertHistoricoFallback({
        usuario_id: usuarioId,
        sessao_id: sessaoId,
        pergunta: mensagem,
        resposta: respostaFinal,
        posicao,
        resposta_base: respostaRaw,
        followups,
        embedding: histVec,
      });
    } else {
      try {
        await updateHistoricoExtras(insRpc, { posicao, resposta_base: respostaRaw, followups });
      } catch {}
    }
  } catch (e) {
    console.warn("Falha ao salvar histórico com embedding; insert mínimo.", e?.message);
    await insertHistoricoFallback({
      usuario_id: usuarioId,
      sessao_id: sessaoId,
      pergunta: mensagem,
      resposta: respostaFinal,
      posicao,
      resposta_base: respostaRaw,
      followups,
    });
  }

  // Título na primeira mensagem
  try {
    const { count } = await supabase
      .from("historico")
      .select("*", { count: "exact", head: true })
      .eq("usuario_id", usuarioId)
      .eq("sessao_id", sessaoId);
    if (count === 1) {
      await supabase
        .from("sessoes")
        .update({ titulo: mensagem.slice(0, 60) })
        .eq("id", sessaoId)
        .eq("usuario_id", usuarioId);
    }
  } catch {}

  return { resposta: respostaFinal, sessionId: sessaoId, user_position: posicao, followups };
}