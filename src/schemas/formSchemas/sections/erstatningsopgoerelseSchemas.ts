import { z } from 'zod';
import {
  coerceToWholeNumberOrUndefined,
  dayCount,
  loseFeriedageCount,
  nonNegativeAmountValue,
  optionalIsoDateString,
  optionalString,
  percentageDecimal,
  positiveAmountValue,
  tableAmountCellValue,
  tableCellString,
  tableIsoDateCellString,
  yearInteger,
  normalizeEmptyToUndefined
} from '../baseSchemas';
import {
  afsluttesMedEnum,
  anciennitetSatsPerEnum,
  arbejdsstatusEnum,
  beregningsmetodeEnum,
  helbredsstatusEnum,
  jaNejEnum,
  krlSatstabelEnum,
  loenPaaHelligdageEnum,
  loenperiodeEnum,
  svieSmerteDelvisSygemeldingSatsEnum,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  offentligLoenTypeEnum,
  sygeferiegodtgoerelseBeregningskildeEnum,
  sygeferiegodtgoerelseSatsvalgEnum,
  tilstandEnum,
  eoBilagLoenindkomstOgOffentligeYdelserIndgaarSchema,
} from '../enumSchemas';
// Genbrug af årsløn-row-schemaet er bevidst: EO-lønindkomstrækker deler samme persisted table-kontrakt,
// herunder at col2 og col3 er to visuelt adskilte lønfelter med identisk beregningsmæssig betydning.
import { standardLoenTableRowSchema } from './aarsloenSchemas';

export const svieSmertePeriodeRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  fra: optionalIsoDateString,
  til: optionalIsoDateString,
  tilstand: z.preprocess(normalizeEmptyToUndefined, tilstandEnum.optional()),
}).strict();

export type SvieSmertePeriodeRow = z.infer<typeof svieSmertePeriodeRowSchema>;

export const tafPeriodeRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  fra: optionalIsoDateString,
  til: optionalIsoDateString,
  loseFeriedage: loseFeriedageCount,
}).strict();

export type TafPeriodeRow = z.infer<typeof tafPeriodeRowSchema>;

export const ferieperiodeRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  fra: optionalIsoDateString,
  til: optionalIsoDateString,
}).strict();

export type FerieperiodeRow = z.infer<typeof ferieperiodeRowSchema>;

export const sygeferiegodtgoerelseAnsaettelsesforholdRowSchema = z.object({
  ansaettelsesforholdId: z.string().min(1, 'Ansættelsesforhold-ID må ikke være tomt'),
  sfggBeregningskilde: z.preprocess(normalizeEmptyToUndefined, sygeferiegodtgoerelseBeregningskildeEnum.optional()),
  sfggReferenceperiodeFra: optionalIsoDateString,
  sfggReferenceperiodeTil: optionalIsoDateString,
  sfggReferenceperiodeFravaersdageUdenLoen: dayCount,
  sfggManuelDagssats: nonNegativeAmountValue,
  sfggManuelBeloebIHenholdTil: optionalString,
  sfggManuelFoerstEfterSygeloen: jaNejEnum.default('Nej'),
  sfggSatsvalg: z.preprocess(normalizeEmptyToUndefined, sygeferiegodtgoerelseSatsvalgEnum.optional()),
  sfggAlleredeBetaltBeloeb: nonNegativeAmountValue,
}).strict();

export type SygeferiegodtgoerelseAnsaettelsesforholdRow =
  z.infer<typeof sygeferiegodtgoerelseAnsaettelsesforholdRowSchema>;

export const oevrigeKravRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  dato: optionalIsoDateString,
  udgiftTil: optionalString,
  beloeb: positiveAmountValue,
}).strict();

export type OevrigeKravRow = z.infer<typeof oevrigeKravRowSchema>;

export const offentligeYdelserRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  fraDato: tableIsoDateCellString,
  tilDato: tableIsoDateCellString,
  // `ydelse` og `tillaeg` er to visuelt adskilte ydelsesfelter med identisk domænebetydning.
  // Beregninger må ikke skelne mellem dem; de lægges blot sammen til én samlet ydelse.
  ydelse: tableAmountCellValue,
  tillaeg: tableAmountCellValue,
  ydelsestype: tableCellString,
}).strict();

export type OffentligeYdelserRow = z.infer<typeof offentligeYdelserRowSchema>;

export const loenudviklingManuelRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  dato: tableIsoDateCellString,
  grundloen: tableAmountCellValue,
  feriepenge: percentageDecimal,
  shSoSats: percentageDecimal,
  fritvalg: percentageDecimal,
  agPension: percentageDecimal,
}).strict();

export type LoenudviklingManuelRow = z.infer<typeof loenudviklingManuelRowSchema>;

const aesAfgoerelserSchema = z.object({
  varigeMenAfgorelse: jaNejEnum.default('Nej'),
  menAfgoerelseDato: optionalIsoDateString,
  verserendeKlageMen: jaNejEnum.default('Nej'),
  midlertidigtEETAfgorelse: jaNejEnum.default('Nej'),
  midlertidigEETAfgoerelseDato: optionalIsoDateString,
  midlertidigEETVirkningsdato: optionalIsoDateString,
  endeligtEETAfgorelse: jaNejEnum.default('Nej'),
  endeligEETAfgoerelseDato: optionalIsoDateString,
  endeligEETVirkningsdato: optionalIsoDateString,
  verserendeKlageEet: jaNejEnum.default('Nej'),
  differencekravDato: optionalIsoDateString,
}).strict();

const svieSmerteSchema = z.object({
  beregnesSvieSmerteGodtgoerelse: jaNejEnum.default('Ja'),
  svieSmerteHelbredsstatus: z.preprocess(normalizeEmptyToUndefined, helbredsstatusEnum.optional()),
  tidligereSsMax: jaNejEnum.default('Nej'),
  svieSmertePerioder: z.array(svieSmertePeriodeRowSchema).default([]),
  svieSmerteSatserAar: yearInteger,
  svieSmerteDelvisSygemeldingSats: svieSmerteDelvisSygemeldingSatsEnum.default('halv'),
  svieSmerteTidligereTotal: nonNegativeAmountValue,
  svieSmerteAktuelPeriode: nonNegativeAmountValue,
}).strict();

const tafSchema = z.object({
  beregnesTabtArbejdsfortjeneste: jaNejEnum.default('Ja'),
  tafArbejdsstatus: z.preprocess(normalizeEmptyToUndefined, arbejdsstatusEnum.optional()),
  tafPerioder: z.array(tafPeriodeRowSchema).default([]),
  ferieperioder: z.array(ferieperiodeRowSchema).default([]),
  opsagtFraStilling: jaNejEnum.default('Nej'),
  sidsteDagAnsaettelsesforhold: optionalIsoDateString,
  tidligereModtagetTaf: nonNegativeAmountValue,
}).strict();

const indtaegtFoerSkadenSchema = z.object({
  komprimerBeregningEfterFoersteOpgoerelse: jaNejEnum.default('Ja'),
  beregnesUdFra: beregningsmetodeEnum.default('Beregningsperiode'),
  tafBeregningsperiodeFra: optionalIsoDateString,
  tafBeregningsperiodeTil: optionalIsoDateString,
  fravaerPerioder: z.array(ferieperiodeRowSchema).default([]),
  uspecificeredeFerieFridage: dayCount,
  oevrigtFravaerUdenLoen: jaNejEnum.default('Nej'),
  oevrigeFravaersdage: dayCount,
  oevrigeFravaersdageBeskrivelse: optionalString,
  maanedsloenenUdgoer: nonNegativeAmountValue,
  dagsloenenUdgoer: nonNegativeAmountValue,
  angivetMaanedsloenBaseretPaa: optionalString,
  angivetMaanedsloenOpreguleresFraDato: optionalIsoDateString,
  angivetDagsloenBaseretPaa: optionalString,
  angivetDagsloenOpreguleresFraDato: optionalIsoDateString,
}).strict();

const sygeferiegodtgoerelseSchema = z.object({
  // ferieperiodeRowSchema genbruges bevidst her: sfggSygeperioderFoer2015 har samme struktur
  // (fra/til/id) som ferieperioder. Invariant: kun fra, til og id bruges — øvrige evt. ferieperiode-felter
  // er irrelevante for dette domæne og ignoreres ved læsning.
  sfggSygeperioderFoer2015: z.array(ferieperiodeRowSchema).default([]),
  sfggAnsaettelsesforhold: z.array(sygeferiegodtgoerelseAnsaettelsesforholdRowSchema).default([]),
}).strict();

const eoBilagSelectionSchema = z.object({
  opgoerelse: z.boolean().default(true),
  loenindkomst: z.boolean().default(true),
  offentligeYdelser: z.boolean().default(true),
  midlertidigEet: z.boolean().default(true),
  shDage: z.boolean().default(false),
  regulering: z.boolean().default(true),
  okSatser: z.boolean().default(true),
  sygeferiegodtgoerelse: z.boolean().default(false),
}).strict();

const bilagsnumreSchema = z.object({
  visBilagsnumre: jaNejEnum.default('Nej'),
  bilagsnumreMenAfgoerelse: optionalString,
  bilagsnumreEetAfgoerelser: optionalString,
  bilagsnumreSvieSmerteDokumentation: optionalString,
  bilagsnumreBeregningsgrundlagTaf: optionalString,
  bilagsnumreLoenISygeperioden: optionalString,
  bilagsnumreOffentligeYdelser: optionalString,
  bilagsnumreOevrigeErstatningskrav: optionalString,
}).strict();

const erstatningsopgoerelseBaseSchema = z.object({
  eoNummer: optionalString,
  eoLedsagetekst: optionalString,
  opgørelseLavetDen: optionalIsoDateString,
  indsaetUdkastStempel: jaNejEnum.default('Nej'),
  vedroererPeriodeFra: optionalIsoDateString,
  vedroererPeriodeTil: optionalIsoDateString,
  revideretOpgoerelse: jaNejEnum.default('Nej'),
  midlertidigtEetFraEetSiden: jaNejEnum.default('Nej'),
  regulerOffentligeYdelser: jaNejEnum.default('Ja'),
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: z.boolean().default(false),
  allowReguleringMedUdloebMedMaaneder: z.number().int().min(0).max(12).default(6),
  erstatningsopgoerelseAfsluttesMed: afsluttesMedEnum.default('Bekræftet godkendt'),
  forligAnsvarsgradProcent: percentageDecimal,
  forligAnsvarsgradBroek: optionalString,
  forligDato: optionalIsoDateString,
  oevrigeKravPerioder: z.array(oevrigeKravRowSchema).default([]),
  offentligeYdelserRows: z.array(offentligeYdelserRowSchema).default([]),
  loenudviklingPaaGrundlagAf: optionalString,
  saerligeKommentarer: optionalString,
  eoBilagSelection: eoBilagSelectionSchema.default({ opgoerelse: true, loenindkomst: true, offentligeYdelser: true, midlertidigEet: true, shDage: false, regulering: true, okSatser: true, sygeferiegodtgoerelse: false }),
  eoBilagLoenindkomstOgOffentligeYdelserIndgaar: eoBilagLoenindkomstOgOffentligeYdelserIndgaarSchema.default('Perioden'),
}).strict();

const overenskomstFilterSchema = z.object({
  loenmodtager: optionalString,
  arbejdsgiver: optionalString,
}).strict();

const offentligLoenTrinSchema = z.preprocess(
  coerceToWholeNumberOrUndefined,
  z.number({ error: 'Skal være et heltal mellem 1 og 99' })
    .int('Skal være et heltal mellem 1 og 99')
    .min(1, 'Skal være mindst 1')
    .max(99, 'Må højst være 99')
    .optional()
);

const offentligLoenGruppeSchema = z.preprocess(
  coerceToWholeNumberOrUndefined,
  z.number({ error: 'Skal være et heltal mellem 0 og 4' })
    .int('Skal være et heltal mellem 0 og 4')
    .min(0, 'Skal være mindst 0')
    .max(4, 'Må højst være 4')
    .optional()
);

// Fælles lønudviklingsfelter bruges i to persisted former:
// ansættelsesforhold kræver `loenPaaHelligdage`, mens EO-angivet løn skal kunne loades uden feltet.
const createLoenudviklingOgSatserSchema = <TLoenPaaHelligdage extends z.ZodTypeAny>(loenPaaHelligdage: TLoenPaaHelligdage) => z.object({
  feriePct: percentageDecimal,
  loenPaaHelligdage,
  saerligFraDatoRegulering: optionalIsoDateString,
  loenudviklingBeregningsgrundlag: z.preprocess(normalizeEmptyToUndefined, loenudviklingBeregningsgrundlagEnum.optional()),
  loenudviklingStatistikModel: z.preprocess(normalizeEmptyToUndefined, loenudviklingStatistikModelEnum.optional()),
  loenudviklingKRLSatstabel: z.preprocess(normalizeEmptyToUndefined, krlSatstabelEnum.optional()),
  loenudviklingManuelNavn: optionalString,
  loenudviklingManuelTableData: z.array(loenudviklingManuelRowSchema).default([]),
  offentligLoenType: z.preprocess(normalizeEmptyToUndefined, offentligLoenTypeEnum.optional()),
  offentligLoenTrin: offentligLoenTrinSchema,
  offentligLoenGruppe: offentligLoenGruppeSchema,
  offentligLoenEkstraGrundloen: nonNegativeAmountValue,
  overenskomstFilter: overenskomstFilterSchema.default({}),
}).strict();

export const loenudviklingOgSatserSchema = createLoenudviklingOgSatserSchema(loenPaaHelligdageEnum);
export const eoLoenudviklingOgSatserSchema = createLoenudviklingOgSatserSchema(
  z.preprocess(normalizeEmptyToUndefined, loenPaaHelligdageEnum.optional())
);
export type LoenudviklingOgSatser = z.infer<typeof loenudviklingOgSatserSchema>;
export type EOLoenudviklingOgSatser = z.infer<typeof eoLoenudviklingOgSatserSchema>;

const loenindkomstAnsaettelsesforholdBaseSchema = z.object({
  id: z.string().min(1, 'ID må ikke være tomt'),
  navnPaaArbejdssted: optionalString,
  harOverenskomst: z.boolean().default(false),
  overenskomstId: optionalString,
  ansatPaaSkadestidspunktet: z.boolean().default(false),
  ansaettelsesforholdOphoert: z.boolean().default(false),
  sidsteArbejdsdag: optionalIsoDateString,
  fritvalgPct: percentageDecimal,
  shSoPct: percentageDecimal,
  storeBededagPct: percentageDecimal,
  pensionPct: percentageDecimal,
  loenperiode: loenperiodeEnum.default('maaned'),
  indtaegtsoplysningerTableData: z.array(standardLoenTableRowSchema).default([]),
  fuldLoenUnderFerie: jaNejEnum.default('Nej'),
}).strict();

const loenindkomstAnciennitetSchema = z.object({
  harAnciennitetstillaegEfterSkadedatoen: z.boolean().default(false),
  anciennitetstillaegDato: optionalIsoDateString,
  anciennitetstillaegSatsAngivesPer: anciennitetSatsPerEnum.default('Måned'),
  anciennitetstillaegSats: nonNegativeAmountValue,
}).strict();

export const loenindkomstAnsaettelsesforholdSchema = z.object({
  // Feltejerskab: base ejer ansættelsesidentitet og løntabel, anciennitet ejer anciennitetsfelter,
  // og lønudvikling ejer satser/reguleringsvalg. Shape-spread må kun bruges her, hvor felterne er disjunkte.
  ...loenindkomstAnsaettelsesforholdBaseSchema.shape,
  ...loenindkomstAnciennitetSchema.shape,
  ...loenudviklingOgSatserSchema.shape,
}).strict();

export type LoenindkomstAnsaettelsesforhold = z.infer<typeof loenindkomstAnsaettelsesforholdSchema>;

const loenindkomstSchema = z.object({
  loenindkomstAnsaettelsesforhold: z.array(loenindkomstAnsaettelsesforholdSchema),
}).strict();

export const eoAngivetLoenLoenudviklingSchema = z.object({
  overenskomstId: optionalString,
  harAnciennitetstillaegEfterSkadedatoen: z.boolean().default(false),
  anciennitetstillaegDato: optionalIsoDateString,
  anciennitetstillaegSatsAngivesPer: anciennitetSatsPerEnum.default('Måned'),
  anciennitetstillaegSats: nonNegativeAmountValue,
  ...eoLoenudviklingOgSatserSchema.shape,
}).strict();

export type EOAngivetLoenLoenudvikling = z.infer<typeof eoAngivetLoenLoenudviklingSchema>;

const createDefaultEoAngivetLoenLoenudvikling = (): EOAngivetLoenLoenudvikling =>
  eoAngivetLoenLoenudviklingSchema.parse({});

const eoAngivetLoenSchema = z.object({
  eoAngivetLoenLoenudvikling: eoAngivetLoenLoenudviklingSchema.default(createDefaultEoAngivetLoenLoenudvikling),
}).strict();

export const erstatningsopgoerelseSchema = z.object({
  ...erstatningsopgoerelseBaseSchema.shape,
  ...aesAfgoerelserSchema.shape,
  ...svieSmerteSchema.shape,
  ...tafSchema.shape,
  ...indtaegtFoerSkadenSchema.shape,
  ...sygeferiegodtgoerelseSchema.shape,
  ...loenindkomstSchema.shape,
  ...eoAngivetLoenSchema.shape,
  ...bilagsnumreSchema.shape,
}).strict();

export type ErstatningsopgoerelseValues = z.infer<typeof erstatningsopgoerelseSchema>;
