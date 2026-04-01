/**
 * SFGG PDF-scenarier til batch-review.
 *
 * Hvert scenarie definerer en kombination af StamdataValues og ErstatningsopgoerelseValues
 * der producerer et SFGG-resultat — enten manuelt angivet, ferielov-baseret eller
 * overenskomst-baseret.
 *
 * Scenarierne bruger createErstatningsopgoerelseInitialValues() som udgangspunkt
 * og patcher kun de felter der er relevante for SFGG og TAF.
 *
 * Profiler:
 * - 'basis':   Scenarier 1–4 (de hyppigste mønstre)
 * - 'udvidet': Scenarier 1–8
 * - 'alle':    Alle scenarier
 */

import { toISODateString } from '../../../../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { BatchScenario, BatchProfile } from '../../../../types';
import type { EoScenarioInput } from '../../../../adapters/eoAdapter';
import type { AmountValue } from '../../../../../../schemas/amountExpressionSchema';

const iso = (s: string) => toISODateString(s);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

// Returnerer måned (1-12) og år fra en ISO-datostreng uden lokaltids-konvertering.
const isoMonth = (s: string): string => String(parseInt(s.slice(5, 7), 10));
const isoYear = (s: string): string => s.slice(0, 4);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAnsaettelsesforhold = (
  id: string,
  navn: string,
  maanedsloen: number,
  periodeFra: string,
  periodeTil: string
): ReturnType<typeof createErstatningsopgoerelseInitialValues>['loenindkomstAnsaettelsesforhold'][number] => ({
  id,
  navnPaaArbejdssted: navn,
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
      id: `${id}-loen-1`,
      col0_maaned: isoMonth(periodeFra),
      col1_maaned: isoYear(periodeFra),
      col0_uge: '',
      col1_uge: '',
      col0_dag: '',
      col1_dag: '',
      col2: amount(maanedsloen),
      col3: undefined,
      col4: undefined,
      col5: undefined,
    },
    {
      id: `${id}-loen-2`,
      col0_maaned: isoMonth(periodeTil),
      col1_maaned: isoYear(periodeTil),
      col0_uge: '',
      col1_uge: '',
      col0_dag: '',
      col1_dag: '',
      col2: amount(maanedsloen),
      col3: undefined,
      col4: undefined,
      col5: undefined,
    },
  ],
});

// ---------------------------------------------------------------------------
// Scenarie-bygger-hjælper
// ---------------------------------------------------------------------------

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
// Alle scenarier
// ---------------------------------------------------------------------------

const SCENARIO_01 = buildScenario(
  'sfgg-pdf-01',
  'Manuel SFGG — kalenderdage — enkelt ansættelsesforhold',
  'Manuelt angivet dagssats kr. 800 baseret på kalenderdage. TAF-periode 3 måneder.',
  ['sfgg', 'manuel', 'kalenderdage', 'basis'],
  [
    { label: 'Kilde', value: 'Manuelt angivet' },
    { label: 'Dagssats', value: '800 kr.' },
    { label: 'TAF-periode', value: '01-03-2023 – 31-05-2023' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-03-01'), til: iso('2023-05-31'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Kommunernes Huse A/S', 35000, '2023-01-01', '2023-02-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: amount(800),
        sfggManuelBeloebIHenholdTil: 'Overenskomst § 14',
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
        journalnr: '2023-00123',
        advokat: undefined,
        sagsbehandler: 'Test Testersen',
        skadelidte: 'Søren Hansen',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2023-03-01'),
      },
      eoValues: eo,
    };
  }
);

const SCENARIO_02 = buildScenario(
  'sfgg-pdf-02',
  'Ferieloven SFGG — med referenceperiode',
  'Ferielov-baseret SFGG med referenceperiode jan 2023. TAF-periode 2 måneder.',
  ['sfgg', 'ferielov', 'referenceperiode', 'basis'],
  [
    { label: 'Kilde', value: 'Ferieloven' },
    { label: 'Referenceperiode', value: '01-01-2023 – 31-01-2023' },
    { label: 'TAF-periode', value: '01-04-2023 – 31-05-2023' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-04-01'), til: iso('2023-05-31'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Mølledalens Rengøring ApS', 30000, '2023-01-01', '2023-02-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: iso('2023-01-01'),
        sfggReferenceperiodeTil: iso('2023-01-31'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: '2023-00456',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Marianne Pedersen',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2023-04-01'),
      },
      eoValues: eo,
    };
  }
);

const SCENARIO_03 = buildScenario(
  'sfgg-pdf-03',
  'Manuel SFGG — allerede betalt delvist',
  'Manuel SFGG kr. 600/dag. Arbejdsgiver har allerede betalt kr. 5.000.',
  ['sfgg', 'manuel', 'alleredeBetalt', 'basis'],
  [
    { label: 'Kilde', value: 'Manuelt angivet' },
    { label: 'Dagssats', value: '600 kr.' },
    { label: 'Allerede betalt', value: '5.000 kr.' },
    { label: 'TAF-periode', value: '15-05-2022 – 14-08-2022' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2022-05-15'), til: iso('2022-08-14'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Bygge og Bo A/S', 28000, '2022-02-01', '2022-03-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: amount(600),
        sfggManuelBeloebIHenholdTil: 'Funktionærlovens § 7',
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: amount(5000),
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: '2022-00789',
        advokat: 'Advokatfirma Jensen & Jensen',
        sagsbehandler: undefined,
        skadelidte: 'Karl Mortensen',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2022-05-15'),
      },
      eoValues: eo,
    };
  }
);

const SCENARIO_04 = buildScenario(
  'sfgg-pdf-04',
  'Ingen SFGG — beregningskilde "Ingen"',
  'SFGG er fravalgt med kilden "Ingen". Forventer at SFGG-afsnittet er tomt/nul.',
  ['sfgg', 'ingen', 'basis'],
  [
    { label: 'Kilde', value: 'Ingen' },
    { label: 'TAF-periode', value: '01-07-2023 – 30-09-2023' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-07-01'), til: iso('2023-09-30'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Fredericia Savværk A/S', 32000, '2023-04-01', '2023-05-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ingen',
        sfggManuelDagssats: undefined,
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
        journalnr: '2023-01000',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Hanne Christensen',
        skadestype: 'Erhvervssygdom',
        skadesdato: iso('2023-07-01'),
      },
      eoValues: eo,
    };
  }
);

const SCENARIO_05 = buildScenario(
  'sfgg-pdf-05',
  'SFGG — to ansættelsesforhold med forskellig kilde',
  'To ansættelsesforhold: ét med Ferieloven, ét med Manuelt angivet.',
  ['sfgg', 'ferielov', 'manuel', 'flereAnsaettelser', 'udvidet'],
  [
    { label: 'Ansættelse 1 kilde', value: 'Ferieloven' },
    { label: 'Ansættelse 2 kilde', value: 'Manuelt angivet' },
    { label: 'TAF-periode', value: '01-02-2024 – 30-04-2024' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-04-30'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Transport og Logistik A/S', 38000, '2023-10-01', '2023-11-01'),
      makeAnsaettelsesforhold('af-2', 'Cafeteria Nordvest', 18000, '2023-10-01', '2023-11-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: iso('2023-10-01'),
        sfggReferenceperiodeTil: iso('2023-10-31'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
      {
        ansaettelsesforholdId: 'af-2',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: amount(450),
        sfggManuelBeloebIHenholdTil: 'Ferieloven § 26',
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
        journalnr: '2024-00200',
        advokat: undefined,
        sagsbehandler: 'Lotte Andersen',
        skadelidte: 'Bjarne Sørensen',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2024-02-01'),
      },
      eoValues: eo,
    };
  }
);

const SCENARIO_06 = buildScenario(
  'sfgg-pdf-06',
  'Manuel SFGG — meget kort periode (1 dag)',
  'Manuel SFGG kr. 750/dag. TAF-periode kun 1 dag. Kanttilfælde for dagsberegning.',
  ['sfgg', 'manuel', 'kanttilfaelde', 'udvidet'],
  [
    { label: 'Kilde', value: 'Manuelt angivet' },
    { label: 'Dagssats', value: '750 kr.' },
    { label: 'TAF-periode', value: '10-06-2023 – 10-06-2023 (1 dag)' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-06-10'), til: iso('2023-06-10'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Lager & Pakke ApS', 25000, '2023-03-01', '2023-04-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: amount(750),
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
        journalnr: '2023-01500',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Poul Eriksen',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2023-06-10'),
      },
      eoValues: eo,
    };
  }
);

const SCENARIO_07 = buildScenario(
  'sfgg-pdf-07',
  'Ferieloven SFGG — fraværsdage uden løn i referenceperioden',
  'Ferielov SFGG med 5 fraværsdage uden løn i referenceperioden (reducerer divisoren).',
  ['sfgg', 'ferielov', 'fravaer', 'udvidet'],
  [
    { label: 'Kilde', value: 'Ferieloven' },
    { label: 'Referenceperiode', value: '01-03-2023 – 31-03-2023' },
    { label: 'Fraværsdage uden løn', value: '5' },
    { label: 'TAF-periode', value: '01-06-2023 – 31-08-2023' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-06-01'), til: iso('2023-08-31'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Hotel Skovlyst A/S', 27000, '2023-03-01', '2023-04-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: iso('2023-03-01'),
        sfggReferenceperiodeTil: iso('2023-03-31'),
        sfggReferenceperiodeFravaersdageUdenLoen: 5,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: '2023-02000',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Rita Lund',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2023-06-01'),
      },
      eoValues: eo,
    };
  }
);

const SCENARIO_08 = buildScenario(
  'sfgg-pdf-08',
  'Manuel SFGG — foerst-efter-sygeloen aktiveret',
  'Manuel SFGG kr. 900/dag med "foerst efter sygeloen" = Ja.',
  ['sfgg', 'manuel', 'sygeloen', 'udvidet'],
  [
    { label: 'Kilde', value: 'Manuelt angivet' },
    { label: 'Dagssats', value: '900 kr.' },
    { label: 'Foerst efter sygeløn', value: 'Ja' },
    { label: 'TAF-periode', value: '01-09-2023 – 30-11-2023' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-09-01'), til: iso('2023-11-30'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Aarhus Rengøringsservice A/S', 31000, '2023-06-01', '2023-07-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: amount(900),
        sfggManuelBeloebIHenholdTil: 'Overenskomst pkt. 8',
        sfggManuelFoerstEfterSygeloen: 'Ja',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: '2023-03000',
        advokat: 'Juridisk Bistand ApS',
        sagsbehandler: undefined,
        skadelidte: 'Torben Nielsen',
        skadestype: 'Erhvervssygdom',
        skadesdato: iso('2023-09-01'),
      },
      eoValues: eo,
    };
  }
);

const SCENARIO_09 = buildScenario(
  'sfgg-pdf-09',
  'Ferieloven SFGG — lang TAF-periode (12 måneder)',
  'Ferielov SFGG over en hel årsperiode. Tester 4-måneders-loftet.',
  ['sfgg', 'ferielov', 'aarPeriode', 'alle'],
  [
    { label: 'Kilde', value: 'Ferieloven' },
    { label: 'Referenceperiode', value: '01-01-2022 – 31-03-2022' },
    { label: 'TAF-periode', value: '01-04-2022 – 31-03-2023 (12 måneder)' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2022-04-01'), til: iso('2023-03-31'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Nordjyllands Fabrik A/S', 40000, '2022-01-01', '2022-03-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: iso('2022-01-01'),
        sfggReferenceperiodeTil: iso('2022-03-31'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: '2022-00999',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Grete Madsen',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2022-04-01'),
      },
      eoValues: eo,
    };
  }
);

const SCENARIO_10 = buildScenario(
  'sfgg-pdf-10',
  'Manuel SFGG — allerede betalt fuldt ud',
  'Manuel SFGG kr. 700/dag. Allerede betalt beløb overstiger det beregnede krav.',
  ['sfgg', 'manuel', 'alleredeBetalt', 'alle'],
  [
    { label: 'Kilde', value: 'Manuelt angivet' },
    { label: 'Dagssats', value: '700 kr.' },
    { label: 'Allerede betalt', value: '50.000 kr.' },
    { label: 'TAF-periode', value: '01-01-2023 – 28-02-2023' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-01-01'), til: iso('2023-02-28'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Regionshospitalet Vest', 36000, '2022-10-01', '2022-11-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: amount(700),
        sfggManuelBeloebIHenholdTil: 'Statens lønsystem',
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: amount(50000),
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: '2023-00001',
        advokat: undefined,
        sagsbehandler: 'Mette Holm',
        skadelidte: 'Jakob Frederiksen',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2023-01-01'),
      },
      eoValues: eo,
    };
  }
);

const SCENARIO_11 = buildScenario(
  'sfgg-pdf-11',
  'Ferieloven SFGG — Erhvervssygdom',
  'Ferielov SFGG for en erhvervssygdomssag. Anmeldelsesdato og skadesdato.',
  ['sfgg', 'ferielov', 'erhvervssygdom', 'alle'],
  [
    { label: 'Kilde', value: 'Ferieloven' },
    { label: 'Skadestype', value: 'Erhvervssygdom' },
    { label: 'TAF-periode', value: '01-03-2024 – 30-06-2024' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2024-03-01'), til: iso('2024-06-30'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Metalværksted Jørgensen', 34000, '2023-11-01', '2023-12-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: iso('2023-11-01'),
        sfggReferenceperiodeTil: iso('2023-11-30'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
    ];
    return {
      stamdataValues: {
        journalnr: '2024-00500',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Svend Olsen',
        skadestype: 'Erhvervssygdom',
        skadesdato: iso('2024-03-01'),
      },
      eoValues: eo,
    };
  }
);

const SCENARIO_12 = buildScenario(
  'sfgg-pdf-12',
  'Tre ansættelsesforhold — blandet SFGG-kilde',
  'Tre ansættelsesforhold: Ferieloven, Manuel og Ingen. Tester aggregering.',
  ['sfgg', 'flereAnsaettelser', 'blandet', 'alle'],
  [
    { label: 'Ansættelse 1 kilde', value: 'Ferieloven' },
    { label: 'Ansættelse 2 kilde', value: 'Manuelt angivet' },
    { label: 'Ansættelse 3 kilde', value: 'Ingen' },
    { label: 'TAF-periode', value: '01-05-2023 – 31-07-2023' },
  ],
  () => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.beregnesTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2023-05-01'), til: iso('2023-07-31'), loseFeriedage: 0 },
    ];
    eo.loenindkomstAnsaettelsesforhold = [
      makeAnsaettelsesforhold('af-1', 'Stormagasin Nord A/S', 32000, '2023-02-01', '2023-03-01'),
      makeAnsaettelsesforhold('af-2', 'Cafeteriaservice Vest', 16000, '2023-02-01', '2023-03-01'),
      makeAnsaettelsesforhold('af-3', 'Rengøringshjælp Syd', 12000, '2023-02-01', '2023-03-01'),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: iso('2023-02-01'),
        sfggReferenceperiodeTil: iso('2023-02-28'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
      {
        ansaettelsesforholdId: 'af-2',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: amount(350),
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      } satisfies SfggAnsaettelsesforholdRow,
      {
        ansaettelsesforholdId: 'af-3',
        sfggBeregningskilde: 'Ingen',
        sfggManuelDagssats: undefined,
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
        journalnr: '2023-04000',
        advokat: undefined,
        sagsbehandler: undefined,
        skadelidte: 'Annette Vestergaard',
        skadestype: 'Arbejdsulykke',
        skadesdato: iso('2023-05-01'),
      },
      eoValues: eo,
    };
  }
);

// ---------------------------------------------------------------------------
// Samlet liste og profil-filtrering
// ---------------------------------------------------------------------------

const ALL_SCENARIOS: readonly BatchScenario<EoScenarioInput>[] = [
  SCENARIO_01,
  SCENARIO_02,
  SCENARIO_03,
  SCENARIO_04,
  SCENARIO_05,
  SCENARIO_06,
  SCENARIO_07,
  SCENARIO_08,
  SCENARIO_09,
  SCENARIO_10,
  SCENARIO_11,
  SCENARIO_12,
];

const PROFILE_TAGS: Record<BatchProfile, readonly string[]> = {
  basis: ['basis', 'udvidet', 'alle'],
  udvidet: ['udvidet', 'alle'],
  alle: ['alle'],
};

export const getSfggPdfScenarios = (profile: BatchProfile): readonly BatchScenario<EoScenarioInput>[] => {
  if (profile === 'basis') {
    return ALL_SCENARIOS.filter((s) => s.tags.includes('basis'));
  }
  if (profile === 'udvidet') {
    return ALL_SCENARIOS.filter((s) =>
      PROFILE_TAGS['udvidet'].some((tag) => s.tags.includes(tag)) || s.tags.includes('basis')
    );
  }
  return ALL_SCENARIOS;
};
