import type { ISODateString } from '../types/branded';
import { getTodayLocalISO } from './dateUtils';

type InsertTodayDateParams = Readonly<{
  onCommit: (today: ISODateString) => void;
  focusRef?: { current: HTMLInputElement | null };
}>;

export const INSERT_TODAY_DATE_EVENT = 'mineo:insert-today-date';

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
  const today = getTodayLocalISO();
  onCommit(today);

  if (typeof focusRef?.current?.dispatchEvent === 'function') {
    focusRef.current.dispatchEvent(
      new CustomEvent<ISODateString>(INSERT_TODAY_DATE_EVENT, { detail: today })
    );
  }

  if (!focusRef) return;
  deferToNextFrame(() => {
    focusRef.current?.focus();
  });
};
