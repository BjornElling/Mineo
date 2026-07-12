import { toISODateString } from '../../types/branded';
import { getDayAfterIso } from '../../utils/isoDateHelpers';
import { folkepensionAlderPerioder } from '../folkepensionAlderRates';
import { SAERLIGT_FERIETILLAEG_SATSTRAPPE, STORE_BEDEDAG_SATSTRAPPE } from '../indskudteLoentillaeg';
import { referenceRates, surchargeRates } from '../interestRates';
import { kapitaliseringsbekendtgoerelser } from '../kapitalisering/kapitaliseringsbekendtgoerelser';
import {
  assertKapitaliseringsTabelDataIntegritet,
  kapitaliseringsTabelDataById,
} from '../kapitalisering/kapitaliseringsTabeller';
import { forhoejetPensionsalderEvents } from '../kapitalisering/forhoejetPensionsalderEvents';
import { klLoenSatser } from '../KL/klLoenSatser';
import { assertKlLoenaftalerDataIntegritet, klLoenaftalerRaekker } from '../klLoenaftaler';
import { krlSatstabeller } from '../krlRates';
import {
  aarsloenAslMax,
  aarsloenAslMin,
  aarsloenAslMinFoer20240701,
  aarsloenAslMinFra20240701,
  aslReference,
  aslReferenceLinks,
  ealReference,
  ealReferenceLinks,
  erhvervsevnetabEalMax,
  foersoergertabEalMin,
  friProcesBarn,
  friProcesEnlig,
  friProcesReference,
  friProcesReferenceLinks,
  friProcesSamlevende,
  kapitalisering as kapitaliseringReference,
  kapitaliseringLinks,
  kapitaliseringSkadeFoer2007,
  kapitaliseringSkadeFoer2007Links,
  kapitaliseringSkadeFoer2011,
  kapitaliseringSkadeFoer2011Links,
  kapitaliseringSkadeFra2007,
  kapitaliseringSkadeFra2007Links,
  kapitaliseringSkadeFra2011,
  kapitaliseringSkadeFra2011Links,
  overgangsbeloeb,
  reguleringsprocentErhvervsevnetab,
  reguleringsprocentErhvervsevnetabFoer2024,
  reguleringsprocentErhvervsevnetabFra2024,
  reguleringssats,
  reguleringssatsReference,
  reguleringssatsReferenceLinks,
  svieSmerteMax,
  svieSmertePrDag,
  varigeMenPrGrad,
  vejledendeUdtalelseEet,
  assertAarsloenAslMaxKontinuitet,
} from '../lovbestemteRates';
import { assertOffentligLoenDataIntegritet } from '../offentligLoenLookup';
import { overenskomster, assertOverenskomstSatserNyesteFoerst, assertValidSfggPolicy } from '../overenskomstRates';
import { rltnLoenSatser } from '../RLTN/rltnLoenSatser';
import { statistiskLoenudvikling, assertStatistikAarKontinuitet } from '../statistiskeRates';
import { assertSygedagpengeRatesIntegritet, sygedagpengeRates } from '../sygedagpengeRates';
import { defineCalculationData, defineCalculationDataCatalog } from './calculationDataCatalog';

const assertNonEmpty = (payload: readonly unknown[], label: string): void => {
  if (payload.length === 0) throw new Error(`${label}: datakilden er tom`);
};

const assertNewestFirstRates = (
  rates: readonly Readonly<{ effectiveDate: string; ratePct: number }>[],
  label: string
): void => {
  assertNonEmpty(rates, label);
  let previousDate: string | null = null;
  for (const rate of rates) {
    if (!Number.isFinite(rate.ratePct) || (previousDate !== null && rate.effectiveDate >= previousDate)) {
      throw new Error(`${label}: satserne skal være endelige og strengt nyeste-først`);
    }
    previousDate = rate.effectiveDate;
  }
};

const assertFolkepensionAlderPerioder = (periods: typeof folkepensionAlderPerioder): void => {
  assertNonEmpty(periods, 'Folkepensionsalder');
  let expectedPeriodStart: string | null = null;
  let hasOpenEndedPeriod = false;
  for (const period of periods) {
    if (hasOpenEndedPeriod || (expectedPeriodStart !== null && period.opslagsdatoFra !== expectedPeriodStart)) {
      throw new Error('Folkepensionsalder: opslagsperioderne skal være sammenhængende');
    }
    if (period.entries.length === 0 || period.entries[0]?.foedselsdatoFra !== null || period.entries.at(-1)?.foedselsdatoTil !== null) {
      throw new Error('Folkepensionsalder: hver periode skal dække alle fødselsdatoer');
    }
    let expectedBirthStart: string | null = null;
    for (const entry of period.entries) {
      if (entry.foedselsdatoFra !== expectedBirthStart || !Number.isInteger(entry.alderMaaneder) || entry.alderMaaneder <= 0) {
        throw new Error('Folkepensionsalder: ugyldig eller usammenhængende fødselskohorte');
      }
      expectedBirthStart = entry.foedselsdatoTil === null ? null : getDayAfterIso(entry.foedselsdatoTil);
    }
    expectedPeriodStart = period.opslagsdatoTil === null ? null : getDayAfterIso(period.opslagsdatoTil);
    hasOpenEndedPeriod = period.opslagsdatoTil === null;
  }
};

const lovbestemtePayload = {
  svieSmertePrDag,
  svieSmerteMax,
  erhvervsevnetabEalMax,
  foersoergertabEalMin,
  vejledendeUdtalelseEet,
  varigeMenPrGrad,
  aarsloenAslMax,
  aarsloenAslMin,
  aarsloenAslMinFoer20240701,
  aarsloenAslMinFra20240701,
  overgangsbeloeb,
  reguleringsprocentErhvervsevnetab,
  reguleringsprocentErhvervsevnetabFoer2024,
  reguleringsprocentErhvervsevnetabFra2024,
  friProcesEnlig,
  friProcesSamlevende,
  friProcesBarn,
  reguleringssats,
  ealReference,
  ealReferenceLinks,
  aslReference,
  aslReferenceLinks,
  kapitaliseringReference,
  kapitaliseringLinks,
  kapitaliseringSkadeFra2011,
  kapitaliseringSkadeFra2011Links,
  kapitaliseringSkadeFoer2011,
  kapitaliseringSkadeFoer2011Links,
  kapitaliseringSkadeFra2007,
  kapitaliseringSkadeFra2007Links,
  kapitaliseringSkadeFoer2007,
  kapitaliseringSkadeFoer2007Links,
  friProcesReference,
  friProcesReferenceLinks,
  reguleringssatsReference,
  reguleringssatsReferenceLinks,
} as const;

export const beregningsdataCatalog = defineCalculationDataCatalog([
  defineCalculationData({
    id: 'lovbestemte-satser',
    provenance: {
      sources: ['Retsinformation: årlige bekendtgørelser og vejledninger'],
      maintenance: { method: 'manually_transcribed' },
    },
    coverage: { kind: 'source_defined', description: 'Årsdækning varierer mellem de lovbestemte serier.' },
    payload: lovbestemtePayload,
    validate: ({ aarsloenAslMax: indeks }) => assertAarsloenAslMaxKontinuitet(indeks),
  }),
  defineCalculationData({
    id: 'indskudte-loentillaeg',
    provenance: {
      sources: ['Lovgrundlaget for Store Bededagstillæg og særligt ferietillæg'],
      maintenance: { method: 'manually_transcribed' },
    },
    coverage: { kind: 'source_defined', description: 'Dækningen følger hvert tillægs satstrappe.' },
    payload: { STORE_BEDEDAG_SATSTRAPPE, SAERLIGT_FERIETILLAEG_SATSTRAPPE },
    validate: (payload) => {
      for (const [label, steps] of Object.entries(payload)) {
        let previousDate = '';
        for (const step of steps) {
          if (step.fraOgMed <= previousDate || !Number.isFinite(step.procentpoint)) {
            throw new Error(`${label}: satstrappen skal være strengt stigende med endelige satser`);
          }
          previousDate = step.fraOgMed;
        }
      }
    },
  }),
  defineCalculationData({
    id: 'procesrenter',
    provenance: {
      sources: ['Danmarks Nationalbanks officielle referencesats', 'Rentelovens tillægssats'],
      maintenance: { method: 'manually_transcribed' },
    },
    coverage: { kind: 'date', from: toISODateString('2002-08-01'), through: null },
    payload: { referenceRates, surchargeRates },
    validate: (payload) => {
      assertNewestFirstRates(payload.referenceRates, 'Referencesatser');
      assertNewestFirstRates(payload.surchargeRates, 'Tillægssatser');
    },
  }),
  defineCalculationData({
    id: 'folkepensionsalder',
    provenance: {
      sources: ['Lov om social pension § 1 a', 'L 485/2009', 'L 395/2015', 'L 710/2020'],
      maintenance: { method: 'manually_transcribed' },
    },
    coverage: { kind: 'date', from: toISODateString('2003-01-01'), through: null },
    payload: folkepensionAlderPerioder,
    validate: assertFolkepensionAlderPerioder,
  }),
  defineCalculationData({
    id: 'overenskomster',
    provenance: {
      sources: ['De navngivne kollektive overenskomster i datasættet'],
      maintenance: { method: 'manually_transcribed' },
    },
    coverage: { kind: 'source_defined', description: 'Hver overenskomst har sin egen satsperiode.' },
    payload: overenskomster,
    validate: (payload) => payload.forEach(({ meta, satser }) => {
      assertValidSfggPolicy(meta, satser);
      assertOverenskomstSatserNyesteFoerst(satser, meta.id);
    }),
  }),
  defineCalculationData({
    id: 'statistiske-loenindeks',
    provenance: {
      sources: ['Danmarks Statistik: ILON12 og SBLON2'],
      maintenance: { method: 'manually_transcribed' },
    },
    coverage: { kind: 'source_defined', description: 'Dækningen følger den enkelte statistikmodel.' },
    payload: statistiskLoenudvikling,
    validate: (payload) => payload.forEach(assertStatistikAarKontinuitet),
  }),
  defineCalculationData({
    id: 'krl-satstabeller',
    provenance: {
      sources: ['Kommunernes og Regionernes Løndatakontor: KTO- og SHK-satstabeller'],
      maintenance: { method: 'manually_transcribed' },
    },
    coverage: { kind: 'source_defined', description: 'Dækningen følger den enkelte KRL-kolonne.' },
    payload: krlSatstabeller,
    validate: (payload) => {
      assertNonEmpty(payload, 'KRL-satstabeller');
      payload.forEach((table) => assertNonEmpty(table.vaerdier, `KRL-satstabel ${table.id}`));
    },
  }),
  defineCalculationData({
    id: 'kl-loenaftaler',
    provenance: {
      sources: ['KL: lønaftalernes reguleringsoversigt'],
      maintenance: { method: 'manually_transcribed' },
    },
    coverage: { kind: 'source_defined', description: 'Fra basisdatoen til seneste aftalte regulering.' },
    payload: klLoenaftalerRaekker,
    validate: assertKlLoenaftalerDataIntegritet,
  }),
  defineCalculationData({
    id: 'sygedagpenge',
    provenance: {
      sources: ['Årlige officielle sygedagpenge-, ATP- og pensionssatser'],
      maintenance: { method: 'manually_transcribed' },
    },
    coverage: { kind: 'date', from: toISODateString('2005-01-03'), through: toISODateString('2027-01-03') },
    payload: sygedagpengeRates,
    validate: assertSygedagpengeRatesIntegritet,
  }),
  defineCalculationData({
    id: 'offentlig-loen-kl',
    provenance: {
      sources: ['src/data/KL/Excel/'],
      maintenance: { method: 'generated', command: 'npm run import:loen' },
    },
    coverage: { kind: 'source_defined', description: 'Dækningen udledes af de importerede KL-reguleringsfiler.' },
    payload: klLoenSatser,
    validate: (payload) => assertOffentligLoenDataIntegritet(payload, 'KL'),
  }),
  defineCalculationData({
    id: 'offentlig-loen-rltn',
    provenance: {
      sources: ['src/data/RLTN/Excel/'],
      maintenance: { method: 'generated', command: 'npm run import:loen' },
    },
    coverage: { kind: 'source_defined', description: 'Dækningen udledes af de importerede RLTN-reguleringsfiler.' },
    payload: rltnLoenSatser,
    validate: (payload) => assertOffentligLoenDataIntegritet(payload, 'RLTN'),
  }),
  defineCalculationData({
    id: 'kapitaliseringstabeller',
    provenance: {
      sources: ['src/data/kapitalisering/kapitaliseringOriginalPdf/'],
      maintenance: { method: 'machine_extracted', sourceDirectory: 'src/data/kapitalisering/kapitaliseringOriginalPdf/' },
    },
    coverage: { kind: 'source_defined', description: 'Hver tabel angiver selv gyldighed og skadedatoafgrænsning.' },
    payload: kapitaliseringsTabelDataById,
    validate: assertKapitaliseringsTabelDataIntegritet,
  }),
  defineCalculationData({
    id: 'kapitaliseringsbekendtgoerelser',
    provenance: {
      sources: ['Retsinformation: kapitaliseringsbekendtgørelser og -vejledninger'],
      maintenance: { method: 'manually_transcribed' },
    },
    coverage: { kind: 'source_defined', description: 'Intervallerne i oversigten er autoritativ dækning.' },
    payload: kapitaliseringsbekendtgoerelser,
    validate: (payload) => assertNonEmpty(payload, 'Kapitaliseringsbekendtgørelser'),
  }),
  defineCalculationData({
    id: 'forhoejet-pensionsalder-events',
    provenance: {
      sources: ['Lovændringer om forhøjet folkepensionsalder og de tilhørende kapitaliseringstabeller'],
      maintenance: { method: 'manually_transcribed' },
    },
    coverage: { kind: 'source_defined', description: 'Én række pr. relevant lovændring.' },
    payload: forhoejetPensionsalderEvents,
    validate: (payload) => assertNonEmpty(payload, 'Forhøjet pensionsalder-events'),
  }),
] as const);

export type BeregningsdataCatalogId = (typeof beregningsdataCatalog)[number]['id'];
