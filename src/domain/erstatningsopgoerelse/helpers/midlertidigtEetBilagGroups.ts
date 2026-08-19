import type { MidlertidigtEetAfgoerelseGroup } from './midlertidigtEetInsertRows';
import type { IsoRange } from '../engines/periodRangeGroups';
import { sumMaanedsbroekForInterval } from '../../dates/maanedsbroek';
import { fromKroner, roundHeleKroner, sumMoneyOre, toKroner } from '../../money/money';
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
}>;

const clampIsoRange = (range: IsoRange, fra: ISODateString, til: ISODateString): IsoRange | null => {
  const clampedFra = range.fra > fra ? range.fra : fra;
  const clampedTil = range.til < til ? range.til : til;
  return clampedFra <= clampedTil ? { fra: clampedFra, til: clampedTil } : null;
};

/**
 * Bygger de rækker der vises i bilaget "Midlertidig EET" – og som samtidig er den
 * KANONISKE kilde til midlertidigt EET-fradraget i TAF-beregningen.
 *
 * Hver (afgørelses-periode × TAF-range)-clamp afrundes til hele kroner PR. PERIODE
 * (`roundHeleKroner`). Både bilaget (dokumentlaget) og TAF-fradraget
 * (`sumMidlertidigtEetBeregnetEetKronerForTafRanges` → `buildTafIndtaegterModel` /
 * `tafPerYearDerived`) afleder deres tal herfra, så den viste bilagssum og det beløb
 * der faktisk trækkes fra er identiske bit for bit. Tidligere summerede fradraget de
 * urundede periodebeløb og rundede ÉN gang til sidst, hvilket kunne give 1 kr.'s
 * afvigelse fra bilaget (fx bilag 1.390 + 41.401 = 42.791 mod fradrag 42.790).
 * Se `eo-snapshot-contract.md` §13.
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
        const rawBeregnetEet = maanederPraecis * toKroner(row.maanedligYdelseOre);
        if (!Number.isFinite(rawBeregnetEet) || rawBeregnetEet <= 0) continue;

        const roundedBeregnetEet = roundHeleKroner(rawBeregnetEet);
        // Skip rækker der runder til 0 – de bidrager intet til bilagets total og ville ellers
        // indgå i delta-justeringen som en "modtager" der ikke kan bære delta uden at gå negativ.
        if (roundedBeregnetEet <= 0) continue;
        pendingRows.push({
          groupIndex,
          row: {
            ...row,
            fra: clamped.fra,
            til: clamped.til,
            maanederPraecis,
            beregnetEetOre: fromKroner(roundedBeregnetEet),
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

/**
 * Den kanoniske midlertidigt EET-fradragssum i hele kroner: summen af de pr.-periode-afrundede
 * `beregnetEet` fra {@link buildMidlertidigtEetPdfGroupsForTafRanges}, klippet mod de angivne
 * TAF-ranges. Bruges af TAF-fradraget (`buildTafIndtaegterModel`) og af per-år-fordelingen
 * (`tafPerYearDerived`), så fradraget altid er identisk med bilagets sammentælling.
 *
 * Fordi der afrundes pr. periode og lægges sammen bagefter, giver et kald pr. år (med
 * år-klippede ranges) ikke nødvendigvis nøjagtig samme sum som ét samlet kald over de fulde
 * ranges, når en periode krydser et årsskifte. Den residual absorberes af afrundingslinjen i
 * TAF fordelt på år (jf. `eo-snapshot-contract.md` §10).
 */
export const sumMidlertidigtEetBeregnetEetKronerForTafRanges = (
  groups: readonly MidlertidigtEetAfgoerelseGroup[],
  tafRanges: readonly IsoRange[]
): number =>
  toKroner(sumMoneyOre(
    buildMidlertidigtEetPdfGroupsForTafRanges(groups, tafRanges)
      .flatMap((group) => group.perioder)
      .map((row) => row.beregnetEetOre)
  ));
