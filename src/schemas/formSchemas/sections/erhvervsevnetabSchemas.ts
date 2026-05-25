import { z } from 'zod';
import { optionalIsoDateString, percentageDecimal, tableIsoDateCellString } from '../baseSchemas';
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
  afgoerelseType: afgoerelseTypeEnum.optional(),
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
  visUdvidetSpecifikation: z.boolean(),
  visUdvidetSpecifikationLoebendeYdelserBilag: z.boolean(),
}).strict();

export type EetDifferencekravBilagSelection = z.infer<typeof eetDifferencekravBilagSelectionSchema>;

export const erhvervsevnetabSchema = z.object({
  beregningsdato: optionalIsoDateString,
  koen: koenEnum.optional(),
  aslAfgoerelser: z.array(aslAfgoerelseRowSchema),
  // ealEetPct gemmes som decimaltal (ikke tabel-draft-string) og parses derfor i schema-laget.
  ealEetPct: percentageDecimal,
  eetDifferencekravBilagSelection: eetDifferencekravBilagSelectionSchema,
}).strict();

export type ErhvervsevnetabValues = z.infer<typeof erhvervsevnetabSchema>;
// Snapshot-input sammensættes først efter at hver persisted sektion er valideret mod eget schema.
export type ErhvervsevnetabComposedValues = ErhvervsevnetabValues & FaellesAarsloenValues & Pick<StamdataValues, 'skadelidteFodselsdato'>;
