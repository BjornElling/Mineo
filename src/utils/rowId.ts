/**
 * Deterministisk id til en TOM grid-række på en given position.
 *
 * Bruges af `normalizeGridRows`' `createEmptyRow(seed)` i stedet for et tilfældigt `createRowId`.
 * Determinismen er kritisk: normalisering kører inde i React `setState`-updaters, som StrictMode
 * dobbelt-invokerer — et tilfældigt id ville divergere mellem de to kørsler og bryde id-følsomme
 * persist-fingerprints (datatab). Se determinisme-kontrakten i `gridModel.normalizeGridRows`.
 *
 * `__empty__`-segmentet adskiller transiente tomme-række-id'er fra persisterede UUID-id'er
 * (`<prefix>_<uuid>`), så de aldrig kolliderer. Id'erne er transiente og kan re-stabiliseres af
 * grid-resync for tomme rækker ved næste prop-resync.
 */
export const createEmptyRowId = (prefix: string, index: number): string => {
  return `${prefix}_empty_${index}`;
};

export const createRowId = (prefix: string): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    // UUID v4: set version (0100) and variant (10xx)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    return `${prefix}_${uuid}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};
