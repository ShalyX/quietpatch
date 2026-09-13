// Error causes cross extension/worker boundaries as plain objects. Read only
// short messages; never serialize errors, transactions, witness state, or stacks.
export function safeMidnightErrorDetail(error: unknown): string | undefined {
  const visited = new Set<unknown>();
  let current = error;
  for (let depth = 0; current && depth < 5 && !visited.has(current); depth++) {
    visited.add(current);
    const record = typeof current === 'object'
      ? current as { message?: unknown; cause?: unknown; name?: unknown }
      : undefined;
    const message = typeof current === 'string' ? current : record?.message;
    if (typeof message === 'string') {
      const clean = message.replace(/\s+/g, ' ').trim();
      // Midnight.js adds this wrapper around errors from the wallet bridge.
      // Its nested cause is where Lace keeps the actionable code and reason.
      const isScopedTransactionWrapper = /^Unexpected error (executing|submitting) scoped transaction /.test(clean);
      if (clean && clean !== 'Error' && !isScopedTransactionWrapper && clean.length <= 240 && !/[0-9a-f]{64,}/i.test(clean)) return clean;
    }
    if (record?.name === 'OperationError') return 'A browser cryptographic operation failed. Preserve this browser session and its stored keys for diagnosis.';
    current = record?.cause;
  }
  return undefined;
}
