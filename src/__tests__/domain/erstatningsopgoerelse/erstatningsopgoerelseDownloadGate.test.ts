// @vitest-environment jsdom
import { evaluateErstatningsopgoerelseDownloadGates } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseDownloadGate';
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { selectBlockingLoenindkomstEntityIds } from '../../../domain/erstatningsopgoerelse/eoInputIssues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { DEFAULT_EO_ROW_POLICY } from '../../../settings/sourceSettings';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';

// EO's download-gate (§3.9): beviser at gaten for de fire EO-dokumenter afledes af den
// ENE reader-projektion og blokerer på præcis de samme rækker/invarianter som den nuværende view-model – men uden
// live store-reads. Genbruger reader-projektionens rekonstruktion, så gaten ser byte-identiske gate-inputs.

const catalog = getProductionInputCatalog();
const asAmount = (value: number) => ({ kind: 'number' as const, value });

const validStamdata: StamdataValues = {
  journalnr: 'J-1', advokat: 'A', sagsbehandler: 'S', skadelidte: 'Test',
  skadestype: 'Arbejdsulykke', skadedato: toISODateString('2022-03-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

/**
 * En sag hvor Erstatningsopgørelse-dokumentet kan hentes (ingen blokerende rækker), men uden TAF-beregning – så
 * de tre TAF-dokumenter er per-dokument-blokeret (§1.10). Bevidst valgt frem for en kunstig "alle-grønne"-sag,
 * der ville kræve et fuldt indbyrdes konsistent TAF-/SFGG-grundlag.
 */
const buildEoDownloadableEo = (): ErstatningsopgoerelseValues => {
  const base = createErstatningsopgoerelseInitialValues();
  return {
    ...base,
    kravPaaSvieSmerteGodtgoerelse: 'Nej',
    kravPaaTabtArbejdsfortjeneste: 'Nej',
    kravPaaOevrigeErstatningskrav: 'Nej',
    vedroererPeriodeFra: toISODateString('2022-01-01'),
    vedroererPeriodeTil: toISODateString('2022-12-31'),
    loenindkomstAnsaettelsesforhold: [],
  };
};

/** Et fixture med et nested ansættelsesforhold + løntabelrække (til celle-fejl-testen). */
const buildEoWithEmployment = (): ErstatningsopgoerelseValues => {
  const base = createErstatningsopgoerelseInitialValues();
  return {
    ...base,
    kravPaaSvieSmerteGodtgoerelse: 'Nej',
    kravPaaTabtArbejdsfortjeneste: 'Ja',
    beregnesUdFra: 'Beregningsperiode',
    tafBeregningsperiodeFra: toISODateString('2022-04-01'),
    tafBeregningsperiodeTil: toISODateString('2022-06-30'),
    tafPerioder: [
      { id: 'taf-1', fra: toISODateString('2022-04-01'), til: toISODateString('2022-06-30'), loseFeriedage: 0 },
    ],
    loenindkomstAnsaettelsesforhold: [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-1',
        harOverenskomst: false,
        loenudviklingBeregningsgrundlag: 'Ingen',
        loenPaaHelligdage: 'Almindelig løn',
        indtaegtsoplysningerTableData: [
          {
            id: 'std-1', col0_maaned: '1', col1_maaned: '2022', col0_uge: '', col1_uge: '',
            col0_dag: undefined, col1_dag: undefined, col2: asAmount(40000), col3: undefined,
            col4: undefined, col5: undefined, fpFvShSoBeloeb: undefined, pensionBeloeb: undefined,
          },
        ],
        loenudviklingManuelTableData: [],
        loenudviklingManuelProcentsatsTableData: [],
        overenskomstFilter: { loenmodtager: undefined, arbejdsgiver: undefined },
      },
    ],
  };
};

const buildReader = (eo: ErstatningsopgoerelseValues | null, stamdata: StamdataValues | null) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken }).reader;
};

describe('evaluateErstatningsopgoerelseDownloadGates', () => {
  it('tillader EO-dokumentet (ingen blokerende rækker) men per-dokument-blokerer de TAF-dokumenter uden TAF (§1.10)', () => {
    const reader = buildReader(buildEoDownloadableEo(), validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });
    const gates = evaluateErstatningsopgoerelseDownloadGates(projection, DEFAULT_EO_ROW_POLICY);

    expect(gates.erstatningsopgoerelse.canDownload).toBe(true);
    expect(gates.erstatningsopgoerelse.reasons).toEqual([]);
    // Uden TAF-beregning blokeres de tre TAF-dokumenter af deres egen projektion – uafhængigt af EO-dokumentet.
    expect(gates.tafFordeltPaaAar.canDownload).toBe(false);
    expect(gates.tafOpreguleret.canDownload).toBe(false);
    expect(gates.tafKravGraf.canDownload).toBe(false);
  });

  it('blokerer EO-dokumentet når en påkrævet beregningsperiode-dato mangler (row-blokering)', () => {
    const eo = { ...buildEoWithEmployment(), tafBeregningsperiodeFra: undefined };
    const reader = buildReader(eo, validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });
    const gates = evaluateErstatningsopgoerelseDownloadGates(projection, DEFAULT_EO_ROW_POLICY);

    expect(gates.erstatningsopgoerelse.canDownload).toBe(false);
    expect(gates.tafFordeltPaaAar.canDownload).toBe(false);
    // Der er en synlig, konkret blokerings-årsag (aldrig usynlig blokering).
    expect(gates.erstatningsopgoerelse.reasons[0]?.message).toBeTruthy();
  });

  it('blokerer når en StandardLoen-tabelcelle er ugyldig (`${afId}:loenindkomst`-aggregatet via suffix-gaten)', () => {
    const eo = buildEoWithEmployment();
    const first = eo.loenindkomstAnsaettelsesforhold[0];
    const withCellError: ErstatningsopgoerelseValues = {
      ...eo,
      loenindkomstAnsaettelsesforhold: [
        { ...first, indtaegtsoplysningerTableData: [{ ...first.indtaegtsoplysningerTableData[0], col0_maaned: '13' }] },
      ],
    };
    const reader = buildReader(withCellError, validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });
    // Aggregatet er til stede i eoErrors (bevist i reader-projektions-testen); gaten blokerer på det via collectAllEoRows.
    expect(selectBlockingLoenindkomstEntityIds(projection.eoErrors)['af-1']).toBe(true);
    const gates = evaluateErstatningsopgoerelseDownloadGates(projection, DEFAULT_EO_ROW_POLICY);
    expect(gates.erstatningsopgoerelse.canDownload).toBe(false);
  });

  it('blokerer alle dokumenter når snapshottet fail-closer (skadedato før fødselsdato)', () => {
    const reader = buildReader(buildEoWithEmployment(), {
      ...validStamdata,
      skadelidteFodselsdato: toISODateString('2025-01-01'),
      skadedato: toISODateString('2022-03-01'),
    });
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });
    const gates = evaluateErstatningsopgoerelseDownloadGates(projection, DEFAULT_EO_ROW_POLICY);
    expect(gates.erstatningsopgoerelse.canDownload).toBe(false);
    expect(gates.tafKravGraf.canDownload).toBe(false);
  });
});
