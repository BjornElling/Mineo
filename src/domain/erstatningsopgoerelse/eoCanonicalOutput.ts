import { z } from 'zod';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { erstatningsopgoerelseSchema, stamdataSchema } from '../../schemas/formSchemas';
import { isoDateString } from '../../schemas/formSchemas/baseSchemas';
import { buildTafRanges } from './indtaegtPerioder';
import { parseForligsgrad } from './forligsgrad';
import { buildOevrigeKravModel } from './eoPdfBuilders';
import { clampMoneyOreToZero, ensureMoneyOre, moneyOreSchema, scaleMoneyOre } from './eoPdfMoneyUtils';
import { computeSvieSmerteEngine, type SvieSmerteEngineOutput } from './svieSmerteEngine';
import { computeTafNettoBeregning, type TafNettoBeregningResult } from './tafNettoBeregning';
import type { Calculable, LoenudviklingSegment, MoneyOre } from './eoPdfModelTypes';
import type { OevrigeKravPdfModel } from './eoPdfModel';

const isoDateSchema = isoDateString;

const loenudviklingSegmentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('maaneder'),
    fra: isoDateSchema,
    til: isoDateSchema,
    maaneder: z.number(),
    maanedsloenOre: moneyOreSchema,
    deltaPct: z.number(),
    amountOre: moneyOreSchema,
  }).strict(),
  z.object({
    kind: z.literal('arbejdsdage'),
    fra: isoDateSchema,
    til: isoDateSchema,
    arbejdsdage: z.number(),
    dagsloenOre: moneyOreSchema,
    deltaPct: z.number(),
    amountOre: moneyOreSchema,
  }).strict(),
]);

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
    tafIndtaegterOre: moneyOreSchema.nullable(),
    tidligereModtagetTafOre: moneyOreSchema.nullable(),
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

const calculableMoneyToNullable = (value: Calculable<MoneyOre> | null | undefined): MoneyOre | null => {
  if (!value || value.status !== 'ok') return null;
  return ensureMoneyOre(value.value);
};

const toCanonicalSegment = (segment: LoenudviklingSegment): z.infer<typeof loenudviklingSegmentSchema> =>
  loenudviklingSegmentSchema.parse(segment);

export const buildEoComputedTotals = (args: Readonly<{
  svieSmerte: SvieSmerteEngineOutput;
  tafNetto: TafNettoBeregningResult;
  oevrige: OevrigeKravPdfModel;
  forligFactor: number | null;
}>): EoComputedTotals => {
  const tabtArbejdsfortjenesteFoerForligOre = clampMoneyOreToZero(ensureMoneyOre(args.tafNetto.tabtArbejdsfortjenesteOre));
  const tabtArbejdsfortjenesteOre = args.forligFactor !== null
    ? clampMoneyOreToZero(scaleMoneyOre(tabtArbejdsfortjenesteFoerForligOre, args.forligFactor))
    : tabtArbejdsfortjenesteFoerForligOre;

  const oevrigeKravFoerForligOre = clampMoneyOreToZero(ensureMoneyOre(args.oevrige.totalFoerForligOre));
  const oevrigeKravOre = args.forligFactor !== null
    ? clampMoneyOreToZero(scaleMoneyOre(oevrigeKravFoerForligOre, args.forligFactor))
    : oevrigeKravFoerForligOre;

  const svieSmerteOre = clampMoneyOreToZero(ensureMoneyOre(args.svieSmerte.totalOre));
  const samletTotalOre = clampMoneyOreToZero(
    ensureMoneyOre(svieSmerteOre + tabtArbejdsfortjenesteOre + oevrigeKravOre)
  );
  const tidligereModtagetTafOre = args.tafNetto.tidligereModtagetTaf.status === 'ok'
    ? ensureMoneyOre(args.tafNetto.tidligereModtagetTaf.value)
    : ensureMoneyOre(0);

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
  oevrige: OevrigeKravPdfModel;
  totals: EoComputedTotals;
}>): EoCanonicalOutput => {
  const loenudviklingSegmenter = (args.tafNetto.loenudvikling?.beregnedeSegmenter ?? []).map(toCanonicalSegment);
  const perAnsaettelse = (args.tafNetto.loenudvikling?.perAnsaettelse ?? []).map((entry) => ({
    ansaettelsesforholdId: entry.ansaettelsesforholdId,
    loenudviklingTotalFoerForligOre: calculableMoneyToNullable(entry.loenudviklingTotal),
    loenudviklingSegmenter: entry.beregnedeSegmenter.map(toCanonicalSegment),
  }));

  return eoCanonicalOutputSchema.parse({
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
      tafIndtaegterOre: calculableMoneyToNullable(args.tafNetto.tafIndtaegter?.total),
      tidligereModtagetTafOre: calculableMoneyToNullable(args.tafNetto.tidligereModtagetTaf),
    },
    periodiseringer: {
      tafPerioder: args.tafRanges,
    },
    regulering: {
      loenudviklingTotalFoerForligOre: calculableMoneyToNullable(args.tafNetto.loenudvikling?.loenudviklingTotal),
      loenudviklingSegmenter,
      perAnsaettelse,
    },
  });
};

/**
 * Legacy test helper.
 * Produktionskoden skal projicere canonical output fra `computeEoSnapshot`, ikke via denne standalone entry.
 */
export const buildEoCanonicalOutput = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues
): EoCanonicalOutput => {
  const stamdataParsed = stamdataSchema.safeParse(stamdataValues);
  const eoParsed = erstatningsopgoerelseSchema.safeParse(eoValues);
  if (!stamdataParsed.success || !eoParsed.success) {
    const errors = [
      ...(stamdataParsed.success ? [] : stamdataParsed.error.issues),
      ...(eoParsed.success ? [] : eoParsed.error.issues),
    ].map((issue) => issue.message).join('; ');
    throw new Error(`Ugyldigt input til EO canonical output: ${errors}`);
  }

  const safeStamdata = stamdataParsed.data;
  const safeEo = eoParsed.data;

  const forlig = parseForligsgrad(safeEo);
  const forligFactor = forlig?.factor ?? null;
  if (forlig !== null && forligFactor === null) {
    throw new Error('Forlig-faktor mangler i canonical output');
  }

  const svieSmerte = computeSvieSmerteEngine({
    erstatningsopgoerelse: safeEo,
    stamdata: {
      skadesdato: safeStamdata.skadesdato,
      skadestype: safeStamdata.skadestype,
    },
  });

  const tafRanges = buildTafRanges(safeEo, { clamp: false });
  const tafNetto = computeTafNettoBeregning(safeEo, safeStamdata, {
    tafRanges,
    clampTafRows: false,
  });
  const oevrige = buildOevrigeKravModel(safeEo.oevrigeKravPerioder ?? []);
  const totals = buildEoComputedTotals({
    svieSmerte,
    tafNetto,
    oevrige,
    forligFactor,
  });
  return buildEoCanonicalOutputFromComputed({
    tafRanges,
    svieSmerte,
    tafNetto,
    oevrige,
    totals,
  });
};
