import { isToday, isYesterday } from "date-fns";
import { parseDateSafe, formatDateReadable } from "../../helpers/transactions.helper";

export function formatDateHeader(dateStr: string | number): string {
  const date = parseDateSafe(dateStr);

  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";

  return formatDateReadable(date);
}
