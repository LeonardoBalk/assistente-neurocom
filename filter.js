function ensureFirstPersonStart(text) {
  const t = (text || "").trim();
  if (!t) return t;
  // Se não começa com "Eu"/"eu", não força; apenas evita capitalização neutra.
  return t;
}

function toThirdPerson(text) {
  if (!text) return text;
  return text
    .replace(/\b(você|vc|tu|teu|tua|te|contigo)\b/gi, "o interlocutor")
    .replace(/\bseu\b/gi, "do interlocutor")
    .replace(/\bsua\b/gi, "da interlocutora")
    .replace(/\bseus\b/gi, "dos interlocutores")
    .replace(/\bsuas\b/gi, "das interlocutoras");
}

function toFirstPlural(text) {
  if (!text) return text;
  return text
    .replace(/\b[Ee]u\b/g, "nós")
    .replace(/\bmeu\b/gi, "nosso")
    .replace(/\bminha\b/gi, "nossa")
    .replace(/\bmeus\b/gi, "nossos")
    .replace(/\bminhas\b/gi, "nossas")
    .replace(/\bpara mim\b/gi, "para nós")
    .replace(/\bem mim\b/gi, "em nós");
}

function applyDialogicFilter(baseEU, posicao, pergunta) {
  const perguntaLimpa = (pergunta || "").trim();
  const base = ensureFirstPersonStart((baseEU || "").trim());

  if (posicao === "TU") {
    // Direto para o interlocutor
    return [
      perguntaLimpa ? `Eu acolho o que tu trazes: "${perguntaLimpa}".` : "",
      base,
      "Se fizer sentido, podemos seguir explorando isso juntos."
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (posicao === "ELE") {
    // Observação em terceira pessoa
    const t = toThirdPerson(base).replace(/^eu\s+/i, "Eu ");
    return [
      perguntaLimpa ? `Diante da questão "${perguntaLimpa}", eu observo que` : "Eu observo que",
      t.charAt(0).toLowerCase() + t.slice(1)
    ].join(" ");
  }

  if (posicao === "NOS") {
    // Coconstrução (nós)
    const t = toFirstPlural(base);
    return [
      perguntaLimpa ? `Refletindo juntos sobre "${perguntaLimpa}",` : "Refletindo juntos,",
      t.charAt(0).toLowerCase() + t.slice(1),
      "Podemos avançar abrindo espaço para o próximo passo que emerja."
    ]
      .filter(Boolean)
      .join(" ");
  }

  // fallback
  return base;
}

module.exports = {
  applyDialogicFilter
};