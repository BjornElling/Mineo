import { opregulerMedAslAarsloensmaksimum } from '../satser/opreguleringsmotorer';
import {
  formatAslAarsloensmaksimumMissing,
  resolveAslAarsloensmaksimumForAar,
} from '../satser/aslAarsloensmaksimum';
import { validateAslAarsloenBySkadesaarMax } from '../aslEalAarsloen/aarsloenValidators';
import {
  getKapitaliseringsTabelData,
  type ForsoergertabMatrixRaekke,
  type ForsoergertabTabelvalg,
  type KapitaliseringsTabelData,
} from '../../data/kapitalisering/kapitaliseringsTabeller';
import { getFolkepensionAlder } from '../../data/folkepensionAlderRates';
import type { ISODateString } from '../../types/branded';
import { dateToISO } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { Koen } from '../../schemas/formSchemas';
import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { roundByMethod } from '../../utils/rounding';
import { dedupeIssuesByIdentity } from '../../utils/issueUtils';
import { endOfYearIso, isoYear, startOfYearIso } from '../../utils/isoDateHelpers';
import { SKAERING_2015_03_01 } from '../erhvervsevnetab/eetSkaeringsdatoer';
import { isoDateToDate } from '../dates/isoDate';
import {
  calculateAgeYearsMonths,
  resolveKapitaliseringsbekendtgoerelseId,
} from '../erhvervsevnetab/eetKapitaliseringOpslag';
import { ceil0, ceilNearest12, round0, round2, round3, round4, roundNearest1000 } from '../../utils/roundingShortcuts';
import type { EetIssue } from '../erhvervsevnetab/eetTypes';
import type { AslLobendeYdelseRaekke, ForsoergertabAslComputation, ForsoergertabAslResult } from './forsoergertabTypes';
import { resolveStamdataDatoReference } from '../policies/stamdataCalculations';
import { SKADELIDTES_AARSLOEN_ASL_LABEL } from '../aslEalAarsloen/aarsloenLabels';

type Input = Readonly<{
  skadedato: ISODateString | undefined;
  skadestype?: Skadestype;
  beregningsdato: ISODateString | undefined;
  virkningsdato: ISODateString | undefined;
  efterladteFodselsdato: ISODateString | undefined;
  koen: Koen | undefined;
  tilkendtForPeriodeAar: number | undefined;
  aslAarsloen: AmountValue | undefined;
}>;

const FORSOERGERTABSPROCENT = 0.3;

const toIssue = (id: string, message: string): EetIssue => ({
  id,
  severity: 'error',
  message,
});

/**
 * Kildens forsørgertabsvalg for skadesintervallet (seneste afsnit, der gælder skadedatoen). Kønsopdelingen
 * er en egenskab ved kilden; den skal stemme med inputreglen (`usesKoen`), ellers fail-closed.
 */
const resolveForsoergertabRows = (
  tabeldata: KapitaliseringsTabelData,
  skadedato: ISODateString,
  usesKoen: boolean,
  koen: Koen | undefined
): Readonly<{ tabel: string; rows: readonly ForsoergertabMatrixRaekke[] }> | null => {
  const valg = tabeldata.forsoergertabTabelvalg
    .filter((entry) => entry.skadedatoFra <= skadedato)
    .reduce<ForsoergertabTabelvalg | null>((latest, current) =>
      latest === null || current.skadedatoFra > latest.skadedatoFra ? current : latest, null);
  if (valg === null || valg.koensopdelt !== usesKoen) return null;
  if (!valg.koensopdelt) {
    const rows = tabeldata.forsoergertabTabeller[valg.tabel];
    return rows ? { tabel: valg.tabel, rows } : null;
  }
  if (!koen) return null;
  const tabel = koen === 'Mand' ? valg.tabelMaend : valg.tabelKvinder;
  const rows = koen === 'Mand' ? tabeldata.forsoergertabTabellerMaend[tabel] : tabeldata.forsoergertabTabellerKvinder[tabel];
  return rows ? { tabel, rows } : null;
};

/**
 * Faktorrækken for efterladtes fyldte alder. Har kilden kun udvalgte aldre (BEK 1068/2003 tabel D og E:
 * 18, 20, 25, ...), foreskriver den mellemliggende faktorer; de findes lineært mellem nabo-aldrene.
 */
const resolveAgeRow = (
  rows: readonly ForsoergertabMatrixRaekke[],
  alderAar: number
): ForsoergertabMatrixRaekke | null => {
  const exact = rows.find((row) => row.alder === alderAar);
  if (exact) return exact;
  const lower = [...rows].reverse().find((row) => row.alder < alderAar);
  const upper = rows.find((row) => row.alder > alderAar);
  if (!lower || !upper) return null;
  const andel = (alderAar - lower.alder) / (upper.alder - lower.alder);
  const laengde = Math.min(lower.faktorerPraHeleAar.length, upper.faktorerPraHeleAar.length);
  return {
    alder: alderAar,
    faktorerPraHeleAar: lower.faktorerPraHeleAar
      .slice(0, laengde)
      .map((faktor, index) => faktor + andel * (upper.faktorerPraHeleAar[index]! - faktor)),
  };
};

const interpolateKapitalfaktor = (
  row: ForsoergertabMatrixRaekke,
  resterendeAar: number,
  resterendeMaaneder: number
): number | null => {
  if (resterendeAar === 0 && resterendeMaaneder === 0) return 0;
  if (resterendeAar === 0) {
    const faktorFor1Aar = row.faktorerPraHeleAar[0];
    return faktorFor1Aar === undefined ? null : round3(faktorFor1Aar * (resterendeMaaneder / 12));
  }
  if (resterendeMaaneder === 0) {
    const faktor = row.faktorerPraHeleAar[resterendeAar - 1];
    return faktor === undefined ? null : round3(faktor);
  }

  const faktorX = row.faktorerPraHeleAar[resterendeAar - 1];
  const faktorXplus1 = row.faktorerPraHeleAar[resterendeAar];
  if (faktorX === undefined || faktorXplus1 === undefined) return null;
  return round3(faktorX + (faktorXplus1 - faktorX) * (resterendeMaaneder / 12));
};

// month er 1-indekseret (1 = januar … 12 = december), som det udtrækkes af ISO-strengens
// måneds-segment. Date.UTC(year, month, 0) udnytter at "dag 0" = sidste dag i den FOREGÅENDE
// 0-indekserede måned: med 1-indekseret input peger month derfor på den 0-indekserede MÅNED-EFTER,
// og dag 0 dér giver præcis sidste dag i den ønskede måned. De to off-by-one-forskydninger
// ophæver hinanden – ret IKKE month til month-1, det ville give forrige måneds dage.
const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

const computeLobendeYdelser = (
  virkningsdato: ISODateString,
  beregningsdato: ISODateString,
  tilkendtForPeriodeAar: number,
  benyttetAarsloen: number,
  skadesaar: number,
  aarsloenMaxSkadesaar: number,
): readonly AslLobendeYdelseRaekke[] => {
  const beregningsdatoDate = isoDateToDate(beregningsdato);

  const periodSlutDate = isoDateToDate(virkningsdato);
  periodSlutDate.setUTCFullYear(periodSlutDate.getUTCFullYear() + tilkendtForPeriodeAar);
  periodSlutDate.setUTCDate(periodSlutDate.getUTCDate() - 1);

  const effectiveLastDate = beregningsdatoDate < periodSlutDate ? beregningsdatoDate : periodSlutDate;
  const lastDay = dateToISO(effectiveLastDate);
  if (!lastDay) throw new Error('INVARIANT: dateToISO returnerede undefined for valid Date');

  if (lastDay < virkningsdato) return [];

  const rows: AslLobendeYdelseRaekke[] = [];
  let fromDate = virkningsdato;

  while (fromDate <= lastDay) {
    const year = isoYear(fromDate);
    const endOfYear = endOfYearIso(year);
    const toDate: ISODateString = lastDay < endOfYear ? lastDay : endOfYear;

    let maanedligYdelse: number;
    if (year === skadesaar) {
      const aarligYdelseSkadesaar = ceilNearest12(FORSOERGERTABSPROCENT * benyttetAarsloen);
      maanedligYdelse = aarligYdelseSkadesaar / 12;
    } else {
      // OPREGULERINGSMETODE: ASL-årslønsmaksimum (idx[år] / idx[skadeår]) – jf.
      // `opregulerMedAslAarsloensmaksimum`. Beregnes direkte her, fordi løbende
      // ydelser også kan ligge FØR skadeåret (de-regulering med faktor < 1),
      // hvilket motorens "kun frem i tid"-clamp ikke dækker.
      const aarsloenMaxYear = resolveAslAarsloensmaksimumForAar(year);
      if (aarsloenMaxYear === undefined) {
        throw new Error(`INVARIANT: aarsloenAslMax mangler for år ${year} – burde være pre-valideret`);
      }
      const opreguleretAarligYdelseForAar = ceilNearest12(FORSOERGERTABSPROCENT * benyttetAarsloen * (aarsloenMaxYear / aarsloenMaxSkadesaar));
      maanedligYdelse = opreguleretAarligYdelseForAar / 12;
    }

    const fromYear = isoYear(fromDate);
    const fromMonth = Number(fromDate.slice(5, 7));
    const fromDay = Number(fromDate.slice(8, 10));
    const toYear = isoYear(toDate);
    const toMonth = Number(toDate.slice(5, 7));
    const toDay = Number(toDate.slice(8, 10));

    let maaneder: number;
    if (fromYear === toYear && fromMonth === toMonth) {
      maaneder = (toDay - fromDay + 1) / daysInMonth(fromYear, fromMonth);
    } else {
      const firstPartial = (daysInMonth(fromYear, fromMonth) - fromDay + 1) / daysInMonth(fromYear, fromMonth);
      const lastPartial = toDay / daysInMonth(toYear, toMonth);
      const fullMonths = ((toYear - fromYear) * 12 + (toMonth - fromMonth) - 1);
      maaneder = firstPartial + fullMonths + lastPartial;
    }

    maaneder = round4(maaneder);
    const ydelseIAlt = round0(maanedligYdelse * maaneder);

    rows.push({
      fraDato: fromDate,
      tilDato: toDate,
      maaneder,
      maanedligYdelse,
      ydelseIAlt,
    });

    fromDate = startOfYearIso(year + 1);
  }

  return rows;
};

/**
 * De issues, der alene betyder «brugeren har ikke udfyldt feltet endnu».
 *
 * Motoren mærker ALLE sine issues `severity: 'error'` – også disse – så severity kan ikke bruges til at
 * skelne «mangler» fra «er forkert». Gaten har brug for netop den skelnen: en tom ASL-sektion er en
 * LEGITIM sag (brugeren regner kun EAL-delen), mens et afvist opslag i kapitaliseringstabellen er en
 * halv beregning, der ikke må trykkes. Uden sættet ville en fail-closed gate på severity spærre den
 * almindeligste gyldige sag på fladen.
 *
 * Sættet er eksporteret, så gaten læser motorens egen liste frem for at gentage ID'erne.
 */
export const FORSOERGERTAB_MISSING_INPUT_ISSUE_IDS: ReadonlySet<string> = new Set([
  'asl-aarsloen-missing',
  'skadedato-missing',
  'beregningsdato-missing',
  'virkningsdato-missing',
  'efterladte-fodselsdato-missing',
  'tilkendt-for-periode-missing',
  'skadelidte-fodselsdato-missing',
  'missing-koen',
]);

export const computeForsoergertabAslYdelser = (input: Input): ForsoergertabAslResult => {
  const issues: EetIssue[] = [];

  const aslAarsloen = amountValueToNumber(input.aslAarsloen);
  if (aslAarsloen === undefined) {
    issues.push(toIssue('asl-aarsloen-missing', `${SKADELIDTES_AARSLOEN_ASL_LABEL} er ikke udfyldt.`));
  } else if (aslAarsloen <= 0) {
    // Persistence accepterer fortegnet som canonical syntaks; domænegaten skal
    // derfor eksplicit blokere både nul og negative beløb.
    issues.push(toIssue('asl-aarsloen-zero', `${SKADELIDTES_AARSLOEN_ASL_LABEL} skal være større end 0 kr.`));
  }

  if (!input.skadedato) {
    issues.push(toIssue(
      'skadedato-missing',
      `${resolveStamdataDatoReference(input.skadestype).label} er ikke udfyldt.`
    ));
  }
  if (!input.beregningsdato) issues.push(toIssue('beregningsdato-missing', 'Beregningsdato er ikke udfyldt.'));
  if (!input.virkningsdato) issues.push(toIssue('virkningsdato-missing', 'Virkningsdato er ikke udfyldt.'));
  if (!input.efterladteFodselsdato) {
    issues.push(toIssue('efterladte-fodselsdato-missing', 'Efterladtes fødselsdato er ikke udfyldt.'));
  }
  if (input.tilkendtForPeriodeAar === undefined) {
    issues.push(toIssue('tilkendt-for-periode-missing', 'Tilkendt periode er ikke udfyldt.'));
  } else if (!Number.isInteger(input.tilkendtForPeriodeAar)) {
    issues.push(toIssue('tilkendt-for-periode-invalid', 'Tilkendt periode skal være et heltal.'));
  } else if (input.tilkendtForPeriodeAar < 1) {
    issues.push(toIssue('tilkendt-for-periode-invalid', 'Tilkendt periode skal være mindst 1 år.'));
  } else if (input.tilkendtForPeriodeAar > 10) {
    issues.push(toIssue('tilkendt-for-periode-invalid', 'Tilkendt periode må højst være 10 år.'));
  }
  if (input.beregningsdato && input.virkningsdato && input.beregningsdato < input.virkningsdato) {
    issues.push(toIssue('beregningsdato-before-virkningsdato', 'Beregningsdato må ikke være før virkningsdato.'));
  }

  const usesKoen = input.beregningsdato !== undefined && input.beregningsdato < SKAERING_2015_03_01;
  if (usesKoen && !input.koen) {
    issues.push(toIssue('missing-koen', 'Ved beregning før 1. marts 2015 skal køn angives.'));
  }

  if (
    issues.some((issue) => issue.severity === 'error') ||
    !input.skadedato ||
    !input.beregningsdato ||
    !input.virkningsdato ||
    !input.efterladteFodselsdato ||
    input.tilkendtForPeriodeAar === undefined ||
    aslAarsloen === undefined
  ) {
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const skadesaar = isoYear(input.skadedato);
  const beregningsaar = isoYear(input.beregningsdato);
  const aarsloenMaxSkadesaar = resolveAslAarsloensmaksimumForAar(skadesaar);
  const aarsloenMaxBeregningsaar = resolveAslAarsloensmaksimumForAar(beregningsaar);
  if (aarsloenMaxSkadesaar === undefined) {
    issues.push(toIssue('aarsloen-max-missing-skadesaar', formatAslAarsloensmaksimumMissing(skadesaar)));
  }
  if (aarsloenMaxBeregningsaar === undefined) {
    issues.push(toIssue('aarsloen-max-missing-beregningsaar', formatAslAarsloensmaksimumMissing(beregningsaar)));
  }
  if (
    issues.length > 0 ||
    aarsloenMaxSkadesaar === undefined ||
    aarsloenMaxBeregningsaar === undefined
  ) {
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const virkningsaar = isoYear(input.virkningsdato);

  for (let yr = virkningsaar; yr < beregningsaar; yr++) {
    if (yr === skadesaar) continue;
    const aarsloenMaxForYear = resolveAslAarsloensmaksimumForAar(yr);
    if (aarsloenMaxForYear === undefined) {
      issues.push(toIssue('aarsloen-max-missing-beregningsaar', formatAslAarsloensmaksimumMissing(yr)));
    }
  }
  if (issues.length > 0) {
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const aslAarsloenMaxIssue = validateAslAarsloenBySkadesaarMax(aslAarsloen, input.skadedato, input.skadestype);
  if (aslAarsloenMaxIssue !== undefined) {
    // Readeren viser normalt samme regel som feltfejl. Dette værn holder også
    // direkte motoropslag fail-closed i stedet for at reducere input stiltiende.
    issues.push(toIssue('asl-aarsloen-over-max', aslAarsloenMaxIssue));
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const aslAarsloenAfrundet1000 = roundNearest1000(aslAarsloen);
  const benyttetAarsloen = aslAarsloenAfrundet1000;
  // OPREGULERINGSMETODE: ASL-årslønsmaksimum (idx[beregningsår] / idx[skadeår]).
  const opreguleringsfaktor = opregulerMedAslAarsloensmaksimum({ kildeAar: skadesaar, maalAar: beregningsaar }).faktor;
  const opreguleretAarligYdelse = round2(FORSOERGERTABSPROCENT * benyttetAarsloen * opreguleringsfaktor);
  const lobendeYdelser = computeLobendeYdelser(
    input.virkningsdato,
    input.beregningsdato,
    input.tilkendtForPeriodeAar,
    benyttetAarsloen,
    skadesaar,
    aarsloenMaxSkadesaar,
  );
  const aslLobendeYdelserTotal = lobendeYdelser.reduce((sum, r) => sum + r.ydelseIAlt, 0);

  // TÆLLEMETODE: dagbaseret optjening (udviklerens afgørelse 2026-09-04, brugerblik-spørgsmål fra flade 10).
  // De allerede udbetalte måneder ER summen af tabellens egne månedstal – ikke en parallel optælling af
  // hele kalendermåneder. Fladens to halvdele havde før hver sin læsning: tabellen værdiansatte dag for dag
  // (fx 60,7323 mdr.), mens kapitalfaktoren talte hele kalendermåneder inklusive begge ender (62 mdr.), så
  // de samme udbetalinger gav to forskellige tal i samme opgørelse. Ved at læse tabellens sum kan de to
  // ikke længere drifte: ændres periodiseringen, følger den resterende periode med.
  const alleredeUdbetaltMaaneder = round4(lobendeYdelser.reduce((sum, r) => sum + r.maaneder, 0));
  const samletMaaneder = input.tilkendtForPeriodeAar * 12;
  const resterendeMaanederTotal = Math.max(0, round4(samletMaaneder - alleredeUdbetaltMaaneder));
  // Kapitaliseringstabellen slår op på HELE år og måneder, så den dagbaserede rest afkortes her – og kun
  // her. `resterendeMaanederTotal` bevarer decimalerne, så visningen kan sige hvad der faktisk er tilbage.
  const resterendeAar = roundByMethod(resterendeMaanederTotal / 12, 0, 'floor');
  const resterendeMaaneder = roundByMethod(resterendeMaanederTotal % 12, 0, 'floor');

  const kapitaliseringsbekendtgoerelseId = resolveKapitaliseringsbekendtgoerelseId(input.skadedato, input.beregningsdato);
  if (!kapitaliseringsbekendtgoerelseId) {
    issues.push(toIssue('kapitaliseringsbekendtgoerelse-missing', 'Der kan ikke findes relevant kapitaliseringsbekendtgørelse.'));
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const tabeldata = getKapitaliseringsTabelData(kapitaliseringsbekendtgoerelseId);
  if (!tabeldata) {
    issues.push(toIssue('kapitaliseringstabeldata-missing', 'Kapitaliseringsdata mangler for den relevante bekendtgørelse.'));
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  // Efterladtes folkepensionsalder følger direkte af den centrale kilde – ikke af et EET-tabelvalg.
  const folkepensionAlder = getFolkepensionAlder(input.efterladteFodselsdato, input.beregningsdato);
  if (!folkepensionAlder) {
    issues.push(toIssue('folkepensionsalder-unresolved', 'Folkepensionsalder kan ikke fastlægges fra de centrale satser.'));
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const alder = calculateAgeYearsMonths(input.efterladteFodselsdato, input.beregningsdato);
  if (!alder) {
    issues.push(toIssue('forsoergertab-alder-unresolved', 'Efterladtes alder kan ikke beregnes på beregningsdatoen.'));
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const harNaaetFolkepensionsalder = alder.totalMonths >= folkepensionAlder.alderMaaneder;

  let kapitaliseringsTabel: string | null = null;
  let kapitalfaktor: number | null = null;

  if (!harNaaetFolkepensionsalder && resterendeMaanederTotal > 0) {
    const forsoergertabTabel = resolveForsoergertabRows(tabeldata, input.skadedato, usesKoen, input.koen);
    if (!forsoergertabTabel) {
      issues.push(toIssue('forsoergertab-tabel-missing', 'Der kan ikke findes relevant forsørgertabstabel.'));
      return { issues: dedupeIssuesByIdentity(issues), computation: null };
    }
    kapitaliseringsTabel = forsoergertabTabel.tabel;

    const ageRow = resolveAgeRow(forsoergertabTabel.rows, alder.years);
    if (!ageRow) {
      issues.push(toIssue('forsoergertab-alder-missing', `Der findes ingen aldersrække for ${alder.years} år i tabel ${kapitaliseringsTabel}.`));
      return { issues: dedupeIssuesByIdentity(issues), computation: null };
    }

    kapitalfaktor = interpolateKapitalfaktor(ageRow, resterendeAar, resterendeMaaneder);
    if (kapitalfaktor === null) {
      issues.push(toIssue('forsoergertab-faktor-unresolved', 'Kapitalfaktoren kan ikke beregnes ud fra den resterende periode.'));
      return { issues: dedupeIssuesByIdentity(issues), computation: null };
    }
  }

  const kapitalbelob =
    harNaaetFolkepensionsalder || resterendeMaanederTotal === 0 || kapitalfaktor === null
      ? 0
      : ceil0(opreguleretAarligYdelse * kapitalfaktor);

  const computation: ForsoergertabAslComputation = {
    skadedato: input.skadedato,
    beregningsdato: input.beregningsdato,
    virkningsdato: input.virkningsdato,
    efterladteFodselsdato: input.efterladteFodselsdato,
    skadesaar,
    beregningsaar,
    koen: input.koen,
    aslAarsloen,
    aslAarsloenAfrundet1000,
    benyttetAarsloen,
    aarsloenMaxSkadesaar,
    aarsloenMaxBeregningsaar,
    opreguleringsfaktor,
    opreguleretAarligYdelse,
    samletMaaneder,
    alleredeUdbetaltMaaneder,
    resterendeMaanederTotal,
    resterendeAar,
    resterendeMaaneder,
    kapitaliseringsbekendtgoerelseId,
    kapitaliseringsTabel,
    kapitaliseringsTabelKoensopdelt: usesKoen,
    alderHeleAar: alder.years,
    folkepensionsalderLabel: folkepensionAlder.alderLabel,
    folkepensionsalderMaaneder: folkepensionAlder.alderMaaneder,
    harNaaetFolkepensionsalder,
    kapitalfaktor,
    kapitalbelob,
    lobendeYdelser,
    aslLobendeYdelserTotal,
  };

  return { issues: dedupeIssuesByIdentity(issues), computation };
};
