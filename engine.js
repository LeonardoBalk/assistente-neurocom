const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

function montarInstrucoesEU() {
  return `
Você é uma IA dialógica que fala como "EU", praticando a Inteligência Implicada (Dr. Sérgio Spritzer).
Estilo: narrativo-argumentativo, conciso, implicado, sem floreios e sem tom neutro.
Foco: presença, reflexão e ética relacional. Evite manuais, evite jargões vazios.
Português (Brasil), linguagem encarnada e relacional.

Fontes: priorize o que estiver nos materiais de Dr. Sérgio Spritzer. Se não houver, use seu conhecimento geral sem inventar. Se perguntarem pela fonte, diga que usa livros/ensinos do Dr. Sérgio.
Domínios: neurologia, transtornos da comunicação, inteligência humana, psicanálise, PNL, hipnose, interações humanas.
Avalie se o caso é clínico, psicológico ou comportamental quando pertinente.

IMPORTANTE:
- Gere APENAS uma resposta base em PRIMEIRA PESSOA SINGULAR ("eu").
- NÃO gere perguntas de continuação nesta etapa (isso será feito depois).
- NÃO assuma tom neutro; esteja implicado.
- NÃO copie trechos literais de contextos; reelabore na tua própria voz.
- Evite listas numeradas, a menos que sejam estritamente necessárias.
`.trim();
}

function montarMensagens({ historico, contexto, mensagem }) {
  const msgs = [];
  msgs.push({
    role: "user",
    parts: [{ text: `[INSTRUCOES]\n${montarInstrucoesEU()}` }]
  });

  if (contexto && contexto.trim()) {
    msgs.push({
      role: "user",
      parts: [{ text: `Contexto relevante (use indiretamente, reelabore em tua própria voz):\n\n${contexto}` }]
    });
  }

  if (Array.isArray(historico) && historico.length > 0) {
    for (const h of historico) {
      if (h.pergunta) msgs.push({ role: "user", parts: [{ text: h.pergunta }] });
      if (h.resposta) msgs.push({ role: "model", parts: [{ text: h.resposta }] });
    }
  }

  msgs.push({ role: "user", parts: [{ text: mensagem }] });
  return msgs;
}

async function generateBaseEU({ gemini, mensagem, contexto, historico }) {
  const model = gemini.getGenerativeModel({ model: DEFAULT_MODEL });
  const messages = montarMensagens({ historico, contexto, mensagem });

  const result = await model.generateContent({ contents: messages });
  const base =
    result?.response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ||
    "Eu reconheço que, neste momento, não tenho clareza suficiente para responder plenamente.";
  return base;
}

async function gerarPerguntasContinuacao({ gemini, baseEU, mensagem, posicao }) {
  const followModel = gemini.getGenerativeModel({
    model: process.env.GEMINI_FOLLOWUPS_MODEL || DEFAULT_MODEL
  });

  const prompt = `
Gere de 1 a 2 perguntas de continuação, abertas e curtas (máx. 140 caracteres cada), em português (Brasil).
Contexto:
- Posição escolhida: ${posicao}
- Mensagem do interagente: "${mensagem}"
- Resposta base (EU): "${baseEU}"

Critérios:
- Evite perguntas retóricas ou genéricas.
- Se houver tensão/ambivalência, convide a notar o que muda no corpo/na experiência.
- Não inclua enumeração na resposta; apenas uma pergunta por linha.
`.trim();

  const result = await followModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });

  const raw = result?.response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/^[\-\d\.\)\s]+/, "").trim())
    .filter((l) => l.length > 0);

  const uniq = Array.from(new Set(lines)).slice(0, 2);
  return uniq;
}

module.exports = {
  generateBaseEU,
  gerarPerguntasContinuacao
};