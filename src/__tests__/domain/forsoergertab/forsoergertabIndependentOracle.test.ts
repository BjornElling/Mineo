// @vitest-environment jsdom
import { evaluateForsoergertabDownloadGate } from '../../../domain/forsoergertab/forsoergertabDownloadGate';
import { buildForsoergertabReaderProjection } from '../../../domain/forsoergertab/forsoergertabReaderProjection';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createEvaluationSourceToken, createInputRevision, createSettingsRevision } from '../../../inputCore/evaluationSource';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type {
  FaellesAarsloenValues,
  ForsoergertabValues,
  StamdataValues,
} from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const values: ForsoergertabValues = {
  beregningsdato: iso('2013-01-01'),
  efterladteFodselsdato: iso('1969-01-01'),
  virkningsdato: iso('2013-01-01'),
  koen: 'Kvinde',
  tilkendtForPeriodeAar: 1,
};

const faellesAarsloen: FaellesAarsloenValues = {
  // 100.000 kr. giver en enkel ASL-ydelse på 30.000 kr. årligt.
  aslAarsloen: amount(100000),
  ealAarsloen: amount(1000000),
};

const stamdata: StamdataValues = {
  journalnr: 'FST-oracle',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Uafhængig facit',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2013-01-01'),
  skadelidteFodselsdato: iso('1970-01-01'),
};

const buildProjection = () => {
  const catalog = getProductionInputCatalog();
  const input = catalog.validateSettledInput({
    sections: {
      stamdata,
      satser: null,
      aarsloen: null,
      faellesAarsloen,
      renteberegning: null,
      varigemen: null,
      forsoergertab: values,
      erstatningsopgoerelse: null,
      erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  const evaluation = createInputEvaluation({ input, catalog, sourceToken });
  return buildForsoergertabReaderProjection(evaluation.reader);
};

describe('CALC-005 – uafhængigt håndberegnet totalsag', () => {
  it('fører kønsvalg, dagbrøk og EAL/ASL-facitter gennem projection og download-gate', () => {
    const projection = buildProjection();
    const { snapshot } = projection;
    const eal = snapshot.calculation.ealComputation;
    const asl = snapshot.calculation.aslComputation;

    expect(eal).not.toBeNull();
    expect(asl).not.toBeNull();
    if (!eal || !asl) throw new Error('Forventede en komplet forsørgertabsprojektion');

    // EAL-facit, uafhængigt af produktionsberegneren:
    // 1.000.000 x 10 = 10.000.000 kr. > 2013-maksimum 8.432.000 kr.
    // 8.432.000 x 30 % = 2.529.600 kr.; skadelidte er 43 år, så 14 % = 354.144 kr.
    // Det færdige EAL-krav er derfor 2.175.456 kr.
    expect(eal).toEqual(expect.objectContaining({
      aarsloenOre: 100000000,
      aarsloenSource: 'eal',
      reguleringsaar: [],
      reguleretAarsloenOre: 100000000,
      eetPct: 100,
      eetBeregnetOre: 1000000000,
      eetMaksOre: 843200000,
      eetAnvendtOre: 843200000,
      eetReduceretTilMaks: true,
      forsoergertabPct: 30,
      forsoergertabBeregnetOre: 252960000,
      forsoergertabAnvendtOre: 252960000,
      alderVedSkade: 43,
      aldersreduktionPct: 14,
      aldersreduktionBeloebOre: 35414400,
      ealKravOre: 217545600,
    }));

    // ASL-facit, uafhængigt af kapitaliseringsmotoren:
    // 30 % af 100.000 kr. = 30.000 kr. årligt = 2.500 kr. pr. måned.
    // Den ene dag i januar er 1/31 måned: afrundet til 0,0323 og 81 kr.
    // Resten er 11,9677 måneder, altså opslag på 0 år + 11 måneder. Kvindetabellens
    // faktor 0,625 x 11/12 = 0,572916..., afrundet til 0,573; kapitalbeløbet er 17.190 kr.
    expect(asl).toEqual(expect.objectContaining({
      aslAarsloen: 100000,
      aslAarsloenAfrundet1000: 100000,
      benyttetAarsloen: 100000,
      aarsloenMaxSkadesaar: 482000,
      aarsloenMaxBeregningsaar: 482000,
      opreguleringsfaktor: 1,
      opreguleretAarligYdelse: 30000,
      samletMaaneder: 12,
      alleredeUdbetaltMaaneder: 0.0323,
      resterendeMaanederTotal: 11.9677,
      resterendeAar: 0,
      resterendeMaaneder: 11,
      kapitaliseringsbekendtgoerelseId: '990/2012',
      kapitaliseringsTabel: 'G',
      kapitaliseringsTabelKoensopdelt: true,
      alderHeleAar: 44,
      kapitalfaktor: 0.573,
      kapitalbelob: 17190,
      aslLobendeYdelserTotal: 81,
    }));
    expect(asl.lobendeYdelser).toEqual([{
      fraDato: iso('2013-01-01'),
      tilDato: iso('2013-01-01'),
      maaneder: 0.0323,
      maanedligYdelse: 2500,
      ydelseIAlt: 81,
    }]);

    const expectedResult = {
      ealKrav: 2175456,
      aslKapitalbelob: 17190,
      aslLobendeYdelserTotal: 81,
      nettokrav: 2158185,
    };
    expect(snapshot.calculation.result).toEqual(expectedResult);
    expect(snapshot.pdfProjection.result).toEqual(expectedResult);
    expect(snapshot.visKoenValg).toBe(true);
    expect(snapshot.canShowEal).toBe(true);
    expect(snapshot.canShowAsl).toBe(true);
    expect(snapshot.canShowResult).toBe(true);
    expect(snapshot.pdfGate).toEqual({ canDownload: true, reasons: [] });
    expect(evaluateForsoergertabDownloadGate(projection)).toEqual(snapshot.pdfGate);
  });
});
