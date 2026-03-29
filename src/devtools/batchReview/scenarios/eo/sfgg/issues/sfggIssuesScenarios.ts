/**
 * SFGG Issues-scenarier til batch-review.
 *
 * Disse scenarier er konstrueret til bevidst at udløse fejl og advarsler
 * i beregnings-debug-systemet. De bruges til at verificere at fejlmeddeler
 * og advarsler præsenteres korrekt for brugeren i Fejl og advarsler-trackens PDF.
 *
 * Profiler:
 * - 'basis':   Scenarier 1–3
 * - 'udvidet': Scenarier 1–5
 * - 'alle':    Alle scenarier
 */

import { toISODateString } from '../../../../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import type { BatchScenario, BatchProfile } from '../../../../types';
import type { EoScenarioInput } from '../../../../adapters/eoAdapter';
import type { AmountValue } from '../../../../../../schemas/amountExpressionSchema';

const iso = (s: string) => toISODateString(s);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

type SfggAnsaettelsesforholdRow = ReturnType<typeof createErstatningsopgoerelseInitialValues>['sfggAnsaettelsesforhold'][number];

const buildScenario = (
  id: string,
  title: string,
  description: string,
  tags: readonly string[],
  parameterSummary: readonly { readonly label: string; readonly value: string }[],
  build: () => EoScenarioInput
): BatchScenario<EoScenarioInput> => ({
  id,
  title,
  description,
  tags,
  input: build(),
  parameterSummary,
});

// ---------------------------------------------------------------------------
// Scenarier der udløser fejl/advarsler
// ---------------------------------------------------------------------------

/**
 * Scenarie: Ferieloven SFGG uden referenceperiode.
 * Forventer advarsel/fejl om manglende referenceperiode.
 */
const ISSUE_SCENARIO_01 = buildScenario(
  'sfgg-issues-01',
  'Ferieloven — manglende referenceperiode',
  'Ferielov SFGG uden fra/til i referenceperioden. Skal udløse valideringsfejl om manglende referenceperiode.',
  ['sfgg', 'ferielov', 'valideringsfejl', 'basis'],
  [
    { label: 'Kilde', value: 'Ferieloven' },
    { label: 'Referenceperiode fra', value: '(mangler)' },
    { label: 'Referenceperiode til', value: '(mangler)' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-03-01'), til: iso('2023-05-31'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      {
        id: 'af-1',
        navnPaaArbejdssted: 'Testvirksomheden',
        harOverenskomst: false,
        overenskomstId: undefined,
        overenskomstFilter: { loenmodtager: undefined, arbejdsgiver: undefined },
        ansatPaaSkadestidspunktet: true,
        ansaettelsesforholdOphoert: false,
        sidsteArbejdsdag: undefined,
        harAnciennitetstillaegEfterSkadesdatoen: false,
        anciennitetstillaegDato: undefined,
        anciennitetstillaegSatsAngivesPer: 'Måned',
        anciennitetstillaegSats: undefined,
        feriePct: 12.5,
        fritvalgPct: undefined,
        shSoPct: undefined,
        storeBededagPct: undefined,
        pensionPct: undefined,
        loenperiode: 'maaned',
        fuldLoenUnderFerie: 'Ja',
        loenPaaHelligdage: 'Almindelig løn',
        saerligFraDatoRegulering: undefined,
        loenudviklingBeregningsgrundlag: undefined,
        loenudviklingStatistikModel: undefined,
        loenudviklingKRLSatstabel: undefined,
        loenudviklingManuelNavn: '',
        loenudviklingManuelTableData: [],
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: undefined,
        offentligLoenGruppe: undefined,
        offentligLoenEkstraGrundloen: undefined,
        indtaegtsoplysningerTableData: [
          {
            id: 'loen-1',
            col0_maaned: '1',
            col1_maaned: '2023',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: amount(30000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      },
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        // Mangler referenceperiode — her
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: 'ISSUE-001',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Test Person',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2023-03-01'),
      },
      eoValues: eo,
    };
  }
);

/**
 * Scenarie: SFGG med ansaettelsesforholdId der ikke matcher nogen lønindkomst.
 * Forventer fejl om ukendt ansættelsesforhold.
 */
const ISSUE_SCENARIO_02 = buildScenario(
  'sfgg-issues-02',
  'SFGG med ukendt ansættelses-ID',
  'sfggAnsaettelsesforhold refererer til et ID der ikke findes i loenindkomstAnsaettelsesforhold. Fejl forventet.',
  ['sfgg', 'manuel', 'ugyldigt-id', 'basis'],
  [
    { label: 'SFGG ansættelses-ID', value: 'af-ukendt' },
    { label: 'Tilgængeligt lønindkomst-ID', value: 'af-1' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-04-01'), til: iso('2023-06-30'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      {
        id: 'af-1',
        navnPaaArbejdssted: 'Korrekt Virksomhed ApS',
        harOverenskomst: false,
        overenskomstId: undefined,
        overenskomstFilter: { loenmodtager: undefined, arbejdsgiver: undefined },
        ansatPaaSkadestidspunktet: true,
        ansaettelsesforholdOphoert: false,
        sidsteArbejdsdag: undefined,
        harAnciennitetstillaegEfterSkadesdatoen: false,
        anciennitetstillaegDato: undefined,
        anciennitetstillaegSatsAngivesPer: 'Måned',
        anciennitetstillaegSats: undefined,
        feriePct: 12.5,
        fritvalgPct: undefined,
        shSoPct: undefined,
        storeBededagPct: undefined,
        pensionPct: undefined,
        loenperiode: 'maaned',
        fuldLoenUnderFerie: 'Ja',
        loenPaaHelligdage: 'Almindelig løn',
        saerligFraDatoRegulering: undefined,
        loenudviklingBeregningsgrundlag: undefined,
        loenudviklingStatistikModel: undefined,
        loenudviklingKRLSatstabel: undefined,
        loenudviklingManuelNavn: '',
        loenudviklingManuelTableData: [],
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: undefined,
        offentligLoenGruppe: undefined,
        offentligLoenEkstraGrundloen: undefined,
        indtaegtsoplysningerTableData: [],
      },
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        // Forkert ID — vil ikke matche nogen lønindkomst
        ansaettelsesforholdId: 'af-ukendt',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: amount(800),
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: 'ISSUE-002',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Test Person 2',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2023-04-01'),
      },
      eoValues: eo,
    };
  }
);

/**
 * Scenarie: TAF-perioder er tomme men SFGG er konfigureret.
 * Forventer advarsel om manglende TAF-perioder.
 */
const ISSUE_SCENARIO_03 = buildScenario(
  'sfgg-issues-03',
  'SFGG konfigureret men ingen TAF-perioder',
  'sfggAnsaettelsesforhold har en beregningskilde, men tafPerioder er tomme. SFGG kan ikke beregnes.',
  ['sfgg', 'manuel', 'tomTAF', 'basis'],
  [
    { label: 'SFGG kilde', value: 'Manuelt angivet' },
    { label: 'TAF-perioder', value: '(ingen)' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    // Ingen TAF-perioder — kun den tomme standardrække
    eo.tafPerioder = [
      { id: 'taf-1', fra: undefined, til: undefined, loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      {
        id: 'af-1',
        navnPaaArbejdssted: 'Tomt Ansættelsessted',
        harOverenskomst: false,
        overenskomstId: undefined,
        overenskomstFilter: { loenmodtager: undefined, arbejdsgiver: undefined },
        ansatPaaSkadestidspunktet: true,
        ansaettelsesforholdOphoert: false,
        sidsteArbejdsdag: undefined,
        harAnciennitetstillaegEfterSkadesdatoen: false,
        anciennitetstillaegDato: undefined,
        anciennitetstillaegSatsAngivesPer: 'Måned',
        anciennitetstillaegSats: undefined,
        feriePct: 12.5,
        fritvalgPct: undefined,
        shSoPct: undefined,
        storeBededagPct: undefined,
        pensionPct: undefined,
        loenperiode: 'maaned',
        fuldLoenUnderFerie: 'Ja',
        loenPaaHelligdage: 'Almindelig løn',
        saerligFraDatoRegulering: undefined,
        loenudviklingBeregningsgrundlag: undefined,
        loenudviklingStatistikModel: undefined,
        loenudviklingKRLSatstabel: undefined,
        loenudviklingManuelNavn: '',
        loenudviklingManuelTableData: [],
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: undefined,
        offentligLoenGruppe: undefined,
        offentligLoenEkstraGrundloen: undefined,
        indtaegtsoplysningerTableData: [],
      },
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: amount(600),
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: 'ISSUE-003',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Test Person 3',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2023-05-01'),
      },
      eoValues: eo,
    };
  }
);

/**
 * Scenarie: beregnesTabtArbejdsfortjeneste = 'Nej' men SFGG konfigureret.
 * SFGG beregnes slet ikke — debug vil vise at SFGG-rows er irrelevante.
 */
const ISSUE_SCENARIO_04 = buildScenario(
  'sfgg-issues-04',
  'TAF fravalgt men SFGG konfigureret',
  'beregnesTabtArbejdsfortjeneste = "Nej" mens sfggAnsaettelsesforhold er udfyldt. SFGG-rows filtreres som irrelevante.',
  ['sfgg', 'tafFravalgt', 'udvidet'],
  [
    { label: 'Beregn TAF', value: 'Nej' },
    { label: 'SFGG kilde', value: 'Manuelt angivet' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Nej';
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: amount(500),
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: 'ISSUE-004',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Test Person 4',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2023-06-01'),
      },
      eoValues: eo,
    };
  }
);

/**
 * Scenarie: Ferieloven SFGG med referenceperiode der slutter efter TAF-periodens start.
 * Tester at referenceperioden er inden for gyldig periode.
 */
const ISSUE_SCENARIO_05 = buildScenario(
  'sfgg-issues-05',
  'Ferieloven — referenceperiode overlapper TAF-periode',
  'Referenceperiodens slutdato er efter TAF-periodens startdato. Kan udløse advarsel.',
  ['sfgg', 'ferielov', 'overlap', 'udvidet'],
  [
    { label: 'Referenceperiode', value: '01-04-2023 – 30-06-2023' },
    { label: 'TAF-periode', value: '01-05-2023 – 31-07-2023' },
    { label: 'Overlap', value: 'Maj–Juni 2023' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-05-01'), til: iso('2023-07-31'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      {
        id: 'af-1',
        navnPaaArbejdssted: 'Overlap Test A/S',
        harOverenskomst: false,
        overenskomstId: undefined,
        overenskomstFilter: { loenmodtager: undefined, arbejdsgiver: undefined },
        ansatPaaSkadestidspunktet: true,
        ansaettelsesforholdOphoert: false,
        sidsteArbejdsdag: undefined,
        harAnciennitetstillaegEfterSkadesdatoen: false,
        anciennitetstillaegDato: undefined,
        anciennitetstillaegSatsAngivesPer: 'Måned',
        anciennitetstillaegSats: undefined,
        feriePct: 12.5,
        fritvalgPct: undefined,
        shSoPct: undefined,
        storeBededagPct: undefined,
        pensionPct: undefined,
        loenperiode: 'maaned',
        fuldLoenUnderFerie: 'Ja',
        loenPaaHelligdage: 'Almindelig løn',
        saerligFraDatoRegulering: undefined,
        loenudviklingBeregningsgrundlag: undefined,
        loenudviklingStatistikModel: undefined,
        loenudviklingKRLSatstabel: undefined,
        loenudviklingManuelNavn: '',
        loenudviklingManuelTableData: [],
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: undefined,
        offentligLoenGruppe: undefined,
        offentligLoenEkstraGrundloen: undefined,
        indtaegtsoplysningerTableData: [
          {
            id: 'loen-1',
            col0_maaned: '4',
            col1_maaned: '2023',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: amount(29000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      },
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        // Referenceperiode overlapper TAF-perioden
        sfggReferenceperiodeFra: iso('2023-04-01'),
        sfggReferenceperiodeTil: iso('2023-06-30'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: 'ISSUE-005',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Test Person 5',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2023-05-01'),
      },
      eoValues: eo,
    };
  }
);

/**
 * Scenarie: Sagen har ingen skadesdato — kan forårsage advarsler i debug.
 */
const ISSUE_SCENARIO_06 = buildScenario(
  'sfgg-issues-06',
  'SFGG — ingen skadesdato i stamdata',
  'Stamdata mangler skadesdato. Kan udløse advarsler i SFGG-debug-rows om manglende skadesdato.',
  ['sfgg', 'stamdata', 'mangler', 'alle'],
  [
    { label: 'Skadesdato', value: '(mangler)' },
    { label: 'SFGG kilde', value: 'Ferieloven' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-07-01'), til: iso('2023-09-30'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      {
        id: 'af-1',
        navnPaaArbejdssted: 'Ingen Dato A/S',
        harOverenskomst: false,
        overenskomstId: undefined,
        overenskomstFilter: { loenmodtager: undefined, arbejdsgiver: undefined },
        ansatPaaSkadestidspunktet: true,
        ansaettelsesforholdOphoert: false,
        sidsteArbejdsdag: undefined,
        harAnciennitetstillaegEfterSkadesdatoen: false,
        anciennitetstillaegDato: undefined,
        anciennitetstillaegSatsAngivesPer: 'Måned',
        anciennitetstillaegSats: undefined,
        feriePct: 12.5,
        fritvalgPct: undefined,
        shSoPct: undefined,
        storeBededagPct: undefined,
        pensionPct: undefined,
        loenperiode: 'maaned',
        fuldLoenUnderFerie: 'Ja',
        loenPaaHelligdage: 'Almindelig løn',
        saerligFraDatoRegulering: undefined,
        loenudviklingBeregningsgrundlag: undefined,
        loenudviklingStatistikModel: undefined,
        loenudviklingKRLSatstabel: undefined,
        loenudviklingManuelNavn: '',
        loenudviklingManuelTableData: [],
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: undefined,
        offentligLoenGruppe: undefined,
        offentligLoenEkstraGrundloen: undefined,
        indtaegtsoplysningerTableData: [],
      },
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: iso('2023-04-01'),
        sfggReferenceperiodeTil: iso('2023-06-30'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: 'ISSUE-006',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Test Person 6',
        skadestype: 'Arbejdsulykke',
        // Ingen skadesdato
        skadesdato: undefined,
      },
      eoValues: eo,
    };
  }
);

// ---------------------------------------------------------------------------
// Samlet liste og profil-filtrering
// ---------------------------------------------------------------------------

const ALL_SCENARIOS: readonly BatchScenario<EoScenarioInput>[] = [
  ISSUE_SCENARIO_01,
  ISSUE_SCENARIO_02,
  ISSUE_SCENARIO_03,
  ISSUE_SCENARIO_04,
  ISSUE_SCENARIO_05,
  ISSUE_SCENARIO_06,
];

export const getSfggIssuesScenarios = (profile: BatchProfile): readonly BatchScenario<EoScenarioInput>[] => {
  if (profile === 'basis') {
    return ALL_SCENARIOS.filter((s) => s.tags.includes('basis'));
  }
  if (profile === 'udvidet') {
    return ALL_SCENARIOS.filter((s) => s.tags.includes('basis') || s.tags.includes('udvidet'));
  }
  return ALL_SCENARIOS;
};
