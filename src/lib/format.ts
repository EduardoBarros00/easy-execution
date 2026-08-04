export const brl = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return date.toLocaleDateString("pt-BR");
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const waLink = (phone: string | null | undefined, text?: string) => {
  if (!phone) return "#";
  const digits = phone.replace(/\D/g, "");
  const t = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits.startsWith("55") ? digits : "55" + digits}${t}`;
};
