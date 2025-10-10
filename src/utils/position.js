// normaliza a posição do interlocutor (TU, ELE, NOS)
export function normalizarPosicao(p) {
  const v = (p || "TU").toString().trim().toUpperCase();
  if (["TU", "ELE", "NOS"].includes(v)) return v;
  if (v === "NÓS" || v === "NOSSO" || v === "NOSSA") return "NOS";
  return "TU";
}