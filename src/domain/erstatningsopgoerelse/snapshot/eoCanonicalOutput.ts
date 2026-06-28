import { z } from 'zod';
import { isoDateString } from '../../../schemas/formSchemas/baseSchemas';
import { clampMoneyOreToZero, ensureMoneyOre, moneyOreSchema, roundKroner, scaleMoneyOre, toOre } from '../shared/eoMoney';
import type { SvieSmerteEngineOutput } from '../engines/svieSmerteEngine';
import type { TafNettoBeregningResult } from '../engines/tafNettoBeregning';
import type { Calculable, LoenudviklingSegment, MoneyOre } from '../shared/eoTypes';
import type { OevrigeKravCanonicalInput } from './eoPresentationModel';

const isoDateSchema = isoDateString;

// reguleretLoenOre er valgfrit og sættes kun for KL-lønaftaler (trinvis kæde-opregulering).
// Se docs/domain/taf/kl-loenaftaler-regulering.md.
const loenudviklingSegmentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('maaneder'),
    fra: isoDateSchema,
    til: isoDateSchema,
    maaneder: z.number(),
    maanedsloenOre: moneyOreSchema,
    deltaPct: z.number(),
    amountOre: moneyOreSchema,
    reguleretLoenOre: moneyOreSchema.optional(),
  }).strict(),
  z.object({
    kind: z.literal('arbejdsdage'),
    fra: isoDateSchema,
    til: isoDateSchema,
    arbejdsdage: z.number(),
    dagsloenOre: moneyOreSchema,
    deltaPct: z.number(),
    amountOre: moneyOreSchema,
    reguleretLoenOre: moneyOreSchema.optional(),
  }).strict(),
]).superRefine((segment, ctx) => {
  if (segment.reguleretLoenOre === undefined) return;
  const quantity = segment.kind === 'maaneder' ? segment.maaneder : segment.arbejdsdage;
  const expectedAmountOre = toOre(roundKroner((segment.reguleretLoenOre / 100) * quantity));
  if (segment.amountOre !== expectedAmountOre) {
    ctx.addIssue({
      code: 'custom',
      path: ['reguleretLoenOre'],
      message: 'reguleretLoenOre kræver at amountOre er beregnet fra den regulerede enhedsløn',
    });
  }
});

const eoCanonicalOutputSchema = z.object({
  totals: z.object({
    svieSmerteOre: moneyOreSchema,
    tabtArbejdsfortjenesteFoerForligOre: moneyOreSchema,
    tabtArbejdsfortjenesteOre: moneyOreSchema,
    oevrigeKravFoerForligOre: moneyOreSchema,
    oevrigeKravOre: moneyOreSchema,
    samletTotalOre: moneyOreSchema,
  }).strict(),
  svieSmerte: z.object({
    maxApplied: z.boolean(),
  }).strict(),
  taf: z.object({
    harTafPerioder: z.boolean(),
    offentligeYdelserUdviklingOre: moneyOreSchema.nullable(),
    tafIndtaegterOre: moneyOreSchema.nullable(),
    tidligereModtagetTafOre: moneyOreSchema.nullable(),
    sygeferiegodtgoerelseOre: moneyOreSchema,
  }).strict(),
  periodiseringer: z.object({
    tafPerioder: z.array(z.object({
      fra: isoDateSchema,
      til: isoDateSchema,
    }).strict()),
  }).strict(),
  regulering: z.object({
    loenudviklingTotalFoerForligOre: moneyOreSchema.nullable(),
    loenudviklingSegmenter: z.array(loenudviklingSegmentSchema),
    perAnsaettelse: z.array(z.object({
      ansaettelsesforholdId: z.string(),
      loenudviklingTotalFoerForligOre: moneyOreSchema.nullable(),
      loenudviklingSegmenter: z.array(loenudviklingSegmentSchema),
    }).strict()),
  }).strict(),
}).strict();

export type EoCanonicalOutput = z.infer<typeof eoCanonicalOutputSchema>;
export const EoCanonicalOutputSchema = eoCanonicalOutputSchema;

export type EoComputedTotals = Readonly<{
  svieSmerteOre: MoneyOre;
  tabtArbejdsfortjenesteFoerForligOre: MoneyOre;
  tabtArbejdsfortjenesteOre: MoneyOre;
  oevrigeKravFoerForligOre: MoneyOre;
  oevrigeKravOre: MoneyOre;
  samletTotalOre: MoneyOre;
  tidligereModtagetTafOre: MoneyOre;
  forligFactor: number | null;
}>;

const formatZodIssuePath = (path: readonly (string | number | symbol)[]): string =>
  path.length > 0 ? path.map(String).join('.') : '<root>';

const buildCanonicalValidationErrorMessage = (
  context: string,
  issues: readonly z.ZodIssue[]
): string => {
  const details = issues
    .map((issue) => `${formatZodIssuePath(issue.path)}: ${issue.message}`)
    .join('; ');
  return `EO canonical output invariant failed (${context}): ${details}`;
};

const calculableMoneyToNullable = (value: Calculable<MoneyOre> | null | undefined): MoneyOre | null => {
  if (!value || value.status !== 'ok') return null;
  return ensureMoneyOre(value.value);
};

const toCanonicalSegment = (segment: LoenudviklingSegment): z.infer<typeof loenudviklingSegmentSchema> => {
  const result = loenudviklingSegmentSchema.safeParse(segment);
  if (!result.success) {
    throw new Error(buildCanonicalValidationErrorMessage('loenudviklingSegment', result.error.issues));
  }
  return result.data;
};

export const buildEoComputedTotals = (args: Readonly<{
  svieSmerte: SvieSmerteEngineOutput;
  tafNetto: TafNettoBeregningResult;
  oevrige: OevrigeKravCanonicalInput;
  forligFactor: number | null;
}>): EoComputedTotals => {
  // Rækkefølge: clamp(tafNetto) → forlig-skalering → fradrag tidligereModtagetTaf → clamp.
  // `tabtArbejdsfortjenesteEfterForligOre` clampes ikke til nul efter skalering — det er tilstrækkeligt
  // at det ydre `clampMoneyOreToZero` håndterer det, da subtraktionen aldrig kan gøre resultatet positivt
  // hvis skaleringen allerede har produceret nul.
  const tabtArbejdsfortjenesteFoerForligOre = clampMoneyOreToZero(ensureMoneyOre(args.tafNetto.tabtArbejdsfortjenesteOre));
  const tidligereModtagetTafOre = args.tafNetto.tidligereModtagetTaf.status === 'ok'
    ? ensureMoneyOre(args.tafNetto.tidligereModtagetTaf.value)
    : ensureMoneyOre(0);
  const tabtArbejdsfortjenesteEfterForligOre = args.forligFactor !== null
    ? scaleMoneyOre(tabtArbejdsfortjenesteFoerForligOre, args.forligFactor)
    : tabtArbejdsfortjenesteFoerForligOre;
  const tabtArbejdsfortjenesteOre = clampMoneyOreToZero(
    ensureMoneyOre(tabtArbejdsfortjenesteEfterForligOre - tidligereModtagetTafOre)
  );

  const oevrigeKravFoerForligOre = clampMoneyOreToZero(ensureMoneyOre(args.oevrige.totalFoerForligOre));
  const oevrigeKravOre = args.forligFactor !== null
    ? clampMoneyOreToZero(scaleMoneyOre(oevrigeKravFoerForligOre, args.forligFactor))
    : oevrigeKravFoerForligOre;

  const svieSmerteOre = clampMoneyOreToZero(ensureMoneyOre(args.svieSmerte.totalOre));
  const samletTotalOre = clampMoneyOreToZero(
    ensureMoneyOre(svieSmerteOre + tabtArbejdsfortjenesteOre + oevrigeKravOre)
  );

  return {
    svieSmerteOre,
    tabtArbejdsfortjenesteFoerForligOre,
    tabtArbejdsfortjenesteOre,
    oevrigeKravFoerForligOre,
    oevrigeKravOre,
    samletTotalOre,
    tidligereModtagetTafOre,
    forligFactor: args.forligFactor,
  };
};

export const buildEoCanonicalOutputFromComputed = (args: Readonly<{
  tafRanges: ReadonlyArray<{ fra: z.infer<typeof isoDateSchema>; til: z.infer<typeof isoDateSchema> }>;
  svieSmerte: SvieSmerteEngineOutput;
  tafNetto: TafNettoBeregningResult;
  totals: EoComputedTotals;
}>): EoCanonicalOutput => {
  const loenudviklingSegmenter = (args.tafNetto.loenudvikling?.beregnedeSegmenter ?? []).map(toCanonicalSegment);
  const perAnsaettelse = (args.tafNetto.loenudvikling?.perAnsaettelse ?? []).map((entry) => ({
    ansaettelsesforholdId: entry.ansaettelsesforholdId,
    loenudviklingTotalFoerForligOre: calculableMoneyToNullable(entry.loenudviklingTotal),
    loenudviklingSegmenter: entry.beregnedeSegmenter.map(toCanonicalSegment),
  }));

  const output = {
    totals: {
      svieSmerteOre: args.totals.svieSmerteOre,
      tabtArbejdsfortjenesteFoerForligOre: args.totals.tabtArbejdsfortjenesteFoerForligOre,
      tabtArbejdsfortjenesteOre: args.totals.tabtArbejdsfortjenesteOre,
      oevrigeKravFoerForligOre: args.totals.oevrigeKravFoerForligOre,
      oevrigeKravOre: args.totals.oevrigeKravOre,
      samletTotalOre: args.totals.samletTotalOre,
    },
    svieSmerte: {
      maxApplied: args.svieSmerte.maxApplied,
    },
    taf: {
      harTafPerioder: args.tafNetto.harTafPerioder,
      offentligeYdelserUdviklingOre: calculableMoneyToNullable(args.tafNetto.offentligeYdelserUdvikling?.total),
      tafIndtaegterOre: calculableMoneyToNullable(args.tafNetto.tafIndtaegter?.total),
      tidligereModtagetTafOre: calculableMoneyToNullable(args.tafNetto.tidligereModtagetTaf),
      sygeferiegodtgoerelseOre: args.tafNetto.sygeferiegodtgoerelse.totalOre,
    },
    periodiseringer: {
      tafPerioder: args.tafRanges,
    },
    regulering: {
      loenudviklingTotalFoerForligOre: calculableMoneyToNullable(args.tafNetto.loenudvikling?.loenudviklingTotal),
      loenudviklingSegmenter,
      perAnsaettelse,
    },
  };
  const result = eoCanonicalOutputSchema.safeParse(output);
  if (!result.success) {
    throw new Error(buildCanonicalValidationErrorMessage('eoCanonicalOutput', result.error.issues));
  }
  return result.data;
};
