import { z } from 'zod';
import { optionalIsoDateString, percentageDecimal, tableIsoDateCellString, normalizeEmptyToUndefined } from '../baseSchemas';
import { afgoerelseTypeEnum, jaNejEnum, koenEnum } from '../enumSchemas';
import type { FaellesAarsloenValues } from './faellesAarsloenSchemas';
import type { StamdataValues } from './stamdataSchemas';

// ─── ASL afgørelser tabel ─────────────────────────────────────────────────────

const aslAfgoerelsePercent = (label: string) => percentageDecimal
  .refine((value) => value === undefined || Number.isInteger(value), `${label} skal være et heltal.`)
  .refine((value) => value === undefined || value % 5 === 0, `${label} skal være deleligt med 5.`);

export const aslAfgoerelseRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  afgoerelsesDato: tableIsoDateCellString,
  virkningsDato: tableIsoDateCellString,
  eetPct: aslAfgoerelsePercent('EET %'),
  kapDato: tableIsoDateCellString,
  kapPct: aslAfgoerelsePercent('Kapitaliseringsprocent'),
  // Normaliser tom streng → undefined før enum-valideringen, så et persisteret '' ikke
  // dropper hele afgørelsesrækken. Kanonisk optional-enum-mønster (jf. EO-sektionens enums).
  afgoerelseType: z.preprocess(normalizeEmptyToUndefined, afgoerelseTypeEnum.optional()),
  tidlKapDato: tableIsoDateCellString,
  // Schema-evolution fallback for ældre afgørelsesrækker uden feltet.
  fsTilbageholdtEet: jaNejEnum.default('Nej'),
}).strict();

export type AslAfgoerelseRow = z.infer<typeof aslAfgoerelseRowSchema>;

// ─── Erhvervsevnetab (fane 1) ─────────────────────────────────────────────────

const eetDifferencekravBilagSelectionSchema = z.object({
  loebendeYdelser: z.boolean(),
  kapitalisering: z.boolean(),
  eetEfterEal: z.boolean(),
  proformaKapitalisering: z.boolean(),
  // Bilag for mer-erstatning ved forhøjet folkepensionsalder. Schema-evolution: ældre .eo
  // uden feltet får default true (samme tilgang som de øvrige differencekrav-valg).
  merErstatningPensionsalder: z.boolean().default(true),
  visUdvidetSpecifikation: z.boolean(),
  visUdvidetSpecifikationLoebendeYdelserBilag: z.boolean(),
}).strict();

export type EetDifferencekravBilagSelection = z.infer<typeof eetDifferencekravBilagSelectionSchema>;

export const erhvervsevnetabSchema = z.object({
  beregningsdato: optionalIsoDateString,
  koen: z.preprocess(normalizeEmptyToUndefined, koenEnum.optional()),
  aslAfgoerelser: z.array(aslAfgoerelseRowSchema),
  // ealEetPct gemmes som decimaltal (ikke tabel-draft-string) og parses derfor i schema-laget.
  ealEetPct: percentageDecimal,
  eetDifferencekravBilagSelection: eetDifferencekravBilagSelectionSchema,
  // Beregnings-valgmulighed på differencekrav-fanen (fane 5): når true gør en endelig
  // afgørelse en tidligere midlertidig EET-ydelse fradragsberettiget i differencekravet
  // med tilbagevirkende kraft. Er sagsdata og følger med .eo. Reglen er beskrevet normativt
  // i docs/domain/eet/differencekrav.md. Schema-evolution: ældre .eo uden feltet får default true.
  endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: z.boolean().default(true),
  // Valgmulighed på differencekrav-fanen (fane 5): når true fratrækkes mer-erstatning ved
  // forhøjet folkepensionsalder (fradrag 4) i differencekravet. Er sagsdata og følger med .eo.
  // Reglen er beskrevet normativt i docs/domain/eet/mer-erstatning-pensionsalder.md.
  // Schema-evolution: ældre .eo uden feltet får default true.
  indregnMerErstatningVedForhoejetPensionsalder: z.boolean().default(true),
}).strict();

export type ErhvervsevnetabValues = z.infer<typeof erhvervsevnetabSchema>;
// Snapshot-input sammensættes først efter at hver persisted sektion er valideret mod eget schema.
export type ErhvervsevnetabComposedValues = ErhvervsevnetabValues & FaellesAarsloenValues & Pick<StamdataValues, 'skadelidteFodselsdato'>;
