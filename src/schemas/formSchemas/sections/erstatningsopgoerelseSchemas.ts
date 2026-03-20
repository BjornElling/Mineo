import { z } from 'zod';
import {
  coerceToIntegerOrUndefined,
  dayCount,
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
// Reuse of årsløn row schema is intentional: EO lønindkomst rows share the same persisted table contract.
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
  midlertidigtEetAfgorelse: jaNejEnum,
  midlertidigEETAfgoerelseDato: optionalIsoDateString,
  midlertidigEETVirkningsdato: optionalIsoDateString,
  endeligtEetAfgorelse: jaNejEnum,
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
  periodeTilBeregningFra: optionalIsoDateString,
  periodeTilBeregningTil: optionalIsoDateString,
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
  ferieMedLon: jaNejEnum,
  maanedsloennetMedFerielon: jaNejEnum,
  forstSfgEfterSygelon: jaNejEnum,
  andelSfggILoenen: nonNegativeAmountValue,
}).strict();

const eoBilagSelectionSchema = z.object({
  opgoerelse: z.literal(true),
  loenindkomst: z.boolean(),
  offentligeYdelser: z.boolean(),
  shDage: z.boolean(),
  regulering: z.boolean(),
  okSatser: z.boolean(),
  sygeferiegodtgoerelse: z.boolean(),
}).strict();

const eoBilagLoenindkomstOgOffentligeYdelserIndgaarSchema = z.enum(['Alle', 'Perioden']);

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
  loenudviklingPaaGrundlagAf: optionalString,
  saerligeKommentarer: optionalString,
  eoBilagSelection: eoBilagSelectionSchema,
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
  indtaegtsoplysningerTableData: z.array(standardLoenTableRowSchema),
  fuldLoenUnderFerie: jaNejEnum,
}).strict();

const loenindkomstAnciennitetSchema = z.object({
  harAnciennitetstillaegEfterSkadesdatoen: z.boolean(),
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
}).merge(z.object({
  harAnciennitetstillaegEfterSkadesdatoen: z.boolean().default(false),
  anciennitetstillaegDato: optionalIsoDateString,
  anciennitetstillaegSatsAngivesPer: anciennitetSatsPerEnum.default('Måned'),
  anciennitetstillaegSats: nonNegativeAmountValue,
}).strict()).merge(eoLoenudviklingOgSatserSchema).strict();

export type EOAngivetLoenLoenudvikling = z.infer<typeof eoAngivetLoenLoenudviklingSchema>;

const defaultEoAngivetLoenLoenudvikling: EOAngivetLoenLoenudvikling = {
  overenskomstId: undefined,
  harAnciennitetstillaegEfterSkadesdatoen: false,
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

export const erstatningsopgoerelseSchema = erstatningsopgoerelseBaseSchema
  .merge(aesAfgoerelserSchema)
  .merge(svieSmerteSchema)
  .merge(tafSchema)
  .merge(indtaegtFoerSkadenSchema)
  .merge(sygeferiegodtgoerelseSchema)
  .merge(loenindkomstSchema)
  .merge(eoAngivetLoenSchema)
  .strict();

export type ErstatningsopgoerelseValues = z.infer<typeof erstatningsopgoerelseSchema>;
