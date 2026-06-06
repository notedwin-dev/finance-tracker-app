export function generateId(): string {
  return `tx_${crypto.randomUUID()}`;
}
