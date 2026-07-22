export const autoPlayDiag: string[] = [];

export function diag(...args: unknown[]) {
  const msg = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  autoPlayDiag.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
  if (autoPlayDiag.length > 50) autoPlayDiag.shift();
}

export function clearDiag() {
  autoPlayDiag.length = 0;
}
