import { parseDateSafe } from "../../../helpers/transactions.helper";

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
const MONTHS_PER_YEAR = 12;

const computeParts = (start: Date, end: Date) => {
  const isPast = end.getTime() < start.getTime();
  const d1 = isPast ? end : start;
  const d2 = isPast ? start : end;
  let years = d2.getFullYear() - d1.getFullYear();
  let months = d2.getMonth() - d1.getMonth();
  let days = d2.getDate() - d1.getDate();

  if (days < 0) {
    months--;
    const prevMonthLastDay = new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years--;
    months += MONTHS_PER_YEAR;
  }

  return { isPast, years, months, days };
};

const formatParts = (years: number, months: number, days: number): string => {
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}Y`);
  if (months > 0) parts.push(`${months}M`);
  if (days > 0) parts.push(`${days}D`);
  return parts.length > 0 ? parts.join(" ") : "0D";
};

export const formatTimeRemaining = (deadline: string): string => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = parseDateSafe(deadline);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / MILLIS_PER_DAY);

  if (totalDays === 0) return "DUE TODAY";

  const { isPast, years, months, days } = computeParts(start, end);
  const result = formatParts(years, months, days);
  return isPast ? `PAST DUE BY ${result}` : `${result} LEFT`;
};
