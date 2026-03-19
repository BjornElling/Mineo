import { z } from 'zod';
import { optionalIsoDateString, percentageDecimal, tableDateCellString, stripTopLevelKey } from '../baseSchemas';
import { afgoerelseTypeEnum, koenEnum } from '../enumSchemas';
import type { FaellesAarsloenValues } from './faellesAarsloenSchemas';

// ─── ASL afgørelser tabel ─────────────────────────────────────────────────────

export const aslAfgoerelseRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  afgoerelsesDato: tableDateCellString,
  virkningsDato: tableDateCellString,
  // Persisteres som committed tabel-display (string). Domæneregler valideres i eetAslAfgoerelser.ts.
  eetPct: z.string().optional(),
  kapDato: tableDateCellString,
  // Persisteres som committed tabel-display (string). Domæneregler valideres i eetAslAfgoerelser.ts.
  kapPct: z.string().optional(),
  afgoerelseType: afgoerelseTypeEnum.optional(),
  tidlKapDato: tableDateCellString,
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

const erhvervsevnetabInnerSchema = z.object({
  beregningsdato: optionalIsoDateString,
  koen: koenEnum.optional(),
  aslAfgoerelser: z.array(aslAfgoerelseRowSchema),
  // ealEetPct gemmes som decimaltal (ikke tabel-draft-string) og parses derfor i schema-laget.
  ealEetPct: percentageDecimal,
  eetDifferencekravBilagSelection: eetDifferencekravBilagSelectionSchema,
}).strict();

export const erhvervsevnetabSchema = z.preprocess(
  (value) => stripTopLevelKey(value, 'activeTab'),
  erhvervsevnetabInnerSchema
);

export type ErhvervsevnetabValues = z.infer<typeof erhvervsevnetabSchema>;
export type ErhvervsevnetabComposedValues = ErhvervsevnetabValues & FaellesAarsloenValues;
