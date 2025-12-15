// normaliza a posição do interlocutor (TU, ELE, NOS)
export function normalizarPosicao(p) {
  const v = (p || "VOCÊ").toString().trim().toUpperCase();
  if (["VOCÊ", "ELE", "NÓS"].includes(v)) return v;
  if (v === "NÓS" || v === "NOSSO" || v === "NOSSA") return "NÓS";
  return "VOCÊ";
}