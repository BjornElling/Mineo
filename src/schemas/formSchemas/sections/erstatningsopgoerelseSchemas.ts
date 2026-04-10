import { z } from 'zod';
import {
  coerceToIntegerOrUndefined,
  dayCount,
  isoDateString,
  loseFeriedageCount,
  nonNegativeAmountValue,
  optionalIsoDateString,
  optionalString,
  percentageDecimal,
  positiveAmountValue,
  tableAmountCellValue,
  tableCellString,
  tableDateCellString,
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
  loenPaaHelligdageSchema,
  loenperiodeSchema,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  offentligLoenTypeEnum,
  tilstandEnum,
} from '../enumSchemas';
// Reuse of årsløn row schema is intentional: EO lønindkomst rows share the same persisted table contract,
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

export const sygeferiegodtgoerelseBeregningskildeEnum = z.enum([
  'Overenskomst',
  'Manuelt angivet',
  'Ferieloven',
  'Ingen',
]);

export type SygeferiegodtgoerelseBeregningskilde = z.infer<typeof sygeferiegodtgoerelseBeregningskildeEnum>;

export const sygeferiegodtgoerelseSatsvalgEnum = z.enum([
  'Faglaert-Koebenhavn',
  'Faglaert-Provinsen',
  'Ufaglaert-Koebenhavn',
  'Ufaglaert-Provinsen',
]);

export type SygeferiegodtgoerelseSatsvalg = z.infer<typeof sygeferiegodtgoerelseSatsvalgEnum>;

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
  fraDato: tableDateCellString,
  tilDato: tableDateCellString,
  // `ydelse` og `tillaeg` er to visuelt adskilte ydelsesfelter med identisk domænebetydning.
  // Beregninger må ikke skelne mellem dem; de lægges blot sammen til én samlet ydelse.
  ydelse: tableAmountCellValue,
  tillaeg: tableAmountCellValue,
  ydelsestype: tableCellString,
}).strict();

export type OffentligeYdelserRow = z.infer<typeof offentligeYdelserRowSchema>;

export const loenudviklingManuelRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  dato: tableDateCellString,
  grundloen: tableAmountCellValue,
  feriepenge: tableCellString,
  shSoSats: tableCellString,
  fritvalg: tableCellString,
  agPension: tableCellString,
}).strict();

export type LoenudviklingManuelRow = z.infer<typeof loenudviklingManuelRowSchema>;

const aesAfgoerelserSchema = z.object({
  varigeMenAfgorelse: jaNejEnum,
  menAfgoerelseDato: optionalIsoDateString,
  verserendeKlageMen: jaNejEnum,
  midlertidigtEETAfgorelse: jaNejEnum,
  midlertidigEETAfgoerelseDato: optionalIsoDateString,
  midlertidigEETVirkningsdato: optionalIsoDateString,
  endeligtEETAfgorelse: jaNejEnum,
  endeligEETAfgoerelseDato: optionalIsoDateString,
  endeligEETVirkningsdato: optionalIsoDateString,
  verserendeKlageEet: jaNejEnum,
  differencekravDato: optionalIsoDateString,
}).strict();

const svieSmerteSchema = z.object({
  beregnesSvieSmerteGodtgoerelse: jaNejEnum.default('Ja'),
  svieSmerteHelbredsstatus: z.preprocess(normalizeEmptyToUndefined, helbredsstatusEnum.optional()),
  tidligereSsMax: jaNejEnum,
  svieSmertePerioder: z.array(svieSmertePeriodeRowSchema),
  svieSmerteSatserAar: yearInteger,
  svieSmerteDelvisSygemeldingSats: z.enum(['fuld', 'halv']),
  svieSmerteTidligereTotal: nonNegativeAmountValue,
  svieSmerteAktuelPeriode: nonNegativeAmountValue,
}).strict();

const tafSchema = z.object({
  beregnesTabtArbejdsfortjeneste: jaNejEnum.default('Ja'),
  tafArbejdsstatus: z.preprocess(normalizeEmptyToUndefined, arbejdsstatusEnum.optional()),
  tafPerioder: z.array(tafPeriodeRowSchema),
  ferieperioder: z.array(ferieperiodeRowSchema),
  opsagtFraStilling: jaNejEnum,
  sidsteDagAnsaettelsesforhold: optionalIsoDateString,
  tidligereModtagetTaf: nonNegativeAmountValue,
}).strict();

const indtaegtFoerSkadenSchema = z.object({
  komprimerBeregningEfterFoersteOpgoerelse: jaNejEnum.default('Ja'),
  beregnesUdFra: beregningsmetodeEnum,
  tafBeregningsperiodeFra: optionalIsoDateString,
  tafBeregningsperiodeTil: optionalIsoDateString,
  fravaerPerioder: z.array(ferieperiodeRowSchema),
  uspecificeredeFerieFridage: dayCount,
  oevrigtFravaerUdenLoen: jaNejEnum,
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
  opgoerelse: z.literal(true),
  loenindkomst: z.boolean(),
  offentligeYdelser: z.boolean(),
  midlertidigEet: z.boolean().default(true),
  shDage: z.boolean(),
  regulering: z.boolean(),
  okSatser: z.boolean(),
  sygeferiegodtgoerelse: z.boolean(),
}).strict();

const eoBilagLoenindkomstOgOffentligeYdelserIndgaarSchema = z.enum(['Alle', 'Perioden']);
export type EoBilagLoenindkomstOgOffentligeYdelserIndgaar = z.infer<typeof eoBilagLoenindkomstOgOffentligeYdelserIndgaarSchema>;

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
  indsaetUdkastStempel: jaNejEnum,
  vedroererPeriodeFra: optionalIsoDateString,
  vedroererPeriodeTil: optionalIsoDateString,
  revideretOpgoerelse: jaNejEnum,
  erstatningsopgoerelseAfsluttesMed: afsluttesMedEnum,
  forligAnsvarsgradProcent: percentageDecimal,
  forligAnsvarsgradBroek: optionalString,
  forligDato: optionalIsoDateString,
  oevrigeKravPerioder: z.array(oevrigeKravRowSchema),
  offentligeYdelserRows: z.array(offentligeYdelserRowSchema),
  midlertidigtEETAfgoerelseGrupper: z.array(z.object({
    afgoerelsesdato: isoDateString,
    rowIds: z.array(z.string()),
  }).strict()).default([]),
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
  coerceToIntegerOrUndefined,
  z.number()
    .int()
    .min(1, 'Skal være mindst 1')
    .max(99, 'Må højst være 99')
    .optional()
);

const offentligLoenGruppeSchema = z.preprocess(
  coerceToIntegerOrUndefined,
  z.number()
    .int()
    .min(0, 'Skal være mindst 0')
    .max(4, 'Må højst være 4')
    .optional()
);

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
  overenskomstFilter: overenskomstFilterSchema,
}).strict();

export const loenudviklingOgSatserSchema = createLoenudviklingOgSatserSchema(loenPaaHelligdageSchema);
export const eoLoenudviklingOgSatserSchema = createLoenudviklingOgSatserSchema(
  z.preprocess(normalizeEmptyToUndefined, loenPaaHelligdageSchema.optional())
);
export type LoenudviklingOgSatser = z.infer<typeof loenudviklingOgSatserSchema>;
export type EOLoenudviklingOgSatser = z.infer<typeof eoLoenudviklingOgSatserSchema>;

const loenindkomstAnsaettelsesforholdBaseSchema = z.object({
  id: z.string().min(1, 'ID må ikke være tomt'),
  navnPaaArbejdssted: optionalString,
  harOverenskomst: z.boolean(),
  overenskomstId: optionalString,
  ansatPaaSkadestidspunktet: z.boolean(),
  ansaettelsesforholdOphoert: z.boolean(),
  sidsteArbejdsdag: optionalIsoDateString,
  fritvalgPct: percentageDecimal,
  shSoPct: percentageDecimal,
  storeBededagPct: percentageDecimal,
  pensionPct: percentageDecimal,
  loenperiode: loenperiodeSchema,
  indtaegtsoplysningerTableData: z.array(standardLoenTableRowSchema).default([]),
  fuldLoenUnderFerie: jaNejEnum,
}).strict();

const loenindkomstAnciennitetSchema = z.object({
  harAnciennitetstillaegEfterSkadedatoen: z.boolean(),
  anciennitetstillaegDato: optionalIsoDateString,
  anciennitetstillaegSatsAngivesPer: anciennitetSatsPerEnum,
  anciennitetstillaegSats: nonNegativeAmountValue,
}).strict();

export const loenindkomstAnsaettelsesforholdSchema = z.object({
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

const defaultEoAngivetLoenLoenudvikling: EOAngivetLoenLoenudvikling = {
  overenskomstId: undefined,
  harAnciennitetstillaegEfterSkadedatoen: false,
  anciennitetstillaegDato: undefined,
  anciennitetstillaegSatsAngivesPer: 'Måned',
  anciennitetstillaegSats: undefined,
  feriePct: undefined,
  loenPaaHelligdage: 'Almindelig løn',
  saerligFraDatoRegulering: undefined,
  loenudviklingBeregningsgrundlag: undefined,
  loenudviklingStatistikModel: undefined,
  loenudviklingKRLSatstabel: undefined,
  loenudviklingManuelNavn: undefined,
  loenudviklingManuelTableData: [],
  offentligLoenType: 'Månedsløn',
  offentligLoenTrin: undefined,
  offentligLoenGruppe: undefined,
  offentligLoenEkstraGrundloen: undefined,
  overenskomstFilter: {
    loenmodtager: undefined,
    arbejdsgiver: undefined,
  },
};

const eoAngivetLoenSchema = z.object({
  eoAngivetLoenLoenudvikling: eoAngivetLoenLoenudviklingSchema.default(defaultEoAngivetLoenLoenudvikling),
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
