const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const passport = require('passport');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const SECRET = process.env.JWT_SECRET || 'chave';
const PORT = process.env.PORT || 3000;

// Supabase Client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.json());
const cors = require('cors');
app.use(cors());

// Sessão e Passport
app.use(session({
  secret: SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Rota de teste Supabase
app.get('/teste-supabase', async (req, res) => {
  try {
    // Teste simples na tabela de usuários
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email')
      .limit(5);

    if (error) throw error;

    res.json({
      ok: true,
      mensagem: 'Conexão com Supabase funcionando ✅',
      usuarios: data
    });
  } catch (err) {
    console.error('Erro teste supabase:', err);
    res.status(500).json({
      ok: false,
      mensagem: 'Falha na conexão com Supabase ❌',
      erro: err.message
    });
  }
});


// Rota de teste RPC
app.get('/teste-rpc', async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('match_documents_and_history', {
      p_query_embedding: Array(768).fill(0.01), // vetor fake só para teste
      p_match_count: 3,
      p_history_count: 3,
      p_usuario_id: 1,
      p_session_id: null
    });

    if (error) throw error;

    res.json({
      ok: true,
      mensagem: 'RPC executada com sucesso ✅',
      resultado: data
    });
  } catch (err) {
    console.error('Erro teste RPC:', err);
    res.status(500).json({
      ok: false,
      mensagem: 'Falha ao executar RPC ❌',
      erro: err.message
    });
  }
});


app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// Middleware de autenticação
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });

  jwt.verify(token, SECRET, (err, usuario) => {
    if (err) return res.status(403).json({ erro: 'Token inválido' });
    req.usuario = usuario;
    next();
  });
}

/* ========= ROTAS ========= */

// Cadastro usuário

app.post('/usuarios', async (req, res) => {
  const { nome, email, senha } = req.body;
  try {
    // TODO: troque por hash com bcrypt
    const { data, error } = await supabase
      .from('usuarios')
      .insert([{ nome, email, senha }])
      .select();
    if (error) throw error;

    const usuario = data[0];

    // Gerar token JWT
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Retornar usuário e token
    res.json({ usuario, token });
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

// Login usuário
app.post('/login', async (req, res) => {
  console.log('req.body:', req.body);
  const { email, senha } = req.body;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    console.log('data:', data, 'error:', error);
    if (error || !data || data.senha !== senha) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }
    const token = jwt.sign({ id: data.id, nome: data.nome }, SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// Buscar histórico da sessão
app.get('/chat-historico/:sessionId', autenticarToken, async (req, res) => {
  const { sessionId } = req.params;
  try {
    let q = supabase
      .from('historico')
      .select('id, pergunta, resposta, session_id, criado_em')
      .eq('usuario_id', req.usuario.id);

    if (sessionId !== "null") {
      q = q.eq('session_id', sessionId);
    }

    const { data, error } = await q.order('id', { ascending: true }); // ordem cronológica
    if (error) throw error;

    res.json({ mensagens: data || [] });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});


// CHAT RAG
app.post('/chat-rag', autenticarToken, async (req, res) => {
  const { mensagem, sessionId } = req.body;
  if (!mensagem) return res.status(400).json({ erro: 'Mensagem obrigatória' });

  try {
    // Se o usuário pedir explicitamente as últimas N mensagens enviadas, responde determinísticamente a partir do banco
    const msgLower = String(mensagem).toLowerCase();
    const pedeUltimas =
      (msgLower.includes('ultimas') || msgLower.includes('últimas')) &&
      msgLower.includes('mensagens') &&
      (msgLower.includes('te enviei') || msgLower.includes('enviei') || msgLower.includes('te mandei') || msgLower.includes('mandei'));

    if (pedeUltimas) {
      // tenta extrair N; padrão 10
      let n = 10;
      const m = msgLower.match(/(\d+)\s+(?:mensagens?|msgs?|menssagens?)/) || msgLower.match(/(?:últimas?|ultimas?)\s+(\d+)\s+(?:mensagens?|msgs?|menssagens?)/);
      if (m) {
        const parsed = parseInt(m[1] || m[2], 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 100) n = parsed;
      }

      let q = supabase
        .from('historico')
        .select('id, pergunta, criado_em, session_id')
        .eq('usuario_id', req.usuario.id);

      if (sessionId) q = q.eq('session_id', sessionId);

      const { data: msgsData, error: msgsError } = await q
        .order('id', { ascending: false })
        .limit(n);

      if (msgsError) throw msgsError;

      // cronológica: mais antiga -> mais recente
      const lista = (msgsData || [])
        .sort((a, b) => a.id - b.id)
        .map(r => r.pergunta);

      const resposta = `Aqui estão suas últimas ${lista.length} mensagens (da mais antiga para a mais recente):\n\n` +
        lista.map((t, i) => `${i + 1}. "${t}"`).join('\n');

      return res.json({ resposta });
    }

    // 1) Buscar contexto RAG (documentos + histórico do usuário/sessão), com embedding
    const contexto = await buscarContextoNoSupabase(mensagem, sessionId || null, req.usuario.id);

    // 2) Buscar histórico recente (somente para estruturar o chat com papéis), em ordem cronológica
    let hq = supabase
      .from('historico')
      .select('id, pergunta, resposta, session_id')
      .eq('usuario_id', req.usuario.id);

    if (sessionId) hq = hq.eq('session_id', sessionId);

    const { data: histData, error: histError } = await hq
      .order('id', { ascending: false })
      .limit(10);

    if (histError) throw histError;

    const historicoCronologico = Array.isArray(histData)
      ? [...histData].sort((a, b) => a.id - b.id)
      : [];

    // 3) Montar mensagens com papéis para o Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    // Instruções do sistema/preambulo
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

Não cite as experiencias e trajetória do Dr. Sérgio Spritzer, apenas utilize o conhecimento. Nem descrição dele, apenas se for perguntado. Se for perguntado qual a base de conhecimento/dados ou algo do tipo, responda que é baseado nos livros e ensinamentos do Dr. Sérgio Spritzer.
`.trim();

    const mensagens = [];

    // Opcional: Colocar instruções como primeiro "user" (se systemInstruction não for suportado)
    mensagens.push({ role: 'user', parts: [{ text: `[INSTRUCOES]\n${instrucoes}` }] });

    // Contexto RAG como mensagem separada (não é pergunta)
    if (contexto && contexto.trim().length > 0) {
      mensagens.push({
        role: 'user',
        parts: [{ text: `Contexto relevante (não responda ainda, apenas use como base):\n\n${contexto}` }]
      });
    }

    // Histórico com papéis, em ordem cronológica
    for (const h of historicoCronologico) {
      if (h.pergunta) {
        mensagens.push({ role: 'user', parts: [{ text: h.pergunta }] });
      }
      if (h.resposta) {
        mensagens.push({ role: 'model', parts: [{ text: h.resposta }] });
      }
    }

    // Mensagem atual do usuário
    mensagens.push({ role: 'user', parts: [{ text: mensagem }] });

    const result = await model.generateContent({ contents: mensagens });
    const resposta = await result.response.text();

    // 4) Salvar no histórico, incluindo session_id
    await supabase.from('historico').insert([{
      usuario_id: req.usuario.id,
      session_id: sessionId || null,
      pergunta: mensagem,
      resposta
    }]);

    res.json({ resposta });
  } catch (error) {
    console.error('Erro no chat-rag:', error);
    res.status(500).json({ erro: 'Falha ao processar pergunta' });
  }
});

// Função para buscar contexto (documentos + histórico) via RPC RAG
async function buscarContextoNoSupabase(pergunta, sessionId, usuarioId) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Embedding da pergunta
  const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const embedResp = await embeddingModel.embedContent(pergunta);
  const vector = embedResp?.embedding?.values || [];

  try {
    // ATENÇÃO: nomes de parâmetros devem bater com a função SQL (p_*)
    const { data, error } = await supabase.rpc('match_documents_and_history', {
      p_query_embedding: vector,
      p_match_count: 5,
      p_history_count: 10,
      p_usuario_id: usuarioId,
      p_session_id: sessionId || null
    });

    if (error) throw error;

    const historicos = (data || []).filter(i => i.tipo === 'historico').map(i => i.content);
    const documentos = (data || []).filter(i => i.tipo === 'documento').map(i => i.content);

    // contexto = histórico (já vem em ordem cronológica pela função) + docs relevantes
    const contexto = [...historicos, ...documentos].join('\n');
    return contexto;
  } catch (e) {
    console.warn('RPC match_documents_and_history indisponível, usando fallback:', e?.message || e);

    // Fallback: match_documents para docs
    let documentos = [];
    try {
      const { data: docsData, error: docsError } = await supabase.rpc('match_documents', {
        query_embedding: vector,
        match_count: 5,
        filter: null
      });
      if (!docsError && Array.isArray(docsData)) {
        documentos = docsData.map(d => d.content).filter(Boolean);
      }
    } catch {}

    // Fallback: histórico do usuário/sessão - em ordem cronológica
    let historicos = [];
    try {
      let q = supabase
        .from('historico')
        .select('pergunta, resposta, id, session_id')
        .eq('usuario_id', usuarioId);
      if (sessionId) q = q.eq('session_id', sessionId);
      const { data: histData, error: histError } = await q
        .order('id', { ascending: false })
        .limit(10);

      if (!histError && Array.isArray(histData)) {
        const ordenado = [...histData].sort((a, b) => a.id - b.id);
        historicos = ordenado.map(h => `${h.pergunta}\n${h.resposta}`).filter(Boolean);
      }
    } catch {}

    return [...historicos, ...documentos].join('\n');
  }

}