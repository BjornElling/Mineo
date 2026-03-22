import { resolveBilagWarning } from '../../../domain/erstatningsopgoerelse/bilagWarnings';
import { buildEODebugBilagsnumreRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

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
    it('ingen advarsel når midlertidigtEetAfgorelse er Ja', () => {
      const values = makeValues({ midlertidigtEetAfgorelse: 'Ja' });
      expect(resolveBilagWarning(values, 'bilagsnumreEetAfgoerelser', '2')).toBeNull();
    });

    it('ingen advarsel når endeligtEetAfgorelse er Ja', () => {
      const values = makeValues({ endeligtEetAfgorelse: 'Ja' });
      expect(resolveBilagWarning(values, 'bilagsnumreEetAfgoerelser', '2')).toBeNull();
    });

    it('advarsel når hverken midlertidigt eller endeligt EET er Ja', () => {
      const values = makeValues({ midlertidigtEetAfgorelse: 'Nej', endeligtEetAfgorelse: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreEetAfgoerelser', '2')).not.toBeNull();
    });
  });

  describe('bilagsnumreSvieSmerteDokumentation', () => {
    it('ingen advarsel når beregnesSvieSmerteGodtgoerelse er Ja', () => {
      const values = makeValues({ beregnesSvieSmerteGodtgoerelse: 'Ja' });
      expect(resolveBilagWarning(values, 'bilagsnumreSvieSmerteDokumentation', '3')).toBeNull();
    });

    it('advarsel når beregnesSvieSmerteGodtgoerelse ikke er Ja', () => {
      const values = makeValues({ beregnesSvieSmerteGodtgoerelse: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreSvieSmerteDokumentation', '3')).not.toBeNull();
    });
  });

  describe('bilagsnumreBeregningsgrundlagTaf', () => {
    it('ingen advarsel når beregnesTabtArbejdsfortjeneste er Ja', () => {
      const values = makeValues({ beregnesTabtArbejdsfortjeneste: 'Ja' });
      expect(resolveBilagWarning(values, 'bilagsnumreBeregningsgrundlagTaf', '4')).toBeNull();
    });

    it('advarsel når beregnesTabtArbejdsfortjeneste ikke er Ja', () => {
      const values = makeValues({ beregnesTabtArbejdsfortjeneste: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreBeregningsgrundlagTaf', '4')).not.toBeNull();
    });
  });

  describe('bilagsnumreLoenISygeperioden', () => {
    it('advarsel når beregnesTabtArbejdsfortjeneste ikke er Ja', () => {
      const values = makeValues({ beregnesTabtArbejdsfortjeneste: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreLoenISygeperioden', '5')).not.toBeNull();
    });

    it('advarsel når TAF beregnes men ingen lønoplysninger', () => {
      const values = makeValues({ beregnesTabtArbejdsfortjeneste: 'Ja' });
      // Standardinitialværdier har et ansættelsesforhold uden lønoplysninger
      expect(resolveBilagWarning(values, 'bilagsnumreLoenISygeperioden', '5')).not.toBeNull();
    });

    it('ingen advarsel når TAF beregnes og lønoplysninger er til stede', () => {
      const base = structuredClone(createErstatningsopgoerelseInitialValues());
      // Indsæt en lønrække med udfyldt col2 (ferieberettiget grundløn)
      base.loenindkomstAnsaettelsesforhold[0].indtaegtsoplysningerTableData = [
        {
          id: 'row_1',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: { kind: 'number', value: 35000 },
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ];
      const values = makeValues({
        beregnesTabtArbejdsfortjeneste: 'Ja',
        loenindkomstAnsaettelsesforhold: base.loenindkomstAnsaettelsesforhold,
      });
      expect(resolveBilagWarning(values, 'bilagsnumreLoenISygeperioden', '5')).toBeNull();
    });
  });

  describe('bilagsnumreOffentligeYdelser', () => {
    it('advarsel når beregnesTabtArbejdsfortjeneste ikke er Ja', () => {
      const values = makeValues({ beregnesTabtArbejdsfortjeneste: 'Nej' });
      expect(resolveBilagWarning(values, 'bilagsnumreOffentligeYdelser', '6')).not.toBeNull();
    });

    it('advarsel når TAF beregnes men ingen offentlige ydelser', () => {
      const values = makeValues({ beregnesTabtArbejdsfortjeneste: 'Ja', offentligeYdelserRows: [] });
      expect(resolveBilagWarning(values, 'bilagsnumreOffentligeYdelser', '6')).not.toBeNull();
    });

    it('advarsel når TAF beregnes men offentlige ydelser kun har tomme rækker', () => {
      const values = makeValues({
        beregnesTabtArbejdsfortjeneste: 'Ja',
        offentligeYdelserRows: [
          { id: 'row_1', fraDato: '', tilDato: '', ydelse: undefined, tillaeg: undefined, ydelsestype: '' },
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
        oevrigeKravPerioder: [
          { id: 'row_1', dato: undefined, udgiftTil: 'Proteser', beloeb: undefined },
        ],
      });
      expect(resolveBilagWarning(values, 'bilagsnumreOevrigeErstatningskrav', '5')).toBeNull();
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
