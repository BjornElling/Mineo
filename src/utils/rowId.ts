/** En rækkes id. Kanonisk her sammen med rækkens id-konstruktører (tidligere `rowDrafts/types`). */
export type RowId = string;

/** En række identificeret ved sit id. Tabelmodellerne bygger deres rækketyper oven på denne. */
export type WithId = { id: RowId };

/**
 * Et nyt, unikt række-id.
 *
 * Bemærk at der IKKE længere findes en separat "deterministisk tom-række-id"-fabrik. Den fandtes, fordi
 * tomme rækker blev skabt inde i en React `setState`-updater, som StrictMode dobbelt-invokerer: et RNG-id
 * ville da divergere mellem de to kørsler og bryde id-følsomme persist-fingerprints. Runtime persisterer
 * ikke tomme rækker, og placeholder-id'et dannes af `usePlaceholderSlotIds` i en memo bag en ref, hvor
 * fabrikken kun kaldes når et slot mangler et id, og resultatet gemmes. Determinismekravet gjaldt
 * mekanismen, ikke id'erne.
 */
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
