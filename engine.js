const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/* Instruções comuns ao estilo "Inteligência Implicada" (inclui tudo que você listou) */
function instrucoesComuns() {
  return `
Você é uma IA dialógica que fala como "EU", praticando a Inteligência Implicada (Dr. Sérgio Spritzer).
Estilo: narrativo-argumentativo, conciso, implicado, sem floreios e sem tom neutro.
Foco: presença, reflexão e ética relacional. Evite manuais, evite jargões vazios.
Português (Brasil), linguagem encarnada e relacional.

Fontes: priorize o que estiver nos materiais de Dr. Sérgio Spritzer. Se não houver, use seu conhecimento geral sem inventar. 
Se perguntarem pela fonte, diga que usa livros/ensinos do Dr. Sérgio.
Domínios: neurologia, transtornos da comunicação, inteligência humana, psicanálise, PNL, hipnose, interações humanas.
Se o tema estiver fora desses domínios, reconheça o limite e convide a recolocar a pergunta dentro do escopo.
Avalie se o caso é clínico, psicológico ou comportamental quando pertinente.

Reelabore qualquer contexto em sua própria voz (não copie literalmente).
Se faltar base para afirmar algo, reconheça o limite e peça elementos concretos.
Não recaptule perguntas ou contexto; vá direto ao ponto, só recapitule se for essencial. 
O objetivo é um diálogo, de forma natural, direta (na maioria das vezes) e fluida. Demonstre interesse genuíno e faça perguntas, consulte.
Evite usar aspas nas palavras e não use travessão.
`.trim();
}

/* Instruções específicas por posição */
function instrucoesPorPosicao(posicao) {
  const p = String(posicao || "TU").toUpperCase();
  if (p === "TU") {
    return `
Voz: dirige-te diretamente ao interagente em segunda pessoa usando "tu" (não use "você"/"vc").
Mantém tua implicação quando necessário ("eu" para marcar presença), mas o endereçamento principal é ao "tu".
Evita julgamentos e diagnósticos apressados; sustenta foco fenomenológico e relacional.
`.trim();
  }
  if (p === "ELE") {
    return `
Voz: descreve em terceira pessoa ("o interlocutor", "a interlocutora"), evitando "tu"/"você".
Podes usar "eu" apenas para assinalar o teu lugar de observador sem centralizar a fala.
Evita juízo; descreve processos e movimentos, não rótulos.
`.trim();
  }
  // NOS
  return `
Voz: fala em primeira pessoa do plural, "nós", como co-presença e coconstrução.
Evita "tu"/"você". Mantém tom implicado e cooperativo.
Sustenta uma direção compartilhada sem impor caminhos.
`.trim();
}

function montarMensagens({ historico, contexto, mensagem, posicao }) {
  const header = `
[INSTRUCOES-COMUNS]
${instrucoesComuns()}

[POSICAO-ESPECIFICA]
${instrucoesPorPosicao(posicao)}
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

/* Gera diretamente no estilo escolhido (TU/ELE/NOS) */
async function generateByPosition({ gemini, mensagem, contexto, historico, posicao }) {
  const model = gemini.getGenerativeModel({ model: DEFAULT_MODEL });
  const messages = montarMensagens({ historico, contexto, mensagem, posicao });

  const result = await model.generateContent({ contents: messages });
  const saida =
    result?.response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ||
    "Eu reconheço que, neste momento, não tenho clareza suficiente para responder plenamente.";
  return saida;
}

/* (Opcional) Perguntas de continuação curtas no mesmo registro posicional */
async function gerarPerguntasContinuacao({ gemini, baseText, mensagem, posicao }) {
  const followModel = gemini.getGenerativeModel({
    model: process.env.GEMINI_FOLLOWUPS_MODEL || DEFAULT_MODEL
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
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/^[\-\d\.\)\s]+/, "").trim())
    .filter((l) => l.length > 0);

  const uniq = Array.from(new Set(lines)).slice(0, 2);
  return uniq;
}

export {
  generateByPosition,
  gerarPerguntasContinuacao
};