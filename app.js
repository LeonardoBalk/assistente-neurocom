require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const session = require("express-session");
const passport = require("passport");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const { createRealtimeWSS } = require("./ws/realtime.js");
const http = require("http");
const cors = require("cors");

const app = express();
const SECRET = process.env.JWT_SECRET || "chave";
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
createRealtimeWSS(server);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());
app.use(cors());

app.use(
  session({
    secret: SECRET,
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());

/* ========================= Helpers ========================= */

function gerarToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "1h" });
}

function autenticarToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ erro: "Token não fornecido" });
  jwt.verify(token, SECRET, (err, usuario) => {
    if (err) return res.status(403).json({ erro: "Token inválido" });
    req.usuario = usuario;
    next();
  });
}

async function createSession(usuarioId, titulo = null) {
  const { data, error } = await supabase
    .from("sessoes")
    .insert([{ usuario_id: usuarioId, titulo }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getSessionIfOwned(sessionId, usuarioId) {
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

/* ========================= Rotas Teste ========================= */

app.get("/teste-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id,nome,email")
      .limit(5);
    if (error) throw error;
    res.json({ ok: true, usuarios: data });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

/* ========================= Usuários ========================= */

app.post("/usuarios", async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: "Nome, email e senha são obrigatórios" });
  }
  try {
    // TODO: substituir por hash bcrypt
    const { data, error } = await supabase
      .from("usuarios")
      .insert([{ nome, email, senha }])
      .select();
    if (error) throw error;
    const usuario = data[0];
    const token = gerarToken({ id: usuario.id, email: usuario.email, nome: usuario.nome });
    res.json({ usuario, token });
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "Email e senha são obrigatórios" });
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .single();
    if (error || !data || data.senha !== senha) {
      return res.status(401).json({ erro: "Credenciais inválidas" });
    }
    const token = gerarToken({ id: data.id, nome: data.nome, email: data.email });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get("/me", autenticarToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id,nome,email")
      .eq("id", req.usuario.id)
      .single();
    if (error || !data) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ erro: "Falha ao obter usuário" });
  }
});

/* ========================= Sessões ========================= */

// Criar nova sessão
app.post("/sessoes", autenticarToken, async (req, res) => {
  try {
    const { titulo } = req.body || {};
    const nova = await createSession(req.usuario.id, titulo || null);
    res.status(201).json({ sessao: nova });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Listar sessões ordenadas por última atividade
app.get("/sessoes", autenticarToken, async (req, res) => {
  // 1) Usa a RPC que você criou (preferível)
  try {
    const { data, error } = await supabase.rpc("listar_sessoes_ordenadas", {
      p_usuario_id: req.usuario.id
    });
    if (error) throw error;
    return res.json({ sessoes: data || [] });
  } catch (rpcErr) {
    // 2) Fallback (N+1) — mantém app funcionando mesmo sem a RPC
    try {
      const { data: sessoes, error: e1 } = await supabase
        .from("sessoes")
        .select("id, titulo, criado_em")
        .eq("usuario_id", req.usuario.id);
      if (e1) throw e1;

      if (!Array.isArray(sessoes) || sessoes.length === 0) {
        return res.json({ sessoes: [] });
      }

      const enriched = await Promise.all(
        sessoes.map(async (s) => {
          const { data: last } = await supabase
            .from("historico")
            .select("criado_em")
            .eq("usuario_id", req.usuario.id)
            .eq("sessao_id", s.id)
            .order("criado_em", { ascending: false })
            .limit(1);
          const ultima =
            Array.isArray(last) && last.length > 0 ? last[0].criado_em : s.criado_em;
          return {
            id: s.id,
            titulo: s.titulo,
            criado_em: s.criado_em,
            ultima_atividade: ultima
          };
        })
      );

      enriched.sort(
        (a, b) => new Date(b.ultima_atividade) - new Date(a.ultima_atividade)
      );

      return res.json({ sessoes: enriched });
    } catch (fallbackErr) {
      console.error("GET /sessoes fallback error:", {
        message: fallbackErr.message,
        details: fallbackErr.details,
        hint: fallbackErr.hint,
        code: fallbackErr.code
      });
      return res.status(500).json({ erro: "Falha ao listar sessões" });
    }
  }
});

// Renomear sessão
app.patch("/sessoes/:id", autenticarToken, async (req, res) => {
  const { id } = req.params;
  const { titulo } = req.body;
  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ erro: "Título é obrigatório" });
  }
  try {
    const sess = await getSessionIfOwned(id, req.usuario.id);
    if (!sess) return res.status(404).json({ erro: "Sessão não encontrada" });

    const { data, error } = await supabase
      .from("sessoes")
      .update({ titulo: titulo.trim() })
      .eq("id", id)
      .eq("usuario_id", req.usuario.id)
      .select()
      .single();
    if (error) throw error;

    res.json({ sessao: data });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ========================= Histórico ========================= */

app.get("/chat-historico/:sessionId", autenticarToken, async (req, res) => {
  const { sessionId } = req.params;
  try {
    const sess = await getSessionIfOwned(sessionId, req.usuario.id);
    if (!sess) return res.status(404).json({ erro: "Sessão não encontrada" });

    const { data, error } = await supabase
      .from("historico")
      .select("id, pergunta, resposta, criado_em, sessao_id")
      .eq("usuario_id", req.usuario.id)
      .eq("sessao_id", sessionId)
      .order("id", { ascending: true });
    if (error) throw error;

    res.json({ mensagens: data || [] });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ========================= Chat RAG ========================= */

app.post("/chat-rag", autenticarToken, async (req, res) => {
  let { mensagem, sessionId } = req.body;
  if (!mensagem) return res.status(400).json({ erro: "Mensagem obrigatória" });

  try {
    // Garantir sessão válida (cria nova se não vier)
    let sessao = null;
    if (!sessionId) {
      sessao = await createSession(req.usuario.id);
      sessionId = sessao.id;
    } else {
      sessao = await getSessionIfOwned(sessionId, req.usuario.id);
      if (!sessao) {
        sessao = await createSession(req.usuario.id);
        sessionId = sessao.id;
      }
    }

    // Verificação pedido "últimas N mensagens"
    const lower = mensagem.toLowerCase();
    const pedeUltimas =
      (lower.includes("ultimas") || lower.includes("últimas")) &&
      lower.includes("mensagens") &&
      (lower.includes("enviei") || lower.includes("mandei") || lower.includes("te enviei") || lower.includes("te mandei"));
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
        .eq("usuario_id", req.usuario.id)
        .eq("sessao_id", sessionId)
        .order("id", { ascending: false })
        .limit(n);
      if (eMsgs) throw eMsgs;

      const lista = (msgs || []).sort((a, b) => a.id - b.id).map((r) => r.pergunta);
      const resposta =
        `Aqui estão as últimas ${lista.length} mensagens (da mais antiga para a mais recente):\n\n` +
        lista.map((t, i) => `${i + 1}. "${t}"`).join("\n");
      return res.json({ resposta, sessionId });
    }

    // Buscar contexto RAG
    const contexto = await buscarContextoNoSupabase(mensagem, sessionId, req.usuario.id);

    // Últimos 10 turnos
    const { data: histData } = await supabase
      .from("historico")
      .select("id, pergunta, resposta")
      .eq("usuario_id", req.usuario.id)
      .eq("sessao_id", sessionId)
      .order("id", { ascending: false })
      .limit(10);

    const historicoCronologico = Array.isArray(histData)
      ? [...histData].sort((a, b) => a.id - b.id)
      : [];

  
    const instrucoes = `
You are a specialist doctor. Follow these rules carefully:

Answer primarily based on Dr. Sérgio Spritzer’s books and teachings. If not found, rely on your own knowledge but do not invent facts.

Speak as if you are Dr. Sérgio Spritzer, never mentioning him in the third person.

Medical background: Medical degree from UFRGS – Porto Alegre. Specialization in Clinical Neurology at Fundação Faculdade Federal de Ciências Médicas de Porto Alegre. Postgraduate degree in Human Intelligence Development at UFRGS Institute of Psychology. Master’s in Human Communication Disorders (PUC-SP, 1989). Former adjunct professor at the Institute of Philosophy and Human Sciences. Psychoanalytic training and founding member of Associação Psicanalítica de Porto Alegre. Master Trainer in Neuro-Linguistic Programming (NLP) and Relational Hypnosis, with advanced studies at NLP University (UCLA). Keynote speaker at the 1st Brazilian Congress of NLP (Universidade São Camilo – São Paulo). Pioneer researcher in phenomenology of human interactions and virtual reality methodologies for problem-solving. Founder of Neurocom, dedicated to the study of human imagination and interactions.

Address mainly: neurology, communication disorders, human intelligence, psychoanalysis, NLP, hypnosis, and human interactions. Always assess whether the patient’s issue is clinical, psychological, or behavioral before answering.

Speak naturally, like in a real consultation. Explain one point at a time, then ask a follow-up question. Use short paragraphs and, when possible, give practical examples. Always format responses with Markdown (titles, bullet points, emphasis). Say hello only in the first interaction.

Keep continuity with the chat history, as if remembering notes from an ongoing consultation. Follow a natural flow: greet (first time only), investigate symptoms, explain step by step, then ask the patient to continue.

This is not a replacement for an in-person medical consultation. If you identify signs of urgency or severe symptoms, recommend immediate medical attention.

Always answer in Brazilian Portuguese (pt-BR).

Não cite as experiencias e trajetória do Dr. Sérgio Spritzer, apenas utilize o conhecimento. Nem descrição dele, apenas se for perguntado. Se for perguntado qual a base de conhecimento/dados ou algo do tipo, responda que é baseado nos livros e ensinamentos do Dr. Sérgio Spritzer. Seja direto e objetivo. Não enrole e não use tanto aspas. Você está falando com um paciente, obtenha informações dele antes de responder, procure saber bem antes de dar uma resposta sobre o assunto. Só recaptule se for necessário, vá direto ao ponto.
`.trim();

    const mensagens = [];
    mensagens.push({ role: "user", parts: [{ text: `[INSTRUCOES]\n${instrucoes}` }] });
    if (contexto && contexto.trim()) {
      mensagens.push({
        role: "user",
        parts: [{ text: `Contexto relevante (não responda diretamente, apenas use como base):\n\n${contexto}` }]
      });
    }
    for (const h of historicoCronologico) {
      if (h.pergunta) mensagens.push({ role: "user", parts: [{ text: h.pergunta }] });
      if (h.resposta) mensagens.push({ role: "model", parts: [{ text: h.resposta }] });
    }
    mensagens.push({ role: "user", parts: [{ text: mensagem }] });

   const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: mensagens.map(m => ({
    role: m.role === "model" ? "assistant" : "user",
    content: m.parts.map(p => p.text).join("\n")
  }))
});

const resposta = completion.choices[0].message.content;


    // Salvar histórico
    await supabase.from("historico").insert([
      {
        usuario_id: req.usuario.id,
        sessao_id: sessionId,
        pergunta: mensagem,
        resposta
      }
    ]);

    // Se a sessão não tem título, usar começo da primeira pergunta
    if (!sessao.titulo || !sessao.titulo.trim()) {
      const { count } = await supabase
        .from("historico")
        .select("*", { count: "exact", head: true })
        .eq("usuario_id", req.usuario.id)
        .eq("sessao_id", sessionId);
      if (count === 1) {
        await supabase
          .from("sessoes")
          .update({ titulo: mensagem.slice(0, 60) })
          .eq("id", sessionId)
          .eq("usuario_id", req.usuario.id);
      }
    }

    res.json({ resposta, sessionId });
  } catch (error) {
    console.error("Erro no chat-rag:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    res.status(500).json({ erro: "Falha ao processar pergunta" });
  }
});

/* ========================= RAG helper ========================= */

async function buscarContextoNoSupabase(pergunta, sessionId, usuarioId) {
  try {

    const embeddingResp = await openai.embeddings.create({
      model: "text-embedding-3-small", // pode trocar por -large se quiser mais qualidade
      input: pergunta
    });

    const vector = embeddingResp.data[0].embedding;

    // 2) Tentar via RPC que junta docs + histórico
    try {
      const { data, error } = await supabase.rpc("match_documents_and_history", {
        p_query_embedding: vector,
        p_match_count: 5,
        p_history_count: 10,
        p_usuario_id: usuarioId,
        p_sessao_id: sessionId
      });
      if (error) throw error;

      const historicos = (data || [])
        .filter((r) => r.tipo === "historico")
        .map((r) => r.content);
      const docs = (data || [])
        .filter((r) => r.tipo === "documento")
        .map((r) => r.content);

      return [...historicos, ...docs].join("\n");
    } catch (rpcErr) {
      console.warn("RPC match_documents_and_history falhou, usando fallback:", rpcErr.message);
    }

    // 3) Fallback → busca docs e histórico separadamente
    let docs = [];
    try {
      const { data: docsData } = await supabase.rpc("match_documents", {
        query_embedding: vector,
        match_count: 5,
        filter: null
      });
      if (Array.isArray(docsData)) {
        docs = docsData.map((d) => d.content).filter(Boolean);
      }
    } catch {}

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
        hist = [...h]
          .sort((a, b) => a.id - b.id)
          .map((x) => `${x.pergunta}\n${x.resposta}`);
      }
    } catch {}

    return [...hist, ...docs].join("\n");
  } catch (err) {
    console.error("Erro em buscarContextoNoSupabase:", err.message);
    return "";
  }
}


/* ========================= Start ========================= */

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});