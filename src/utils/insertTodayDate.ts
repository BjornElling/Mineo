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
 * Fokus udsættes med vilje for at undgå at intern draft-state i date-input
 * blokerer synkronisering af den netop committede værdi.
 */
export const insertTodayDate = ({ onCommit, focusRef }: InsertTodayDateParams): void => {
  onCommit(getTodayLocalISO());

  if (!focusRef) return;
  deferToNextFrame(() => {
    focusRef.current?.focus();
  });
};

