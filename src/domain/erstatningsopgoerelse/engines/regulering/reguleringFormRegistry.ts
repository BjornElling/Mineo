import type { LoenudviklingBeregningsgrundlag } from '../../../../schemas/formSchemas';
import type {
  KonsolideretLoenudvikling,
  LoenreguleringsSegment,
  LoenudviklingStrategi,
  ReguleringForm,
} from './reguleringForm';
import { statistikForm } from './forms/statistikForm';
import { overenskomstForm } from './forms/overenskomstForm';
import { krlForm } from './forms/krlForm';
import { klLoenaftalerForm } from './forms/klLoenaftalerForm';
import { manuelForm } from './forms/manuelForm';
import { manuelProcentsatsForm } from './forms/manuelProcentsatsForm';
import { ingenForm } from './forms/ingenForm';

/**
 * Ét statisk, exhaustivt register over reguleringsformerne, keyet på enum-værdien. `Record`-typen
 * håndhæver at hver form er dækket — det er en compile-fejl at glemme en. Dispatch sker ét sted:
 * motoren, coverage-laget osv. slår formen op her frem for at gentage en switch (jf. R1).
 */
export const FORM_REGISTRY: Readonly<Record<LoenudviklingBeregningsgrundlag, ReguleringForm>> = {
  Overenskomst: overenskomstForm,
  Statistik: statistikForm,
  'KRL satstabel': krlForm,
  'KL-lønaftaler': klLoenaftalerForm,
  'Manuelt angivet': manuelForm,
  'Manuel procentsats': manuelProcentsatsForm,
  Ingen: ingenForm,
};

const FORM_BY_STRATEGI: ReadonlyMap<LoenudviklingStrategi, ReguleringForm> = new Map(
  Object.values(FORM_REGISTRY).map((form) => [form.strategi, form])
);

/**
 * Bygger segmenter for en allerede konsolideret form. Dispatcher på `konsolideret.strategi`
 * gennem registeret (afløser den tidligere if-kæde i motoren). "Ingen" bygges direkte i
 * orkestratoren (konsolideret er null) og når aldrig hertil.
 */
export const byggReguleringsSegmenter = (
  konsolideret: KonsolideretLoenudvikling
): ReadonlyArray<LoenreguleringsSegment> => {
  const form = FORM_BY_STRATEGI.get(konsolideret.strategi);
  if (!form) {
    throw new Error('Loenudvikling kan ikke beregnes: ukendt strategi');
  }
  return form.byggSegmenter(konsolideret);
};
