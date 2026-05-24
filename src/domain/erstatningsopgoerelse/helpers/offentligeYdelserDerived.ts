import { ydelsestyper } from '../../../data/ydelsestyper';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { countOffentligYdelsePeriodiseringsdage } from '../engines/periodiseringsMotor';
import { coerceToISODateString } from '../../../types/branded';

export type OffentligeYdelserDerivedRow = Readonly<{
  periodiseringLabel: string;
  antalDage: number | null;
  ydelsePerDag: number | null;
}>;

export const deriveOffentligeYdelserRow = (row: OffentligeYdelserRow): OffentligeYdelserDerivedRow => {
  const ydelsestypeKey = row.ydelsestype?.trim() ?? '';
  const config = ydelsestypeKey ? ydelsestyper[ydelsestypeKey] : undefined;

  const periodiseringLabel = config?.periodiseringLabel ?? '';
  if (!config) return { periodiseringLabel, antalDage: null, ydelsePerDag: null };

  const fra = coerceToISODateString(row.fraDato);
  const til = coerceToISODateString(row.tilDato);
  const antalDage = countOffentligYdelsePeriodiseringsdage({
    fra,
    til,
    periodisering: config.periodisering,
    ydelsestypeKey,
  });
  if (!antalDage || antalDage <= 0) return { periodiseringLabel, antalDage: null, ydelsePerDag: null };

  const ydelseValue = amountValueToNumber(row.ydelse);
  const ydelse2Value = amountValueToNumber(row.tillaeg);
  const hasAnyAmount = ydelseValue !== undefined || ydelse2Value !== undefined;
  if (!hasAnyAmount) return { periodiseringLabel, antalDage, ydelsePerDag: null };

  // De to ydelsesfelter er semantisk ens og indgår derfor kun som en samlet ydelse.
  const samletYdelse = (ydelseValue ?? 0) + (ydelse2Value ?? 0);
  return { periodiseringLabel, antalDage, ydelsePerDag: samletYdelse / antalDage };
};
