// @vitest-environment jsdom
import { evaluateErstatningsopgoerelseDownloadGates } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseDownloadGate';
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import type { EetImportSource } from '../../../domain/erhvervsevnetab/eetImportPort';
import { selectBlockingLoenindkomstEntityIds } from '../../../domain/erstatningsopgoerelse/eoInputIssues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { DEFAULT_EO_ROW_POLICY } from '../../../settings/sourceSettings';
import {
  DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE,
  resolveBlockedGateTooltip,
} from '../../../document/layout/documentGateTypes';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { EoInvariant } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';

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
    // Perioden starter PÅ skadedatoen: en erstatningsopgørelse kan ikke vedrøre en periode før den skade,
    // den opgør, og periodefelterne har derfor skadedatoen som gulv ligesom fladens øvrige datoer.
    vedroererPeriodeFra: toISODateString('2022-03-01'),
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
    expect(gates.erstatningsopgoerelse.reasons[0]?.kind).toBe('page-errors');
    expect(resolveBlockedGateTooltip(gates.erstatningsopgoerelse.reasons))
      .toBe(DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE);
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

  it('rekonstruerer offentlige ydelser og SFGG-rækker i EO-readerprojektionen', () => {
    const reader = buildReader({
      ...buildEoWithEmployment(),
      offentligeYdelserRows: [{
        id: 'ydelse-1',
        fraDato: toISODateString('2022-04-01'),
        tilDato: toISODateString('2022-04-30'),
        ydelse: asAmount(1_000),
        tillaeg: undefined,
        ydelsestype: 'dagpenge',
      }],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ingen',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: undefined,
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      }],
    }, validStamdata);

    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });

    expect(projection.eoValues.offentligeYdelserRows).toEqual([expect.objectContaining({ id: 'ydelse-1' })]);
    expect(projection.eoValues.sfggAnsaettelsesforhold).toEqual([
      expect.objectContaining({ ansaettelsesforholdId: 'af-1', sfggBeregningskilde: 'Ingen' }),
    ]);
  });

  it('rekonstruerer manuelle løn- og procentsatsrækker i det angivne løn-property', () => {
    const reader = buildReader({
      ...buildEoWithEmployment(),
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingManuelTableData: [{
          id: 'manuel-1',
          dato: toISODateString('2022-04-01'),
          grundloen: asAmount(30_000),
          feriepenge: 12.5,
          shSoSats: 1.5,
          fritvalg: 2,
          agPension: 8,
        }],
        loenudviklingManuelProcentsatsTableData: [{
          id: 'procent-1',
          dato: toISODateString('2022-04-01'),
          procent: 3.5,
        }],
      },
    }, validStamdata);

    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });
    const manual = projection.eoValues.eoAngivetLoenLoenudvikling;

    expect(manual.loenudviklingManuelTableData).toEqual([
      expect.objectContaining({ id: 'manuel-1', grundloen: asAmount(30_000), feriepenge: 12.5 }),
    ]);
    expect(manual.loenudviklingManuelProcentsatsTableData).toEqual([
      expect.objectContaining({ id: 'procent-1', procent: 3.5 }),
    ]);
  });

  it('projekterer et aktivt midlertidigt EET-importkald med en tom importkilde', () => {
    const reader = buildReader({
      ...buildEoWithEmployment(),
      midlertidigtEetFraEetSiden: 'Ja',
      sfggAnsaettelsesforhold: [],
    }, validStamdata);
    const midlertidigtEetInsertSource: EetImportSource = {
      revision: 'eet-r',
      eetValues: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: undefined,
        ealAarsloen: undefined,
        skadelidteFodselsdato: validStamdata.skadelidteFodselsdato,
      },
      skadedato: validStamdata.skadedato,
    };

    const projection = buildErstatningsopgoerelseReaderProjection(reader, {
      midlertidigtEetInsertSource,
    });

    expect(projection.snapshot.invariants).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'midlertidigt-eet-source-missing' }),
    ]));
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

  it('blokerer på aktiv midlertidig EET-kildefejl selv uden række-fejl', () => {
    const reader = buildReader({ ...buildEoDownloadableEo(), midlertidigtEetFraEetSiden: 'Ja' }, validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });
    const eetError = {
      id: 'midlertidigt_eet_source:runtime',
      passed: false,
      severity: 'error',
      source: 'system',
      message: 'Midlertidig EET-kilde mangler',
      blocksAuthoritativeComputation: false,
    } as EoInvariant;
    const withEetError = {
      ...projection,
      snapshot: { ...projection.snapshot, invariants: [eetError] },
    };

    const gates = evaluateErstatningsopgoerelseDownloadGates(withEetError, DEFAULT_EO_ROW_POLICY);

    expect(gates.erstatningsopgoerelse.canDownload).toBe(false);
    expect(gates.erstatningsopgoerelse.reasons[0]?.kind).toBe('page-errors');
    expect(gates.erstatningsopgoerelse.reasons[0]?.message).toBe('Midlertidig EET-kilde mangler');
  });

  it('blokerer fail-closed når rækkeaggregeringen kaster en intern fejl', () => {
    const reader = buildReader(buildEoDownloadableEo(), validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });

    expect(projection.snapshot.data).toBeDefined();
    if (!projection.snapshot.data) throw new Error('Testfixturet skal have snapshotdata');

    const brokenData = new Proxy(projection.snapshot.data, {
      get(target, property, receiver) {
        if (property === 'canonicalOutput') throw new Error('syntetisk aggregatorfejl');
        return Reflect.get(target, property, receiver);
      },
    });
    const brokenProjection = {
      ...projection,
      snapshot: { ...projection.snapshot, data: brokenData },
    };

    const gates = evaluateErstatningsopgoerelseDownloadGates(brokenProjection, DEFAULT_EO_ROW_POLICY);

    expect(gates.erstatningsopgoerelse.canDownload).toBe(false);
    expect(gates.erstatningsopgoerelse.reasons[0]?.kind).toBe('page-errors');
    expect(gates.erstatningsopgoerelse.reasons[0]?.message).toBe(
      'Beregningens fejloverblik kan ikke vises på grund af en intern fejl'
    );
  });
});
