import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  erSvieSmertePeriodeInputRelevant,
  erSvieSmerteTidligereTotalRelevant,
  erVarigeMenAfgoerelseAktiv,
  erMidlertidigtEETAfgoerelseAktiv,
  erEndeligtEETAfgoerelseAktiv,
  erEETKlageRelevant,
  erBilagsnumreRelevant,
  erTidligereModtagetTafRelevant,
  neutralizeIrrelevantEoInputs,
} from '../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { computeSvieSmerteEngine } from '../../../domain/erstatningsopgoerelse/engines/svieSmerteEngine';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

const iso = (value: string) => toISODateString(value);
const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(createErstatningsopgoerelseInitialValues());
  return { ...base, ...patch };
};

// Gyldigt svie/smerte-scenarie der rammer max-loftet (96.000 kr for satser-år 2026),
// så et evt. "tidligere"-fradrag tydeligt påvirker resultatet.
const svieMaxScenario = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues =>
  makeValues({
    kravPaaSvieSmerteGodtgoerelse: 'Ja',
    tidligereSsMax: 'Nej',
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2025-02-04'),
    svieSmertePerioder: [
      { id: '1', fra: iso('2024-01-01'), til: iso('2025-02-04'), tilstand: 'sygemeldt' },
    ],
    svieSmerteSatserAar: 2026,
    svieSmerteDelvisSygemeldingSats: 'fuld',
    svieSmerteAktuelPeriode: asAmountValue(0),
    ...patch,
  });

describe('eoInputRelevance', () => {
  describe('erSvieSmerteTidligereTotalRelevant', () => {
    it('er irrelevant ved første opgørelse', () => {
      expect(erSvieSmerteTidligereTotalRelevant(svieMaxScenario({ eoNummer: '1' }))).toBe(false);
      expect(erSvieSmerteTidligereTotalRelevant(svieMaxScenario({ eoNummer: undefined }))).toBe(false);
    });

    it('er relevant fra og med anden opgørelse', () => {
      expect(erSvieSmerteTidligereTotalRelevant(svieMaxScenario({ eoNummer: '2' }))).toBe(true);
    });

    it('er irrelevant når sektionen er skjult eller "tidligere til max" er slået til', () => {
      expect(erSvieSmerteTidligereTotalRelevant(svieMaxScenario({ eoNummer: '2', kravPaaSvieSmerteGodtgoerelse: 'Skjul' }))).toBe(false);
      expect(erSvieSmerteTidligereTotalRelevant(svieMaxScenario({ eoNummer: '2', tidligereSsMax: 'Ja' }))).toBe(false);
    });
  });

  describe('neutralizeIrrelevantEoInputs', () => {
    it('blanker svieSmerteTidligereTotal ved første opgørelse', () => {
      const result = neutralizeIrrelevantEoInputs(
        svieMaxScenario({ eoNummer: '1', svieSmerteTidligereTotal: asAmountValue(50_000) })
      );
      expect(result.svieSmerteTidligereTotal).toBeUndefined();
    });

    it('bevarer svieSmerteTidligereTotal fra og med anden opgørelse', () => {
      const tidligere = asAmountValue(50_000);
      const result = neutralizeIrrelevantEoInputs(
        svieMaxScenario({ eoNummer: '2', svieSmerteTidligereTotal: tidligere })
      );
      expect(result.svieSmerteTidligereTotal).toEqual(tidligere);
    });

    it('blanker svie-periodeinput når sektionen ikke er aktiv', () => {
      const result = neutralizeIrrelevantEoInputs(
        svieMaxScenario({ eoNummer: '2', kravPaaSvieSmerteGodtgoerelse: 'Skjul', svieSmerteTidligereTotal: asAmountValue(50_000) })
      );
      expect(result.svieSmertePerioder).toEqual([]);
      expect(result.svieSmerteSatserAar).toBeUndefined();
      expect(result.svieSmerteAktuelPeriode).toBeUndefined();
      expect(result.svieSmerteTidligereTotal).toBeUndefined();
    });

    it('blanker svie-perioder når "tidligere beregnet S/S til max" er slået til', () => {
      const result = neutralizeIrrelevantEoInputs(svieMaxScenario({ eoNummer: '2', tidligereSsMax: 'Ja' }));
      expect(result.svieSmertePerioder).toEqual([]);
      expect(result.svieSmerteSatserAar).toBeUndefined();
    });

    it('blanker TAF- og øvrige-krav-rækker når sektionerne ikke er aktive', () => {
      const result = neutralizeIrrelevantEoInputs(
        makeValues({
          kravPaaTabtArbejdsfortjeneste: 'Skjul',
          tafPerioder: [{ id: 't1', fra: iso('2024-01-01'), til: iso('2024-02-01'), loseFeriedage: undefined }],
          ferieperioder: [{ id: 'f1', fra: iso('2024-01-10'), til: iso('2024-01-12') }],
          kravPaaOevrigeErstatningskrav: 'Nej',
          oevrigeKravPerioder: [{ id: 'o1', dato: iso('2024-01-01'), udgiftTil: 'Medicin', beloeb: asAmountValue(100) }],
        })
      );
      expect(result.tafPerioder).toEqual([]);
      expect(result.ferieperioder).toEqual([]);
      expect(result.oevrigeKravPerioder).toEqual([]);
    });

    it('UNDTAGELSE: bevarer komprimeret løn-/beregningsgrundlag ved EO 2+ (TAF beregnes fortsat heraf)', () => {
      const loenindkomst = createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold;
      const values = makeValues({
        eoNummer: '2',
        kravPaaTabtArbejdsfortjeneste: 'Ja',
        komprimerBeregningEfterFoersteOpgoerelse: 'Ja',
        beregnesUdFra: 'Angivet månedsløn',
        maanedsloenenUdgoer: asAmountValue(42_000),
        tafBeregningsperiodeFra: iso('2023-01-01'),
        tafBeregningsperiodeTil: iso('2023-12-31'),
        loenindkomstAnsaettelsesforhold: loenindkomst,
      });
      const result = neutralizeIrrelevantEoInputs(values);
      expect(result.beregnesUdFra).toBe('Angivet månedsløn');
      expect(result.maanedsloenenUdgoer).toEqual(asAmountValue(42_000));
      expect(result.tafBeregningsperiodeFra).toBe(iso('2023-01-01'));
      expect(result.tafBeregningsperiodeTil).toBe(iso('2023-12-31'));
      expect(result.loenindkomstAnsaettelsesforhold).toEqual(loenindkomst);
    });

    it('blanker tidligereModtagetTaf når TAF-sektionen ikke er aktiv', () => {
      const result = neutralizeIrrelevantEoInputs(
        makeValues({ kravPaaTabtArbejdsfortjeneste: 'Nej', tidligereModtagetTaf: asAmountValue(12_000) })
      );
      expect(result.tidligereModtagetTaf).toBeUndefined();
    });

    it('bevarer tidligereModtagetTaf når TAF-sektionen er aktiv', () => {
      const tidligere = asAmountValue(12_000);
      const result = neutralizeIrrelevantEoInputs(
        makeValues({ kravPaaTabtArbejdsfortjeneste: 'Ja', tidligereModtagetTaf: tidligere })
      );
      expect(result.tidligereModtagetTaf).toEqual(tidligere);
    });

    it('returnerer samme objekt-reference når intet skal neutraliseres', () => {
      const values = svieMaxScenario({ eoNummer: '2', svieSmerteTidligereTotal: asAmountValue(10_000) });
      expect(neutralizeIrrelevantEoInputs(values)).toBe(values);
    });
  });

  describe('rene synligheds-prædikater', () => {
    it('erVarigeMenAfgoerelseAktiv følger varigeMenAfgorelse', () => {
      expect(erVarigeMenAfgoerelseAktiv(makeValues({ varigeMenAfgorelse: 'Ja' }))).toBe(true);
      expect(erVarigeMenAfgoerelseAktiv(makeValues({ varigeMenAfgorelse: 'Nej' }))).toBe(false);
    });

    it('erMidlertidigtEETAfgoerelseAktiv / erEndeligtEETAfgoerelseAktiv følger deres toggles', () => {
      expect(erMidlertidigtEETAfgoerelseAktiv(makeValues({ midlertidigtEETAfgorelse: 'Ja' }))).toBe(true);
      expect(erMidlertidigtEETAfgoerelseAktiv(makeValues({ midlertidigtEETAfgorelse: 'Nej' }))).toBe(false);
      expect(erEndeligtEETAfgoerelseAktiv(makeValues({ endeligtEETAfgorelse: 'Ja' }))).toBe(true);
      expect(erEndeligtEETAfgoerelseAktiv(makeValues({ endeligtEETAfgorelse: 'Nej' }))).toBe(false);
    });

    it('erEETKlageRelevant er sand når mindst én EET-afgørelse er truffet', () => {
      expect(erEETKlageRelevant(makeValues({ midlertidigtEETAfgorelse: 'Nej', endeligtEETAfgorelse: 'Nej' }))).toBe(false);
      expect(erEETKlageRelevant(makeValues({ midlertidigtEETAfgorelse: 'Ja', endeligtEETAfgorelse: 'Nej' }))).toBe(true);
      expect(erEETKlageRelevant(makeValues({ midlertidigtEETAfgorelse: 'Nej', endeligtEETAfgorelse: 'Ja' }))).toBe(true);
    });

    it('erBilagsnumreRelevant følger visBilagsnumre', () => {
      expect(erBilagsnumreRelevant(makeValues({ visBilagsnumre: 'Ja' }))).toBe(true);
      expect(erBilagsnumreRelevant(makeValues({ visBilagsnumre: 'Nej' }))).toBe(false);
    });

    it('erTidligereModtagetTafRelevant følger TAF-sektionen', () => {
      expect(erTidligereModtagetTafRelevant(makeValues({ kravPaaTabtArbejdsfortjeneste: 'Ja' }))).toBe(true);
      expect(erTidligereModtagetTafRelevant(makeValues({ kravPaaTabtArbejdsfortjeneste: 'Nej' }))).toBe(false);
    });
  });

  describe('beregningsvirkning (regression for den oprindelige fejl)', () => {
    it('fradrager IKKE et skjult "tidligere" svie/smerte-beløb ved første opgørelse', () => {
      const tidligere = asAmountValue(50_000);

      const foersteOpgoerelse = computeSvieSmerteEngine({
        erstatningsopgoerelse: neutralizeIrrelevantEoInputs(
          svieMaxScenario({ eoNummer: '1', svieSmerteTidligereTotal: tidligere })
        ),
      });
      // Fuldt loft uden fradrag (jf. svieSmerteEngine.test.ts max-cap scenarie).
      expect(foersteOpgoerelse.totalOre).toBe(9_600_000);
      expect(foersteOpgoerelse.tidligereOre).toBeNull();

      const andenOpgoerelse = computeSvieSmerteEngine({
        erstatningsopgoerelse: neutralizeIrrelevantEoInputs(
          svieMaxScenario({ eoNummer: '2', svieSmerteTidligereTotal: tidligere })
        ),
      });
      // Ved 2. opgørelse fradrages det tidligere beløb fortsat: 96.000 − 50.000 = 46.000 kr.
      expect(andenOpgoerelse.totalOre).toBe(4_600_000);
    });
  });

  describe('erSvieSmertePeriodeInputRelevant', () => {
    it('følger sektion + tidligere-til-max', () => {
      expect(erSvieSmertePeriodeInputRelevant(svieMaxScenario({}))).toBe(true);
      expect(erSvieSmertePeriodeInputRelevant(svieMaxScenario({ tidligereSsMax: 'Ja' }))).toBe(false);
      expect(erSvieSmertePeriodeInputRelevant(svieMaxScenario({ kravPaaSvieSmerteGodtgoerelse: 'Nej' }))).toBe(false);
    });
  });
});
