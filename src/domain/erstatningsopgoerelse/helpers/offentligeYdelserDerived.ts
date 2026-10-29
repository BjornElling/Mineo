import { canonicalYdelsestypeKey, ydelsestyper } from '../../../data/ydelsestyper';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { buildFallbackAllocationDaysForInterval, countOffentligYdelsePeriodiseringsdage } from '../engines/periodiseringsMotor';
import { coerceToISODateString } from '../../../types/branded';

export type OffentligeYdelserDerivedRow = Readonly<{
  periodiseringLabel: string;
  antalDage: number | null;
  ydelsePerDag: number | null;
  /** En arbejdsdags-periodiseret række, hvis periode ingen arbejdsdage har (BB-365). */
  ingenArbejdsdage: boolean;
}>;

export const deriveOffentligeYdelserRow = (row: OffentligeYdelserRow): OffentligeYdelserDerivedRow => {
  const ydelsestypeKey = canonicalYdelsestypeKey(row.ydelsestype);
  const config = ydelsestypeKey ? ydelsestyper[ydelsestypeKey] : undefined;

  const periodiseringLabel = config?.periodiseringLabel ?? '';
  const uden = { periodiseringLabel, antalDage: null, ydelsePerDag: null, ingenArbejdsdage: false } as const;
  if (!config) return uden;

  const fra = coerceToISODateString(row.fraDato);
  const til = coerceToISODateString(row.tilDato);
  const periodiseringsdage = countOffentligYdelsePeriodiseringsdage({
    fra,
    til,
    periodisering: config.periodisering,
    ydelsestypeKey,
  });
  if (periodiseringsdage === null || fra === undefined || til === undefined) return uden;
  // Samme fald-tilbage som beregningen (periodisering-contract.md §3A): en arbejdsdags-periodiseret ydelse i en ren
  // weekend fordeles på fald-tilbage-dagene og medregnes fuldt. Før stod dagkolonnerne tomme – det tegn, tabellen
  // ellers bruger for en række, der IKKE regnes – mens beregningen trak hele beløbet fra (BB-365; lønnens BB-292).
  const ingenArbejdsdage = periodiseringsdage === 0 && config.periodisering !== 'kalenderdage';
  const antalDage = ingenArbejdsdage
    ? buildFallbackAllocationDaysForInterval({ fra, til }).size
    : periodiseringsdage;
  if (antalDage <= 0) return uden;

  const ydelseValue = amountValueToNumber(row.ydelse);
  const ydelse2Value = amountValueToNumber(row.tillaeg);
  const hasAnyAmount = ydelseValue !== undefined || ydelse2Value !== undefined;
  if (!hasAnyAmount) return { periodiseringLabel, antalDage, ydelsePerDag: null, ingenArbejdsdage };

  // De to ydelsesfelter er semantisk ens og indgår derfor kun som en samlet ydelse.
  const samletYdelse = (ydelseValue ?? 0) + (ydelse2Value ?? 0);
  return { periodiseringLabel, antalDage, ydelsePerDag: samletYdelse / antalDage, ingenArbejdsdage };
};
