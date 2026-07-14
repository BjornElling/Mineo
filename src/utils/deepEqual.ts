/**
 * Sammenligner schema-validerede JSON-data uden at gøre objektets property-rækkefølge semantisk.
 * `JSON.stringify(a) === JSON.stringify(b)` kan ellers oprette history for et reelt no-op.
 */
export const deepEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deepEqual(value, right[index]));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => Object.hasOwn(rightRecord, key)
    && deepEqual(leftRecord[key], rightRecord[key]));
};
