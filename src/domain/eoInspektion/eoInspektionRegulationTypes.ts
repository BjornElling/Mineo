/**
 * Regulation Types - Index model (rettet)
 */

import type { ISODateString } from '../../types/branded';
import type { TafBeregningsenhed } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';

export type IndeksEntry = Readonly<{
  effectiveFrom: ISODateString;
  grundloen: number;
  feriePct: number;
  shSoPct: number;
  fritvalgPct: number;
  storeBededagPct: number;
  pensionPct: number;
  packageValue: number;
  index: number;
  arbejdsdage: number | null;
  maaneder: number | null;
}>;

export type AnsaettelsesforholdIndeks = Readonly<{
  ansaettelsesforholdId: string;
  /** Ansættelsesforholdets kanoniske navn (`resolveAnsaettelsesforholdNavn`). */
  navn: string;
  kildeLabel: string;
  kildeVaerdi: string;
  overenskomstId?: string;
  referenceIso: ISODateString;
  referenceValue: number;
  entries: readonly IndeksEntry[];
}>;

export type RegulationIndexTimeline = Readonly<{
  tafBeregningsenhed: TafBeregningsenhed;
  ansaettelser: readonly AnsaettelsesforholdIndeks[];
}>;
