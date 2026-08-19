import type { ISODateString } from '../../../types/branded';
import type {
  SvieSmertePeriodeRow,
  TafPeriodeRow,
  FerieperiodeRow,
  OevrigeKravRow,
} from '../../../schemas/formSchemas';
import {
  isSvieSmerteRowEmpty,
  isTafRowEmpty,
  isFerieRowEmpty,
  isOevrigeKravRowEmpty,
} from '../../../domain/erstatningsopgoerelse/helpers/rowEmpty';

// ─── Helpers ──────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

// ─── isSvieSmerteRowEmpty ──────────────────────────────────────────────────

describe('isSvieSmerteRowEmpty', () => {
  const emptyRow = (): SvieSmertePeriodeRow => ({
    id: 'r1',
    fra: undefined,
    til: undefined,
    tilstand: undefined,
  });

  it('alle non-id felter undefined → tom', () => {
    expect(isSvieSmerteRowEmpty(emptyRow())).toBe(true);
  });

  it('fra sat → ikke tom', () => {
    expect(isSvieSmerteRowEmpty({ ...emptyRow(), fra: iso('2024-01-01') })).toBe(false);
  });

  it('til sat → ikke tom', () => {
    expect(isSvieSmerteRowEmpty({ ...emptyRow(), til: iso('2024-12-31') })).toBe(false);
  });

  it('tilstand sat → ikke tom', () => {
    expect(isSvieSmerteRowEmpty({ ...emptyRow(), tilstand: 'sygemeldt' })).toBe(false);
  });

  it('id ignoreres – kun id sat, resten undefined → tom', () => {
    const row: SvieSmertePeriodeRow = { id: 'andet-id', fra: undefined, til: undefined, tilstand: undefined };
    expect(isSvieSmerteRowEmpty(row)).toBe(true);
  });
});

// ─── isTafRowEmpty ────────────────────────────────────────────────────────

describe('isTafRowEmpty', () => {
  const emptyRow = (): TafPeriodeRow => ({
    id: 'r1',
    fra: undefined,
    til: undefined,
    loseFeriedage: undefined,
  });

  it('alle non-id felter undefined → tom', () => {
    expect(isTafRowEmpty(emptyRow())).toBe(true);
  });

  it('fra sat → ikke tom', () => {
    expect(isTafRowEmpty({ ...emptyRow(), fra: iso('2024-01-01') })).toBe(false);
  });

  it('til sat → ikke tom', () => {
    expect(isTafRowEmpty({ ...emptyRow(), til: iso('2024-12-31') })).toBe(false);
  });

  it('loseFeriedage sat til 5 → ikke tom', () => {
    expect(isTafRowEmpty({ ...emptyRow(), loseFeriedage: 5 })).toBe(false);
  });

  it('loseFeriedage = 0 → ikke tom (0 er defined)', () => {
    // isEmptyByKeys tjekker row[key] !== undefined, og 0 !== undefined
    expect(isTafRowEmpty({ ...emptyRow(), loseFeriedage: 0 })).toBe(false);
  });

  it('id ignoreres – alle non-id undefined → tom', () => {
    const row: TafPeriodeRow = { id: 'andet-id', fra: undefined, til: undefined, loseFeriedage: undefined };
    expect(isTafRowEmpty(row)).toBe(true);
  });
});

// ─── isFerieRowEmpty ──────────────────────────────────────────────────────

describe('isFerieRowEmpty', () => {
  const emptyRow = (): FerieperiodeRow => ({
    id: 'r1',
    fra: undefined,
    til: undefined,
  });

  it('alle non-id felter undefined → tom', () => {
    expect(isFerieRowEmpty(emptyRow())).toBe(true);
  });

  it('fra sat → ikke tom', () => {
    expect(isFerieRowEmpty({ ...emptyRow(), fra: iso('2024-01-01') })).toBe(false);
  });

  it('til sat → ikke tom', () => {
    expect(isFerieRowEmpty({ ...emptyRow(), til: iso('2024-12-31') })).toBe(false);
  });

  it('id ignoreres – begge undefined → tom', () => {
    const row: FerieperiodeRow = { id: 'anden-id', fra: undefined, til: undefined };
    expect(isFerieRowEmpty(row)).toBe(true);
  });
});

// ─── isOevrigeKravRowEmpty ────────────────────────────────────────────────

describe('isOevrigeKravRowEmpty', () => {
  const emptyRow = (): OevrigeKravRow => ({
    id: 'r1',
    dato: undefined,
    udgiftTil: undefined,
    beloeb: undefined,
  });

  it('alle non-id felter undefined → tom', () => {
    expect(isOevrigeKravRowEmpty(emptyRow())).toBe(true);
  });

  it('dato sat → ikke tom', () => {
    expect(isOevrigeKravRowEmpty({ ...emptyRow(), dato: iso('2024-01-01') })).toBe(false);
  });

  it('udgiftTil sat → ikke tom', () => {
    expect(isOevrigeKravRowEmpty({ ...emptyRow(), udgiftTil: 'Hjælpemidler' })).toBe(false);
  });

  it('beloeb sat → ikke tom', () => {
    expect(isOevrigeKravRowEmpty({ ...emptyRow(), beloeb: { kind: 'number', value: 5000 } })).toBe(false);
  });

  it('id ignoreres – alle non-id undefined → tom', () => {
    const row: OevrigeKravRow = { id: 'andet-id', dato: undefined, udgiftTil: undefined, beloeb: undefined };
    expect(isOevrigeKravRowEmpty(row)).toBe(true);
  });
});
