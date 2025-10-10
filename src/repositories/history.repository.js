import { supabase } from "../clients/supabase.js";

// lista o histórico de perguntas e respostas de uma sessão
export async function listHistory(usuarioId, sessaoId, limit = 10) {
  const { data } = await supabase
    .from("historico")
    .select("id, pergunta, resposta")
    .eq("usuario_id", usuarioId)
    .eq("sessao_id", sessaoId)
    .order("id", { ascending: false })
    .limit(limit);
  return Array.isArray(data) ? [...data].sort((a, b) => a.id - b.id) : [];
}

// lista o histórico completo de perguntas e respostas de uma sessão, com todos os campos
export async function listHistoryRaw(usuarioId, sessaoId) {
  const { data, error } = await supabase
    .from("historico")
    .select("id, pergunta, resposta, criado_em, sessao_id, posicao, resposta_base, followups")
    .eq("usuario_id", usuarioId)
    .eq("sessao_id", sessaoId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}

// obtém um registro específico do histórico, se pertencer ao usuário
export async function listLastUserMessages(usuarioId, sessaoId, n) {
  const { data, error } = await supabase
    .from("historico")
    .select("id, pergunta")
    .eq("usuario_id", usuarioId)
    .eq("sessao_id", sessaoId)
    .order("id", { ascending: false })
    .limit(n);
  if (error) throw error;
  return (data || []).sort((a, b) => a.id - b.id).map((r) => r.pergunta);
}

// insere um novo registro no histórico, usando a função RPC para garantir integridade
export async function insertHistoricoRPC({ usuarioId, sessaoId, pergunta, resposta, embedding }) {
  return supabase.rpc("insert_historico", {
    p_usuario_id: usuarioId,
    p_sessao_id: sessaoId,
    p_pergunta: pergunta,
    p_resposta: resposta,
    p_embedding: embedding,
  });
}

// atualiza informações adicionais de um registro no histórico
export async function updateHistoricoExtras(id, { posicao, resposta_base, followups }) {
  await supabase
    .from("historico")
    .update({ posicao, resposta_base, followups })
    .eq("id", id);
}

export async function insertHistoricoFallback(row) {
  const { error } = await supabase.from("historico").insert([row]);
  if (error) throw error;
}