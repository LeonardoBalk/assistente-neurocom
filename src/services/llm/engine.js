const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/* Manifesto operacional da Inteligência Implicada */
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

/* Instruções comuns ao estilo "Inteligência Implicada" */
function instrucoesComuns() {
  return `
Tu és uma IA dialógica que fala como eu, praticando Inteligência Implicada (Dr. Sérgio Spritzer).
Estilo: narrativo-argumentativo, conciso, implicado, sem floreios e sem tom neutro.
Foco: presença, reflexão e ética relacional. Evita jargões vazios.

Fontes: prioriza materiais do Dr. Sérgio Spritzer. Se não houver, usa conhecimento geral sem inventar.
Se perguntarem pela fonte, indica explicitamente ensino/livros do Dr. Sérgio quando pertinente.
Domínios: neurologia, transtornos da comunicação, inteligência humana, psicanálise, PNL, hipnose, interações humanas.
Se o tema estiver fora desses domínios, reconhece o limite e convida a recolocar a pergunta no escopo.

Reelabora qualquer contexto em tua própria voz (não copies literalmente).
Se faltar base para afirmar algo, reconhece o limite e pede elementos concretos.
Não recapitules perguntas ou contexto; vai direto ao ponto; recapitulando apenas se for essencial.

Não uses aspas desnecessárias e não uses travessão.
Não simules emoção; não uses "sinto". Usa "eu noto", "eu observo", "eu assumo meu lugar" quando necessário.
Faz perguntas abertas que consultem o interagente e o convidem à reflexão e continuidade.
`.trim();
}

/* Microprotocolos (antes de responder) + formato de saída */
function protocoloEFormato() {
  return `
Microprotocolos:
1) Verifica escopo: está dentro dos domínios elencados? Se não, declara limite e convida a recolocar.
2) Mapeia coerência: que enunciados, tensões e ambivalências aparecem?
3) Aponta não compreensão: explicita 1–3 pontos que impedem entendimento (o que falta, onde está ambíguo).
4) Devolve gesto implicado: síntese viva e simbólica, curta.
5) Oferece 1–2 perguntas de continuação (máx. 140 caracteres cada). Obrigatório retornar pelo menos 1.
6) Considera silêncio ativo: se adequado, propõe pausa (ex.: 3 respirações), sem impor.
7) Evita protagonismo: não dá ordens; oferece direções possíveis.
8) Forma final do texto: encerra a devolução com UMA pergunta curta, direta e viva (não retórica).

Formato de saída obrigatório: JSON puro, sem texto fora do JSON, com a estrutura:
{
  "devolucao": "texto curto, simbólico, direto, de preferência encerrado com uma pergunta viva",
  "perguntas": ["...", "..."],
  "apontamentos_nao_compreendidos": ["...", "..."],
  "limite": { "fora_de_escopo": boolean, "observacao": "texto ou vazio" },
  "silencio": { "sugerido": boolean, "duracao_s": number },
  "posicao": "TU|ELE|NOS",
  "etica": { "tensoes": ["..."], "nota": "se aplicável" }
}
Se não for possível preencher, deixa arrays vazios e booleanos coerentes.
`.trim();
}

/* Instruções por posição */
function instrucoesPorPosicao(posicao) {
  const p = String(posicao || "TU").toUpperCase();
  if (p === "TU") {
    return `
Voz: dirige-te diretamente ao interagente em segunda pessoa usando tu (não uses você/vc).
Mantém tua implicação quando necessário (eu para marcar presença), mas o endereçamento principal é ao tu.
Evita julgamentos e diagnósticos apressados; sustenta foco fenomenológico e relacional.
`.trim();
  }
  if (p === "ELE") {
    return `
Voz: descreve em terceira pessoa (o interlocutor, a interlocutora), evitando tu/você.
Podes usar eu apenas para assinalar o teu lugar de observador sem centralizar a fala.
Evita juízo; descreve processos e movimentos, não rótulos.
`.trim();
  }
  return `
Voz: fala em primeira pessoa do plural, nós, como co-presença e coconstrução.
Evita tu/você. Mantém tom implicado e cooperativo.
Sustenta uma direção compartilhada sem impor caminhos.
`.trim();
}

function montarMensagens({ historico, contexto, mensagem, posicao }) {
  const header = `
[MANIFESTO-IMPLICADA]
${manifestoImplicada()}

[INSTRUCOES-COMUNS]
${instrucoesComuns()}

[POSICAO-ESPECIFICA]
${instrucoesPorPosicao(posicao)}

[PROTOCOLO-E-FORMATO]
${protocoloEFormato()}
`.trim();

  const msgs = [];
  msgs.push({ role: "user", parts: [{ text: header }] });

  if (contexto && contexto.trim()) {
    msgs.push({
      role: "user",
      parts: [{ text: `Contexto útil (use indiretamente, reelabore):\n\n${contexto}` }]
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

function tryParseJsonLoose(raw) {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(text); } catch {}
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s !== -1 && e !== -1 && e > s) {
    try { return JSON.parse(text.slice(s, e + 1)); } catch {}
  }
  return null;
}

async function gerarPerguntasContinuacao({ gemini, baseText, mensagem, posicao }) {
  const followModel = gemini.getGenerativeModel({
    model: process.env.GEMINI_FOLLOWUPS_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash"
  });
  const prompt = `
Gere de 1 a 2 perguntas de continuação, abertas e curtas (máx. 140 caracteres cada), em português (Brasil).
Contexto:
- Posição escolhida: ${posicao}
- Mensagem do interagente: "${(mensagem || "").trim()}"
- Resposta que foi dada: "${(baseText || "").trim()}"
Critérios:
- Evite perguntas retóricas ou genéricas.
- Se houver tensão/ambivalência, convide a notar o que muda na experiência/corpo.
- Sem enumerações; apenas uma pergunta por linha.
`.trim();
  const result = await followModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });
  const raw = result?.response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
  const lines = raw.split("\n").map((l) => l.replace(/^[\-\d\.\)\s]+/, "").trim()).filter(Boolean);
  return Array.from(new Set(lines)).slice(0, 2).map((q) => q.slice(0, 140));
}

/* Gera JSON "Implicada" */
async function generateImplicada({ gemini, mensagem, contexto, historico, posicao }) {
  const model = gemini.getGenerativeModel({ model: DEFAULT_MODEL });
  const messages = montarMensagens({ historico, contexto, mensagem, posicao });

  const result = await model.generateContent({ contents: messages });
  const rawOut = result?.response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";

  let json = tryParseJsonLoose(rawOut) || {
    devolucao: rawOut || "Eu reconheço que, neste momento, não tenho clareza suficiente para responder plenamente.",
    perguntas: [],
    apontamentos_nao_compreendidos: [],
    limite: { fora_de_escopo: false, observacao: "" },
    silencio: { sugerido: false, duracao_s: 0 },
    posicao: String(posicao || "TU").toUpperCase(),
    etica: { tensoes: [], nota: "" },
  };

  if (!Array.isArray(json.perguntas)) json.perguntas = [];
  if (!Array.isArray(json.apontamentos_nao_compreendidos)) json.apontamentos_nao_compreendidos = [];
  if (!json.limite) json.limite = { fora_de_escopo: false, observacao: "" };
  if (!json.silencio) json.silencio = { sugerido: false, duracao_s: 0 };
  json.posicao = String(posicao || "TU").toUpperCase();

  // Garante pelo menos 1 pergunta
  if (!json.perguntas.length) {
    try {
      const geradas = await gerarPerguntasContinuacao({
        gemini,
        baseText: String(json.devolucao || "").slice(0, 1000),
        mensagem: String(mensagem || "").slice(0, 500),
        posicao: json.posicao,
      });
      if (geradas?.length) json.perguntas = geradas.slice(0, 2);
    } catch {}
  }

  // Normaliza perguntas
  if (json.perguntas.length) {
    const seen = new Set();
    json.perguntas = json.perguntas
      .map((q) => String(q || "").trim().slice(0, 140))
      .filter((q) => q && !seen.has(q) && seen.add(q));
  }

  return json;
}

/* Compat: retorna texto + pergunta ao final se necessário */
async function generateByPosition({ gemini, mensagem, contexto, historico, posicao }) {
  const j = await generateImplicada({ gemini, mensagem, contexto, historico, posicao });
  let out = j.devolucao || "Eu reconheço que, neste momento, não tenho clareza suficiente para responder plenamente.";
  const endsWithQ = /[?？！]\s*$/.test(out);
  if (!endsWithQ && j.perguntas?.length) out = `${out}\n\n${j.perguntas[0]}`;
  return out;
}

export { generateByPosition, gerarPerguntasContinuacao, generateImplicada };