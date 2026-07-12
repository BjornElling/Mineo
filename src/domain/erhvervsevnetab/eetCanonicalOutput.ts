import { z } from 'zod';
import { isoDateString } from '../../schemas/formSchemas/baseSchemas';
import { moneyOreSchema } from '../money/money';
import { eetIssueSchema } from './eetTypes';
import { eetLoebendeComputationSchema } from './eetLoebendeYdelserCalculation';

const finite = z.number().finite();
const integer = z.number().int();

const eetEalComputationSchema = z.object({
  beregningsdato: isoDateString,
  skadedato: isoDateString,
  fodselsdato: isoDateString,
  skadesaar: integer,
  beregningsaar: integer,
  aarsloenOre: moneyOreSchema,
  aarsloenSource: z.enum(['eal', 'asl']),
  reguleringsaar: z.array(integer).readonly(),
  reguleringsPctRounded4: finite,
  reguleretAarsloenOre: moneyOreSchema,
  eetPct: finite,
  eetPctSource: z.enum(['eal', 'asl']),
  kapitaliseringsfaktor: z.literal(10),
  eetBeregnetOre: moneyOreSchema,
  eetMaksOre: moneyOreSchema,
  eetAnvendtOre: moneyOreSchema,
  eetReduceretTilMaks: z.boolean(),
  alderVedSkade: integer,
  alderVedSkadeCapped: integer,
  aldersreduktionPct: finite,
  aldersreduktionBeloebOre: moneyOreSchema,
  ealKravOre: moneyOreSchema,
}).strict().readonly();

const eetKapitaliseringAfgoerelseSchema = z.object({
  rowId: z.string(),
  afgoerelsesdato: isoDateString,
  kapitaliseringsdato: isoDateString,
  kapitaliseringspct: finite,
  grundloenOre: moneyOreSchema,
  erstatningsniveauPct: z.union([z.literal(80), z.literal(83)]),
  amBidragPct: z.union([z.literal(0), z.literal(8)]),
  grundydelseOre: moneyOreSchema,
  grundydelse2024Ore: moneyOreSchema.nullable(),
  opreguleringTil2024PctRounded4: finite.nullable(),
  aarsydelseGrundlagOre: moneyOreSchema,
  aarsydelseReguleringsPctRounded4: finite.nullable(),
  aarsydelseOre: moneyOreSchema,
  kapitaliseringsbekendtgoerelseLabel: z.string(),
  tabelLabel: z.string(),
  folkepensionsalderLabel: z.string(),
  saerfaktor: finite.nullable(),
  alderAar: integer,
  alderMaaneder: integer,
  kapitaliseretPgaUnderToAarTilFp: z.boolean(),
  faktorMaanedsAfhaengig: z.boolean(),
  kapitaliseringsfaktor: finite,
  kapitalbelobOre: moneyOreSchema,
  koenOpdelt: z.boolean(),
}).strict().readonly();

const eetKapitaliseringComputationSchema = z.object({
  afgoerelser: z.array(eetKapitaliseringAfgoerelseSchema).readonly(),
}).strict().readonly();

const merKapitalvaerdiSchema = z.object({
  kapitaliseringsbekendtgoerelseLabel: z.string(),
  folkepensionsalderLabel: z.string(),
  kapitaliseringsfaktor: finite,
  kapitalvaerdiOre: moneyOreSchema,
}).strict().readonly();

const merErstatningEventSchema = z.object({
  rowId: z.string(),
  afgoerelsesdato: isoDateString,
  kapitaliseringsdato: isoDateString,
  kapitaliseringspct: finite,
  forhoejelsesdato: isoDateString,
  satsAar: integer,
  gammelAlderLabel: z.string(),
  nyAlderLabel: z.string(),
  alderAar: integer,
  alderMaaneder: integer,
  faktorMaanedsAfhaengig: z.boolean(),
  koenOpdelt: z.boolean(),
  grundloenOre: moneyOreSchema,
  erstatningsniveauPct: finite,
  amBidragPct: finite,
  grundydelseOre: moneyOreSchema,
  grundydelse2024Ore: moneyOreSchema.nullable(),
  opreguleringTil2024PctRounded4: finite.nullable(),
  aarsydelseGrundlagOre: moneyOreSchema,
  aarsydelseReguleringsPctRounded4: finite.nullable(),
  aarsydelseOre: moneyOreSchema,
  gammel: merKapitalvaerdiSchema,
  ny: merKapitalvaerdiSchema,
  merErstatningOre: moneyOreSchema,
}).strict().readonly();

const merErstatningComputationSchema = z.object({
  events: z.array(merErstatningEventSchema).readonly(),
  samletMerErstatningOre: moneyOreSchema,
}).strict().readonly();

const proformaSchema = z.object({
  loebendeEetPct: finite,
  kapitaliseringsdato: isoDateString,
  grundloenOre: moneyOreSchema,
  erstatningsniveauPct: finite,
  amBidragPct: finite,
  grundydelseOre: moneyOreSchema,
  grundydelse2024Ore: moneyOreSchema.nullable(),
  opreguleringTil2024PctRounded4: finite.nullable(),
  aarsydelseGrundlagOre: moneyOreSchema,
  aarsydelseReguleringsPctRounded4: finite.nullable(),
  aarsydelseOre: moneyOreSchema,
  kapitaliseringsbekendtgoerelseLabel: z.string(),
  folkepensionsalderLabel: z.string(),
  alderAar: integer,
  alderMaaneder: integer,
  kapitaliseretPgaUnderToAarTilFp: z.boolean(),
  faktorMaanedsAfhaengig: z.boolean(),
  saerfaktor: finite.nullable(),
  kapitaliseringsfaktor: finite,
  proformaBeloebOre: moneyOreSchema,
  koenOpdelt: z.boolean(),
}).strict().readonly();

const resterendeLoebendeSchema = z.object({
  loebendeEetPct: finite,
  beregningsdato: isoDateString,
  dagenFoerFolkepensionsdato: isoDateString,
  aarsydelseOre: moneyOreSchema,
  maanedligYdelseOre: moneyOreSchema,
  tilbageraevendeMaaneder: finite,
  fradragBeloebOre: moneyOreSchema,
}).strict().readonly();

const tvkFradragSchema = z.object({
  endeligVirkningsdato: isoDateString,
  fra: isoDateString,
  til: isoDateString,
  beloebOre: moneyOreSchema,
}).strict().readonly();

const differenceLoebendeAfgoerelseSchema = z.object({
  rowId: z.string(),
  afgoerelsesdato: isoDateString,
  virkningsdato: isoDateString,
  afgoerelseType: z.enum(['Midlertidig', 'Delvist endelig', 'Endelig']),
  eetPct: finite,
  fradragesTil: isoDateString,
  beloebOre: moneyOreSchema,
  fradragForetages: z.boolean(),
  tilbagevirkendeKraftFradrag: tvkFradragSchema.nullable(),
}).strict().readonly();

const differenceKapitaliseringSchema = z.object({
  rowId: z.string(),
  afgoerelsesdato: isoDateString,
  kapitaliseringsdato: isoDateString.nullable(),
  kapitaliseringspct: finite.nullable(),
  kapitalbelobOre: moneyOreSchema.nullable(),
  kapitaliseringEfterBeregningsdato: z.boolean(),
}).strict().readonly();

const differencekravComputationSchema = z.object({
  beregningsdato: isoDateString,
  skadedato: isoDateString,
  dagFoerBeregningsdato: isoDateString,
  fradragGaelderForFoer2011: z.boolean(),
  ealKravOre: moneyOreSchema,
  ealEetPct: finite,
  fradragLoebendeYdelserOre: moneyOreSchema,
  fradragKapitaliseretEetOre: moneyOreSchema,
  proformaKapitalisering: proformaSchema.nullable(),
  resterendeLoebendeYdelser: resterendeLoebendeSchema.nullable(),
  merErstatningPensionsalder: merErstatningComputationSchema.nullable(),
  differencekravFoerForligOre: moneyOreSchema,
  forligFactor: finite.nullable(),
  forligLabel: z.string().nullable(),
  forligDato: isoDateString.nullable(),
  differencekravOre: moneyOreSchema,
  afgoerelser: z.array(differenceLoebendeAfgoerelseSchema).readonly(),
  kapitaliseringerAfgoerelser: z.array(differenceKapitaliseringSchema).readonly(),
  loebendeComputation: eetLoebendeComputationSchema.nullable(),
  kapComputation: eetKapitaliseringComputationSchema.nullable(),
  ealComputation: eetEalComputationSchema.nullable(),
}).strict().readonly();

const projectionSchema = <T extends z.ZodType>(computation: T) => z.object({
  issues: z.array(eetIssueSchema).readonly(),
  hasBlockingErrors: z.boolean(),
  computation: computation.nullable(),
}).strict().readonly();

export const eetCanonicalOutputSchema = z.object({
  loebendeYdelser: projectionSchema(eetLoebendeComputationSchema),
  kapitalisering: projectionSchema(eetKapitaliseringComputationSchema),
  efterEal: projectionSchema(eetEalComputationSchema),
  differencekrav: projectionSchema(differencekravComputationSchema),
}).strict().readonly();

export type EetCanonicalOutput = z.infer<typeof eetCanonicalOutputSchema>;

