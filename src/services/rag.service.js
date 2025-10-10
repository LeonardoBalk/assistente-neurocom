import { supabase } from "../clients/supabase.js";
import { embedText } from "./embedding.service.js";

export async function buscarContexto({ pergunta, sessionId, usuarioId }) {
  try {
    const vector = await embedText(pergunta);

    try {
      const { data, error } = await supabase.rpc("search_docs_and_history", {
        p_query_embedding: vector,
        p_usuario_id: usuarioId,
        p_sessao_id: sessionId,
        p_match_count: 8,
        p_history_count: 6,
        p_min_sim_docs: 0.30,
        p_min_sim_hist: 0.25,
        p_recency_half_life_seconds: 86400,
        p_total_limit: null,
      });
      if (error) throw error;

      const historicos = (data || []).filter((r) => r.tipo === "historico").map((r) => r.content);
      const docs = (data || []).filter((r) => r.tipo === "documento").map((r) => r.content);
      return [...historicos, ...docs].join("\n");
    } catch (rpcErr) {
      console.warn("RPC search_docs_and_history falhou, fallback:", rpcErr.message);
    }

    let docs = [];
    try {
      const { data: docsData, error: mdErr } = await supabase.rpc("match_documents", {
        p_query_embedding: vector,
        p_match_count: 8,
        p_min_sim: 0.30,
        p_candidate_pool: 50,
      });
      if (mdErr) throw mdErr;
      if (Array.isArray(docsData)) docs = docsData.map((d) => d.content).filter(Boolean);
    } catch (e) {
      console.warn("Fallback match_documents falhou:", e?.message);
    }

    let hist = [];
    try {
      const { data: h } = await supabase
        .from("historico")
        .select("pergunta,resposta,id")
        .eq("usuario_id", usuarioId)
        .eq("sessao_id", sessionId)
        .order("id", { ascending: false })
        .limit(10);
      if (Array.isArray(h)) {
        hist = [...h].sort((a, b) => a.id - b.id).map((x) => `${x.pergunta}\n${x.resposta}`);
      }
    } catch {}

    return [...hist, ...docs].join("\n");
  } catch (err) {
    console.error("Erro em buscarContexto:", err.message);
    return "";
  }
}