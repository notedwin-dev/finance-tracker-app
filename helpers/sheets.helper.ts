// Helper to convert Google Sheets serial date number to YYYY-MM-DD string
export const fromSerialDate = (serial: number | any): string => {
  if (typeof serial !== "number") return String(serial || "");
  // If it's a large number, it's definitely a timestamp (Date.now()) or ID, not a serial date
  if (serial > 100000) return String(serial);

  // Excel/Sheets base date is Dec 30, 1899 in UTC
  const baseDate = Date.UTC(1899, 11, 30);
  const d = new Date(baseDate + serial * 24 * 60 * 60 * 1000);

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const fromSerialTime = (serial: number | any): string => {
  if (typeof serial !== "number") return String(serial || "");
  // Time is a fraction of a day
  const fraction = serial % 1;
  const totalSeconds = Math.round(fraction * 24 * 3600);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  return `${h}:${m}`;
};
