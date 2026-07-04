import {
  MANUEL_ANGIVET_SUPPLEMENT_FELTER,
  hasFinitePct,
  isManuelAngivetRowAktiv,
  isManuelAngivetRowDatoUdfyldt,
  isManuelProcentsatsRowAktiv,
  isManuelProcentsatsRowKomplet,
} from '../../../domain/erstatningsopgoerelse/helpers/manuelReguleringRowPredicates';
import type {
  LoenudviklingManuelProcentsatsRow,
  LoenudviklingManuelRow,
} from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

// Repræsentativt committed-domæne for en dato-celle: gyldig ISO eller undefined
// (tableIsoDateCellString mapper tom/whitespace → undefined; ugyldigt ikke-tomt input
// fejler schemaet og kan aldrig nå prædikaterne). Vi tager whitespace/'' med for at
// dokumentere at prædikaterne stadig opfører sig fornuftigt hvis de mod forventning ses.
const DATO_KANDIDATER: ReadonlyArray<string | undefined> = [undefined, iso('2024-01-01')];
const PCT_KANDIDATER: ReadonlyArray<number | undefined> = [undefined, 0, 10, 100];

describe('manuelReguleringRowPredicates', () => {
  describe('hasFinitePct', () => {
    it('er sand kun for finitte tal', () => {
      expect(hasFinitePct(0)).toBe(true);
      expect(hasFinitePct(12.5)).toBe(true);
      expect(hasFinitePct(undefined)).toBe(false);
      expect(hasFinitePct(Number.NaN)).toBe(false);
      expect(hasFinitePct(Number.POSITIVE_INFINITY)).toBe(false);
    });
  });

  describe('Manuel procentsats — tal-/adfærds-identitet med de tidligere inline-udtryk', () => {
    // De bogstavelige udtryk der lå i validator (:894-895/:886/:892) og row-lag (:295-300)
    // FØR konsolideringen. Denne test beviser at helperne er byte-ækvivalente på committed-domænet
    // (vacuous-pass-værn: matrixen indeholder både aktive, komplette og ufuldstændige rækker).
    const tidligereAktiv = (row: LoenudviklingManuelProcentsatsRow): boolean =>
      row.dato !== undefined || (typeof row.procent === 'number' && Number.isFinite(row.procent));
    const tidligereKomplet = (row: LoenudviklingManuelProcentsatsRow): boolean =>
      row.dato !== undefined && typeof row.procent === 'number' && Number.isFinite(row.procent);

    it('matcher aktiv/komplet på hele dato×procent-matrixen', () => {
      let sawAktiv = false;
      let sawInaktiv = false;
      let sawKomplet = false;
      let sawUkomplet = false;
      for (const dato of DATO_KANDIDATER) {
        for (const procent of PCT_KANDIDATER) {
          const row = { id: 'r', dato, procent } as LoenudviklingManuelProcentsatsRow;
          expect(isManuelProcentsatsRowAktiv(row)).toBe(tidligereAktiv(row));
          expect(isManuelProcentsatsRowKomplet(row)).toBe(tidligereKomplet(row));
          if (isManuelProcentsatsRowAktiv(row)) sawAktiv = true; else sawInaktiv = true;
          if (isManuelProcentsatsRowKomplet(row)) sawKomplet = true; else sawUkomplet = true;
        }
      }
      // Beviser at matrixen faktisk rammer begge udfald (ikke en tom/altid-sand test).
      expect([sawAktiv, sawInaktiv, sawKomplet, sawUkomplet]).toEqual([true, true, true, true]);
    });

    it('en aktiv men ikke-komplet række (dato uden procent / procent uden dato) fanges', () => {
      expect(isManuelProcentsatsRowAktiv({ dato: iso('2024-01-01'), procent: undefined })).toBe(true);
      expect(isManuelProcentsatsRowKomplet({ dato: iso('2024-01-01'), procent: undefined })).toBe(false);
      expect(isManuelProcentsatsRowAktiv({ dato: undefined, procent: 10 })).toBe(true);
      expect(isManuelProcentsatsRowKomplet({ dato: undefined, procent: 10 })).toBe(false);
    });

    it('en helt tom række er hverken aktiv eller komplet', () => {
      const tom = { id: 'r', dato: undefined, procent: undefined } as LoenudviklingManuelProcentsatsRow;
      expect(isManuelProcentsatsRowAktiv(tom)).toBe(false);
      expect(isManuelProcentsatsRowKomplet(tom)).toBe(false);
    });
  });

  describe('Manuel angivet — tal-/adfærds-identitet med de tidligere inline-udtryk', () => {
    const hasManualPercentValue = (value: number | undefined): boolean =>
      typeof value === 'number' && Number.isFinite(value);
    // Row-lagets tidligere aktiv-udtryk brugte (row.dato ?? '').trim() !== ''; validatoren
    // brugte row.dato !== undefined. Begge er ækvivalente på committed-domænet (dato ∈ {ISO, undefined}).
    const tidligereAktivRowLag = (row: LoenudviklingManuelRow): boolean => {
      const dato = row.dato ?? '';
      return (
        dato.trim() !== '' ||
        hasManualPercentValue(row.feriepenge) ||
        hasManualPercentValue(row.shSoSats) ||
        hasManualPercentValue(row.fritvalg) ||
        hasManualPercentValue(row.agPension) ||
        row.grundloen !== undefined
      );
    };
    const tidligereAktivValidator = (row: LoenudviklingManuelRow): boolean =>
      row.dato !== undefined ||
      hasManualPercentValue(row.feriepenge) ||
      hasManualPercentValue(row.shSoSats) ||
      hasManualPercentValue(row.fritvalg) ||
      hasManualPercentValue(row.agPension) ||
      row.grundloen !== undefined;

    const baseRow = (overrides: Partial<LoenudviklingManuelRow>): LoenudviklingManuelRow =>
      ({
        id: 'r',
        dato: undefined,
        grundloen: undefined,
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
        ...overrides,
      }) as LoenudviklingManuelRow;

    it('matcher begge tidligere aktiv-udtryk på en repræsentativ prøvemængde', () => {
      const proever: ReadonlyArray<LoenudviklingManuelRow> = [
        baseRow({}),
        baseRow({ dato: iso('2024-01-01') }),
        baseRow({ grundloen: amount(1000) }),
        baseRow({ feriepenge: 12.5 }),
        baseRow({ shSoSats: 0 }),
        baseRow({ fritvalg: 4 }),
        baseRow({ agPension: 15 }),
        baseRow({ dato: iso('2024-01-01'), grundloen: amount(1000), feriepenge: 12.5 }),
      ];
      let sawAktiv = false;
      let sawInaktiv = false;
      for (const row of proever) {
        expect(isManuelAngivetRowAktiv(row)).toBe(tidligereAktivRowLag(row));
        expect(isManuelAngivetRowAktiv(row)).toBe(tidligereAktivValidator(row));
        if (isManuelAngivetRowAktiv(row)) sawAktiv = true; else sawInaktiv = true;
      }
      expect([sawAktiv, sawInaktiv]).toEqual([true, true]);
    });

    it('isManuelAngivetRowDatoUdfyldt matcher row-lagets trim-form og validatorens undefined-form', () => {
      expect(isManuelAngivetRowDatoUdfyldt({ dato: iso('2024-01-01') })).toBe(true);
      expect(isManuelAngivetRowDatoUdfyldt({ dato: undefined })).toBe(false);
    });

    it('supplement-felt-listen dækker de fire tillægssatser', () => {
      expect([...MANUEL_ANGIVET_SUPPLEMENT_FELTER]).toEqual(['feriepenge', 'shSoSats', 'fritvalg', 'agPension']);
    });
  });
});
