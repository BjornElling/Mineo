/**
 * Regulation Types - Index model (rettet)
 */

import type { ISODateString } from '../../types/branded';
import type { TafBeregningsenhed } from '../erstatningsopgoerelse/tafBeregningsenhed';

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
  navn: string | undefined;
  kildeLabel: string;
  kildeVaerdi: string;
  overenskomstId?: string;
  referenceIso: ISODateString;
  referenceLabel: 'Skadedato' | 'Manuelt angivet';
  referenceValue: number;
  entries: readonly IndeksEntry[];
}>;

export type RegulationIndexTimeline = Readonly<{
  tafBeregningsenhed: TafBeregningsenhed;
  ansaettelser: readonly AnsaettelsesforholdIndeks[];
}>;
