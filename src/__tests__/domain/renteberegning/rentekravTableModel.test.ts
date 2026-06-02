import {
  createEmptyRentekravCommittedRow,
  createRentekravRowId,
  ensureRentekravRows,
  committedToRentekravDraftRows,
  rentekravDraftToCommittedRow,
} from '../../../domain/renteberegning/rentekravTableModel';
import { isRentekravRowEmpty } from '../../../domain/renteberegning/rowEmpty';
import type { RentekravRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { RentekravDraftRow } from '../../../domain/renteberegning/tableDraftRows';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

/**
 * Round-trip- og normaliserings-tests for rentekrav-tabelmodellen.
 *
 * Disse funktioner var tidligere kun indirekte dækket via UI- og schema-tests.
 * Save/load-korrekthed afhænger af, at draft↔committed-konverteringen er tabsfri
 * for gyldigt input og fail-closed for ugyldigt — det hævdes her direkte.
 */

describe('ensureRentekravRows', () => {
  it('undefined → præcis én tom række', () => {
    const rows = ensureRentekravRows(undefined);
    expect(rows).toHaveLength(1);
    expect(isRentekravRowEmpty(rows[0]!)).toBe(true);
  });

  it('tomt array → præcis én tom række', () => {
    const rows = ensureRentekravRows([]);
    expect(rows).toHaveLength(1);
    expect(isRentekravRowEmpty(rows[0]!)).toBe(true);
  });

  it('udfyldt række får en efterfølgende tom række tilføjet', () => {
    const filled: RentekravRow = {
      id: createRentekravRowId(),
      belob: asAmount(1000),
      renterFra: toISODateString('2024-01-01'),
      tillaegstid: 0,
      enhed: 'dage',
    };
    const rows = ensureRentekravRows([filled]);
    expect(rows).toHaveLength(2);
    expect(isRentekravRowEmpty(rows[0]!)).toBe(false);
    expect(isRentekravRowEmpty(rows[1]!)).toBe(true);
  });

  it('række uden id får tildelt et id (ingen tom id-streng)', () => {
    const noId = {
      id: '' as RentekravRow['id'],
      belob: asAmount(500),
      renterFra: toISODateString('2024-03-01'),
      tillaegstid: undefined,
      enhed: 'dage' as const,
    };
    const rows = ensureRentekravRows([noId]);
    expect(rows[0]!.id).toBeTruthy();
  });

  it('manglende enhed defaulter til "dage"', () => {
    const row = {
      id: createRentekravRowId(),
      belob: asAmount(1),
      renterFra: toISODateString('2024-01-01'),
      tillaegstid: undefined,
      enhed: undefined as unknown as RentekravRow['enhed'],
    };
    const rows = ensureRentekravRows([row]);
    expect(rows[0]!.enhed).toBe('dage');
  });
});

describe('rentekravDraftToCommittedRow — fail-closed parsing', () => {
  const baseDraft: RentekravDraftRow = {
    id: createRentekravRowId(),
    belob: '',
    renterFra: '',
    tillaegstid: '',
    enhed: 'dage',
  };

  it('tomme felter → undefined (ingen falsk 0)', () => {
    const committed = rentekravDraftToCommittedRow(baseDraft);
    expect(committed.belob).toBeUndefined();
    expect(committed.renterFra).toBeUndefined();
    expect(committed.tillaegstid).toBeUndefined();
    expect(committed.enhed).toBe('dage');
  });

  it('ugyldig enhed → fallback til "dage"', () => {
    // En ugyldig enhed-streng modellerer korrupt draft-/persisteret data; funktionen validerer
    // runtime og falder fail-closed tilbage til 'dage'. Casten dokumenterer det bevidst ugyldige input.
    const committed = rentekravDraftToCommittedRow({ ...baseDraft, enhed: 'lysår' as RentekravDraftRow['enhed'] });
    expect(committed.enhed).toBe('dage');
  });

  it('gyldig enhed bevares', () => {
    const committed = rentekravDraftToCommittedRow({ ...baseDraft, enhed: 'maaneder' });
    expect(committed.enhed).toBe('maaneder');
  });

  it('ikke-numerisk tillaegstid → undefined', () => {
    const committed = rentekravDraftToCommittedRow({ ...baseDraft, tillaegstid: 'abc' });
    expect(committed.tillaegstid).toBeUndefined();
  });

  it('ciffer-frit beløb rydder feltet (parses som tomt, ikke som fejl)', () => {
    // Input uden cifre tolkes som ryddet → undefined, IKKE som parse-fejl.
    const prev: RentekravRow = {
      id: baseDraft.id,
      belob: asAmount(1234),
      renterFra: undefined,
      tillaegstid: undefined,
      enhed: 'dage',
    };
    const committed = rentekravDraftToCommittedRow({ ...baseDraft, belob: 'xx-ugyldig' }, prev);
    expect(committed.belob).toBeUndefined();
  });

  it('parse-fejlende beløb (cifre men ugyldig syntaks) bevarer prev (fail-closed mod datatab)', () => {
    // '1-2' har cifre men ugyldig syntaks → parse-fejl → prev bevares, så et uheldigt
    // mellemtilstand under redigering ikke nulstiller en allerede committed værdi.
    const prev: RentekravRow = {
      id: baseDraft.id,
      belob: asAmount(1234),
      renterFra: undefined,
      tillaegstid: undefined,
      enhed: 'dage',
    };
    const committed = rentekravDraftToCommittedRow({ ...baseDraft, belob: '1-2' }, prev);
    expect(committed.belob).toEqual(prev.belob);
  });
});

describe('committed ↔ draft round-trip', () => {
  it('round-trip bevarer semantikken for et fuldt udfyldt krav', () => {
    const committed: RentekravRow = {
      id: createRentekravRowId(),
      belob: asAmount(45000),
      renterFra: toISODateString('2024-06-15'),
      tillaegstid: 30,
      enhed: 'dage',
    };
    const [draft] = committedToRentekravDraftRows([committed]);
    const back = rentekravDraftToCommittedRow(draft!, committed);
    expect(back.renterFra).toBe(committed.renterFra);
    expect(back.tillaegstid).toBe(committed.tillaegstid);
    expect(back.enhed).toBe(committed.enhed);
    expect(back.belob).toEqual(committed.belob);
  });

  it('tom committed-række round-tripper til tom committed-række', () => {
    const empty = createEmptyRentekravCommittedRow(createRentekravRowId());
    const [draft] = committedToRentekravDraftRows([empty]);
    const back = rentekravDraftToCommittedRow(draft!);
    expect(isRentekravRowEmpty(back)).toBe(true);
  });
});
