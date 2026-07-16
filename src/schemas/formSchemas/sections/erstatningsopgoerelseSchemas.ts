import { z } from 'zod';
import {
  entityId,
  amountValue,
  optionalIsoDateString,
  optionalString,
  decimalNumber,
  tableAmountCellValue,
  tableCellString,
  tableIsoDateCellString,
  wholeNumber,
  normalizeEmptyToUndefined
} from '../baseSchemas';
import {
  afsluttesMedEnum,
  anciennitetSatsPerEnum,
  arbejdsstatusEnum,
  beregningsmetodeEnum,
  helbredsstatusEnum,
  jaNejEnum,
  jaNejSkjulEnum,
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
  tillaegAngivesSomEnum,
  eoBilagLoenindkomstOgOffentligeYdelserIndgaarSchema,
} from '../enumSchemas';
// Genbrug af årsløn-row-schemaet er bevidst: EO-lønindkomstrækker deler samme persisted table-kontrakt,
// herunder at col2 og col3 er to visuelt adskilte lønfelter med identisk beregningsmæssig betydning.
import { standardLoenTableRowSchema } from './aarsloenSchemas';

export const svieSmertePeriodeRowSchema = z.object({
  id: entityId(),
  fra: optionalIsoDateString,
  til: optionalIsoDateString,
  tilstand: z.preprocess(normalizeEmptyToUndefined, tilstandEnum.optional()),
}).strict();

export type SvieSmertePeriodeRow = z.infer<typeof svieSmertePeriodeRowSchema>;

export const tafPeriodeRowSchema = z.object({
  id: entityId(),
  fra: optionalIsoDateString,
  til: optionalIsoDateString,
  loseFeriedage: wholeNumber,
}).strict();

export type TafPeriodeRow = z.infer<typeof tafPeriodeRowSchema>;

export const ferieperiodeRowSchema = z.object({
  id: entityId(),
  fra: optionalIsoDateString,
  til: optionalIsoDateString,
}).strict();

export type FerieperiodeRow = z.infer<typeof ferieperiodeRowSchema>;

export const sygeferiegodtgoerelseAnsaettelsesforholdRowSchema = z.object({
  ansaettelsesforholdId: entityId('Ansættelsesforhold-ID'),
  sfggBeregningskilde: z.preprocess(normalizeEmptyToUndefined, sygeferiegodtgoerelseBeregningskildeEnum.optional()),
  sfggReferenceperiodeFra: optionalIsoDateString,
  sfggReferenceperiodeTil: optionalIsoDateString,
  sfggReferenceperiodeFravaersdageUdenLoen: wholeNumber,
  sfggManuelDagssats: amountValue,
  sfggManuelBeloebIHenholdTil: optionalString,
  sfggManuelFoerstEfterSygeloen: jaNejEnum.default('Nej'),
  sfggSatsvalg: z.preprocess(normalizeEmptyToUndefined, sygeferiegodtgoerelseSatsvalgEnum.optional()),
  sfggAlleredeBetaltBeloeb: amountValue,
}).strict();

export type SygeferiegodtgoerelseAnsaettelsesforholdRow =
  z.infer<typeof sygeferiegodtgoerelseAnsaettelsesforholdRowSchema>;

export const oevrigeKravRowSchema = z.object({
  id: entityId(),
  dato: optionalIsoDateString,
  udgiftTil: optionalString,
  beloeb: amountValue,
}).strict();

export type OevrigeKravRow = z.infer<typeof oevrigeKravRowSchema>;

export const offentligeYdelserRowSchema = z.object({
  id: entityId(),
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
  id: entityId(),
  dato: tableIsoDateCellString,
  grundloen: tableAmountCellValue,
  feriepenge: decimalNumber,
  shSoSats: decimalNumber,
  fritvalg: decimalNumber,
  agPension: decimalNumber,
}).strict();

export type LoenudviklingManuelRow = z.infer<typeof loenudviklingManuelRowSchema>;

export const loenudviklingManuelProcentsatsRowSchema = z.object({
  id: entityId(),
  dato: tableIsoDateCellString,
  procent: decimalNumber,
}).strict();

export type LoenudviklingManuelProcentsatsRow = z.infer<typeof loenudviklingManuelProcentsatsRowSchema>;

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
  // Breaking rename fra `beregnesSvieSmerteGodtgoerelse` (JaNej-toggle) til tre-tilstands-valg.
  // Gamle .eo-filer mister bevidst den tidligere værdi (strippes som ukendt felt) og loades
  // med default 'Ja' — jf. brugerbeslutning og schema-evolution.md §3.1a (bevidst tab af gammel værdi).
  kravPaaSvieSmerteGodtgoerelse: jaNejSkjulEnum.default('Ja'),
  svieSmerteHelbredsstatus: z.preprocess(normalizeEmptyToUndefined, helbredsstatusEnum.optional()),
  tidligereSsMax: jaNejEnum.default('Nej'),
  svieSmertePerioder: z.array(svieSmertePeriodeRowSchema).default([]),
  svieSmerteSatserAar: wholeNumber,
  svieSmerteDelvisSygemeldingSats: svieSmerteDelvisSygemeldingSatsEnum.default('halv'),
  svieSmerteTidligereTotal: amountValue,
  svieSmerteAktuelPeriode: amountValue,
}).strict();

const tafSchema = z.object({
  // Breaking rename fra `beregnesTabtArbejdsfortjeneste` (JaNej-toggle) til tre-tilstands-valg.
  // Se note ved kravPaaSvieSmerteGodtgoerelse: gammel værdi tabes bevidst, default 'Ja'.
  kravPaaTabtArbejdsfortjeneste: jaNejSkjulEnum.default('Ja'),
  tafArbejdsstatus: z.preprocess(normalizeEmptyToUndefined, arbejdsstatusEnum.optional()),
  tafPerioder: z.array(tafPeriodeRowSchema).default([]),
  ferieperioder: z.array(ferieperiodeRowSchema).default([]),
  sidsteDagAnsaettelsesforhold: optionalIsoDateString,
  tidligereModtagetTaf: amountValue,
}).strict();

const indtaegtFoerSkadenSchema = z.object({
  komprimerBeregningEfterFoersteOpgoerelse: jaNejEnum.default('Ja'),
  beregnesUdFra: beregningsmetodeEnum.default('Beregningsperiode'),
  tafBeregningsperiodeFra: optionalIsoDateString,
  tafBeregningsperiodeTil: optionalIsoDateString,
  fravaerPerioder: z.array(ferieperiodeRowSchema).default([]),
  uspecificeredeFerieFridage: wholeNumber,
  oevrigtFravaerUdenLoen: jaNejEnum.default('Nej'),
  oevrigeFravaersdage: wholeNumber,
  oevrigeFravaersdageBeskrivelse: optionalString,
  maanedsloenenUdgoer: amountValue,
  dagsloenenUdgoer: amountValue,
  angivetMaanedsloenBaseretPaa: optionalString,
  angivetMaanedsloenOpreguleresFraDato: optionalIsoDateString,
  angivetDagsloenBaseretPaa: optionalString,
  angivetDagsloenOpreguleresFraDato: optionalIsoDateString,
}).strict();

const sygeferiegodtgoerelseSchema = z.object({
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
  erstatningsopgoerelseAfsluttesMed: afsluttesMedEnum.default('Bekræftet godkendt'),
  forligAnsvarsgradProcent: decimalNumber,
  forligAnsvarsgradBroek: optionalString,
  forligDato: optionalIsoDateString,
  // Tre-tilstands-valg magen til kravPaaSvieSmerteGodtgoerelse/kravPaaTabtArbejdsfortjeneste.
  // 'Ja' = krav medregnes og vises; 'Nej' = medregnes ikke, vises som "Ingen" i PDF;
  // 'Skjul' = medregnes ikke og udelades helt fra erstatningsopgørelse-PDF'en.
  kravPaaOevrigeErstatningskrav: jaNejSkjulEnum.default('Ja'),
  oevrigeKravPerioder: z.array(oevrigeKravRowSchema).default([]),
  offentligeYdelserRows: z.array(offentligeYdelserRowSchema).default([]),
  offentligeYdelserKommentarer: optionalString,
  saerligeKommentarer: optionalString,
  // Zod 4 .default() returnerer output-værdien direkte (re-parser den ikke), så defaulten skal være
  // det fulde objekt. Vi udleder det fra schemaets egne felt-defaults via parse({}) i stedet for at
  // gentage en håndskrevet litteral, der ellers kunne drive ud af sync med felt-defaultsene.
  eoBilagSelection: eoBilagSelectionSchema.default(() => eoBilagSelectionSchema.parse({})),
  eoBilagLoenindkomstOgOffentligeYdelserIndgaar: eoBilagLoenindkomstOgOffentligeYdelserIndgaarSchema.default('Perioden'),
}).strict();

const overenskomstFilterSchema = z.object({
  loenmodtager: optionalString,
  arbejdsgiver: optionalString,
}).strict();

// Fælles lønudviklingsfelter bruges i to persisted former:
// ansættelsesforhold kræver `loenPaaHelligdage`, mens EO-angivet løn skal kunne loades uden feltet.
const createLoenudviklingOgSatserSchema = <TLoenPaaHelligdage extends z.ZodTypeAny>(loenPaaHelligdage: TLoenPaaHelligdage) => z.object({
  feriePct: decimalNumber,
  loenPaaHelligdage,
  saerligFraDatoRegulering: optionalIsoDateString,
  loenudviklingBeregningsgrundlag: z.preprocess(normalizeEmptyToUndefined, loenudviklingBeregningsgrundlagEnum.optional()),
  loenudviklingStatistikModel: z.preprocess(normalizeEmptyToUndefined, loenudviklingStatistikModelEnum.optional()),
  loenudviklingKRLSatstabel: z.preprocess(normalizeEmptyToUndefined, krlSatstabelEnum.optional()),
  loenudviklingManuelNavn: optionalString,
  loenudviklingManuelTableData: z.array(loenudviklingManuelRowSchema).default([]),
  loenudviklingManuelProcentsatsTableData: z.array(loenudviklingManuelProcentsatsRowSchema).default([]),
  offentligLoenType: z.preprocess(normalizeEmptyToUndefined, offentligLoenTypeEnum.optional()),
  offentligLoenTrin: wholeNumber,
  offentligLoenGruppe: wholeNumber,
  offentligLoenEkstraGrundloen: amountValue,
  overenskomstFilter: overenskomstFilterSchema.default({}),
}).strict();

export const loenudviklingOgSatserSchema = createLoenudviklingOgSatserSchema(loenPaaHelligdageEnum);
export const eoLoenudviklingOgSatserSchema = createLoenudviklingOgSatserSchema(
  z.preprocess(normalizeEmptyToUndefined, loenPaaHelligdageEnum.optional())
);
export type LoenudviklingOgSatser = z.infer<typeof loenudviklingOgSatserSchema>;
export type EOLoenudviklingOgSatser = z.infer<typeof eoLoenudviklingOgSatserSchema>;

const loenindkomstAnsaettelsesforholdBaseSchema = z.object({
  id: entityId('ID'),
  navnPaaArbejdssted: optionalString,
  harOverenskomst: z.boolean().default(false),
  overenskomstId: optionalString,
  ansatPaaSkadestidspunktet: z.boolean().default(false),
  ansaettelsesforholdOphoert: z.boolean().default(false),
  sidsteArbejdsdag: optionalIsoDateString,
  fritvalgPct: decimalNumber,
  shSoPct: decimalNumber,
  storeBededagPct: decimalNumber,
  pensionPct: decimalNumber,
  // 'procent' = nuværende adfærd (default, passiv load-fallback for ældre .eo); 'beloeb' =
  // tillægsbeløb angives direkte i lønindkomst-tabellen, sats-blokken og 'Manuelt angivet'
  // lønudvikling skjules. Defineres her ét sted (sammen med de fire satser den styrer).
  tillaegAngivesSom: tillaegAngivesSomEnum.default('procent'),
  loenperiode: loenperiodeEnum.default('maaned'),
  indtaegtsoplysningerTableData: z.array(standardLoenTableRowSchema).default([]),
  fuldLoenUnderFerie: jaNejEnum.default('Nej'),
}).strict();

const loenindkomstAnciennitetSchema = z.object({
  harAnciennitetstillaegEfterSkadedatoen: z.boolean().default(false),
  anciennitetstillaegDato: optionalIsoDateString,
  anciennitetstillaegSatsAngivesPer: anciennitetSatsPerEnum.default('Måned'),
  anciennitetstillaegSats: amountValue,
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
  anciennitetstillaegSats: amountValue,
  ...eoLoenudviklingOgSatserSchema.shape,
}).strict();

export type EOAngivetLoenLoenudvikling = z.infer<typeof eoAngivetLoenLoenudviklingSchema>;

const eoAngivetLoenSchema = z.object({
  // Som eoBilagSelection: udled hele default-objektet fra underschemaets egne felt-defaults via parse({}).
  eoAngivetLoenLoenudvikling: eoAngivetLoenLoenudviklingSchema.default(() => eoAngivetLoenLoenudviklingSchema.parse({})),
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
