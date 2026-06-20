import { z } from 'zod';
import {
  allowEmptyString,
  dayCount,
  percentageDecimal,
  tableAmountCellValue,
  tableIsoDateCellString,
} from '../baseSchemas';
import { loenPaaHelligdageEnum, loenperiodeEnum, tillaegAngivesSomEnum } from '../enumSchemas';

export const standardLoenTableRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  col0_maaned: allowEmptyString,
  col1_maaned: allowEmptyString,
  col0_uge: allowEmptyString,
  col1_uge: allowEmptyString,
  col0_dag: tableIsoDateCellString,
  col1_dag: tableIsoDateCellString,
  // col2 og col3 er to visuelt adskilte lønfelter med identisk domænebetydning.
  // Beregninger må ikke skelne mellem dem; de lægges blot sammen.
  col2: tableAmountCellValue,
  col3: tableAmountCellValue,
  col4: tableAmountCellValue,
  col5: tableAmountCellValue,
  // Beløb-tilstand (tillaegAngivesSom='beloeb'): brugeren angiver tillægsbeløbene direkte i
  // stedet for procentsatser. fpFvShSoBeloeb svarer til kolonnen "FP/FV/SH/SO/St.B." og
  // pensionBeloeb til "Arb.g. Pension". I Procent-tilstand er disse beregnede visningsfelter,
  // og de to her ignoreres af beregningskernen (læses aldrig → tilstands-isolation).
  fpFvShSoBeloeb: tableAmountCellValue,
  pensionBeloeb: tableAmountCellValue,
}).strict();

export type StandardLoenTableRow = z.infer<typeof standardLoenTableRowSchema>;

export const aarsloenSchema = z.object({
  // Procent- og feriedage-felterne er allerede optional (tom/undefined er lovlig) og
  // behøver derfor ingen default for at en ældre .eo uden dem kan loades.
  feriePct: percentageDecimal,
  fritvalgPct: percentageDecimal,
  shSoPct: percentageDecimal,
  storeBededagPct: percentageDecimal,
  pensionPct: percentageDecimal,
  // Defaults nedenfor gør load forward/backward-tolerant: en ældre .eo der mangler et af
  // disse påkrævede felter fejler ikke længere hele sektionen, men loades med en fast
  // fallback-værdi. Værdierne matcher det, en ny, tom sag starter med.
  //
  // loenperiode: fast 'maaned' som load-fallback. NYE sager sætter feltet settings-styret via
  // createAarsloenInitialValues(defaultLoenIndtastesSom); schema-defaulten rammer KUN load af en
  // fil hvor feltet helt mangler. Bevidst ikke settings-styret her: persistence-contract forbyder
  // at injicere device-lokale app-settings under load.
  loenperiode: loenperiodeEnum.default('maaned'),
  // 'procent' = nuværende adfærd (default, passiv load-fallback for ældre .eo); 'beloeb' =
  // tillægsbeløb angives direkte i tabellen, og sats-blokken skjules.
  tillaegAngivesSom: tillaegAngivesSomEnum.default('procent'),
  tableData: z.array(standardLoenTableRowSchema).default([]),
  omregningTilFuldtAar: z.boolean().default(false),
  fuldLoenUnderFerie: z.boolean().default(true),
  retTilSjetteFerieuge: z.boolean().default(true),
  antalFeriedage: dayCount,
  loenPaaHelligdage: loenPaaHelligdageEnum.default('Almindelig løn'),
}).strict();

export type AarsloenValues = z.infer<typeof aarsloenSchema>;
