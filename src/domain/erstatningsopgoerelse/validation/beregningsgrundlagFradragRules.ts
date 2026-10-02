import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { isISODateString, type ISODateString } from '../../../types/branded';
import { formatCountWithUnit } from '../../../utils/formatUtils';
import { roundByMethod } from '../../../utils/rounding';
import { formatDocumentMaanederTrimmed } from '../../../utils/documentMaanederFormatting';
import { calculateTafAntalMaanederPraecis, calculateTafArbejdsdageBreakdown } from '../engines/tafCalculations';
import { TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR, TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { TAF_LOSE_FERIEDAGE_LABEL } from './tafRowRules';

/**
 * Hvor meget af beregningsperioden, fradragene efterlader – og de regler, der vogter over det.
 *
 * Beregningsgrundlaget deler periodens løn med de måneder eller arbejdsdage, der er tilbage efter fradragene.
 * Ingen regel sikrede, at der VAR noget tilbage: 300 fraværsdage i 12 måneder (14,4 måneder), løse dage lig
 * periodens sidste arbejdsdag eller ferie over hele perioden efterlod en nævner på 0, og beregningen endte i en
 * intern undtagelse uden et ord om feltet (BB-258). Én dag under randen gav omvendt en dagsindkomst på hele
 * periodens løn uden bemærkning (BB-259).
 *
 * Modulet regner med motorens egne funktioner (`calculateTafAntalMaanederPraecis`,
 * `calculateTafArbejdsdageBreakdown`), så grænsen og beregningen ikke kan være uenige om, hvornår intet er
 * tilbage. Inputtet er readerens værdier: et skjult eller rødt felt er allerede tomt og tæller som 0.
 */

/** En eller begge af periodens datoer mangler – fælles for rækken og validatoren (BB-265). */
export const BEREGNINGSPERIODE_MANGLER_MESSAGE = 'Der mangler indtastninger i perioden til beregning af før-løn';

/** Ingen lønrække eller ydelse over 0 kr. i beregningsperioden – fælles for rækken og validatoren (BB-258). */
export const INGEN_INDKOMST_I_BEREGNINGSPERIODEN_MESSAGE = 'Ingen indkomst i beregningsperioden';

export type BeregningsgrundlagFradragInput = Pick<
  ErstatningsopgoerelseValues,
  | 'beregnesUdFra'
  | 'tafBeregningsperiodeFra'
  | 'tafBeregningsperiodeTil'
  | 'fravaerPerioder'
  | 'uspecificeredeFerieFridage'
  | 'oevrigtFravaerUdenLoen'
  | 'oevrigeFravaersdage'
>;

export type BeregningsgrundlagFradrag =
  | Readonly<{
    enhed: typeof TAF_BEREGNES_SOM.MAANEDER;
    /** Periodens måneder før fradrag. */
    periodensMaaneder: number;
    /** Fraværsdagene, der fradrages med 4,8 % af en måned pr. dag. */
    fravaersdage: number;
    /** Måneder tilbage efter fradraget. */
    tilbage: number;
  }>
  | Readonly<{
    enhed: typeof TAF_BEREGNES_SOM.ARBEJDSDAGE;
    /** Periodens hverdage minus SH-dage – arbejdsdagene før ferie og øvrige fradrag. */
    periodensArbejdsdage: number;
    /** Dagene, ferien i beregningsperioden optager. */
    feriedage: number;
    /** Arbejdsdagene tilbage efter ferien – det, løse dage og fravær kan tage af. */
    efterFerie: number;
    loseFeriedage: number;
    fravaersdage: number;
    /** Arbejdsdage tilbage efter alle fradrag. */
    tilbage: number;
  }>;

// Felterne er heltalsfelter; codec'et tager kun ikke-negative heltal imod.
const nonNegative = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

const validPeriod = (
  values: BeregningsgrundlagFradragInput,
): Readonly<{ fra: ISODateString; til: ISODateString }> | undefined => {
  const { tafBeregningsperiodeFra: fra, tafBeregningsperiodeTil: til } = values;
  if (!isISODateString(fra) || !isISODateString(til) || fra > til) return undefined;
  return { fra, til };
};

/** Fradragene i beregningsperioden, eller `undefined` uden en gyldig beregningsperiode. */
export const resolveBeregningsgrundlagFradrag = (
  values: BeregningsgrundlagFradragInput,
  enhed: TafBeregningsenhed,
): BeregningsgrundlagFradrag | undefined => {
  if (values.beregnesUdFra !== 'Beregningsperiode') return undefined;
  const periode = validPeriod(values);
  if (periode === undefined) return undefined;
  const fravaersdage = values.oevrigtFravaerUdenLoen === 'Ja' ? nonNegative(values.oevrigeFravaersdage) : 0;

  if (enhed === TAF_BEREGNES_SOM.MAANEDER) {
    const periodensMaaneder = calculateTafAntalMaanederPraecis(periode.fra, periode.til, 0);
    const tilbage = calculateTafAntalMaanederPraecis(periode.fra, periode.til, fravaersdage);
    if (periodensMaaneder === null || tilbage === null) return undefined;
    return { enhed, periodensMaaneder, fravaersdage, tilbage };
  }

  const ferieperioder = values.fravaerPerioder ?? [];
  const uden = calculateTafArbejdsdageBreakdown(periode.fra, periode.til, ferieperioder, 0, {
    kind: 'beregningsgrundlag', oevrigeFravaersdage: 0,
  });
  const loseFeriedage = nonNegative(values.uspecificeredeFerieFridage);
  const med = calculateTafArbejdsdageBreakdown(periode.fra, periode.til, ferieperioder, loseFeriedage, {
    kind: 'beregningsgrundlag', oevrigeFravaersdage: fravaersdage,
  });
  if (uden === null || med === null) return undefined;
  return {
    enhed,
    periodensArbejdsdage: uden.arbejdsdageMinusSH,
    feriedage: uden.feriedage,
    efterFerie: uden.tafDage,
    loseFeriedage,
    fravaersdage,
    tilbage: med.tafDage,
  };
};

// ── Spærrende regler: der skal være noget tilbage (BB-258) ──────────────────────────────────────

/**
 * Det største antal fraværsdage, der efterlader en del af en måned. `ceil(M / 0,048) − 1` er formlen, men den
 * prøves mod motorens egen optælling, fordi 250 × 0,048 i flydende tal er præcis 12 – og så ville formlen og
 * beregningen kunne være uenige om den sidste dag.
 */
export const resolveMaksimaleFravaersdageIMaaneder = (
  fra: ISODateString,
  til: ISODateString,
  periodensMaaneder: number,
): number => {
  const tilbageMed = (dage: number): number => calculateTafAntalMaanederPraecis(fra, til, dage) ?? 0;
  let maks = Math.max(0, roundByMethod(periodensMaaneder / TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR, 0, 'ceil') - 1);
  while (maks > 0 && tilbageMed(maks) <= 0) maks -= 1;
  while (tilbageMed(maks + 1) > 0) maks += 1;
  return maks;
};

export const buildFravaerOverstigerMaanederMessage = (maks: number): string =>
  `Fraværet overstiger beregningsperioden (højst ${formatCountWithUnit(maks, 'fraværsdag', 'fraværsdage')})`;

const MINDST_EN_ARBEJDSDAG = 'Der skal være mindst én arbejdsdag tilbage i beregningsperioden';

export const buildLoseFeriedageMaksimumMessage = (maks: number): string =>
  `${MINDST_EN_ARBEJDSDAG} (højst ${formatCountWithUnit(maks, 'løs ferie-/feriefridag', TAF_LOSE_FERIEDAGE_LABEL.toLowerCase())})`;

export const buildFravaersdageArbejdsdageMaksimumMessage = (maks: number): string =>
  `${MINDST_EN_ARBEJDSDAG} (højst ${formatCountWithUnit(maks, 'fraværsdag', 'fraværsdage')})`;

export const FERIE_DAEKKER_BEREGNINGSPERIODEN_MESSAGE = 'Ferien dækker alle arbejdsdage i beregningsperioden';
export const BEREGNINGSPERIODE_UDEN_ARBEJDSDAGE_MESSAGE = 'Beregningsperioden indeholder ingen arbejdsdage';

export type BeregningsgrundlagFradragFejl = Readonly<{
  /** Beregningsperioden har ingen arbejdsdage overhovedet (fx en weekend). */
  periode?: string;
  /** Ferien alene optager alle arbejdsdage. */
  ferie?: string;
  loseFeriedage?: string;
  fravaersdage?: string;
}>;

/**
 * Hvilke felter, der efterlader for lidt. Et felt markeres kun, når DET kan rettes til at gå op: er det andet
 * felt i sig selv for stort, er det dét, der markeres – ellers fik et lovligt felt at vide, at det højst må
 * være 0. Er begge for store hver for sig, markeres begge med hver sin selvstændige grænse.
 */
export const evaluateBeregningsgrundlagFradragFejl = (
  values: BeregningsgrundlagFradragInput,
  fradrag: BeregningsgrundlagFradrag | undefined,
): BeregningsgrundlagFradragFejl => {
  if (fradrag === undefined) return {};
  if (fradrag.enhed === TAF_BEREGNES_SOM.MAANEDER) {
    if (fradrag.fravaersdage === 0 || fradrag.tilbage > 0) return {};
    const periode = validPeriod(values);
    if (periode === undefined) return {};
    return {
      fravaersdage: buildFravaerOverstigerMaanederMessage(
        resolveMaksimaleFravaersdageIMaaneder(periode.fra, periode.til, fradrag.periodensMaaneder),
      ),
    };
  }

  if (fradrag.tilbage > 0) return {};
  if (fradrag.periodensArbejdsdage <= 0) return { periode: BEREGNINGSPERIODE_UDEN_ARBEJDSDAGE_MESSAGE };
  if (fradrag.efterFerie <= 0) return { ferie: FERIE_DAEKKER_BEREGNINGSPERIODEN_MESSAGE };

  const loft = fradrag.efterFerie - 1;
  const loseMaks = loft - fradrag.fravaersdage;
  const fravaerMaks = loft - fradrag.loseFeriedage;
  const markerLose = fradrag.loseFeriedage > 0 && loseMaks >= 0;
  const markerFravaer = fradrag.fravaersdage > 0 && fravaerMaks >= 0;
  if (markerLose || markerFravaer) {
    return {
      ...(markerLose ? { loseFeriedage: buildLoseFeriedageMaksimumMessage(loseMaks) } : {}),
      ...(markerFravaer ? { fravaersdage: buildFravaersdageArbejdsdageMaksimumMessage(fravaerMaks) } : {}),
    };
  }
  return {
    ...(fradrag.loseFeriedage > 0 ? { loseFeriedage: buildLoseFeriedageMaksimumMessage(loft) } : {}),
    ...(fradrag.fravaersdage > 0 ? { fravaersdage: buildFravaersdageArbejdsdageMaksimumMessage(loft) } : {}),
  };
};

// ── Ikke-spærrende advarsel: næsten intet tilbage (BB-259) ──────────────────────────────────────

/**
 * Under en fjerdedel af perioden tilbage er næsten altid en tastefejl – fx 250 for 25 – og skærmen viser ikke
 * resultatet (BB-226), så kun papiret ville afsløre den. Grænsen er udviklerens (2026-10-02, BB-259).
 */
export const BEREGNINGSGRUNDLAG_ADVARSEL_ANDEL = 0.25;

export type BeregningsgrundlagFradragAdvarsel = Readonly<{
  message: string;
  /** De indtastede fradrag, advarslen hører til; ferien er en tabel og får kun linjen. */
  felter: readonly ('loseFeriedage' | 'fravaersdage' | 'ferie')[];
}>;

export const evaluateBeregningsgrundlagFradragAdvarsel = (
  fradrag: BeregningsgrundlagFradrag | undefined,
): BeregningsgrundlagFradragAdvarsel | undefined => {
  if (fradrag === undefined || fradrag.tilbage <= 0) return undefined;
  if (fradrag.enhed === TAF_BEREGNES_SOM.MAANEDER) {
    if (fradrag.fravaersdage === 0) return undefined;
    if (fradrag.tilbage >= fradrag.periodensMaaneder * BEREGNINGSGRUNDLAG_ADVARSEL_ANDEL) return undefined;
    return {
      message: `Fraværet efterlader kun ${formatDocumentMaanederTrimmed(fradrag.tilbage)} af `
        + `${formatCountWithUnit(fradrag.periodensMaaneder, 'måned', 'måneder')} i beregningsperioden`,
      felter: ['fravaersdage'],
    };
  }
  if (fradrag.tilbage >= fradrag.periodensArbejdsdage * BEREGNINGSGRUNDLAG_ADVARSEL_ANDEL) return undefined;
  const felter = [
    ...(fradrag.feriedage > 0 ? ['ferie' as const] : []),
    ...(fradrag.loseFeriedage > 0 ? ['loseFeriedage' as const] : []),
    ...(fradrag.fravaersdage > 0 ? ['fravaersdage' as const] : []),
  ];
  if (felter.length === 0) return undefined;
  return {
    message: `Fradragene efterlader kun ${fradrag.tilbage} af `
      + `${formatCountWithUnit(fradrag.periodensArbejdsdage, 'arbejdsdag', 'arbejdsdage')} i beregningsperioden`,
    felter,
  };
};
