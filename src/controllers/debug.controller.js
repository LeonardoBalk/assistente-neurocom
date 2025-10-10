import { asyncHandler } from "../utils/asyncHandler.js";
import { embedText } from "../services/embedding.service.js";
import { supabase } from "../clients/supabase.js";
import { getSessionIfOwned } from "../repositories/session.repository.js";

export const ragSearch = asyncHandler(async (req, res) => {
  const q = (req.query.q || "").toString();
  const sessionId = (req.query.sessionId || "").toString();
  const minSimDocs = parseFloat(req.query.minSimDocs ?? "0.30");
  const minSimHist = parseFloat(req.query.minSimHist ?? "0.25");
  const docsK = parseInt(req.query.docsK ?? "8", 10);
  const histK = parseInt(req.query.histK ?? "6", 10);

  if (!q) return res.status(400).json({ erro: "Passe ?q=pergunta para testar." });
  if (!sessionId) return res.status(400).json({ erro: "Passe ?sessionId=<uuid> da sessão." });

  const sess = await getSessionIfOwned(sessionId, req.usuario.id);
  if (!sess) return res.status(404).json({ erro: "Sessão não encontrada" });

  const started = Date.now();
  const vec = await embedText(q);

  let rows = [];
  try {
    const { data, error } = await supabase.rpc("search_docs_and_history", {
      p_query_embedding: vec,
      p_usuario_id: req.usuario.id,
      p_sessao_id: sessionId,
      p_match_count: docsK,
      p_history_count: histK,
      p_min_sim_docs: isNaN(minSimDocs) ? 0.30 : minSimDocs,
      p_min_sim_hist: isNaN(minSimHist) ? 0.25 : minSimHist,
      p_recency_half_life_seconds: 86400,
      p_total_limit: null,
    });
    if (error) throw error;
    rows = data || [];
  } catch (e) {
    const { data: docsData, error: mdErr } = await supabase.rpc("match_documents", {
      p_query_embedding: vec,
      p_match_count: docsK,
      p_min_sim: isNaN(minSimDocs) ? 0.30 : minSimDocs,
      p_candidate_pool: 100,
    });
    if (mdErr) throw mdErr;
    rows = (docsData || []).map((d) => ({
      id: d.id,
      content: d.content,
      similarity: d.similarity,
      tipo: "documento",
      score: d.similarity,
    }));
  }

  const tookMs = Date.now() - started;

  const byTipo = (t) =>
    rows
      .filter((r) => r.tipo === t)
      .map((r) => ({
        id: r.id,
        similarity: r.similarity ?? null,
        score: r.score ?? null,
        preview: (r.content || "").slice(0, 200),
      }));

  return res.json({
    query: q,
    took_ms: tookMs,
    total: rows.length,
    documentos: byTipo("documento"),
    historico: byTipo("historico"),
    raw_top3: rows.slice(0, 3).map((r) => ({
      id: r.id,
      tipo: r.tipo,
      sim: r.similarity,
      score: r.score,
      preview: (r.content || "").slice(0, 300),
    })),
  });
});