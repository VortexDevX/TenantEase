export function rupeesToPaisa(value: string | number) {
  const raw = String(value).trim().replace(/,/g, "");

  if (!/^\d+(\.\d{0,2})?$/.test(raw)) {
    return Number.NaN;
  }

  const [rupees, paise = ""] = raw.split(".");
  const normalizedPaise = `${paise}00`.slice(0, 2);
  return Number(rupees) * 100 + Number(normalizedPaise);
}

export function paisaToRupeesInput(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  const rupees = Math.trunc(value / 100);
  const paise = Math.abs(value % 100);
  return paise === 0 ? String(rupees) : `${rupees}.${String(paise).padStart(2, "0")}`;
}
