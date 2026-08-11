import type { ISODateString } from '../types/branded';
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
