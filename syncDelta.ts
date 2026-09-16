/**
 * Pure helpers for smart-sync change detection.
 *
 * Kept separate from server.ts so the diffing logic can be unit-tested without
 * booting the HTTP server.
 */

/**
 * Stable identity for a shipment record, independent of its array position.
 * Google Sheets rows are keyed by shipment number + customer code.
 */
export function recordKey(rec: any): string {
  return `${String(rec?.shipment || '').trim()}::${String(rec?.code || '').trim().toUpperCase()}`;
}

/**
 * Fingerprint of a record's business fields. `id` is derived from the row
 * index and is excluded so that inserting a row does not mark every following
 * record as modified.
 */
export function recordFingerprint(rec: any): string {
  if (!rec || typeof rec !== 'object') return JSON.stringify(rec ?? null);
  const { id: _ignored, ...business } = rec;
  return JSON.stringify(business, Object.keys(business).sort());
}

export interface SyncDelta {
  added: number;
  modified: number;
  removed: number;
}

export function computeDelta(previous: any[], next: any[]): SyncDelta {
  const prevMap = new Map(previous.map(r => [recordKey(r), r]));
  const nextMap = new Map(next.map(r => [recordKey(r), r]));

  let added = 0;
  let modified = 0;
  let removed = 0;

  nextMap.forEach((rec, key) => {
    const prev = prevMap.get(key);
    if (!prev) added += 1;
    else if (recordFingerprint(prev) !== recordFingerprint(rec)) modified += 1;
  });
  prevMap.forEach((_rec, key) => {
    if (!nextMap.has(key)) removed += 1;
  });

  return { added, modified, removed };
}

export function hasChanges(delta: SyncDelta): boolean {
  return delta.added > 0 || delta.modified > 0 || delta.removed > 0;
}
