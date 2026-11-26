import type { ISODateString } from '../types/branded';
import { isoToDanish } from '../types/branded';
import { formatIsoDateLong } from './dateFormatting';
import { getTodayLocalISO } from './dateUtils';

type InsertTodayDateParams = Readonly<{
  onCommit: (today: ISODateString) => void;
}>;

/**
 * Committerer dags dato til et date-felt.
 *
 * Committet går gennem feltets normale settle-vej (`FieldEditorController.settleValue`), så den
 * programmatiske dato parses og valideres præcis som en tastet dato (§1.3/§1.5).
 * Den aktiverede knap beholder sit native fokus; at flytte det til datofeltet gjorde Tab-forløbet uforudsigeligt.
 */
export const insertTodayDate = ({ onCommit }: InsertTodayDateParams): void => {
  const today = getTodayLocalISO();
  onCommit(today);
};

/** En nedre grænse for feltet og det navn i bestemt form, tooltippen omtaler den med (fx «virkningsdatoen»). */
export type InsertTodayLowerBound = Readonly<{ date: ISODateString; labelBestemt: string }>;

/**
 * Årsagen til, at «Indsæt dags dato» er inaktiv – eller `undefined`, når dags dato er en gyldig værdi.
 *
 * Knappen må aldrig kunne indsætte en dato, feltet selv afviser – hverken ved den ØVRE grænse
 * (satsdækningen slutter før dags dato) eller ved den NEDRE: på Forsørgertab kan en fremtidig
 * virkningsdato være gyldig, og et klik ville da erstatte en gyldig beregningsdato med en rød. De nedre
 * grænser gives i prioriteret rækkefølge; den første, dags dato ligger før, navngives i årsagen.
 */
export const resolveInsertTodayDisabledReason = (params: Readonly<{
  today: ISODateString;
  max: ISODateString;
  lowerBounds?: readonly (InsertTodayLowerBound | undefined)[];
}>): string | undefined => {
  if (params.today > params.max) {
    return `Der kan kun foretages beregninger frem til ${formatIsoDateLong(params.max)}`;
  }
  const binding = params.lowerBounds?.find(
    (bound): bound is InsertTodayLowerBound => bound !== undefined && params.today < bound.date
  );
  return binding === undefined
    ? undefined
    : `Dags dato er før ${binding.labelBestemt} (${isoToDanish(binding.date)})`;
};
