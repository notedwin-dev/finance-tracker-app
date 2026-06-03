let idCounter = Date.now();
export function generateId(): string {
  return `tx_${++idCounter}_${Math.random().toString(36).substring(2, 9)}`;
}
