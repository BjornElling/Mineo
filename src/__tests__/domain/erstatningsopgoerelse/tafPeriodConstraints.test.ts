import { describe, expect, it } from 'vitest';
import type { ISODateString } from '../../../types/branded';
import type { TafConstraintSource, TafConstraintBounds, IsoRange } from '../../../domain/erstatningsopgoerelse/tafPeriodConstraints';
import {
  resolveTafConstraintBounds,
  resolveTafFejlgivendeBounds,
  clampTafRange,
  getValidTafRange,
  clampTafRow,
  buildClampedTafRanges,
} from '../../../domain/erstatningsopgoerelse/tafPeriodConstraints';
import type { TafPeriodeRow } from '../../../schemas/formSchemas';

// ─── Helpers ──────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

const makeRow = (fra?: string, til?: string): TafPeriodeRow => ({
  id: 'r1',
  fra: fra as ISODateString | undefined,
  til: til as ISODateString | undefined,
  loseFeriedage: 0,
});

// ─── resolveTafConstraintBounds ────────────────────────────────────────────

describe('resolveTafConstraintBounds', () => {
  describe('tom kilde → ingen bounds', () => {
    it('returnerer tomme bounds for tom kilde', () => {
      const bounds = resolveTafConstraintBounds({});
      expect(bounds.minStart).toBeUndefined();
      expect(bounds.maxEnd).toBeUndefined();
    });
  });

  describe('vedroererPeriode', () => {
    it('vedroererPeriodeFra sætter minStart', () => {
      const bounds = resolveTafConstraintBounds({ vedroererPeriodeFra: iso('2022-01-01') });
      expect(bounds.minStart).toBe('2022-01-01');
    });

    it('vedroererPeriodeTil sætter maxEnd', () => {
      const bounds = resolveTafConstraintBounds({ vedroererPeriodeTil: iso('2024-12-31') });
      expect(bounds.maxEnd).toBe('2024-12-31');
    });

    it('begge vedroererPeriode felter sætter begge bounds', () => {
      const bounds = resolveTafConstraintBounds({
        vedroererPeriodeFra: iso('2022-01-01'),
        vedroererPeriodeTil: iso('2024-12-31'),
      });
      expect(bounds.minStart).toBe('2022-01-01');
      expect(bounds.maxEnd).toBe('2024-12-31');
    });
  });

  describe('differencekravDato', () => {
    it('sætter maxEnd til dagen før differencekravDato', () => {
      const bounds = resolveTafConstraintBounds({ differencekravDato: iso('2024-06-15') });
      expect(bounds.maxEnd).toBe('2024-06-14');
    });

    it('differencekravDato 1. januar → maxEnd 31. december året før', () => {
      const bounds = resolveTafConstraintBounds({ differencekravDato: iso('2024-01-01') });
      expect(bounds.maxEnd).toBe('2023-12-31');
    });

    it('bruger den mindste af vedroererPeriodeTil og differencekravMax', () => {
      // vedroererPeriodeTil = 2024-12-31, differencekravMax = 2024-06-14
      const bounds = resolveTafConstraintBounds({
        vedroererPeriodeTil: iso('2024-12-31'),
        differencekravDato: iso('2024-06-15'),
      });
      expect(bounds.maxEnd).toBe('2024-06-14');
    });

    it('differencekravMax er mindste (vedroererPeriodeTil er større)', () => {
      const bounds = resolveTafConstraintBounds({
        vedroererPeriodeTil: iso('2024-01-01'),
        differencekravDato: iso('2024-06-15'),
      });
      expect(bounds.maxEnd).toBe('2024-01-01');
    });
  });

  describe('endeligtEetAfgorelse', () => {
    it('endeligtEetAfgorelse = Nej → ingen EET-begrænsning', () => {
      const bounds = resolveTafConstraintBounds({
        endeligtEetAfgorelse: 'Nej',
        endeligEETVirkningsdato: iso('2023-01-01'),
      });
      expect(bounds.maxEnd).toBeUndefined();
    });

    it('endeligtEetAfgorelse = Ja + virkningsdato → maxEnd = virkningsdato - 1 dag', () => {
      const bounds = resolveTafConstraintBounds({
        endeligtEetAfgorelse: 'Ja',
        endeligEETVirkningsdato: iso('2024-03-01'),
      });
      expect(bounds.maxEnd).toBe('2024-02-29'); // 2024 er skudår
    });

    it('endeligtEetAfgorelse = Ja + kun afgoerelsesdato → maxEnd = afgoerelsesdato - 1', () => {
      const bounds = resolveTafConstraintBounds({
        endeligtEetAfgorelse: 'Ja',
        endeligEETAfgoerelseDato: iso('2024-06-15'),
      });
      expect(bounds.maxEnd).toBe('2024-06-14');
    });

    it('endeligtEetAfgorelse = Ja + virkningsdato → bruger virkningsdato (ikke afgoerelsesdato)', () => {
      const bounds = resolveTafConstraintBounds({
        endeligtEetAfgorelse: 'Ja',
        endeligEETVirkningsdato: iso('2024-03-01'),
        endeligEETAfgoerelseDato: iso('2024-06-15'),
      });
      // virkningsdato tages før afgoerelsesdato (via ??)
      expect(bounds.maxEnd).toBe('2024-02-29');
    });

    it('verserendeKlageEet = Ja → EET-begrænsning ignoreres', () => {
      const bounds = resolveTafConstraintBounds({
        endeligtEetAfgorelse: 'Ja',
        endeligEETVirkningsdato: iso('2024-03-01'),
        verserendeKlageEet: 'Ja',
      });
      // verserendeKlageEet = Ja → endeligEetMax = undefined → ingen begrænsning
      expect(bounds.maxEnd).toBeUndefined();
    });

    it('bruger mindste af alle maxEnd-candidater', () => {
      const bounds = resolveTafConstraintBounds({
        vedroererPeriodeTil: iso('2025-12-31'),
        differencekravDato: iso('2024-07-01'),  // max = 2024-06-30
        endeligtEetAfgorelse: 'Ja',
        endeligEETVirkningsdato: iso('2024-04-01'), // max = 2024-03-31
      });
      expect(bounds.maxEnd).toBe('2024-03-31');
    });
  });

  describe('midlertidigtEetAfgorelse (skadesdato < 2011-06-16)', () => {
    const skadesdatoFoer = iso('2011-06-15'); // én dag før skæringsdato
    const skadesdatoPaa  = iso('2011-06-16'); // præcis skæringsdato — ingen afgrænsning
    const skadesdatoEfter = iso('2015-01-01'); // efter skæringsdato — ingen afgrænsning

    it('midlertidigtEetAfgorelse = Nej → ingen midlertidig EET-begrænsning', () => {
      const bounds = resolveTafConstraintBounds({
        midlertidigtEetAfgorelse: 'Nej',
        midlertidigEETVirkningsdato: iso('2010-01-01'),
        skadesdatoISO: skadesdatoFoer,
      });
      expect(bounds.maxEnd).toBeUndefined();
    });

    it('midlertidigtEetAfgorelse = Ja + skadesdato < skæringsdato + virkningsdato → maxEnd = virkningsdato - 1', () => {
      const bounds = resolveTafConstraintBounds({
        midlertidigtEetAfgorelse: 'Ja',
        midlertidigEETVirkningsdato: iso('2011-03-01'),
        skadesdatoISO: skadesdatoFoer,
      });
      expect(bounds.maxEnd).toBe('2011-02-28');
    });

    it('midlertidigtEetAfgorelse = Ja + skadesdato < skæringsdato + kun afgørelsesdato → maxEnd = afgørelsesdato - 1', () => {
      const bounds = resolveTafConstraintBounds({
        midlertidigtEetAfgorelse: 'Ja',
        midlertidigEETAfgoerelseDato: iso('2010-06-15'),
        skadesdatoISO: skadesdatoFoer,
      });
      expect(bounds.maxEnd).toBe('2010-06-14');
    });

    it('midlertidigtEetAfgorelse = Ja + skadesdato præcis på skæringsdato → ingen afgrænsning', () => {
      const bounds = resolveTafConstraintBounds({
        midlertidigtEetAfgorelse: 'Ja',
        midlertidigEETVirkningsdato: iso('2011-03-01'),
        skadesdatoISO: skadesdatoPaa,
      });
      expect(bounds.maxEnd).toBeUndefined();
    });

    it('midlertidigtEetAfgorelse = Ja + skadesdato efter skæringsdato → ingen afgrænsning', () => {
      const bounds = resolveTafConstraintBounds({
        midlertidigtEetAfgorelse: 'Ja',
        midlertidigEETVirkningsdato: iso('2015-06-01'),
        skadesdatoISO: skadesdatoEfter,
      });
      expect(bounds.maxEnd).toBeUndefined();
    });

    it('midlertidigtEetAfgorelse = Ja + skadesdatoISO mangler → ingen afgrænsning', () => {
      const bounds = resolveTafConstraintBounds({
        midlertidigtEetAfgorelse: 'Ja',
        midlertidigEETVirkningsdato: iso('2011-03-01'),
        skadesdatoISO: undefined,
      });
      expect(bounds.maxEnd).toBeUndefined();
    });

    it('verserendeKlageEet = Ja → midlertidig EET-begrænsning ignoreres', () => {
      const bounds = resolveTafConstraintBounds({
        midlertidigtEetAfgorelse: 'Ja',
        midlertidigEETVirkningsdato: iso('2011-03-01'),
        skadesdatoISO: skadesdatoFoer,
        verserendeKlageEet: 'Ja',
      });
      expect(bounds.maxEnd).toBeUndefined();
    });

    it('midlertidig er tidligst → maxEnd fra midlertidig (ikke endelig)', () => {
      const bounds = resolveTafConstraintBounds({
        midlertidigtEetAfgorelse: 'Ja',
        midlertidigEETVirkningsdato: iso('2010-03-01'), // tidligst
        endeligtEetAfgorelse: 'Ja',
        endeligEETVirkningsdato: iso('2011-01-01'),
        skadesdatoISO: skadesdatoFoer,
      });
      expect(bounds.maxEnd).toBe('2010-02-28');
    });

    it('endelig er tidligst → maxEnd fra endelig (ikke midlertidig)', () => {
      const bounds = resolveTafConstraintBounds({
        midlertidigtEetAfgorelse: 'Ja',
        midlertidigEETVirkningsdato: iso('2011-01-01'),
        endeligtEetAfgorelse: 'Ja',
        endeligEETVirkningsdato: iso('2010-03-01'), // tidligst
        skadesdatoISO: skadesdatoFoer,
      });
      expect(bounds.maxEnd).toBe('2010-02-28');
    });

    it('resolveTafFejlgivendeBounds inkluderer midlertidig EET ved skadesdato < skæringsdato', () => {
      const bounds = resolveTafFejlgivendeBounds({
        midlertidigtEetAfgorelse: 'Ja',
        midlertidigEETVirkningsdato: iso('2011-03-01'),
        skadesdatoISO: skadesdatoFoer,
      });
      expect(bounds.maxEnd).toBe('2011-02-28');
    });

    it('resolveTafFejlgivendeBounds ignorerer midlertidig EET ved skadesdato >= skæringsdato', () => {
      const bounds = resolveTafFejlgivendeBounds({
        midlertidigtEetAfgorelse: 'Ja',
        midlertidigEETVirkningsdato: iso('2011-03-01'),
        skadesdatoISO: skadesdatoPaa,
      });
      expect(bounds.maxEnd).toBeUndefined();
    });
  });
});

// ─── clampTafRange ────────────────────────────────────────────────────────

describe('clampTafRange', () => {
  const range: IsoRange = { fra: iso('2024-01-01'), til: iso('2024-12-31') };

  it('ingen bounds → range uændret', () => {
    const result = clampTafRange(range, {});
    expect(result).toEqual(range);
  });

  it('minStart indenfor range → fra uændret', () => {
    const result = clampTafRange(range, { minStart: iso('2023-01-01') });
    expect(result?.fra).toBe('2024-01-01');
  });

  it('minStart efter range start → fra clampet til minStart', () => {
    const result = clampTafRange(range, { minStart: iso('2024-06-01') });
    expect(result?.fra).toBe('2024-06-01');
    expect(result?.til).toBe('2024-12-31');
  });

  it('maxEnd indenfor range → til uændret', () => {
    const result = clampTafRange(range, { maxEnd: iso('2025-12-31') });
    expect(result?.til).toBe('2024-12-31');
  });

  it('maxEnd før range slut → til clampet til maxEnd', () => {
    const result = clampTafRange(range, { maxEnd: iso('2024-06-30') });
    expect(result?.fra).toBe('2024-01-01');
    expect(result?.til).toBe('2024-06-30');
  });

  it('minStart > maxEnd (efter clamping) → null', () => {
    const result = clampTafRange(range, {
      minStart: iso('2024-12-01'),
      maxEnd: iso('2024-06-30'),
    });
    expect(result).toBeNull();
  });

  it('minStart = maxEnd → single-day range returneres', () => {
    const result = clampTafRange(range, {
      minStart: iso('2024-06-15'),
      maxEnd: iso('2024-06-15'),
    });
    expect(result).toEqual({ fra: '2024-06-15', til: '2024-06-15' });
  });

  it('range er allerede within bounds → returneres uændret', () => {
    const result = clampTafRange(range, {
      minStart: iso('2023-01-01'),
      maxEnd: iso('2025-12-31'),
    });
    expect(result).toEqual(range);
  });

  it('maxEnd = 0000-01-01 (ekstremt tidligt) → null (range efter maxEnd)', () => {
    const result = clampTafRange(range, { maxEnd: iso('2020-01-01') });
    expect(result).toBeNull();
  });
});

// ─── getValidTafRange ─────────────────────────────────────────────────────

describe('getValidTafRange', () => {
  it('gyldig ISO fra og til → returnerer range', () => {
    const result = getValidTafRange({ fra: '2024-01-01', til: '2024-12-31' });
    expect(result).toEqual({ fra: '2024-01-01', til: '2024-12-31' });
  });

  it('fra = til (enkelt dag) → gyldig', () => {
    const result = getValidTafRange({ fra: '2024-06-15', til: '2024-06-15' });
    expect(result).not.toBeNull();
  });

  it('fra > til → null', () => {
    const result = getValidTafRange({ fra: '2024-12-31', til: '2024-01-01' });
    expect(result).toBeNull();
  });

  it('fra = undefined → null', () => {
    const result = getValidTafRange({ fra: undefined, til: '2024-12-31' });
    expect(result).toBeNull();
  });

  it('til = undefined → null', () => {
    const result = getValidTafRange({ fra: '2024-01-01', til: undefined });
    expect(result).toBeNull();
  });

  it('begge undefined → null', () => {
    const result = getValidTafRange({ fra: undefined, til: undefined });
    expect(result).toBeNull();
  });

  it('ikke-ISO streng → null', () => {
    const result = getValidTafRange({ fra: '01-01-2024', til: '31-12-2024' });
    expect(result).toBeNull();
  });
});

// ─── clampTafRow ──────────────────────────────────────────────────────────

describe('clampTafRow', () => {
  it('gyldig row, ingen bounds → range returneres uændret', () => {
    const row = makeRow('2024-01-01', '2024-12-31');
    const result = clampTafRow(row, {});
    expect(result).toEqual({ fra: '2024-01-01', til: '2024-12-31' });
  });

  it('ugyldig row (undefined fra) → null', () => {
    const row = makeRow(undefined, '2024-12-31');
    expect(clampTafRow(row, {})).toBeNull();
  });

  it('ugyldig row (fra > til) → null', () => {
    const row = makeRow('2024-12-31', '2024-01-01');
    expect(clampTafRow(row, {})).toBeNull();
  });

  it('gyldig row, bounds clamper range', () => {
    const row = makeRow('2024-01-01', '2024-12-31');
    const result = clampTafRow(row, { maxEnd: iso('2024-06-30') });
    expect(result?.til).toBe('2024-06-30');
  });

  it('bounds ekskluderer hele row → null', () => {
    const row = makeRow('2024-07-01', '2024-12-31');
    const result = clampTafRow(row, { maxEnd: iso('2024-06-30') });
    expect(result).toBeNull();
  });
});

// ─── buildClampedTafRanges ────────────────────────────────────────────────

describe('buildClampedTafRanges', () => {
  it('tom liste → tom liste', () => {
    expect(buildClampedTafRanges([], {})).toEqual([]);
  });

  it('en gyldig række, ingen bounds → returnerer rangen', () => {
    const rows = [makeRow('2024-01-01', '2024-12-31')];
    const result = buildClampedTafRanges(rows, {});
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ fra: '2024-01-01', til: '2024-12-31' });
  });

  it('ugyldige rækker (undefined fra) filtreres ud', () => {
    const rows = [makeRow(undefined, '2024-12-31')];
    expect(buildClampedTafRanges(rows, {})).toHaveLength(0);
  });

  it('blandede rækker — kun gyldige returneres', () => {
    const rows = [
      makeRow('2024-01-01', '2024-06-30'),
      makeRow(undefined, '2024-12-31'),  // ugyldig
      makeRow('2024-07-01', '2024-12-31'),
    ];
    const result = buildClampedTafRanges(rows, {});
    expect(result).toHaveLength(2);
  });

  it('bounds clamper alle rækker', () => {
    const rows = [
      makeRow('2024-01-01', '2024-12-31'),
      makeRow('2023-01-01', '2023-12-31'),
    ];
    const result = buildClampedTafRanges(rows, { minStart: iso('2024-01-01') });
    expect(result).toHaveLength(1);
    expect(result[0].fra).toBe('2024-01-01');
  });

  it('bounds ekskluderer alle rækker → tom liste', () => {
    const rows = [
      makeRow('2024-01-01', '2024-12-31'),
      makeRow('2024-07-01', '2024-09-30'),
    ];
    const result = buildClampedTafRanges(rows, { maxEnd: iso('2023-12-31') });
    expect(result).toHaveLength(0);
  });

  it('tre rækker med delvis clamp → korrekte ranges', () => {
    const rows = [
      makeRow('2024-01-01', '2024-06-30'),
      makeRow('2024-07-01', '2024-09-30'),
      makeRow('2024-10-01', '2024-12-31'),
    ];
    const result = buildClampedTafRanges(rows, {
      minStart: iso('2024-03-01'),
      maxEnd: iso('2024-11-30'),
    });
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ fra: '2024-03-01', til: '2024-06-30' });
    expect(result[1]).toEqual({ fra: '2024-07-01', til: '2024-09-30' });
    expect(result[2]).toEqual({ fra: '2024-10-01', til: '2024-11-30' });
  });
});
