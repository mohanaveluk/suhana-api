// Returns the list of keys whose values differ between two snapshots.
// - Considers the union of keys across both objects (added/removed keys count).
// - Uses a stable deep-equal via JSON comparison (order-insensitive for keys
//   is not attempted — snapshots come from the same source shape).
export function computeChangedFields(
  oldValue: Record<string, any> | null | undefined,
  newValue: Record<string, any> | null | undefined,
): string[] {
  if (!oldValue && !newValue) return [];
  const a = oldValue ?? {};
  const b = newValue ?? {};

  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  const changed: string[] = [];

  for (const key of keys) {
    if (!deepEqual(a[key], b[key])) changed.push(key);
  }
  return changed;
}

// Reduces a full object down to only the changed keys — keeps the stored
// old_value / new_value compact and free of noisy unchanged fields.
export function pickChanged(
  source: Record<string, any> | null | undefined,
  changedFields: string[],
): Record<string, any> | null {
  if (!source) return null;
  const out: Record<string, any> = {};
  for (const key of changedFields) {
    if (key in source) out[key] = source[key];
  }
  return Object.keys(out).length ? out : null;
}

function deepEqual(x: any, y: any): boolean {
  if (x === y) return true;
  if (x === null || y === null || x === undefined || y === undefined) return x === y;
  if (typeof x !== 'object' || typeof y !== 'object') return false;
  try {
    return JSON.stringify(x) === JSON.stringify(y);
  } catch {
    return false;
  }
}
