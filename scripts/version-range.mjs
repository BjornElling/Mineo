/**
 * Lille, bevidst afgrænset semver-læser til projektets runtime-intervaller.
 *
 * Projektet bruger kun intervaller af formen `>=X.Y.Z <A.B.C`. En ukendt form
 * skal give en hård fejl; ellers kan en ændring i `engines` passere kontrollen
 * uden faktisk at være blevet efterprøvet.
 */

/** `'1.2.3'` → `[1, 2, 3]`. Præ-release-suffikser sammenlignes ikke. */
export const parseVersion = (raw) => {
  const cleaned = raw.trim().replace(/^v/, '').split('-')[0];
  const parts = cleaned.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length === 0 || parts.length > 3 || parts.some((part) => !Number.isInteger(part))) {
    throw new Error(`Kunne ikke læse versionen '${raw}'.`);
  }
  while (parts.length < 3) parts.push(0);
  return parts;
};

const compareVersions = (left, right) => {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
};

/** Evaluér et projekt-runtime-interval uden at indføre en ny dependency. */
export const satisfiesRange = (version, range) => {
  const comparators = range.trim().split(/\s+/);
  for (const comparator of comparators) {
    const match = /^(>=|>|<=|<|=)?(\d+(?:\.\d+){0,2})$/.exec(comparator);
    if (match === null) {
      throw new Error(
        `Intervallet '${range}' bruger en operator, kontrollen ikke forstår ('${comparator}'). `
        + 'Udvid scripts/version-range.mjs frem for at lade udtrykket passere ukontrolleret.'
      );
    }
    const [, operator = '=', bound] = match;
    const result = compareVersions(parseVersion(version), parseVersion(bound));
    const ok = operator === '>=' ? result >= 0
      : operator === '>' ? result > 0
        : operator === '<=' ? result <= 0
          : operator === '<' ? result < 0
            : result === 0;
    if (!ok) return false;
  }
  return true;
};
