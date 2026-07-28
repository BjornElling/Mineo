import type { ISODateString } from '../types/branded';
import { getTodayLocalISO } from './dateUtils';

type InsertTodayDateParams = Readonly<{
  onCommit: (today: ISODateString) => void;
  focusRef?: { current: HTMLInputElement | null };
}>;

const deferToNextFrame = (callback: () => void): void => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => callback());
    return;
  }
  setTimeout(callback, 0);
};

/**
 * Committerer dags dato til et date-felt og sætter evt. fokus efter næste frame.
 *
 * Committet går gennem feltets normale settle-vej (`FieldEditorController.settleValue`), så den
 * programmatiske dato parses og valideres præcis som en tastet dato (§1.3/§1.5).
 *
 * Fokus udsættes til næste frame, så feltet først fokuseres, når den nye afsluttede revision er rendret.
 */
export const insertTodayDate = ({ onCommit, focusRef }: InsertTodayDateParams): void => {
  const today = getTodayLocalISO();
  onCommit(today);

  if (!focusRef) return;
  deferToNextFrame(() => {
    focusRef.current?.focus();
  });
};
