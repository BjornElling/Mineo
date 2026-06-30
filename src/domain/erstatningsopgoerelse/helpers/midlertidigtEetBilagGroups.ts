import type { MidlertidigtEetAfgoerelseGroup } from './midlertidigtEetInsertRows';
import type { IsoRange } from '../engines/periodRangeGroups';
import { sumMaanedsbroekForInterval } from '../engines/periodiseringsMotor';
import { roundHeleKroner } from '../shared/eoMoney';
import type { ISODateString } from '../../../types/branded';
import { parseISODate } from '../../../types/branded';

type ClampedMidlertidigtEetRow = MidlertidigtEetAfgoerelseGroup['perioder'][number];

export type ClampedMidlertidigtEetGroup = Readonly<{
  afgoerelsesdato: MidlertidigtEetAfgoerelseGroup['afgoerelsesdato'];
  eetPct: MidlertidigtEetAfgoerelseGroup['eetPct'];
  perioder: readonly ClampedMidlertidigtEetRow[];
}>;

type PendingClampedMidlertidigtEetRow = Readonly<{
  groupIndex: number;
  row: ClampedMidlertidigtEetRow;
  rawBeregnetEet: number;
}>;

const clampIsoRange = (range: IsoRange, fra: ISODateString, til: ISODateString): IsoRange | null => {
  const clampedFra = range.fra > fra ? range.fra : fra;
  const clampedTil = range.til < til ? range.til : til;
  return clampedFra <= clampedTil ? { fra: clampedFra, til: clampedTil } : null;
};

/**
 * Bygger de rækker der vises i bilaget "Midlertidig EET".
 *
 * Afledningen ligger i domæne-helper-laget, fordi den også låser paritet med TAF-fradraget:
 * rækkerne klippes mod de autoritative TAF-ranges og afrundes til hele kroner på samme måde
 * som den importerede EET-kilde. Dokumentlaget renderer kun de færdige rækker.
 */
export const buildMidlertidigtEetPdfGroupsForTafRanges = (
  groups: readonly MidlertidigtEetAfgoerelseGroup[],
  tafRanges: readonly IsoRange[]
): readonly ClampedMidlertidigtEetGroup[] => {
  if (groups.length === 0 || tafRanges.length === 0) return [];

  const pendingRows: PendingClampedMidlertidigtEetRow[] = [];
  const outputGroups = groups.map((group) => ({
    afgoerelsesdato: group.afgoerelsesdato,
    eetPct: group.eetPct,
    perioder: [] as ClampedMidlertidigtEetRow[],
  }));

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    if (!group) continue;
    for (const row of group.perioder) {
      const rowStart = parseISODate(row.fra);
      const rowEnd = parseISODate(row.til);
      if (!rowStart || !rowEnd || rowStart > rowEnd) continue;

      for (const tafRange of tafRanges) {
        const clamped = clampIsoRange(tafRange, row.fra, row.til);
        if (!clamped) continue;
        const clampedStart = parseISODate(clamped.fra);
        const clampedEnd = parseISODate(clamped.til);
        if (!clampedStart || !clampedEnd || clampedStart > clampedEnd) continue;

        const maanederPraecis = sumMaanedsbroekForInterval(clamped.fra, clamped.til);
        const rawBeregnetEet = maanederPraecis * row.maanedligYdelse;
        if (!Number.isFinite(rawBeregnetEet) || rawBeregnetEet <= 0) continue;

        const roundedBeregnetEet = roundHeleKroner(rawBeregnetEet);
        // Skip rækker der runder til 0 — de bidrager intet til bilagets total og ville ellers
        // indgå i delta-justeringen som en "modtager" der ikke kan bære delta uden at gå negativ.
        if (roundedBeregnetEet <= 0) continue;
        pendingRows.push({
          groupIndex,
          rawBeregnetEet,
          row: {
            ...row,
            fra: clamped.fra,
            til: clamped.til,
            maanederPraecis,
            beregnetEet: roundedBeregnetEet,
          },
        });
      }
    }
  }

  if (pendingRows.length === 0) return [];

  pendingRows.forEach((entry) => {
    outputGroups[entry.groupIndex]?.perioder.push(entry.row);
  });

  return outputGroups.filter((group) => group.perioder.length > 0);
};
