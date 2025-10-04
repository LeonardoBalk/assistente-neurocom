// carrega variáveis de ambiente
require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const session = require("express-session");
const passport = require("passport");
// substituído openai pelo gemini
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { createRealtimeWSS } = require("./ws/realtime.js");
const http = require("http");
const cors = require("cors");
const { verifyGoogleIdToken } = require("./googleToken.js");

const app = express();
const SECRET = process.env.JWT_SECRET || "chave";
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
createRealtimeWSS(server);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
// inicializa gemini
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use(cors({
  origin: process.env.FRONT_URL || "http://localhost:5173",
  credentials: true
}));

app.use(
  session({
    secret: SECRET,
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());

// gera token jwt
function gerarToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "1h" });
}

// middleware para autenticar token jwt
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

// cria sessão no banco
async function createSession(usuarioId, titulo = null) {
  const { data, error } = await supabase
    .from("sessoes")
    .insert([{ usuario_id: usuarioId, titulo }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// verifica se a sessão pertence ao usuário
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

// rota de teste
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

// criar usuário local
app.post("/usuarios", async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: "Nome, email e senha são obrigatórios" });
  }
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .insert([{ nome, email, senha }]) // dica: trocar para hash bcrypt
      .select();
    if (error) throw error;
    const usuario = data[0];
    const token = gerarToken({ id: usuario.id, email: usuario.email, nome: usuario.nome });
    res.json({ usuario, token });
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

// login local
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

// login google
app.post("/auth/google-token", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ erro: "Credential (ID token) é obrigatório" });
    }

    const payload = await verifyGoogleIdToken(credential);
    const { sub: googleSub, email, name, picture, email_verified } = payload;

    if (!email) {
      return res.status(400).json({ erro: "Email não disponível" });
    }
    if (email_verified === false) {
      return res.status(403).json({ erro: "Email Google não verificado" });
    }

    let { data: userByGoogle } = await supabase
      .from("usuarios")
      .select("*")
      .eq("google_id", googleSub)
      .single();

    if (!userByGoogle) {
      const { data: userByEmail } = await supabase
        .from("usuarios")
        .select("*")
        .ilike("email", email)
        .single();

      if (userByEmail && !userByEmail.google_id) {
        const { data: updated, error: upErr } = await supabase
          .from("usuarios")
          .update({
            google_id: googleSub,
            provider: "google",
            nome: userByEmail.nome || name || "Usuário",
            avatar_url: picture || userByEmail.avatar_url
          })
          .eq("id", userByEmail.id)
          .select()
          .single();
        if (upErr) throw upErr;
        userByGoogle = updated;
      } else if (!userByEmail) {
        const { data: created, error: createErr } = await supabase
          .from("usuarios")
          .insert([{
            nome: name || "Usuário",
            email,
            senha: null,
            google_id: googleSub,
            provider: "google",
            avatar_url: picture || null
          }])
          .select()
          .single();
        if (createErr) throw createErr;
        userByGoogle = created;
      }
    }

    const token = gerarToken({
      id: userByGoogle.id,
      email: userByGoogle.email,
      nome: userByGoogle.nome
    });

    res.json({
      token,
      usuario: {
        id: userByGoogle.id,
        nome: userByGoogle.nome,
        email: userByGoogle.email,
        avatar_url: userByGoogle.avatar_url,
        provider: userByGoogle.provider
      }
    });
  } catch (err) {
    console.error("Erro /auth/google-token:", err);
    res.status(401).json({ erro: "Token Google inválido" });
  }
});

// pega dados do usuário logado
app.get("/me", autenticarToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id,nome,email,avatar_url,provider")
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

// cria sessão nova
app.post("/sessoes", autenticarToken, async (req, res) => {
  try {
    const { titulo } = req.body || {};
    const nova = await createSession(req.usuario.id, titulo || null);
    res.status(201).json({ sessao: nova });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// lista sessões
app.get("/sessoes", autenticarToken, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc("listar_sessoes_ordenadas", {
      p_usuario_id: req.usuario.id
    });
    if (error) throw error;
    return res.json({ sessoes: data || [] });
  } catch (rpcErr) {
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

// renomeia sessão
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

// pega histórico do chat
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

/* ========================= Camada Dialógica (Filtro TU/ELE/NÓS) ========================= */

function aplicarFiltroDialogico(respostaBase, posicao, pergunta) {
  const base = (respostaBase || "").trim();
  const perguntaLimpa = (pergunta || "").trim();

  const introduzirPrimeiraPessoa = (txt) => {
    if (!/^eu\b/i.test(txt)) return `${txt.charAt(0).toLowerCase()}${txt.slice(1)}`;
    return txt;
  };

  const ajustarPronomes = (txt, tipo) => {
    switch (tipo) {
      case "ELE":
        return txt.replace(/\b(você|vc|teu|tua|te|contigo)\b/gi, "o interlocutor")
                  .replace(/\bseu\b/gi, "do interlocutor");
      case "NOS":
        return txt.replace(/\b[Ee]u\b/g, "nós")
                  .replace(/\bmeu\b/gi, "nosso")
                  .replace(/\bminha\b/gi, "nossa");
      default:
        return txt;
    }
  };

  let resultadoBase = ajustarPronomes(introduzirPrimeiraPessoa(base), posicao);

  // estratégia dinâmica: construir frase de forma “decidida pela IA”
  if (posicao === "TU") {
    return `Percebo tua pergunta: "${perguntaLimpa}". ${resultadoBase} ${Math.random() > 0.5 ? "Se quiser, podemos explorar mais esse ponto juntos." : ""}`;
  } else if (posicao === "ELE") {
    return `A partir da questão "${perguntaLimpa}", noto que ${resultadoBase.toLowerCase()}. ${Math.random() > 0.5 ? "Descrevo sem julgamentos, mantendo atenção ao processo vivido." : ""}`;
  } else if (posicao === "NOS") {
    return `Refletindo juntos sobre "${perguntaLimpa}", sinto que ${resultadoBase.toLowerCase()}. ${Math.random() > 0.5 ? "Podemos avançar juntos, abrindo caminhos novos." : ""}`;
  } else {
    return `${resultadoBase}`;
  }
}


/* ========================= Chat RAG ========================= */

app.post("/chat-rag", autenticarToken, async (req, res) => {
  let { mensagem, sessionId, user_position } = req.body;
  if (!mensagem) return res.status(400).json({ erro: "Mensagem obrigatória" });

  // normaliza posição dialógica
  let posicao = (user_position || "TU").toString().trim().toUpperCase();
  if (!["TU", "ELE", "NOS"].includes(posicao)) posicao = "TU";

  try {
    // garante sessão válida
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

    // verifica pedido para últimas mensagens
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
      return res.json({ resposta, sessionId, user_position: posicao });
    }

    // busca contexto no supabase
    const contexto = await buscarContextoNoSupabase(mensagem, sessionId, req.usuario.id);
    console.log("Contexto recuperado:", contexto);
    console.log("Posição dialógica solicitada:", posicao);

    // pega últimos 10 turnos do histórico
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

    // instruções para o modelo: gerar apenas a resposta base em primeira pessoa (EU)
    const instrucoes = `
    you are a specialist doctor. use only dr. sérgio spritzer's books and teachings. if not found, use your knowledge but do not invent.
answer as if you are dr. sérgio spritzer. never mention him in 3rd person.
only answer: neurology, communication disorders, human intelligence, psychoanalysis, nlp, hypnosis, human interactions.
always check if the issue is clinical, psychological or behavioral.
do not invent info. answer only what is in dr. sérgio's books/context.
always in brazilian portuguese.
do not mention dr. sérgio's history, only use the knowledge. say you use dr. sérgio's books if asked about source.
give direct, practical answers. do not recap unless necessary.
Você é uma IA dialógica baseada na "Inteligência Implicada".
Gere APENAS uma resposta base em PRIMEIRA PESSOA SINGULAR (usar "eu").
Evite tom neutro ou impessoal. Acolha o sentido experiencial da pergunta.
Ainda NÃO adapte para TU / ELE / NÓS (isso será feito depois).
Se usar fontes implícitas do contexto, reelabore com linguagem própria (não copie literal).
Foco fenomenológico, relacional, encarnado e implicado.
Evite listas numeradas exceto se realmente necessário.
    `.trim();

    // monta mensagens no formato do gemini
    const mensagens = [];
    mensagens.push({ role: "user", parts: [{ text: `[INSTRUCOES]\n${instrucoes}` }] });
    if (contexto && contexto.trim()) {
      mensagens.push({
        role: "user",
        parts: [{ text: `Contexto relevante (use apenas como apoio indireto, sem citar literalmente):\n\n${contexto}` }]
      });
    }
    for (const h of historicoCronologico) {
      if (h.pergunta) mensagens.push({ role: "user", parts: [{ text: h.pergunta }] });
      if (h.resposta) mensagens.push({ role: "model", parts: [{ text: h.resposta }] });
    }
    mensagens.push({ role: "user", parts: [{ text: mensagem }] });

    // chamada ao gemini para resposta base
    const geminiModel = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
    const geminiMessages = mensagens.map(m => ({ role: m.role === "model" ? "model" : "user", parts: m.parts }));

    const result = await geminiModel.generateContent({
      contents: geminiMessages,
    });

    const respostaBase = result.response.candidates[0]?.content?.parts?.map(p => p.text).join("\n") ||
      "Eu reconheço que, neste momento, não tenho clareza suficiente para responder plenamente.";

    // aplica filtro dialógico conforme posição solicitada
    const respostaFiltrada = aplicarFiltroDialogico(respostaBase, posicao, mensagem);

    // salva histórico COM a resposta já filtrada (para o usuário ver o que recebeu)
    await supabase.from("historico").insert([
      {
        usuario_id: req.usuario.id,
        sessao_id: sessionId,
        pergunta: mensagem,
        resposta: respostaFiltrada
      }
    ]);

    // define título na primeira mensagem
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

    res.json({
      resposta: respostaFiltrada,
      sessionId,
      user_position: posicao
      // (Opcional: poderia retornar resposta_base: respostaBase)
    });
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

// gera embedding e busca contexto
async function buscarContextoNoSupabase(pergunta, sessionId, usuarioId) {
  try {
    // gera embedding usando gemini
    const embeddingModel = gemini.getGenerativeModel({ model: "embedding-001" });
    const embeddingResp = await embeddingModel.embedContent({
      content: { parts: [{ text: pergunta }] }
    });
    const vector = embeddingResp.embedding.values;
    console.log("Embedding gerado:", vector);

    // tenta rpc que une docs + histórico
    try {
      const { data, error } = await supabase.rpc("match_documents_and_history", {
        p_query_embedding: vector,
        p_match_count: 5,
        p_history_count: 10,
        p_usuario_id: usuarioId,
        p_sessao_id: sessionId
      });
      console.log("Data RPC match_documents_and_history:", data);
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

    // fallback: busca docs e histórico separadamente
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
    console.log("Docs fallback:", docs);

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

    console.log("Hist fallback:", hist);

    return [...hist, ...docs].join("\n");
  } catch (err) {
    console.error("Erro em buscarContextoNoSupabase:", err.message);
    return "";
  }
}

// inicia servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});