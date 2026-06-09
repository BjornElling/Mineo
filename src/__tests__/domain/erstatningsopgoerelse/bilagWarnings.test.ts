import { resolveBilagWarning } from '../../../domain/erstatningsopgoerelse/helpers/bilagWarnings';
import { buildEODebugBilagsnumreRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

// ─── Hjælper ──────────────────────────────────────────────────────────────────

const makeValues = (overrides: Partial<ReturnType<typeof createErstatningsopgoerelseInitialValues>> = {}) => ({
  ...createErstatningsopgoerelseInitialValues(),
  ...overrides,
});

// ─── resolveBilagWarning ──────────────────────────────────────────────────────

describe('resolveBilagWarning', () => {
  describe('bilagsnumreMenAfgoerelse', () => {
    it('ingen advarsel når varigeMenAfgorelse er Ja', () => {
      const values = makeValues({ varigeMenAfgorelse: 'Ja' });
      expect(resolveBilagWarning(values, 'bilagsnumreMenAfgoerelse', '1')).toBeNull();
    });

    it('advarsel når varigeMenAfgorelse ikke er Ja', () => {
      const values = makeValues({ varigeMenAfgorelse: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreMenAfgoerelse', '1')).not.toBeNull();
    });

    it('ingen advarsel når value er tom (uanset tilstand)', () => {
      const values = makeValues({ varigeMenAfgorelse: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreMenAfgoerelse', undefined)).toBeNull();
      expect(resolveBilagWarning(values, 'bilagsnumreMenAfgoerelse', '')).toBeNull();
      expect(resolveBilagWarning(values, 'bilagsnumreMenAfgoerelse', '  ')).toBeNull();
    });
  });

  describe('bilagsnumreEetAfgoerelser', () => {
    it('ingen advarsel når midlertidigtEETAfgorelse er Ja', () => {
      const values = makeValues({ midlertidigtEETAfgorelse: 'Ja' });
      expect(resolveBilagWarning(values, 'bilagsnumreEetAfgoerelser', '2')).toBeNull();
    });

    it('ingen advarsel når endeligtEETAfgorelse er Ja', () => {
      const values = makeValues({ endeligtEETAfgorelse: 'Ja' });
      expect(resolveBilagWarning(values, 'bilagsnumreEetAfgoerelser', '2')).toBeNull();
    });

    it('advarsel når hverken midlertidigt eller endeligt EET er Ja', () => {
      const values = makeValues({ midlertidigtEETAfgorelse: 'Nej', endeligtEETAfgorelse: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreEetAfgoerelser', '2')).not.toBeNull();
    });
  });

  describe('bilagsnumreSvieSmerteDokumentation', () => {
    it('ingen advarsel når kravPaaSvieSmerteGodtgoerelse er Ja', () => {
      const values = makeValues({ kravPaaSvieSmerteGodtgoerelse: 'Ja' });
      expect(resolveBilagWarning(values, 'bilagsnumreSvieSmerteDokumentation', '3')).toBeNull();
    });

    it('advarsel når kravPaaSvieSmerteGodtgoerelse ikke er Ja', () => {
      const values = makeValues({ kravPaaSvieSmerteGodtgoerelse: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreSvieSmerteDokumentation', '3')).not.toBeNull();
    });
  });

  describe('bilagsnumreBeregningsgrundlagTaf', () => {
    it('ingen advarsel når kravPaaTabtArbejdsfortjeneste er Ja', () => {
      const values = makeValues({ kravPaaTabtArbejdsfortjeneste: 'Ja' });
      expect(resolveBilagWarning(values, 'bilagsnumreBeregningsgrundlagTaf', '4')).toBeNull();
    });

    it('advarsel når kravPaaTabtArbejdsfortjeneste ikke er Ja', () => {
      const values = makeValues({ kravPaaTabtArbejdsfortjeneste: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreBeregningsgrundlagTaf', '4')).not.toBeNull();
    });
  });

  describe('bilagsnumreLoenISygeperioden', () => {
    it('advarsel når kravPaaTabtArbejdsfortjeneste ikke er Ja', () => {
      const values = makeValues({ kravPaaTabtArbejdsfortjeneste: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreLoenISygeperioden', '5')).not.toBeNull();
    });

    it('advarsel når TAF beregnes men ingen lønoplysninger', () => {
      const values = makeValues({ kravPaaTabtArbejdsfortjeneste: 'Ja' });
      // Standardinitialværdier har et ansættelsesforhold uden lønoplysninger
      expect(resolveBilagWarning(values, 'bilagsnumreLoenISygeperioden', '5')).not.toBeNull();
    });

    it('ingen advarsel når TAF beregnes og lønoplysninger er til stede', () => {
      const base = structuredClone(createErstatningsopgoerelseInitialValues());
      base.loenindkomstAnsaettelsesforhold = [createDefaultLoenindkomstAnsaettelsesforhold()];
      // Indsæt en lønrække med udfyldt col2 (Løn)
      base.loenindkomstAnsaettelsesforhold[0].indtaegtsoplysningerTableData = [
        {
          id: 'row_1',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: { kind: 'number', value: 35000 },
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ];
      const values = makeValues({
        kravPaaTabtArbejdsfortjeneste: 'Ja',
        loenindkomstAnsaettelsesforhold: base.loenindkomstAnsaettelsesforhold,
      });
      expect(resolveBilagWarning(values, 'bilagsnumreLoenISygeperioden', '5')).toBeNull();
    });
  });

  describe('bilagsnumreOffentligeYdelser', () => {
    it('advarsel når kravPaaTabtArbejdsfortjeneste ikke er Ja', () => {
      const values = makeValues({ kravPaaTabtArbejdsfortjeneste: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreOffentligeYdelser', '6')).not.toBeNull();
    });

    it('advarsel når TAF beregnes men ingen offentlige ydelser', () => {
      const values = makeValues({ kravPaaTabtArbejdsfortjeneste: 'Ja', offentligeYdelserRows: [] });
      expect(resolveBilagWarning(values, 'bilagsnumreOffentligeYdelser', '6')).not.toBeNull();
    });

    it('advarsel når TAF beregnes men offentlige ydelser kun har tomme rækker', () => {
      const values = makeValues({
        kravPaaTabtArbejdsfortjeneste: 'Ja',
        offentligeYdelserRows: [
          { id: 'row_1', fraDato: undefined, tilDato: undefined, ydelse: undefined, tillaeg: undefined, ydelsestype: '' },
        ],
      });
      expect(resolveBilagWarning(values, 'bilagsnumreOffentligeYdelser', '6')).not.toBeNull();
    });
  });

  describe('bilagsnumreOevrigeErstatningskrav', () => {
    it('advarsel når ingen øvrige krav er udfyldt', () => {
      const values = makeValues();
      // Standardinitialværdier har tomme rækker
      expect(resolveBilagWarning(values, 'bilagsnumreOevrigeErstatningskrav', '5')).not.toBeNull();
    });

    it('ingen advarsel når mindst ét øvrigt krav er udfyldt', () => {
      const values = makeValues({
        kravPaaOevrigeErstatningskrav: 'Ja',
        oevrigeKravPerioder: [
          { id: 'row_1', dato: undefined, udgiftTil: 'Proteser', beloeb: undefined },
        ],
      });
      expect(resolveBilagWarning(values, 'bilagsnumreOevrigeErstatningskrav', '5')).toBeNull();
    });

    it('advarsel når kravPaaOevrigeErstatningskrav ikke er Ja (trods udfyldt krav)', () => {
      for (const valg of ['Nej', 'Skjul'] as const) {
        const values = makeValues({
          kravPaaOevrigeErstatningskrav: valg,
          oevrigeKravPerioder: [
            { id: 'row_1', dato: undefined, udgiftTil: 'Proteser', beloeb: undefined },
          ],
        });
        expect(resolveBilagWarning(values, 'bilagsnumreOevrigeErstatningskrav', '5')).not.toBeNull();
      }
    });
  });

  describe('ukendt feltnavn', () => {
    it('returnerer null for ukendt feltnavn', () => {
      const values = makeValues();
      expect(resolveBilagWarning(values, 'ikkeEtKendtFelt', '1')).toBeNull();
    });
  });
});

// ─── buildEODebugBilagsnumreRows ─────────────────────────────────────────────

describe('buildEODebugBilagsnumreRows', () => {
  it('returnerer tom liste når visBilagsnumre er Nej', () => {
    const values = makeValues({ visBilagsnumre: 'Nej' });
    expect(buildEODebugBilagsnumreRows(values)).toHaveLength(0);
  });

  it('returnerer "Ingen"-række når visBilagsnumre er Ja men ingen felter er udfyldt', () => {
    const values = makeValues({ visBilagsnumre: 'Ja' });
    const rows = buildEODebugBilagsnumreRows(values);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('bilagsnumre.ingen');
    expect(rows[0].status).toBe('ok');
  });

  it('returnerer ok-række for udfyldt felt uden advarsel', () => {
    const values = makeValues({
      visBilagsnumre: 'Ja',
      varigeMenAfgorelse: 'Ja',
      bilagsnumreMenAfgoerelse: '1',
    });
    const rows = buildEODebugBilagsnumreRows(values);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('bilagsnumre.menAfgoerelse');
    expect(rows[0].status).toBe('ok');
    expect(rows[0].displayValue).toBe('1');
  });

  it('returnerer warning-række for udfyldt felt med advarsel', () => {
    const values = makeValues({
      visBilagsnumre: 'Ja',
      varigeMenAfgorelse: 'Nej',
      bilagsnumreMenAfgoerelse: '1',
    });
    const rows = buildEODebugBilagsnumreRows(values);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('bilagsnumre.menAfgoerelse');
    expect(rows[0].status).toBe('warning');
  });

  it('viser kun udfyldte felter', () => {
    const values = makeValues({
      visBilagsnumre: 'Ja',
      varigeMenAfgorelse: 'Ja',
      bilagsnumreMenAfgoerelse: '1',
      bilagsnumreEetAfgoerelser: undefined,
    });
    const rows = buildEODebugBilagsnumreRows(values);
    // Kun ménafgørelse er udfyldt
    expect(rows.every((r) => r.id !== 'bilagsnumre.ingen')).toBe(true);
    expect(rows.some((r) => r.id === 'bilagsnumre.menAfgoerelse')).toBe(true);
    expect(rows.some((r) => r.id === 'bilagsnumre.eetAfgoerelser')).toBe(false);
  });

  it('trimmer whitespace i displayValue', () => {
    const values = makeValues({
      visBilagsnumre: 'Ja',
      varigeMenAfgorelse: 'Ja',
      bilagsnumreMenAfgoerelse: '  42  ',
    });
    const rows = buildEODebugBilagsnumreRows(values);
    expect(rows[0].displayValue).toBe('42');
  });
});
