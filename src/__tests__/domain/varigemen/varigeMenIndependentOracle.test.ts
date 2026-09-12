// @vitest-environment jsdom
import { computeVarigeMenEngine } from '../../../domain/varigemen/varigeMenEngine';
import { buildVarigeMenReaderProjection } from '../../../domain/varigemen/varigeMenReaderProjection';
import { evaluateVarigeMenDownloadGate } from '../../../domain/varigemen/varigeMenDownloadGate';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { toISODateString } from '../../../types/branded';
import type { YearlyRate } from '../../../data/lovbestemteRates';
import type { StamdataValues, VarigeMenValues } from '../../../schemas/formSchemas';

const iso = (value: string) => toISODateString(value);

const varigeMen: VarigeMenValues = {
  mengrad: 37,
  beregningsdato: iso('2025-07-01'),
};

const stamdata: StamdataValues = {
  journalnr: 'varigemen-orakel',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Uafhængig facit',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2024-02-29'),
  skadelidteFodselsdato: iso('1964-02-29'),
};

// Satsen er testens isolerede input – ikke en import af produktionsregistret. Alle forventede tal nedenfor
// er håndberegnet fra 10.530 kr. pr. méntrin, 37 % mén og 60 år ved skaden.
const independentRates: YearlyRate = { 2025: 10530 };

const expectedResult = {
  // 10.530 · 37 = 389.610; 60 år giver 21 % + 1 % = 22 % reduktion;
  // 389.610 · 0,78 = 303.895,8 → oprundet op = 303.896.
  beregnetGodtgoerelse: 303896,
  grundbeloeb: 1053000,
  satsPerMengrad: 10530,
  aldersreduktionPct: 22,
  grundbeloebUdenReduktion: 389610,
  aldersreduktionBeloeb: 85714,
  beregningsaar: 2025,
  alderVedSkade: 60,
} as const;

const buildProjection = (varigemen: VarigeMenValues, stamdata: StamdataValues) => {
  const catalog = getProductionInputCatalog();
  const input = catalog.validateSettledInput({
    sections: {
      stamdata,
      satser: null,
      aarsloen: null,
      faellesAarsloen: null,
      renteberegning: null,
      varigemen: varigeMen,
      forsoergertab: null,
      erstatningsopgoerelse: null,
      erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  const evaluation = createInputEvaluation({ input, catalog, sourceToken });
  return buildVarigeMenReaderProjection(evaluation.reader);
};

describe('Varige mén – uafhængigt håndberegnet totalsag', () => {
  it('matcher engine, reader-projektion og download-gate', () => {
    const engineResult = computeVarigeMenEngine({
      varigemen: varigeMen,
      fodselsdato: stamdata.skadelidteFodselsdato,
      skadestidspunkt: stamdata.skadedato,
      rates: independentRates,
    }).result;

    expect(engineResult).toEqual(expectedResult);

    const projection = buildProjection(varigeMen, stamdata);
    expect(projection.status).toBe('ready');
    if (projection.status !== 'ready') throw new Error('Forventede en ready varige mén-projektion');

    expect(projection.value.beregningsResultat).toEqual(expectedResult);
    expect(projection.value.mengrad).toBe(37);
    expect(projection.value.beregningsdato).toBe(iso('2025-07-01'));
    expect(projection.value.skadedato).toBe(iso('2024-02-29'));
    expect(projection.value.fodselsdato).toBe(iso('1964-02-29'));

    const gate = evaluateVarigeMenDownloadGate(projection);
    expect(gate.canDownload).toBe(true);
    expect(gate.reasons).toEqual([]);
  });

  it('matcher det håndberegnede facit præcis ved 39-årsgrænsen', () => {
    const boundaryVarigeMen: VarigeMenValues = {
      mengrad: 10,
      beregningsdato: iso('2024-06-01'),
    };
    const boundaryStamdata: StamdataValues = {
      journalnr: 'varigemen-39-aar',
      advokat: '',
      sagsbehandler: '',
      skadelidte: 'Uafhængig grænseværdi',
      skadestype: 'Arbejdsulykke',
      skadedato: iso('2024-02-28'),
      skadelidteFodselsdato: iso('1985-02-28'),
    };
    // 2024-satsen er skrevet som et facitliteral, så testen ikke læser sin forventning fra registret.
    const boundaryRate: YearlyRate = { 2024: 10135 };
    const expectedBoundaryResult = {
      // 10.135 × 10 = 101.350 kr.; 39 år giver ingen aldersreduktion.
      beregnetGodtgoerelse: 101350,
      grundbeloeb: 1013500,
      satsPerMengrad: 10135,
      aldersreduktionPct: 0,
      grundbeloebUdenReduktion: 101350,
      aldersreduktionBeloeb: 0,
      beregningsaar: 2024,
      alderVedSkade: 39,
    } as const;

    const engineResult = computeVarigeMenEngine({
      varigemen: boundaryVarigeMen,
      fodselsdato: boundaryStamdata.skadelidteFodselsdato,
      skadestidspunkt: boundaryStamdata.skadedato,
      rates: boundaryRate,
    }).result;

    expect(engineResult).toEqual(expectedBoundaryResult);

  });
});
