import type { ErhvervsevnetabComposedValues } from '../../schemas/formSchemas';
import type { Forligsgrad } from '../erstatningsopgoerelse/engines/forligsgrad';
import type { EetIssue } from './eetTypes';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
// Disse tabeller importeres direkte fordi computeEetDifferencekravCalculation selv kører
// sub-beregningerne for fane 3 og 4 og sender dem videre som parametre. Dette bryder
// parametrerings-mønsteret i de øvrige beregningsfunktioner, men er en bevidst trade-off:
// differencekrav-beregningen er det naturlige aggregeringspunkt og kalder selv de andre.
import {
  aarsloenAslMax,
  erhvervsevnetabEalMax,
  reguleringssats,
  reguleringsprocentErhvervsevnetabFoer2024,
} from '../../data/lovbestemteRates';
import { getDagenFoerFolkepensionsdato } from '../../data/folkepensionAlderRates';
import { getKapitaliseringsTabelData } from '../../data/kapitalisering/kapitaliseringsTabeller';
import { formatISOToDanish } from '../../utils/dateFormatting';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import { getDayBeforeIso, isoYear } from '../../utils/isoDateHelpers';
import { parseCommittedPercent } from './eetAslAfgoerelser';
import {
  calculateAgeYearsMonths,
  interpolateFactorBeyondTable,
  interpolateFactorWithinTable,
  resolveFactorTable,
  isUnderOrEqualTwoYearsToFpByBekendtgoerelse,
  resolveKapitaliseringsbekendtgoerelseId,
  resolveKapitaliseringTabelvalg,
  resolveSaerfaktor,
} from './eetKapitaliseringOpslag';
import { ceil0, ceilNearest12, round0, round2, round3 } from '../../utils/roundingShortcuts';
import { SKAERING_2007_07_01, SKAERING_2011_01_01, SKAERING_2011_06_16, SKAERING_2015_03_01, SKAERING_2024_07_01 } from './eetSkaeringsdatoer';
import { computeEetLoebendeYdelser } from './eetLoebendeYdelserCalculation';
import { computeEetEalCalculation } from './eetEalCalculation';
import {
  computeEetKapitaliseringCalculation,
  resolveKapitaliseringAarsydelseBreakdown,
  WARN_NO_KAP_INPUT_ID,
} from './eetKapitaliseringCalculation';
import {
  computeMerErstatningPensionsalder,
  type MerErstatningPensionsalderComputation,
} from './eetMerErstatningPensionsalderCalculation';
import { hasTextValue } from './eetAslAfgoerelser';
import { sumMaanedsbroekForInterval } from '../dates/maanedsbroek';
import { resolveAslReguleringRateForSatsAar } from './eetReguleringRater';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EetDifferencekravLoebendeAfgoerelse = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  virkningsdato: ISODateString;
  afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig';
  eetPct: number;
  fradragesTil: ISODateString;
  beloeb: number;
  fradragForetages: boolean;
  // Sat når en midlertidig afgørelse gøres endelig med tilbagevirkende kraft (toggle):
  // dens egen løbende ydelse fradrages fra den endelige afgørelses virkningsdato og frem.
  // null når reglen ikke gælder for rækken.
  tilbagevirkendeKraftFradrag: EetDifferencekravTilbagevirkendeKraftFradrag | null;
}>;

export type EetDifferencekravTilbagevirkendeKraftFradrag = Readonly<{
  // Den endelige afgørelses virkningsdato — fradraget løber herfra og frem.
  endeligVirkningsdato: ISODateString;
  fra: ISODateString;
  til: ISODateString;
  beloeb: number;
}>;

export type EetDifferencekravKapitaliseretAfgoerelse = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  // null = ikke kapitaliseret
  kapitaliseringsdato: ISODateString | null;
  kapitaliseringspct: number | null;
  kapitalbelob: number | null;
  // true = kapitalisering er angivet, men datoen er efter beregningsdatoen og medregnes ikke
  kapitaliseringEfterBeregningsdato: boolean;
}>;

export type EetDifferencekravProformaKapitalisering = Readonly<{
  loebendeEetPct: number;
  kapitaliseringsdato: ISODateString;
  grundloen: number;
  erstatningsniveauPct: number;
  amBidragPct: number;
  grundydelse: number;
  grundydelse2024: number | null;
  opreguleringTil2024PctRounded4: number | null;
  aarsydelseGrundlag: number;
  aarsydelseReguleringsPctRounded4: number | null;
  aarsydelse: number;
  kapitaliseringsbekendtgoerelseLabel: string;
  folkepensionsalderLabel: string;
  alderAar: number;
  alderMaaneder: number;
  kapitaliseretPgaUnderToAarTilFp: boolean;
  faktorMaanedsAfhaengig: boolean;
  saerfaktor: number | null;
  kapitaliseringsfaktor: number;
  proformaBeloeb: number;
  koenOpdelt: boolean;
}>;

export type EetDifferencekravResterendeLoebendeYdelser = Readonly<{
  loebendeEetPct: number;
  beregningsdato: ISODateString;
  dagenFoerFolkepensionsdato: ISODateString;
  aarsydelse: number;
  maanedligYdelse: number;
  tilbageraevendeMaaneder: number;
  fradragBeloeb: number;
}>;

export type EetDifferencekravComputation = Readonly<{
  beregningsdato: ISODateString;
  skadedato: ISODateString;
  dagFoerBeregningsdato: ISODateString;
  // true = skadedato < 2011-06-16: fradrag for midlertidige/delvist endelige ydelser foretages
  fradragGaelderForFoer2011: boolean;
  ealKrav: number;
  ealEetPct: number;
  fradragLoebendeYdelser: number;
  fradragKapitaliseretEet: number;
  // Fradrag 3-invariant: højst ét af proformaKapitalisering og resterendeLoebendeYdelser må være non-null.
  proformaKapitalisering: EetDifferencekravProformaKapitalisering | null;
  resterendeLoebendeYdelser: EetDifferencekravResterendeLoebendeYdelser | null;
  // Fradrag 4: mer-erstatning ved forhøjet folkepensionsalder. null når toggle er fra,
  // eller ingen forhøjelse kvalificerer.
  merErstatningPensionsalder: MerErstatningPensionsalderComputation | null;
  // Differencekrav før forlig om ansvarsgrad anvendes (det fulde, ureducerede krav).
  differencekravFoerForlig: number;
  // Forlig om ansvarsgrad: faktor (< 1) og label ("2/3"/"50 %") når et gyldigt forlig under 100 %
  // er angivet. Ved intet forlig / 100 % er begge null, og differencekrav === differencekravFoerForlig.
  forligFactor: number | null;
  forligLabel: string | null;
  // Forligsdato (delt kilde med EO). Bruges kun til prosa-sætningen "Der er [den dato] indgået
  // forlig …". null når der ikke reduceres eller ingen dato er angivet.
  forligDato: ISODateString | null;
  // Endeligt differencekrav efter forlig om ansvarsgrad (= differencekravFoerForlig × forligFactor,
  // eller differencekravFoerForlig når der ikke reduceres).
  differencekrav: number;
  afgoerelser: readonly EetDifferencekravLoebendeAfgoerelse[];
  kapitaliseringerAfgoerelser: readonly EetDifferencekravKapitaliseretAfgoerelse[];
  // Sub-beregninger til brug i bilag-PDF'er
  loebendeComputation: import('./eetLoebendeYdelserCalculation').EetLoebendeComputation | null;
  kapComputation: import('./eetKapitaliseringCalculation').EetKapitaliseringComputation | null;
  ealComputation: import('./eetEalCalculation').EetEalComputation | null;
}>;

/** hasBlockingErrors er eksplicit her fordi differencekrav-fanen bruger den direkte;
 *  de øvrige faner udleder den fra issues.some(). */
export type EetDifferencekravCalculationResult = Readonly<{
  issues: readonly EetIssue[];
  computation: EetDifferencekravComputation | null;
  hasBlockingErrors: boolean;
}>;

type Input = Readonly<{
  erhvervsevnetab: ErhvervsevnetabComposedValues;
  skadedato: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
  // Beregnings-valgmulighed fra differencekrav-fanen (sagsdata på erhvervsevnetab-sektionen).
  // Injiceres eksplicit som parameter — beregningslaget læser aldrig form-state direkte.
  endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: boolean;
  // Beregnings-valgmulighed fra differencekrav-fanen (sagsdata). Når true fratrækkes
  // mer-erstatning ved forhøjet folkepensionsalder (fradrag 4) i differencekravet.
  indregnMerErstatningVedForhoejetPensionsalder: boolean;
  // Forlig om ansvarsgrad (delt kilde med EO-fanen). Når et gyldigt forlig under 100 % er angivet,
  // reduceres det endelige differencekrav med faktoren. `null`/udeladt = intet forlig / 100 % =
  // ingen reduktion. Ugyldigt forlig håndteres som blokerende fejl i eetSnapshot (ikke her).
  forlig?: Forligsgrad;
  // Forligsdato (delt kilde med EO) — kun til prosa-sætningen. Udeladt/undefined = ingen dato.
  forligDato?: ISODateString;
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toIssue = (id: string, message: string): EetIssue => ({ id, severity: 'error', message });
const toWarning = (id: string, message: string): EetIssue => ({ id, severity: 'warning', message });

type KnownAtBeregningsdatoAnalysis = Readonly<{
  hasAnyEnteredRows: boolean;
  hasAnyResolvedRows: boolean;
  hasAnyKnownRows: boolean;
  issues: readonly EetIssue[];
}>;

const hasAnyEetPctInput = (values: ErhvervsevnetabComposedValues): boolean => {
  if (values.ealEetPct !== undefined && values.ealEetPct !== 0) {
    return true;
  }
  return (values.aslAfgoerelser ?? []).some((row) => {
    const eetPct = parseCommittedPercent(row.eetPct);
    return eetPct !== undefined && eetPct !== 0;
  });
};

const filterAslRowsKnownAtBeregningsdato = (
  rows: readonly ErhvervsevnetabComposedValues['aslAfgoerelser'][number][],
  beregningsdato: ISODateString | undefined
): readonly ErhvervsevnetabComposedValues['aslAfgoerelser'][number][] => {
  if (!beregningsdato) return rows;
  return rows.filter((row) => {
    const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
    const virkningsdato = coerceToISODateString(row.virkningsDato);
    // Fane 5 afgrænser kun på virkningsdato. Afgørelsesdatoen kan godt ligge efter beregningsdatoen
    // uden at afskære beregningen, men rækken skal stadig være en gyldig afgørelse med begge datoer.
    if (afgoerelsesdato === undefined || virkningsdato === undefined) return false;
    return virkningsdato <= beregningsdato;
  });
};

const analyzeAslRowsAtBeregningsdato = (
  rows: readonly ErhvervsevnetabComposedValues['aslAfgoerelser'][number][],
  beregningsdato: ISODateString | undefined
): KnownAtBeregningsdatoAnalysis => {
  const issues: EetIssue[] = [];
  let hasAnyEnteredRows = false;
  let hasAnyResolvedRows = false;
  let hasAnyKnownRows = false;
  let hasAfgoerelsesdatoAfterBeregningsdato = false;
  let hasVirkningsdatoAfterBeregningsdato = false;
  let hasKapDatoAfterBeregningsdato = false;

  for (const row of rows) {
    const rowHasAnyInput =
      hasTextValue(row.afgoerelsesDato) ||
      hasTextValue(row.virkningsDato) ||
      hasTextValue(row.eetPct) ||
      hasTextValue(row.kapDato) ||
      hasTextValue(row.kapPct) ||
      row.afgoerelseType !== undefined;
    if (!rowHasAnyInput) continue;
    hasAnyEnteredRows = true;

    const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
    const virkningsdato = coerceToISODateString(row.virkningsDato);
    const kapDato = coerceToISODateString(row.kapDato);
    const eetPct = parseCommittedPercent(row.eetPct);

    if (!afgoerelsesdato || !virkningsdato || !row.afgoerelseType || eetPct === undefined || eetPct <= 0) {
      continue;
    }

    hasAnyResolvedRows = true;

    if (beregningsdato && afgoerelsesdato > beregningsdato) {
      hasAfgoerelsesdatoAfterBeregningsdato = true;
    }
    if (beregningsdato && virkningsdato > beregningsdato) {
      hasVirkningsdatoAfterBeregningsdato = true;
    }
    if (beregningsdato && kapDato !== undefined && kapDato > beregningsdato) {
      hasKapDatoAfterBeregningsdato = true;
    }
    if (!beregningsdato || virkningsdato <= beregningsdato) {
      hasAnyKnownRows = true;
    }
  }

  if (!hasAnyResolvedRows) {
    issues.push(toIssue('asl-afgoerelser-empty', 'Ingen ASL-afgørelser er indtastet'));
  }
  if (hasAnyResolvedRows && !hasAnyKnownRows) {
    issues.push(toIssue('no-asl-afgoerelser-known-at-beregningsdato', 'Der er ingen ASL-afgørelser med virkningsdato på eller før beregningsdatoen'));
    return {
      hasAnyEnteredRows,
      hasAnyResolvedRows,
      hasAnyKnownRows,
      issues,
    };
  }
  if (hasAfgoerelsesdatoAfterBeregningsdato) {
    issues.push(toWarning('warn-afgoerelsesdato-after-beregningsdato', 'Der er angivet en afgørelsesdato efter beregningsdatoen'));
  }
  if (hasVirkningsdatoAfterBeregningsdato) {
    issues.push(toWarning('warn-virkningsdato-after-beregningsdato', 'Der er angivet en virkningsdato efter beregningsdatoen'));
  }
  if (hasKapDatoAfterBeregningsdato) {
    issues.push(toWarning('warn-kap-dato-after-beregningsdato', 'Der er angivet en kapitaliseringsdato efter beregningsdatoen'));
  }
  return {
    hasAnyEnteredRows,
    hasAnyResolvedRows,
    hasAnyKnownRows,
    issues,
  };
};

// ─── Proforma-kapitalisering ──────────────────────────────────────────────────

const computeProformaKapitalisering = (
  args: Readonly<{
    loebendeEetPct: number;
    beregningsdato: ISODateString;
    skadedato: ISODateString;
    fodselsdato: ISODateString;
    grundloen: number;
    erstatningsniveau: number;
    amFaktor: number;
    before2024Skade: boolean;
    koen: ErhvervsevnetabComposedValues['koen'];
  }>,
  issues: EetIssue[]
): EetDifferencekravProformaKapitalisering | null => {
  const { loebendeEetPct, beregningsdato, skadedato, fodselsdato } = args;

  if (!args.koen && beregningsdato < SKAERING_2015_03_01) {
    issues.push(toIssue('missing-koen', 'Ved beregning før 1. marts 2015 skal køn angives'));
    return null;
  }

  const controlBekId = resolveKapitaliseringsbekendtgoerelseId(skadedato, beregningsdato);
  if (!controlBekId) {
    issues.push(toIssue(
      'proforma-kapitaliseringsbekendtgoerelse-missing',
      `Der findes ingen gyldig kapitaliseringsbekendtgørelse for beregningsdatoen ${formatISOToDanish(beregningsdato)}.`
    ));
    return null;
  }

  const tabeldata = getKapitaliseringsTabelData(controlBekId);
  if (!tabeldata) {
    issues.push(toIssue(
      'proforma-kapitaliseringsbekendtgoerelse-missing',
      `Kapitaliseringsdata mangler for ${controlBekId}.`
    ));
    return null;
  }

  const tabelvalg = resolveKapitaliseringTabelvalg(tabeldata, skadedato, fodselsdato, beregningsdato);
  if (!tabelvalg) {
    issues.push(toIssue(
      'proforma-kapitaliseringstabel-missing',
      'Ingen kapitaliseringstabel matcher skadedato og fødselsdato på beregningsdatoen'
    ));
    return null;
  }

  const age = calculateAgeYearsMonths(fodselsdato, beregningsdato);
  if (!age) {
    issues.push(toIssue('proforma-kapitaliseringsfaktor-unresolved', 'Alder kan ikke beregnes på beregningsdatoen'));
    return null;
  }

  const saerfaktor = resolveSaerfaktor(tabeldata, skadedato);
  const useDirectSaerfaktor = tabelvalg.folkepensionsalderMaaneder - age.totalMonths <= 24;
  let kapitaliseringsfaktor: number | null = null;
  let kapitaliseretPgaUnderToAarTilFp = false;
  let koenOpdelt = false;
  const faktorMaanedsAfhaengig = skadedato >= SKAERING_2007_07_01;

  if (useDirectSaerfaktor) {
    if (saerfaktor === null) {
      issues.push(toIssue(
        'proforma-kapitaliseringsfaktor-unresolved',
        'Særfaktor mangler for proformakapitalisering under 2 år til folkepension'
      ));
      return null;
    }
    kapitaliseringsfaktor = round3(saerfaktor);
    kapitaliseretPgaUnderToAarTilFp = true;
  } else {
    const factorTableResult = resolveFactorTable(tabeldata, tabelvalg.tabel, args.koen);
    koenOpdelt = factorTableResult.koenOpdelt;
    const factorRows = factorTableResult.rows;
    if (!factorRows || factorRows.length === 0) {
      if (factorTableResult.reason === 'missing-koen') {
        issues.push(toIssue('missing-koen', 'Ved kapitalisering før 1. marts 2015 skal køn angives'));
      } else {
        issues.push(toIssue('proforma-kapitaliseringstabel-missing', `Ingen kapitaliseringsfaktorer for tabel ${tabelvalg.tabel}.`));
      }
      return null;
    }

    const minAge = factorRows[0]?.alder;
    if (minAge === undefined || age.years < minAge) {
      issues.push(toIssue(
        'proforma-kapitaliseringsalder-under-minimum',
        `Ingen kapitaliseringsfaktor for alder (${age.years} år, ${age.months} mdr.) — tabellen starter ved ${minAge} år.`
      ));
      return null;
    }

    const withinTable = interpolateFactorWithinTable(factorRows, age, faktorMaanedsAfhaengig);
    if (withinTable !== null) {
      kapitaliseringsfaktor = round3(withinTable);
    } else {
      const maxAge = factorRows[factorRows.length - 1]?.alder;
      const isBeyondLastWholeYearInMonthDependentTable =
        faktorMaanedsAfhaengig &&
        maxAge !== undefined &&
        age.years === maxAge &&
        age.months > 0;
      if (maxAge !== undefined && age.years <= maxAge && !isBeyondLastWholeYearInMonthDependentTable) {
        issues.push(toIssue(
          'proforma-kapitaliseringsfaktor-unresolved',
          `Ingen kapitaliseringsfaktor for alder (${age.years} år, ${age.months} mdr.) i tabel ${tabelvalg.tabel}.`
        ));
        return null;
      }
      if (saerfaktor === null) {
        issues.push(toIssue(
          'proforma-kapitaliseringsfaktor-unresolved',
          'Kapitaliseringsfaktor kan ikke beregnes, fordi særfaktor mangler'
        ));
        return null;
      }
      const beyondTable = interpolateFactorBeyondTable(factorRows, age, tabelvalg.folkepensionsalderMaaneder, saerfaktor, faktorMaanedsAfhaengig);
      if (beyondTable === null) {
        issues.push(toIssue(
          'proforma-kapitaliseringsfaktor-unresolved',
          `Kapitaliseringsfaktor kan ikke beregnes for alder (${age.years} år, ${age.months} mdr.).`
        ));
        return null;
      }
      kapitaliseringsfaktor = round3(beyondTable);
    }
  }

  const kapitaliseringsaar = isoYear(beregningsdato);
  const aarsydelseBreakdown = resolveKapitaliseringAarsydelseBreakdown(
    {
      grundloen: args.grundloen,
      kapitaliseringspct: loebendeEetPct,
      erstatningsniveau: args.erstatningsniveau,
      amFaktor: args.amFaktor,
      kapitaliseringsaar,
      before2024Skade: args.before2024Skade,
    },
    issues
  );
  if (!aarsydelseBreakdown || kapitaliseringsfaktor === null) return null;

  const proformaBeloeb = ceil0(aarsydelseBreakdown.aarsydelse * kapitaliseringsfaktor);
  const typeLabel = tabeldata.kapitaliseringsType === 'vejl' ? 'Vejl.' : 'Bkg.';

  return {
    loebendeEetPct,
    kapitaliseringsdato: beregningsdato,
    grundloen: args.grundloen,
    erstatningsniveauPct: round0(args.erstatningsniveau * 100),
    amBidragPct: round0((1 - args.amFaktor) * 100),
    grundydelse: aarsydelseBreakdown.grundydelse,
    grundydelse2024: aarsydelseBreakdown.grundydelse2024,
    opreguleringTil2024PctRounded4: aarsydelseBreakdown.opreguleringTil2024PctRounded4,
    aarsydelseGrundlag: aarsydelseBreakdown.aarsydelseGrundlag,
    aarsydelseReguleringsPctRounded4: aarsydelseBreakdown.aarsydelseReguleringsPctRounded4,
    aarsydelse: aarsydelseBreakdown.aarsydelse,
    kapitaliseringsbekendtgoerelseLabel: `${typeLabel} ${controlBekId}, tabel ${tabelvalg.tabel}`,
    folkepensionsalderLabel: tabelvalg.folkepensionsalderLabel,
    alderAar: age.years,
    alderMaaneder: age.months,
    kapitaliseretPgaUnderToAarTilFp,
    faktorMaanedsAfhaengig,
    saerfaktor,
    kapitaliseringsfaktor,
    proformaBeloeb,
    koenOpdelt,
  };
};

const computeResterendeLoebendeYdelser = (
  args: Readonly<{
    loebendeEetPct: number;
    beregningsdato: ISODateString;
    fodselsdato: ISODateString;
    grundloen: number;
    erstatningsniveau: number;
    amFaktor: number;
    before2024Skade: boolean;
  }>,
  issues: EetIssue[]
): EetDifferencekravResterendeLoebendeYdelser | null => {
  const dagenFoerFolkepensionsdato = getDagenFoerFolkepensionsdato(args.fodselsdato, args.beregningsdato);
  if (!dagenFoerFolkepensionsdato || args.beregningsdato > dagenFoerFolkepensionsdato) return null;

  const tilbageraevendeMaaneder = sumMaanedsbroekForInterval(
    args.beregningsdato,
    dagenFoerFolkepensionsdato
  );
  if (tilbageraevendeMaaneder <= 0) return null;

  const beregningsaar = isoYear(args.beregningsdato);
  const grundydelse = round2(
    args.grundloen * (args.loebendeEetPct / 100) * args.erstatningsniveau * args.amFaktor
  );
  const grundydelse2024 = args.before2024Skade
    ? round2(grundydelse * (1 + (reguleringsprocentErhvervsevnetabFoer2024[2024] ?? Number.NaN) / 100))
    : grundydelse;
  if (!Number.isFinite(grundydelse2024)) {
    issues.push(toIssue('reguleringssats-missing-2024', 'Reguleringssats mangler for år 2024'));
    return null;
  }

  const effektivGrundydelseBase = args.before2024Skade && beregningsaar >= 2024
    ? grundydelse2024
    : grundydelse;

  const rateInfo = resolveAslReguleringRateForSatsAar(beregningsaar, args.before2024Skade, issues);
  if (!rateInfo) return null;

  // Resterende løbende ydelser skal bruge samme års-/månedssatsprincip som fane 2,
  // ikke kapitaliseringsårssatsen. Årsydelsen rundes derfor op til et beløb deleligt med 12.
  const aarsydelse = ceilNearest12(effektivGrundydelseBase * rateInfo.factor);
  const maanedligYdelse = aarsydelse / 12;
  const fradragBeloeb = round0(tilbageraevendeMaaneder * maanedligYdelse);

  return {
    loebendeEetPct: args.loebendeEetPct,
    beregningsdato: args.beregningsdato,
    dagenFoerFolkepensionsdato,
    aarsydelse,
    maanedligYdelse,
    tilbageraevendeMaaneder,
    fradragBeloeb,
  };
};

// ─── Beregning af løbende EET-pct der skal indgå i fradrag 3 ──────────────────

const resolveLoebendeEetPct = (
  afgoerelser: readonly {
    eetPct: number;
    afgoerelseType: string;
    afgoerelsesdato: ISODateString;
    virkningsdato: ISODateString;
  }[],
  // Kapitaliseringsdata fra råinput — filtreret på kap.dato <= beregningsdato,
  // så fremtidige kapitaliseringer ikke medregnes i rest-EET.
  kapitaliseringer: readonly { kapPct: number }[]
): number => {
  if (afgoerelser.length === 0) return 0;

  // Tie-breaking matches fane 4's resolveEetPctFromAslRows:
  // 1. Latest afgørelsesdato, 2. Latest virkningsdato, 3. Endelig > Delvist endelig > rest
  // Invariant: senestEetPct antages at være >= alle tidligere afgørelsers EET-procenter.
  // Domænet tillader ikke reduktion i EET-procent, så sumKapPct fratrukket senestEetPct
  // er altid >= 0 (clamped af Math.max). Hvis denne invariant brydes (f.eks. via en
  // afgørelse der sætter EET lavere end en tidligere) returneres 0, ikke negativt.
  const latestAfgoerelsesdato = afgoerelser.reduce<ISODateString>(
    (latest, a) => (a.afgoerelsesdato > latest ? a.afgoerelsesdato : latest),
    afgoerelser[0]!.afgoerelsesdato
  );

  const sameDate = afgoerelser.filter((a) => a.afgoerelsesdato === latestAfgoerelsesdato);

  const latestVirkningsdato = sameDate.reduce<ISODateString>(
    (latest, a) => (a.virkningsdato > latest ? a.virkningsdato : latest),
    sameDate[0]!.virkningsdato
  );

  const sameVirkningsdato = sameDate.filter((a) => a.virkningsdato === latestVirkningsdato);
  const endelig = sameVirkningsdato.filter((a) => a.afgoerelseType === 'Endelig');
  const delvist = sameVirkningsdato.filter((a) => a.afgoerelseType === 'Delvist endelig');
  const selected = endelig[0] ?? delvist[0] ?? sameVirkningsdato[0];
  if (!selected) return 0;

  const senestEetPct = selected.eetPct;
  const sumKapPct = kapitaliseringer.reduce((sum, k) => sum + k.kapPct, 0);
  return Math.max(0, senestEetPct - sumKapPct);
};

// ─── Bestemmer om fradrag for løbende ydelser foretages pr. afgørelse ─────────

const skalFradragForetages = (
  afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig',
  skadedato: ISODateString
): boolean => {
  if (skadedato < SKAERING_2011_06_16) return true;
  return afgoerelseType === 'Endelig';
};

// ─── Tilbagevirkende kraft: midlertidig gøres endelig (toggle) ─────────────────

type LoebendeAfgoerelseComputation =
  import('./eetLoebendeYdelserCalculation').EetLoebendeAfgoerelseComputation;

/**
 * Beregner det fradrag der opstår, når en endelig afgørelse med tilbagevirkende kraft
 * gør en tidligere midlertidig afgørelses løbende ydelse fradragsberettiget i differencekravet.
 *
 * Reglen (jf. docs/domain/eet/differencekrav.md):
 * - Gælder kun midlertidige afgørelser og kun skader >= 16-06-2011.
 * - Aktiveres når en endelig afgørelses virkningsdato ligger inden i den midlertidiges
 *   egen løbende-ydelsesperiode [virkningsdato, ophørDato].
 * - Fradraget = den midlertidiges egen løbende ydelse (dens egen rest-EET og sats, præcis
 *   som fane 2 har beregnet den) for delperioden [endeligVirkningsdato, midlertidigs ophør].
 *
 * Genbruger den midlertidiges allerede beregnede periode-rækker frem for at genberegne,
 * og recomputeer kun den eventuelle delperiode der krydser den endelige virkningsdato med
 * samme måneds-/afrundingsregel som kilden (round0(måneder × månedlig ydelse)).
 */
const computeTilbagevirkendeKraftFradrag = (
  midlertidig: LoebendeAfgoerelseComputation,
  endeligVirkningsdato: ISODateString
): EetDifferencekravTilbagevirkendeKraftFradrag | null => {
  // Den endelige virkningsdato skal ligge inden i den midlertidiges løbende periode.
  if (endeligVirkningsdato < midlertidig.virkningsdato || endeligVirkningsdato > midlertidig.ophoerDato) {
    return null;
  }

  let beloeb = 0;
  for (const row of midlertidig.perioder) {
    if (row.til < endeligVirkningsdato) continue;
    if (row.fra >= endeligVirkningsdato) {
      beloeb += row.beregnetEet;
      continue;
    }
    // Rækken krydser den endelige virkningsdato — medregn kun delen fra og med den dato.
    const maaneder = sumMaanedsbroekForInterval(endeligVirkningsdato, row.til);
    beloeb += round0(maaneder * row.maanedligYdelse);
  }

  if (beloeb <= 0) return null;

  return {
    endeligVirkningsdato,
    fra: endeligVirkningsdato,
    til: midlertidig.ophoerDato,
    beloeb,
  };
};

// ─── Beregning ────────────────────────────────────────────────────────────────

export const computeEetDifferencekravCalculation = (input: Input): EetDifferencekravCalculationResult => {
  const beregningsdato = coerceToISODateString(input.erhvervsevnetab.beregningsdato);
  const skadedato = input.skadedato;
  const fodselsdato = input.skadelidteFodselsdato;
  const hasAnyPctInput = hasAnyEetPctInput(input.erhvervsevnetab);
  const aslRowsAnalysis = analyzeAslRowsAtBeregningsdato(input.erhvervsevnetab.aslAfgoerelser, beregningsdato);
  const aslRowsKnownAtBeregningsdato = filterAslRowsKnownAtBeregningsdato(input.erhvervsevnetab.aslAfgoerelser, beregningsdato);
  const filteredErhvervsevnetab = {
    ...input.erhvervsevnetab,
    aslAfgoerelser: [...aslRowsKnownAtBeregningsdato],
  };

  // ─── Kør eal-beregning (fane 4) ───────────────────────────────────────────
  const ealResult = computeEetEalCalculation({
    erhvervsevnetab: filteredErhvervsevnetab,
    skadedato,
    skadelidteFodselsdato: fodselsdato,
    reguleringssats,
    erhvervsevnetabEalMax,
    aarsloenAslMax,
  });

  // ─── Kør kapitaliserings-beregning (fane 3) ───────────────────────────────
  const kapResult = computeEetKapitaliseringCalculation({
    erhvervsevnetab: filteredErhvervsevnetab,
    skadedato,
    skadelidteFodselsdato: fodselsdato,
  });

  // ─── Kør løbende ydelser med ophørsdato = beregningsdato − 1 dag ─────────
  let loebendeResult: ReturnType<typeof computeEetLoebendeYdelser> | null = null;
  let dagFoerBeregningsdato: ISODateString | null = null;

  if (beregningsdato) {
    const dayBefore = getDayBeforeIso(beregningsdato);
    if (dayBefore) {
      dagFoerBeregningsdato = dayBefore;
      loebendeResult = computeEetLoebendeYdelser({
        erhvervsevnetab: { ...filteredErhvervsevnetab, beregningsdato: dayBefore },
        skadedato,
        skadelidteFodselsdato: fodselsdato,
      });
    }
  }

  // ─── Aggreger issues fra fane 2, 3 og 4 ──────────────────────────────────
  const allSourceIssues: EetIssue[] = [];

  for (const issue of ealResult.issues) {
    allSourceIssues.push(issue);
  }
  for (const issue of kapResult.issues) {
    if (issue.id !== WARN_NO_KAP_INPUT_ID) allSourceIssues.push(issue);
  }
  if (loebendeResult) {
    for (const issue of loebendeResult.issues) {
      allSourceIssues.push(issue);
    }
  } else if (!beregningsdato) {
    allSourceIssues.push({ id: 'beregningsdato-missing', severity: 'error', message: 'Beregningsdato er ikke udfyldt.' });
  } else if (!dagFoerBeregningsdato) {
    allSourceIssues.push({ id: 'beregningsdato-invalid', severity: 'error', message: 'Beregningsdato er ugyldig.' });
  }

  // ─── Fradrag 3: rest-EET (issues indgår i blocking-evaluering) ───────────────
  // Rest-EET-beregningen kræver eal-computation og alle stamdata — kør kun hvis
  // disse forudsætninger er til stede, så vi undgår fejl-stacking ovenpå allerede
  // kendte blokerende fejl.
  const fradrag3Issues: EetIssue[] = [];
  let proformaKapitalisering: EetDifferencekravProformaKapitalisering | null = null;
  let resterendeLoebendeYdelser: EetDifferencekravResterendeLoebendeYdelser | null = null;
  let loebendeEetPct = 0;

  if (ealResult.computation && beregningsdato && skadedato && fodselsdato && dagFoerBeregningsdato) {
    const loebendeComputation = loebendeResult?.computation ?? null;

    const before2024Skade = skadedato < SKAERING_2024_07_01;
    const from2011 = skadedato >= SKAERING_2011_01_01;
    const erstatningsniveau = from2011 ? 0.83 : 0.8;
    const amFaktor = from2011 ? 0.92 : 1;
    // Grundlønnen genbruges fra fane 2's computation frem for at rekonstruere den lokalt.
    // Invariant: loebendeEetPct kan kun blive > 0 når loebendeComputation findes; ?? 0 er kun defensivt.
    const grundloen = loebendeComputation?.grundloen ?? 0;

    // Bestem løbende EET-pct til fradrag 3.
    // Afgørelseslisten hentes fra løbende-computation til tie-breaking (seneste afgørelse).
    // Kapitaliseringsprocenterne hentes fra fane 3's resolvede computation og filtreres:
    // kun kapitaliseringer med dato <= beregningsdato medregnes.
    const kapitaliseringerForProforma =
      kapResult.computation?.afgoerelser
        .filter((afgoerelse) => afgoerelse.kapitaliseringsdato <= beregningsdato && afgoerelse.kapitaliseringspct > 0)
        .map((afgoerelse) => ({ kapPct: afgoerelse.kapitaliseringspct })) ?? [];

    loebendeEetPct = loebendeComputation
      ? resolveLoebendeEetPct(loebendeComputation.afgoerelser, kapitaliseringerForProforma)
      : 0;

    if (loebendeEetPct > 0 && grundloen > 0) {
      const beregningUnderEllerLigeToAarTilFp = isUnderOrEqualTwoYearsToFpByBekendtgoerelse(
        skadedato,
        fodselsdato,
        beregningsdato
      );

      if (beregningUnderEllerLigeToAarTilFp) {
        resterendeLoebendeYdelser = computeResterendeLoebendeYdelser(
          {
            loebendeEetPct,
            beregningsdato,
            fodselsdato,
            grundloen,
            erstatningsniveau,
            amFaktor,
            before2024Skade,
          },
          fradrag3Issues
        );
      } else {
        proformaKapitalisering = computeProformaKapitalisering(
          {
            loebendeEetPct,
            beregningsdato,
            skadedato,
            fodselsdato,
            grundloen,
            erstatningsniveau,
            amFaktor,
            before2024Skade,
            koen: input.erhvervsevnetab.koen,
          },
          fradrag3Issues
        );
      }
    }
  }

  // Fradrag 3-issues merges ind før blocking-evaluering, så fejl i rest-EET-beregningen
  // blokerer download på linje med fejl fra fane 2, 3 og 4.
  for (const issue of fradrag3Issues) {
    allSourceIssues.push(issue);
  }

  // 'no-endelig-afgoerelser' er kun relevant på fane 3 og filtreres altid væk fra fane 5.
  // F5 kan opgøre rest-EET som fradrag 3 uafhængigt af om der tidligere er foretaget kapitalisering.
  const deduped = dedupeIssuesBySeverityAndMessage(allSourceIssues)
    .filter((issue) => {
      if (issue.id === 'no-endelig-afgoerelser') return false;
      if (
        issue.id === 'warn-afgoerelsesdato-after-beregningsdato' ||
        issue.id === 'warn-virkningsdato-after-beregningsdato' ||
        issue.id === 'warn-kap-dato-after-beregningsdato'
      ) {
        return false;
      }
      // Decision note:
      // Reason: differencekrav filtrerer beregningsgrundlaget til afgørelser med virkning på eller før beregningsdatoen.
      // Den generiske "Ingen ASL-afgørelser er indtastet" må i differencekrav kun afhænge af, om der findes
      // nogen gyldige afgørelser overhovedet. Underberegningernes tom-tabel-fejl er derfor misvisende her,
      // fordi de udløses efter beregningsdato-filteret.
      // Risk: hvis underberegninger senere får flere "tom input"-fejl, skal denne afgrænsning genbesøges.
      if (issue.id === 'asl-afgoerelser-empty') return false;
      return true;
    });
  const dedupedWithKnownAtBeregningsdatoIssues = dedupeIssuesBySeverityAndMessage([
    ...deduped,
    ...aslRowsAnalysis.issues,
  ]);
  const hasAslAfgoerelserEmpty = dedupedWithKnownAtBeregningsdatoIssues.some((issue) => issue.id === 'asl-afgoerelser-empty');
  // 'eet-pct-missing' undertrykkes når afgørelsestabellen er tom.
  // Ellers vises både den generelle tom-tabel-fejl og den afledte feltfejl for samme rodproblem.
  const aggregatedIssues = hasAslAfgoerelserEmpty
    ? dedupedWithKnownAtBeregningsdatoIssues.filter((issue) => issue.id !== 'eet-pct-missing')
    : dedupedWithKnownAtBeregningsdatoIssues;
  const finalIssues = hasAnyPctInput
    ? aggregatedIssues.filter((issue) => issue.id !== 'eet-pct-missing')
    : aggregatedIssues;

  const blockingErrors = finalIssues.filter((issue) => issue.severity === 'error');

  const hasBlockingErrors = blockingErrors.length > 0;

  if (hasBlockingErrors || !ealResult.computation || !beregningsdato || !skadedato || !fodselsdato || !dagFoerBeregningsdato) {
    return { issues: finalIssues, computation: null, hasBlockingErrors };
  }

  const loebendeComputation = loebendeResult?.computation ?? null;

  // ─── Fradrag 1: Løbende ydelser ───────────────────────────────────────────
  const ealKrav = ealResult.computation.ealKrav;
  const ealEetPct = ealResult.computation.eetPct;

  const loebendeAfgoerelser: EetDifferencekravLoebendeAfgoerelse[] = [];
  let fradragLoebendeYdelser = 0;

  if (loebendeComputation) {
    // Sorter afgørelser på virkningsdato for at kunne bestemme slutdato per afgørelse:
    // slutdato = dagen før næste afgørelses virkningsdato, eller dagFoerBeregningsdato for den seneste.
    const sortedByVirkningsdato = [...loebendeComputation.afgoerelser].sort(
      (a, b) => a.virkningsdato.localeCompare(b.virkningsdato)
    );

    // Tilbagevirkende kraft-reglen (toggle): kun aktuel for skader >= 16-06-2011, hvor
    // midlertidigt EET ellers er fradragsfrit. Før denne dato fradrages midlertidige ydelser
    // allerede 100 %, så reglen ville være en no-op/dobbelttælling og deaktiveres derfor.
    const tilbagevirkendeKraftAktiv =
      input.endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft && skadedato >= SKAERING_2011_06_16;
    // Tidligste endelige afgørelses virkningsdato — det er denne der kan gøre tidligere
    // midlertidige ydelser endelige med tilbagevirkende kraft.
    const tidligsteEndeligVirkningsdato = tilbagevirkendeKraftAktiv
      ? loebendeComputation.afgoerelser
          .filter((a) => a.afgoerelseType === 'Endelig')
          .reduce<ISODateString | null>(
            (earliest, a) => (earliest === null || a.virkningsdato < earliest ? a.virkningsdato : earliest),
            null
          )
      : null;

    for (let i = 0; i < sortedByVirkningsdato.length; i++) {
      const afgoerelse = sortedByVirkningsdato[i]!;
      const fradragesTil = afgoerelse.ophoerDato;

      const foretages = skalFradragForetages(afgoerelse.afgoerelseType, skadedato);
      const beloeb = foretages ? afgoerelse.iAltBeregnetEet : 0;
      fradragLoebendeYdelser += beloeb;

      // Tilbagevirkende kraft: en midlertidig afgørelse, der ellers ikke fradrages, får
      // sin egen løbende ydelse fradraget fra den endelige afgørelses virkningsdato og frem.
      let tilbagevirkendeKraftFradrag: EetDifferencekravTilbagevirkendeKraftFradrag | null = null;
      if (
        !foretages &&
        afgoerelse.afgoerelseType === 'Midlertidig' &&
        tidligsteEndeligVirkningsdato !== null
      ) {
        tilbagevirkendeKraftFradrag = computeTilbagevirkendeKraftFradrag(
          afgoerelse,
          tidligsteEndeligVirkningsdato
        );
        if (tilbagevirkendeKraftFradrag) {
          fradragLoebendeYdelser += tilbagevirkendeKraftFradrag.beloeb;
        }
      }

      loebendeAfgoerelser.push({
        rowId: afgoerelse.rowId,
        afgoerelsesdato: afgoerelse.afgoerelsesdato,
        virkningsdato: afgoerelse.virkningsdato,
        afgoerelseType: afgoerelse.afgoerelseType,
        eetPct: afgoerelse.eetPct,
        fradragesTil,
        beloeb,
        fradragForetages: foretages,
        tilbagevirkendeKraftFradrag,
      });
    }
  }

  // ─── Fradrag 2: Kapitaliseret EET ─────────────────────────────────────────
  const kapAfgoerelser: EetDifferencekravKapitaliseretAfgoerelse[] = [];
  let fradragKapitaliseretEet = 0;

  const aslRowsForDisplay = aslRowsKnownAtBeregningsdato
    .filter((row) => {
      const eetPct = parseCommittedPercent(row.eetPct);
      return eetPct !== undefined && eetPct > 0 && coerceToISODateString(row.afgoerelsesDato) !== undefined;
    })
    .map((row) => {
      const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato)!;
      const kapComp = kapResult.computation?.afgoerelser.find((a) => a.rowId === row.id);
      // Kapitalisering medregnes kun hvis kapitaliseringsdatoen er <= beregningsdatoen.
      // Er kapitaliseringsdatoen efter beregningsdatoen, vises afgørelsen som "ikke kapitaliseret
      // på beregningsdatoen" og bidrager ikke til fradragKapitaliseretEet.
      if (kapComp && kapComp.kapitaliseringsdato <= beregningsdato) {
        fradragKapitaliseretEet += kapComp.kapitalbelob;
        return {
          rowId: row.id,
          afgoerelsesdato,
          kapitaliseringsdato: kapComp.kapitaliseringsdato,
          kapitaliseringspct: kapComp.kapitaliseringspct,
          kapitalbelob: kapComp.kapitalbelob,
          kapitaliseringEfterBeregningsdato: false,
        };
      }
      if (kapComp && kapComp.kapitaliseringsdato > beregningsdato) {
        return {
          rowId: row.id,
          afgoerelsesdato,
          kapitaliseringsdato: null as ISODateString | null,
          kapitaliseringspct: null as number | null,
          kapitalbelob: null as number | null,
          kapitaliseringEfterBeregningsdato: true,
        };
      }
      return {
        rowId: row.id,
        afgoerelsesdato,
        kapitaliseringsdato: null as ISODateString | null,
        kapitaliseringspct: null as number | null,
        kapitalbelob: null as number | null,
        kapitaliseringEfterBeregningsdato: false,
      };
    })
    .sort((a, b) => a.afgoerelsesdato.localeCompare(b.afgoerelsesdato));

  kapAfgoerelser.push(...aslRowsForDisplay);

  // ─── Fradrag 4: Mer-erstatning ved forhøjet folkepensionsalder ────────────
  // Når et erhvervsevnetab tidligere er kapitaliseret, og folkepensionsalderen senere
  // forhøjes, er kapitalbeløbet beregnet til en for lav pensionsalder. Forskellen mellem
  // kapitalværdien til den nye og den gamle folkepensionsalder fratrækkes differencekravet.
  // Beregnes på grundlag af de faktisk kapitaliserede afgørelser fra fane 3.
  let merErstatningPensionsalder: MerErstatningPensionsalderComputation | null = null;
  if (input.indregnMerErstatningVedForhoejetPensionsalder && kapResult.computation) {
    const before2024Skade = skadedato < SKAERING_2024_07_01;
    const kapitaliseringerForMerErstatning = kapResult.computation.afgoerelser
      .filter((a) => a.kapitaliseringsdato <= beregningsdato && a.kapitaliseringspct > 0)
      .map((a) => ({
        rowId: a.rowId,
        afgoerelsesdato: a.afgoerelsesdato,
        kapitaliseringsdato: a.kapitaliseringsdato,
        kapitaliseringspct: a.kapitaliseringspct,
        grundloen: a.grundloen,
        erstatningsniveauPct: a.erstatningsniveauPct,
        amBidragPct: a.amBidragPct,
      }));

    if (kapitaliseringerForMerErstatning.length > 0) {
      const merErstatningIssues: EetIssue[] = [];
      merErstatningPensionsalder = computeMerErstatningPensionsalder(
        {
          kapitaliseringer: kapitaliseringerForMerErstatning,
          beregningsdato,
          skadedato,
          fodselsdato,
          before2024Skade,
          koen: input.erhvervsevnetab.koen,
        },
        merErstatningIssues
      );
      // Mer-erstatning er et fradrag der genbruger allerede validerede stamdata; opstår der
      // alligevel et opslagsproblem, må det ikke nulstille hele differencekravet. Issues
      // rapporteres ikke som blokerende her (computation er allerede gyldig på dette punkt),
      // men hvis beregningen fejler udelades fradraget, så et forkert (for lavt) fradrag
      // aldrig anvendes.
    }
  }

  // ─── Differencekrav før forlig ────────────────────────────────────────────
  const differencekravFoerForlig = Math.max(
    0,
    round0(
      ealKrav
      - fradragLoebendeYdelser
      - fradragKapitaliseretEet
      - (proformaKapitalisering?.proformaBeloeb ?? resterendeLoebendeYdelser?.fradragBeloeb ?? 0)
      - (merErstatningPensionsalder?.samletMerErstatning ?? 0)
    )
  );

  // ─── Forlig om ansvarsgrad ────────────────────────────────────────────────
  // Reducér kun ved et gyldigt forlig under 100 % (factor < 1). Ved intet forlig eller 100 %
  // forbliver differencekravet uændret, og label vises uden parentes. Ugyldigt forlig blokerer
  // hele beregningen i eetSnapshot, så det når aldrig hertil.
  const reducerer = input.forlig !== null && input.forlig !== undefined && input.forlig.factor < 1;
  const forligFactor = reducerer ? input.forlig!.factor : null;
  const forligLabel = reducerer ? input.forlig!.label : null;
  const forligDato = reducerer ? (input.forligDato ?? null) : null;
  const differencekrav = forligFactor !== null
    ? Math.max(0, round0(differencekravFoerForlig * forligFactor))
    : differencekravFoerForlig;

  return {
    issues: finalIssues,
    hasBlockingErrors: false,
    computation: {
      beregningsdato,
      skadedato,
      dagFoerBeregningsdato,
      fradragGaelderForFoer2011: skadedato < SKAERING_2011_06_16,
      ealKrav,
      ealEetPct,
      fradragLoebendeYdelser,
      fradragKapitaliseretEet,
      proformaKapitalisering,
      resterendeLoebendeYdelser,
      merErstatningPensionsalder,
      differencekravFoerForlig,
      forligFactor,
      forligLabel,
      forligDato,
      differencekrav,
      afgoerelser: loebendeAfgoerelser,
      kapitaliseringerAfgoerelser: kapAfgoerelser,
      loebendeComputation: loebendeResult?.computation ?? null,
      kapComputation: kapResult.computation,
      ealComputation: ealResult.computation,
    },
  };
};
