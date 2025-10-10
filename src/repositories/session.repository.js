import { supabase } from "../clients/supabase.js";

// cria uma nova sessão para o usuário
export async function createSession(usuarioId, titulo = null) {
  const { data, error } = await supabase
    .from("sessoes")
    .insert([{ usuario_id: usuarioId, titulo }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// obtém uma sessão por ID, se pertencer ao usuário
export async function getSessionIfOwned(sessionId, usuarioId) {
  if (!sessionId) return null;
  const { data, error } = await supabase
    .from("sessoes")
    .select("id, usuario_id, titulo, criado_em")
    .eq("id", sessionId)
    .eq("usuario_id", usuarioId)
    .single();
  if (error) return null;
  return data;
}

// renomeia uma sessão, se pertencer ao usuário
export async function renameSession(id, usuarioId, titulo) {
  const { data, error } = await supabase
    .from("sessoes")
    .update({ titulo: titulo.trim() })
    .eq("id", id)
    .eq("usuario_id", usuarioId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// lista sessões do usuário, ordenadas pela última atividade (ou criação, se nenhuma atividade)
export async function listSessionsOrdered(usuarioId) {
  try {
    const { data, error } = await supabase.rpc("listar_sessoes_ordenadas", {
      p_usuario_id: usuarioId,
    });
    if (error) throw error;
    return data || [];
  } catch (rpcErr) {
    const { data: sessoes, error: e1 } = await supabase
      .from("sessoes")
      .select("id, titulo, criado_em")
      .eq("usuario_id", usuarioId);
    if (e1) throw e1;

    if (!Array.isArray(sessoes) || sessoes.length === 0) return [];

    const enriched = await Promise.all(
      sessoes.map(async (s) => {
        const { data: last } = await supabase
          .from("historico")
          .select("criado_em")
          .eq("usuario_id", usuarioId)
          .eq("sessao_id", s.id)
          .order("criado_em", { ascending: false })
          .limit(1);
        const ultima = Array.isArray(last) && last.length > 0 ? last[0].criado_em : s.criado_em;
        return {
          id: s.id,
          titulo: s.titulo,
          criado_em: s.criado_em,
          ultima_atividade: ultima,
        };
      })
    );

    enriched.sort((a, b) => new Date(b.ultima_atividade) - new Date(a.ultima_atividade));
    return enriched;
  }
}