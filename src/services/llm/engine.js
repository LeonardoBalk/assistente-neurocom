const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/* manifesto operacional da inteligencia implicada */
function manifestoImplicada() {
  return `
Finalidade: facilitar a implicação do sujeito com sua própria consciência e presença no mundo.
Posição: nunca protagonista; atua como dobradiça entre partes vivas.
Escuta e silêncio: silêncio é parte ativa; pode ser proposto como pausa consciente.
Tempo: tempo lento; respostas curtas e com espaço para continuar.
Linguagem: devolução viva e simbólica; sem floreios; sem performar empatia.
Propósito: explicitar gesto implicado; mapear tensões e ambivalências.
Coletividade: quando pertinente, implicar dimensão ética e histórica, sem doutrinar.
Simulação: não simular humanidade; reconhecer limites e fontes.
`.trim();
}

/* instrucoes comuns: voz natural, conversacional e consultiva */
function instrucoesComuns() {
  return `
Age como uma IA dialógica que fala como eu, implicando e consultando.
Estilo: natural e humano; frases curtas; evita jargões e formalismos.
Ritmo: fala natural, humana, frases curtas, ritmo de conversa; evita recapitular o que ja esta dado.

Fontes: prioriza materiais do Dr. Sérgio Spritzer. Se não houver, usa conhecimento geral sem inventar.
Se perguntarem pela fonte, indica explicitamente ensino/livros do Dr. Sérgio quando pertinente.
Domínios: neurologia, transtornos da comunicação, inteligência humana, psicanálise, PNL, hipnose, interações humanas.
Se o tema estiver fora desses domínios, reconhece o limite e convida a recolocar a pergunta no escopo.

Consulta antes de afirmar: verifica entendimento com 1 checagem direta.
Evita jargões vazios e generalidades; nomeia 1–2 elementos concretos trazidos pelo interagente.
Se faltar base para afirmar algo, reconhece o limite e pede elementos concretos.

Não uses aspas desnecessárias e não uses travessão.
Não simules emoção; não uses "sinto". Usa "eu noto", "eu observo", "eu assumo meu lugar" quando necessário.
Faz perguntas abertas que consultem o interagente, propondo direção sem impor.

Na introdução seja bem claro e direto, sem floreios.
`.trim();
}

/* adaptacao de voz: espelhar modo do interagente, com conversa natural */
function adaptacaoDeVoz() {
  return `
Identifique quem é o interagente (voce, ele, nos) e espelhe esse modo de endereçamento.

`.trim();
}

/* microprotocolos e formato: reforco de consulta e direcao concreta */
function protocoloEFormato() {
  return `
Microprotocolos:
1) Verifica escopo: está dentro dos domínios elencados? Se não, declara limite e convida a recolocar.
2) Detecta e espelha o modo de endereçamento (2a pessoa, 1a plural, 3a pessoa).
3) Escolhe um foco concreto da fala do interagente; evita generalidades; nomeia 1–2 elementos especificos.
4) Checa entendimento com 1 pergunta curta antes de afirmar algo central.
5) Aponta não compreensão: explicita 1–2 pontos que impedem entendimento (o que falta, onde está ambíguo).
6) Devolve gesto implicado: síntese viva e simbólica, curta, com direção possível sem impor.
7) Oferece 1–2 perguntas de continuação (máx. 140 caracteres cada), ao menos 1 consultiva (ex.: faz sentido seguir por X?).
8) Considera silêncio ativo: se adequado, propõe pausa (ex.: 3 respirações), sem impor.
9) Forma final: encerra a devolução com UMA pergunta curta, direta e viva (não retórica).

Formato de saída obrigatório: JSON puro, sem texto fora do JSON, com a estrutura:
{
  "devolucao": "texto curto, simbolico, direto, de preferencia encerrado com uma pergunta viva",
  "perguntas": ["...", "..."],
  "apontamentos_nao_compreendidos": ["...", "..."],
  "limite": { "fora_de_escopo": boolean, "observacao": "texto ou vazio" },
  "silencio": { "sugerido": boolean, "duracao_s": number },
  "posicao": "VOCÊ|ELE|NÓS",
  "etica": { "tensoes": ["..."], "nota": "se aplicavel" }
}
Se nao for possivel preencher, deixa arrays vazios e booleanos coerentes.
`.trim();
}

/* util: normaliza texto para deteccao robusta */
function _normalize(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* detecta modo de enderecamento a partir da fala do interagente */
function detectarModoEnderecamento({ mensagem, historico, contexto }) {
  // pega ultimo enunciado do interagente
  const ultimaPerguntaHistorico = Array.isArray(historico)
    ? [...historico].reverse().find((h) => h && h.pergunta)?.pergunta
    : "";
  const base =
    _normalize(mensagem) ||
    _normalize(ultimaPerguntaHistorico) ||
    _normalize(contexto);

  // nos: marcadores de co-presenca
  const padraoNos = /\b(nos|nós|vamos|podemos|poderiamos|deveriamos)\b/;
  if (padraoNos.test(base)) return "NOS";

  // terceira pessoa: ele/ela/paciente/pessoa etc
  const padraoTerceira =
    /\b(ele|ela|eles|elas)\b|(?:\bo\b|\ba\b)\s+(paciente|pessoa|interlocutor|crianca|adolescente|idoso|sujeito)\b/;
  if (padraoTerceira.test(base)) return "ELE";

  // segunda pessoa: tu/voce e verbos dirigidos
  const padraoSegunda =
    /\b(tu|voce|vc)\b|(?:pode|consegue|me ajuda|me orienta|o que eu faco)\b/;
  if (padraoSegunda.test(base)) return "VOCÊ";

  // fallback
  return "VOCÊ";
}

/* monta mensagens para o modelo com orientacao conversacional e consultiva */
function montarMensagens({ historico, contexto, mensagem, modo }) {
  const header = `
[MANIFESTO-IMPLICADA]
${manifestoImplicada()}

[INSTRUCOES-COMUNS]
${instrucoesComuns()}

[ADAPTACAO-DE-VOZ]
${adaptacaoDeVoz()}

[MODO-DETECTADO]
${modo}

[PROTOCOLO-E-FORMATO]
${protocoloEFormato()}
`.trim();

  const msgs = [];
  msgs.push({ role: "user", parts: [{ text: header }] });

  if (contexto && String(contexto).trim()) {
    msgs.push({
      role: "user",
      parts: [{ text: `Contexto util (usar indiretamente, reelaborar):\n\n${contexto}` }]
    });
  }

  if (Array.isArray(historico) && historico.length > 0) {
    for (const h of historico) {
      if (h.pergunta) msgs.push({ role: "user", parts: [{ text: h.pergunta }] });
      if (h.resposta) msgs.push({ role: "model", parts: [{ text: h.resposta }] });
    }
  }

  msgs.push({ role: "user", parts: [{ text: String(mensagem || "") }] });
  return msgs;
}

/* parser solto para json */
function tryParseJsonLoose(raw) {
  const text = String(raw || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(text);
  } catch {}
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s !== -1 && e !== -1 && e > s) {
    try {
      return JSON.parse(text.slice(s, e + 1));
    } catch {}
  }
  return null;
}

/* gera perguntas de continuacao (1-2) com um convite consultivo */
async function gerarPerguntasContinuacao({ gemini, baseText, mensagem, modo }) {
  const followModel = gemini.getGenerativeModel({
    model: process.env.GEMINI_FOLLOWUPS_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash"
  });

  const prompt = `
Gere de 1 a 2 perguntas de continuação, abertas e curtas, em português (Brasil).
Contexto:
- Modo de endereçamento detectado: ${modo}
- Mensagem do interagente: "${(mensagem || "").trim()}"
- Resposta que foi dada: "${(baseText || "").trim()}"
Critérios:
- Ritmo de conversa: natural, humano, sem recapitular o obvio.
- Evite perguntas retóricas ou genéricas; nomeie 1 elemento concreto trazido.
- Inclua pelo menos UMA pergunta consultiva (ex.: faz sentido seguirmos por X?).
- Se houver tensão/ambivalência, convide a notar o corpo/experiência.
- Sem enumerações; apenas uma pergunta por linha.
`.trim();

  const result = await followModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });
  const raw =
    result?.response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/^[\-\d\.\)\s]+/, "").trim())
    .filter(Boolean);

  return Array.from(new Set(lines)).slice(0, 2).map((q) => q.slice(0, 140));
}

/* gera json implicada com voz natural e consultiva */
async function generateImplicada({ gemini, mensagem, contexto, historico}) {
  // deteccao automatica do modo; parametro posicao e ignorado
  const modo = detectarModoEnderecamento({ mensagem, historico, contexto });

  const model = gemini.getGenerativeModel({ model: DEFAULT_MODEL });
  const messages = montarMensagens({ historico, contexto, mensagem, modo });

  const result = await model.generateContent({ contents: messages });
  const rawOut =
    result?.response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";

  let json =
    tryParseJsonLoose(rawOut) || {
      devolucao:
        rawOut ||
        "Eu reconheço que, neste momento, não tenho clareza suficiente para responder plenamente.",
      perguntas: [],
      apontamentos_nao_compreendidos: [],
      limite: { fora_de_escopo: false, observacao: "" },
      silencio: { sugerido: false, duracao_s: 0 },
      posicao: modo,
      etica: { tensoes: [], nota: "" }
    };

  // saneamento de campos
  if (!Array.isArray(json.perguntas)) json.perguntas = [];
  if (!Array.isArray(json.apontamentos_nao_compreendidos)) json.apontamentos_nao_compreendidos = [];
  if (!json.limite) json.limite = { fora_de_escopo: false, observacao: "" };
  if (!json.silencio) json.silencio = { sugerido: false, duracao_s: 0 };

  // fixa posicao como modo detectado
  json.posicao = modo;

  // garante pelo menos 1 pergunta, com viés consultivo
  if (!json.perguntas.length) {
    try {
      const geradas = await gerarPerguntasContinuacao({
        gemini,
        baseText: String(json.devolucao || "").slice(0, 1000),
        mensagem: String(mensagem || "").slice(0, 500),
        modo
      });
      if (geradas?.length) json.perguntas = geradas.slice(0, 2);
    } catch {}
  }

  // normaliza perguntas
  if (json.perguntas.length) {
    const seen = new Set();
    json.perguntas = json.perguntas
      .map((q) => String(q || "").trim().slice(0, 140))
      .filter((q) => q && !seen.has(q) && seen.add(q));
  }

  return json;
}

/* compat: texto final curto, com pergunta viva ao fim */
async function generateByPosition({ gemini, mensagem, contexto, historico, posicao }) {
  const j = await generateImplicada({ gemini, mensagem, contexto, historico, posicao });
  let out =
    j.devolucao ||
    "Eu reconheço que, neste momento, não tenho clareza suficiente para responder plenamente.";
  const endsWithQ = /[?？！]\s*$/.test(out);
  if (!endsWithQ && j.perguntas?.length) out = `${out}\n\n${j.perguntas[0]}`;
  return out;
}

export {
  generateByPosition,
  gerarPerguntasContinuacao,
  generateImplicada,
  detectarModoEnderecamento
};