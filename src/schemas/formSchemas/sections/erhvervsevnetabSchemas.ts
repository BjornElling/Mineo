import { z } from 'zod';
import { optionalIsoDateString, percentageDecimal, tableDateCellString } from '../baseSchemas';
import { afgoerelseTypeEnum, jaNejEnum, koenEnum } from '../enumSchemas';
import type { FaellesAarsloenValues } from './faellesAarsloenSchemas';
import type { StamdataValues } from './stamdataSchemas';

// ─── ASL afgørelser tabel ─────────────────────────────────────────────────────

export const aslAfgoerelseRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  afgoerelsesDato: tableDateCellString,
  virkningsDato: tableDateCellString,
  eetPct: percentageDecimal,
  kapDato: tableDateCellString,
  kapPct: percentageDecimal,
  afgoerelseType: afgoerelseTypeEnum.optional(),
  tidlKapDato: tableDateCellString,
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
export type ErhvervsevnetabComposedValues = ErhvervsevnetabValues & FaellesAarsloenValues & Pick<StamdataValues, 'skadelidteFodselsdato'>;
