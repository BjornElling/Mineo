import { aarsloenMax } from '../../data/regulationRates';
import {
  getKapitaliseringsTabelData,
  type ForsoergertabMatrixRaekke,
  type KapitaliseringsTabelData,
} from '../../data/kapitalisering/kapitaliseringsTabeller';
import type { ISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { Koen } from '../../schemas/formSchemas';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import { PRE_2015_CUTOFF } from './forsoergertabConstants';
import {
  calculateAgeYearsMonths,
  resolveKapitaliseringsbekendtgoerelseId,
  resolveKapitaliseringTabelvalg,
} from '../erhvervsevnetab/eetKapitaliseringOpslag';
import { ceil0, round2, round3, roundNearest1000 } from '../erhvervsevnetab/eetRounding';
import type { ForsoergertabAslComputation, ForsoergertabAslResult, ForsoergertabIssue } from './forsoergertabTypes';

type Input = Readonly<{
  skadesdato: ISODateString | undefined;
  beregningsdato: ISODateString | undefined;
  virkningsdato: ISODateString | undefined;
  efterladteFodselsdato: ISODateString | undefined;
  koen: Koen | undefined;
  tilkendtForPeriodeAar: number | undefined;
  aslAarsloen: AmountValue | undefined;
}>;

type LegacyTableChoice = Readonly<{
  neutral?: string;
  maend?: string;
  kvinder?: string;
}>;

const SKADESDATO_2007 = '2007-07-01' as ISODateString;
const FORSOERGERTABSPROCENT = 0.3;

const LEGACY_FORSOERGERTAB_TABLE_CHOICES: Readonly<Record<string, Readonly<{
  before2007: LegacyTableChoice;
  from2007: LegacyTableChoice;
}>>> = {
  '1221/2010': {
    before2007: { maend: 'M', kvinder: 'N' },
    from2007: { maend: 'F', kvinder: 'G' },
  },
  '1403/2011': {
    before2007: { maend: 'M', kvinder: 'N' },
    from2007: { maend: 'F', kvinder: 'G' },
  },
  '198/2015': {
    before2007: { neutral: 'L' },
    from2007: { neutral: 'F' },
  },
  '1700/2015': {
    before2007: { neutral: 'N' },
    from2007: { neutral: 'G' },
  },
};

const toIssue = (id: string, message: string): ForsoergertabIssue => ({
  id,
  severity: 'error',
  message,
});

const resolveLegacyForsoergertabTable = (
  tabeldata: KapitaliseringsTabelData,
  skadesdato: ISODateString,
  usesKoen: boolean,
  koen: Koen | undefined
): string | null => {
  const explicit = LEGACY_FORSOERGERTAB_TABLE_CHOICES[tabeldata.kapitaliseringsId];
  if (explicit) {
    const bucket = skadesdato >= SKADESDATO_2007 ? explicit.from2007 : explicit.before2007;
    if (!usesKoen) {
      return bucket.neutral ?? null;
    }
    if (!koen) return null;
    return koen === 'Mand' ? (bucket.maend ?? null) : (bucket.kvinder ?? null);
  }

  const keys = Object.keys(
    usesKoen
      ? (koen === 'Mand' ? tabeldata.forsoergertabTabellerMaend : tabeldata.forsoergertabTabellerKvinder)
      : tabeldata.forsoergertabTabeller
  );
  return keys.length === 1 ? keys[0] ?? null : null;
};

const resolveForsoergertabTabel = (
  tabeldata: KapitaliseringsTabelData,
  skadesdato: ISODateString,
  usesKoen: boolean,
  koen: Koen | undefined
): string | null => {
  const explicit = tabeldata.forsoergertabTabelvalg
    .filter((entry) => entry.skadesdatoFra <= skadesdato)
    .reduce<typeof tabeldata.forsoergertabTabelvalg[number] | null>((latest, current) => {
      if (!latest) return current;
      return current.skadesdatoFra > latest.skadesdatoFra ? current : latest;
    }, null);

  if (explicit) return explicit.tabel;
  return resolveLegacyForsoergertabTable(tabeldata, skadesdato, usesKoen, koen);
};

const resolveForsoergertabRows = (
  tabeldata: KapitaliseringsTabelData,
  tabel: string,
  usesKoen: boolean,
  koen: Koen | undefined
): readonly ForsoergertabMatrixRaekke[] | null => {
  if (!usesKoen) {
    return tabeldata.forsoergertabTabeller[tabel] ?? null;
  }
  if (!koen) return null;
  return koen === 'Mand'
    ? (tabeldata.forsoergertabTabellerMaend[tabel] ?? null)
    : (tabeldata.forsoergertabTabellerKvinder[tabel] ?? null);
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

export const computeForsoergertabAslYdelser = (input: Input): ForsoergertabAslResult => {
  const issues: ForsoergertabIssue[] = [];

  const aslAarsloen = amountValueToNumber(input.aslAarsloen);
  if (aslAarsloen === undefined) {
    issues.push(toIssue('asl-aarsloen-missing', 'Årsløn efter ASL er ikke udfyldt.'));
  } else if (aslAarsloen === 0) {
    issues.push(toIssue('asl-aarsloen-zero', 'Årsløn efter ASL må ikke være 0 kr.'));
  }

  if (!input.skadesdato) issues.push(toIssue('skadesdato-missing', 'Skadesdato er ikke udfyldt.'));
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

  const usesKoen = input.beregningsdato !== undefined && input.beregningsdato < PRE_2015_CUTOFF;
  if (usesKoen && !input.koen) {
    issues.push(toIssue('missing-koen', 'Ved beregning før 1. marts 2015 skal køn angives.'));
  }

  if (
    issues.some((issue) => issue.severity === 'error') ||
    !input.skadesdato ||
    !input.beregningsdato ||
    !input.virkningsdato ||
    !input.efterladteFodselsdato ||
    input.tilkendtForPeriodeAar === undefined ||
    aslAarsloen === undefined
  ) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const skadesaar = Number(input.skadesdato.slice(0, 4));
  const beregningsaar = Number(input.beregningsdato.slice(0, 4));
  const aarsloenMaxSkadesaar = aarsloenMax[skadesaar];
  const aarsloenMaxBeregningsaar = aarsloenMax[beregningsaar];
  if (!Number.isFinite(aarsloenMaxSkadesaar)) {
    issues.push(toIssue('aarsloen-max-missing-skadesaar', `Årslønsmaksimum mangler for år ${skadesaar}.`));
  }
  if (!Number.isFinite(aarsloenMaxBeregningsaar)) {
    issues.push(toIssue('aarsloen-max-missing-beregningsaar', `Årslønsmaksimum mangler for år ${beregningsaar}.`));
  }
  if (issues.length > 0 || !Number.isFinite(aarsloenMaxSkadesaar) || !Number.isFinite(aarsloenMaxBeregningsaar)) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const aslAarsloenAfrundet1000 = roundNearest1000(aslAarsloen);
  const benyttetAarsloen = Math.min(aslAarsloenAfrundet1000, aarsloenMaxSkadesaar);
  const opreguleringsfaktor = aarsloenMaxBeregningsaar / aarsloenMaxSkadesaar;
  const opreguleretAarligYdelse = round2(FORSOERGERTABSPROCENT * benyttetAarsloen * opreguleringsfaktor);

  const virkningsaar = Number(input.virkningsdato.slice(0, 4));
  const virkningsmaaned = Number(input.virkningsdato.slice(5, 7));
  const beregningsmaaned = Number(input.beregningsdato.slice(5, 7));
  const alleredeUdbetaltMaaneder = (beregningsaar - virkningsaar) * 12 + (beregningsmaaned - virkningsmaaned) + 1;
  const samletMaaneder = input.tilkendtForPeriodeAar * 12;
  const resterendeMaanederTotal = Math.max(0, samletMaaneder - alleredeUdbetaltMaaneder);
  const resterendeAar = Math.floor(resterendeMaanederTotal / 12);
  const resterendeMaaneder = resterendeMaanederTotal % 12;

  const kapitaliseringsbekendtgoerelseId = resolveKapitaliseringsbekendtgoerelseId(input.skadesdato, input.beregningsdato);
  if (!kapitaliseringsbekendtgoerelseId) {
    issues.push(toIssue('kapitaliseringsbekendtgoerelse-missing', 'Der kan ikke findes relevant kapitaliseringsbekendtgørelse.'));
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const tabeldata = getKapitaliseringsTabelData(kapitaliseringsbekendtgoerelseId);
  if (!tabeldata) {
    issues.push(toIssue('kapitaliseringstabeldata-missing', 'Kapitaliseringsdata mangler for den relevante bekendtgørelse.'));
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const fpTabelvalg = resolveKapitaliseringTabelvalg(tabeldata, input.skadesdato, input.efterladteFodselsdato);
  if (!fpTabelvalg) {
    issues.push(toIssue('folkepensionsalder-unresolved', 'Folkepensionsalder kan ikke fastlægges fra kapitaliseringsbekendtgørelsen.'));
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const alder = calculateAgeYearsMonths(input.efterladteFodselsdato, input.beregningsdato);
  if (!alder) {
    issues.push(toIssue('forsoergertab-alder-unresolved', 'Efterladtes alder kan ikke beregnes på beregningsdatoen.'));
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const harNaaetFolkepensionsalder = alder.totalMonths >= fpTabelvalg.folkepensionsalderMaaneder;

  let kapitaliseringsTabel: string | null = null;
  let kapitalfaktor: number | null = null;

  if (!harNaaetFolkepensionsalder && resterendeMaanederTotal > 0) {
    kapitaliseringsTabel = resolveForsoergertabTabel(tabeldata, input.skadesdato, usesKoen, input.koen);
    if (!kapitaliseringsTabel) {
      issues.push(toIssue('forsoergertab-tabel-missing', 'Der kan ikke findes relevant forsørgertabstabel.'));
      return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
    }

    const rows = resolveForsoergertabRows(tabeldata, kapitaliseringsTabel, usesKoen, input.koen);
    if (!rows || rows.length === 0) {
      issues.push(toIssue('forsoergertab-tabel-rows-missing', `Ingen kapitaliseringsfaktorer fundet for tabel ${kapitaliseringsTabel}.`));
      return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
    }

    const ageRow = rows.find((row) => row.alder === alder.years);
    if (!ageRow) {
      issues.push(toIssue('forsoergertab-alder-missing', `Der findes ingen aldersrække for ${alder.years} år i tabel ${kapitaliseringsTabel}.`));
      return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
    }

    kapitalfaktor = interpolateKapitalfaktor(ageRow, resterendeAar, resterendeMaaneder);
    if (kapitalfaktor === null) {
      issues.push(toIssue('forsoergertab-faktor-unresolved', 'Kapitalfaktoren kan ikke beregnes ud fra den resterende periode.'));
      return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
    }
  }

  const kapitalbelob =
    harNaaetFolkepensionsalder || resterendeMaanederTotal === 0 || kapitalfaktor === null
      ? 0
      : ceil0(opreguleretAarligYdelse * kapitalfaktor);

  const computation: ForsoergertabAslComputation = {
    skadesdato: input.skadesdato,
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
    folkepensionsalderAarLabel: fpTabelvalg.folkepensionsalderLabel,
    folkepensionsalderMaaneder: fpTabelvalg.folkepensionsalderMaaneder,
    harNaaetFolkepensionsalder,
    kapitalfaktor,
    kapitalbelob,
  };

  return { issues: dedupeIssuesBySeverityAndMessage(issues), computation };
};
