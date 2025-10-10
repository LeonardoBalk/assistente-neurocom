import { supabase } from "../clients/supabase.js"; // configura o banco de dados supabase

// funções para interagir com a tabela de usuários
export async function findUserByEmail(email) { 
  const { data } = await supabase.from("usuarios").select("*").ilike("email", email).single();
  return data || null;
}

// função para buscar usuário logados com Google por google_id
export async function findUserByGoogleId(googleId) {
  const { data } = await supabase.from("usuarios").select("*").eq("google_id", googleId).single();
  return data || null;
}

// cria um novo usuário
export async function createUser({ nome, email, senha = null, google_id = null, provider = null, avatar_url = null }) {
  const { data, error } = await supabase
    .from("usuarios")
    .insert([{ nome, email, senha, google_id, provider, avatar_url }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// vincula uma conta Google a um usuário existente
export async function linkGoogleToUser(userId, { google_id, provider = "google", nome, avatar_url }) {
  const { data, error } = await supabase
    .from("usuarios")
    .update({ google_id, provider, nome, avatar_url })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// obtém dados públicos do usuário por ID (sem senha)
export async function getUserPublicById(id) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id,nome,email,avatar_url,provider")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}