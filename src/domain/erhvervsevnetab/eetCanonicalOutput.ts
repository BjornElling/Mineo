import { z } from 'zod';
import { isoDateString } from '../../schemas/formSchemas/baseSchemas';
import { moneyOreSchema } from '../money/money';
import { skadestypeEnum } from '../../schemas/formSchemas/enumSchemas';
import { eetIssueSchema } from './eetTypes';
import { eetLoebendeComputationSchema } from './eetLoebendeYdelserCalculation';

const finite = z.number().finite();
const integer = z.number().int();

export const eetEalComputationSchema = z.object({
  beregningsdato: isoDateString,
  skadedato: isoDateString,
  /**
   * Skadestypen bæres MED beregningen, fordi datoens navn er skadestype-afhængigt i alle afledte
   * tekster (BB-121). Både skærmen og de to dokumentkaldere holder computation'en, mens dokumenternes
   * `stamdata` kun projiceres, når brevhovedet er slået til – med brevhovedet fra bliver `skadestype`
   * dér `undefined`, og bilaget ville tavst falde tilbage til «skadestidspunktet» ved erhvervssygdom.
   */
  skadestype: skadestypeEnum.optional(),
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
export type EetEalComputation = z.infer<typeof eetEalComputationSchema>;

export const eetKapitaliseringAfgoerelseSchema = z.object({
  rowId: z.string(),
  afgoerelsesdato: isoDateString,
  kapitaliseringsdato: isoDateString,
  /**
   * Afgørelsens EGEN erhvervsevnetabsprocent – ikke den kapitaliserede andel.
   *
   * Den er afgørelsens indhold, ikke en mellemregning: ved en delvist endelig afgørelse på 30 %,
   * hvoraf 5 % kapitaliseres, kan læseren ellers ikke se, at 25 % står ukapitaliseret tilbage
   * (det tal, differencekravet senere proformakapitaliserer). Bæres i boksens overskrift (BB-170).
   */
  eetPct: finite,
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
export type EetKapitaliseringAfgoerelseComputation = z.infer<
  typeof eetKapitaliseringAfgoerelseSchema
>;

export const eetKapitaliseringComputationSchema = z.object({
  afgoerelser: z.array(eetKapitaliseringAfgoerelseSchema).readonly(),
}).strict().readonly();
export type EetKapitaliseringComputation = z.infer<typeof eetKapitaliseringComputationSchema>;

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

export const eetDifferencekravProformaKapitaliseringSchema = z.object({
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
export type EetDifferencekravProformaKapitalisering = z.infer<
  typeof eetDifferencekravProformaKapitaliseringSchema
>;

export const eetDifferencekravResterendeLoebendeYdelserSchema = z.object({
  loebendeEetPct: finite,
  beregningsdato: isoDateString,
  dagenFoerFolkepensionsdato: isoDateString,
  aarsydelseOre: moneyOreSchema,
  maanedligYdelseOre: moneyOreSchema,
  tilbageraevendeMaaneder: finite,
  fradragBeloebOre: moneyOreSchema,
}).strict().readonly();
export type EetDifferencekravResterendeLoebendeYdelser = z.infer<
  typeof eetDifferencekravResterendeLoebendeYdelserSchema
>;

export const eetDifferencekravTilbagevirkendeKraftFradragSchema = z.object({
  endeligVirkningsdato: isoDateString,
  fra: isoDateString,
  til: isoDateString,
  beloebOre: moneyOreSchema,
}).strict().readonly();
export type EetDifferencekravTilbagevirkendeKraftFradrag = z.infer<
  typeof eetDifferencekravTilbagevirkendeKraftFradragSchema
>;

export const eetDifferencekravLoebendeAfgoerelseSchema = z.object({
  rowId: z.string(),
  afgoerelsesdato: isoDateString,
  virkningsdato: isoDateString,
  afgoerelseType: z.enum(['Midlertidig', 'Delvist endelig', 'Endelig']),
  eetPct: finite,
  fradragesTil: isoDateString,
  beloebOre: moneyOreSchema,
  fradragForetages: z.boolean(),
  tilbagevirkendeKraftFradrag: eetDifferencekravTilbagevirkendeKraftFradragSchema.nullable(),
}).strict().readonly();
export type EetDifferencekravLoebendeAfgoerelse = z.infer<
  typeof eetDifferencekravLoebendeAfgoerelseSchema
>;

export const eetDifferencekravKapitaliseretAfgoerelseSchema = z.object({
  rowId: z.string(),
  afgoerelsesdato: isoDateString,
  kapitaliseringsdato: isoDateString.nullable(),
  kapitaliseringspct: finite.nullable(),
  kapitalbelobOre: moneyOreSchema.nullable(),
  kapitaliseringEfterBeregningsdato: z.boolean(),
}).strict().readonly();
export type EetDifferencekravKapitaliseretAfgoerelse = z.infer<
  typeof eetDifferencekravKapitaliseretAfgoerelseSchema
>;

export const eetDifferencekravComputationSchema = z.object({
  beregningsdato: isoDateString,
  skadedato: isoDateString,
  dagFoerBeregningsdato: isoDateString,
  fradragGaelderForFoer2011: z.boolean(),
  ealKravOre: moneyOreSchema,
  ealEetPct: finite,
  fradragLoebendeYdelserOre: moneyOreSchema,
  fradragKapitaliseretEetOre: moneyOreSchema,
  proformaKapitalisering: eetDifferencekravProformaKapitaliseringSchema.nullable(),
  resterendeLoebendeYdelser: eetDifferencekravResterendeLoebendeYdelserSchema.nullable(),
  merErstatningPensionsalder: merErstatningComputationSchema.nullable(),
  differencekravFoerForligOre: moneyOreSchema,
  forligFactor: finite.nullable(),
  forligLabel: z.string().nullable(),
  forligDato: isoDateString.nullable(),
  differencekravOre: moneyOreSchema,
  afgoerelser: z.array(eetDifferencekravLoebendeAfgoerelseSchema).readonly(),
  kapitaliseringerAfgoerelser: z.array(eetDifferencekravKapitaliseretAfgoerelseSchema).readonly(),
  loebendeComputation: eetLoebendeComputationSchema.nullable(),
  kapComputation: eetKapitaliseringComputationSchema.nullable(),
  ealComputation: eetEalComputationSchema.nullable(),
}).strict().readonly();
export type EetDifferencekravComputation = z.infer<typeof eetDifferencekravComputationSchema>;

const projectionSchema = <T extends z.ZodType>(computation: T) => z.object({
  issues: z.array(eetIssueSchema).readonly(),
  hasBlockingErrors: z.boolean(),
  computation: computation.nullable(),
}).strict().superRefine((projection, ctx) => {
  const hasErrorIssue = projection.issues.some((issue) => issue.severity === 'error');
  if (projection.hasBlockingErrors === hasErrorIssue) return;

  // Blocking-flaget er kun troværdigt, når den samme canonical projektion også forklarer
  // blokeringen med en error-issue. Den modsatte uoverensstemmelse er lige så farlig, fordi
  // et error-issue ellers kan passere som et ikke-blokerende output.
  ctx.addIssue({
    code: 'custom',
    path: ['hasBlockingErrors'],
    message: 'Blocking-status og error-issues skal være konsistente',
  });
}).readonly();

export const eetCanonicalOutputSchema = z.object({
  loebendeYdelser: projectionSchema(eetLoebendeComputationSchema),
  kapitalisering: projectionSchema(eetKapitaliseringComputationSchema),
  efterEal: projectionSchema(eetEalComputationSchema),
  differencekrav: projectionSchema(eetDifferencekravComputationSchema),
}).strict().readonly();

export type EetCanonicalOutput = z.infer<typeof eetCanonicalOutputSchema>;
