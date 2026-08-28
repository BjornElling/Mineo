import type { ErhvervsevnetabComposedValues, AslAfgoerelseRow } from '../../schemas/formSchemas';
import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import type { EetIssue } from './eetTypes';
import { EET_UNDER_15_WARNING, hasEetAslAarsloenMaxWarning } from './eetFieldWarnings';
import { MISSING_BEREGNINGSDATO_ISSUE } from './eetIssueCatalog';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, parseISODate } from '../../types/branded';
import type { YearlyRate } from '../../data/lovbestemteRates';
import { calculateUtcAgeInWholeYears } from '../../utils/dateUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { dedupeIssuesByIdentity } from '../../utils/issueUtils';
import { isoYear } from '../../utils/isoDateHelpers';
import { roundByMethod } from '../../utils/rounding';
import {
  ASL_IDENTICAL_AFGOERELSER_ID,
  hasIdenticalAfgoerelser,
  parseCommittedPercent,
  validatePercentDivisibleBy5,
  validatePercentDivisibleBy5FromValue,
} from './eetAslAfgoerelser';
import { round0, round4 } from '../../utils/roundingShortcuts';
import { SKAERING_2024_07_01 } from './eetSkaeringsdatoer';
import { opregulerMedAkkumuleretReguleringssats } from '../satser/opreguleringsmotorer';
import { resolveAslAarsloensmaksimumForAar } from '../satser/aslAarsloensmaksimum';
import {
  clampMoneyOreToZero,
  fromKroner,
  subtractMoneyOre,
  toKroner,
} from '../money/money';
import type { EetEalComputation } from './eetCanonicalOutput';
import { resolveStamdataDatoReference } from '../policies/stamdataCalculations';

export type { EetEalComputation } from './eetCanonicalOutput';

export type EetEalResolvedEetPct = Readonly<{
  value: number;
  source: 'eal' | 'asl';
  rowId?: string;
}>;

export type EetEalCalculationResult = Readonly<{
  issues: readonly EetIssue[];
  computation: EetEalComputation | null;
}>;

/**
 * EAL-beregningen læser kun fem felter fra erhvervsevnetab-sektionen. Vi udstiller derfor
 * en smal input-type (i stedet for hele `ErhvervsevnetabComposedValues`), så kaldere som
 * forsørgertab ikke tvinges til at konstruere dødvægts-felter (bilagvalg, toggles, køn) blot
 * for at tilfredsstille typen. `ErhvervsevnetabComposedValues` er strukturelt tildelbar til
 * denne Pick, så eksisterende kaldere der sender det fulde objekt er uændrede.
 */
export type EetEalInputValues = Pick<
  ErhvervsevnetabComposedValues,
  'beregningsdato' | 'aslAarsloen' | 'ealAarsloen' | 'ealEetPct' | 'aslAfgoerelser'
>;

type Input = Readonly<{
  erhvervsevnetab: EetEalInputValues;
  skadedato: ISODateString | undefined;
  skadestype?: Skadestype;
  skadelidteFodselsdato: ISODateString | undefined;
  reguleringssats: YearlyRate;
  erhvervsevnetabEalMax: YearlyRate;
  aarsloenAslMax: YearlyRate;
}>;

const round500 = (value: number): number => roundByMethod(value / 500, 0, 'halfAwayFromZero') * 500;

const toIssue = (id: string, message: string): EetIssue => ({
  id,
  severity: 'error',
  message,
});

const toWarning = (id: string, message: string): EetIssue => ({
  id,
  severity: 'warning',
  message,
});

const calculateAgeInWholeYears = (fodselsdato: ISODateString, skadedato: ISODateString): number | null => {
  const birthDate = parseISODate(fodselsdato);
  const injuryDate = parseISODate(skadedato);
  if (!birthDate || !injuryDate) return null;
  return calculateUtcAgeInWholeYears(birthDate, injuryDate) ?? null;
};

const calculateAldersreduktionPct = (ageAtInjury: number): number => {
  if (!Number.isFinite(ageAtInjury) || ageAtInjury <= 29) return 0;
  const cappedAge = Math.min(ageAtInjury, 69);
  const base = cappedAge - 29;
  const extra = ageAtInjury > 54 ? 2 * (cappedAge - 54) : 0;
  return base + extra;
};


const resolveEetPctFromAslRows = (
  rows: readonly AslAfgoerelseRow[]
): { resolved: EetEalResolvedEetPct | null; issues: EetIssue[] } => {
  const issues: EetIssue[] = [];
  const rowsWithAfgoerelsesdato = rows
    .map((row) => ({ row, afgoerelsesdato: coerceToISODateString(row.afgoerelsesDato) }))
    .filter((entry): entry is { row: AslAfgoerelseRow; afgoerelsesdato: ISODateString } => entry.afgoerelsesdato !== undefined);

  if (rowsWithAfgoerelsesdato.length === 0) {
    return { resolved: null, issues };
  }

  const latestAfgoerelsesdato = rowsWithAfgoerelsesdato.reduce((latest, current) => {
    return current.afgoerelsesdato > latest ? current.afgoerelsesdato : latest;
  }, rowsWithAfgoerelsesdato[0].afgoerelsesdato);

  const sameAfgoerelsesdato = rowsWithAfgoerelsesdato.filter(
    (entry) => entry.afgoerelsesdato === latestAfgoerelsesdato
  );

  const withVirkningsdato = sameAfgoerelsesdato
    .map((entry) => ({ ...entry, virkningsdato: coerceToISODateString(entry.row.virkningsDato) }))
    .filter(
      (entry): entry is { row: AslAfgoerelseRow; afgoerelsesdato: ISODateString; virkningsdato: ISODateString } =>
        entry.virkningsdato !== undefined
    );

  const maxVirkningsdato = withVirkningsdato.length > 0
    ? withVirkningsdato.reduce((latest, current) => {
      return current.virkningsdato > latest ? current.virkningsdato : latest;
    }, withVirkningsdato[0].virkningsdato)
    : null;

  const tiedOnDates =
    maxVirkningsdato === null
      ? sameAfgoerelsesdato
      : withVirkningsdato.filter((entry) => entry.virkningsdato === maxVirkningsdato);

  const endelig = tiedOnDates.filter((entry) => entry.row.afgoerelseType === 'Endelig');
  const delvist = tiedOnDates.filter((entry) => entry.row.afgoerelseType === 'Delvist endelig');
  const selected = endelig[0] ?? delvist[0] ?? tiedOnDates[0];
  if (!selected) return { resolved: null, issues };

  const eetPctDivisibleError = validatePercentDivisibleBy5(selected.row.eetPct, 'EET %');
  if (eetPctDivisibleError) {
    issues.push(toIssue('asl-selected-eet-pct-invalid', eetPctDivisibleError));
    return { resolved: null, issues };
  }

  const parsed = parseCommittedPercent(selected.row.eetPct);
  if (parsed === undefined || parsed === 0) {
    return { resolved: null, issues };
  }

  return {
    resolved: {
      value: parsed,
      source: 'asl',
      rowId: selected.row.id,
    },
    issues,
  };
};

const resolveEetPct = (
  values: EetEalInputValues
): { resolved: EetEalResolvedEetPct | null; issues: EetIssue[] } => {
  const issues: EetIssue[] = [];

  const ealDivisibleError = validatePercentDivisibleBy5FromValue(values.ealEetPct, 'EET %');
  if (ealDivisibleError) {
    issues.push(toIssue('eal-eet-pct-invalid', ealDivisibleError));
    return { resolved: null, issues };
  }

  if (values.ealEetPct !== undefined && values.ealEetPct !== 0) {
    return {
      resolved: {
        value: values.ealEetPct,
        source: 'eal',
      },
      issues,
    };
  }

  const fallback = resolveEetPctFromAslRows(values.aslAfgoerelser ?? []);
  issues.push(...fallback.issues);
  return { resolved: fallback.resolved, issues };
};

const resolveAarsloen = (values: EetEalInputValues): { value: number | null; source: 'eal' | 'asl' | null } => {
  const ealAarsloen = amountValueToNumber(values.ealAarsloen);
  if (typeof ealAarsloen === 'number' && Number.isFinite(ealAarsloen) && ealAarsloen > 0) {
    return { value: ealAarsloen, source: 'eal' };
  }
  const aslAarsloen = amountValueToNumber(values.aslAarsloen);
  if (typeof aslAarsloen === 'number' && Number.isFinite(aslAarsloen) && aslAarsloen > 0) {
    return { value: aslAarsloen, source: 'asl' };
  }
  return { value: null, source: null };
};

const computeEalReguleringsfaktorFromYearlyChain = (
  skadesaar: number,
  beregningsaar: number,
  reguleringssats: YearlyRate
): Readonly<{ reguleringsaar: number[]; manglendeAar: number[]; faktor: number }> => {
  // Den faktiske opregulering (akkumuleret reguleringssats / "tilpasningsprocenten
  // plus to procent") ligger i den fælles motor. Listen af mellemliggende år
  // (reguleringsaar) bevares her, da EAL-beregningen bruger den til visning/evidens.
  const reguleringsaar: number[] = [];
  for (let year = skadesaar + 1; year <= beregningsaar; year += 1) {
    reguleringsaar.push(year);
  }

  const { faktor, manglendeAar } = opregulerMedAkkumuleretReguleringssats(
    { kildeAar: skadesaar, maalAar: beregningsaar },
    reguleringssats
  );

  return { reguleringsaar, manglendeAar: [...manglendeAar], faktor };
};

export const computeEetEalCalculation = (input: Input): EetEalCalculationResult => {
  const issues: EetIssue[] = [];
  const values = input.erhvervsevnetab;

  const beregningsdato = coerceToISODateString(values.beregningsdato);
  const skadedato = input.skadedato;
  const stamdataDatoReference = resolveStamdataDatoReference(input.skadestype);
  const fodselsdato = input.skadelidteFodselsdato;

  const aarsloen = resolveAarsloen(values);
  // Fortegn er et afledt domæneissue. Rækkefølgen er intentionel: et udfyldt
  // ikke-positivt beløb er en konkret fejl; kun undefined er "mangler".
  const ealAarsloenRaw = amountValueToNumber(values.ealAarsloen);
  const aslAarsloenRaw = amountValueToNumber(values.aslAarsloen);
  if (ealAarsloenRaw !== undefined && ealAarsloenRaw <= 0) {
    issues.push(toIssue('eal-aarsloen-zero', 'EAL-årsløn skal være større end 0 kr'));
  } else if (ealAarsloenRaw === undefined && aslAarsloenRaw !== undefined && aslAarsloenRaw <= 0) {
    // ASL-årslønnen er kun en EAL-afhængighed ved fallback. En ugyldig ASL-værdi må derfor ikke blokere
    // EAL-fanen, når brugeren allerede har angivet en positiv EAL-årsløn.
    issues.push(toIssue('aarsloen-zero', 'Årsløn skal være større end 0 kr'));
  } else if (aarsloen.value === null || aarsloen.source === null) {
    issues.push(toIssue('aarsloen-missing', 'Årsløn er ikke udfyldt'));
  }

  // Identiske ASL-afgørelser er kun relevante, når EAL-EET-procenten skal findes via ASL-fallbacken.
  // Med en positiv EAL-procent læser denne beregning ikke afgørelsestabellen.
  if ((values.ealEetPct === undefined || values.ealEetPct === 0) && hasIdenticalAfgoerelser(values.aslAfgoerelser ?? [])) {
    issues.push(toIssue(ASL_IDENTICAL_AFGOERELSER_ID, 'Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato'));
  }

  const eetPctResolution = resolveEetPct(values);
  issues.push(...eetPctResolution.issues);
  if (!eetPctResolution.resolved && eetPctResolution.issues.length === 0) {
    issues.push(toIssue('eet-pct-missing', 'Erhvervsevnetabsprocent er ikke udfyldt'));
  }

  if (!fodselsdato) {
    issues.push(toIssue('skadelidte-fodselsdato-missing', 'Fødselsdato er ikke udfyldt'));
  }
  if (!beregningsdato) {
    issues.push(MISSING_BEREGNINGSDATO_ISSUE);
  }
  if (!skadedato) {
    issues.push(toIssue('skadedato-missing', `${stamdataDatoReference.label} er ikke udfyldt`));
  }

  const hasBlockingIssues = issues.some((issue) => issue.severity === 'error');
  if (hasBlockingIssues || !aarsloen.value || !aarsloen.source || !eetPctResolution.resolved || !beregningsdato || !skadedato || !fodselsdato) {
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const skadesaar = isoYear(skadedato);
  const beregningsaar = isoYear(beregningsdato);

  // Datoorden-værn: beregningsdato bør aldrig ligge før skadedato. Sker det (typisk tastefejl),
  // giver opreguleringskæden faktor 1 (ingen opregulering) – et tvivlsomt, uopreguleret krav.
  // ISO-datoer (YYYY-MM-DD) kan sammenlignes leksikografisk = kronologisk. Ikke-blokerende advarsel.
  if (beregningsdato < skadedato) {
    issues.push(
      toWarning(
        'warn-beregningsdato-foer-skadedato',
        `Beregningsdatoen ligger før ${stamdataDatoReference.labelLower}. Kravet opreguleres ikke – kontrollér datoerne`
      )
    );
  }

  const ealRegulering = computeEalReguleringsfaktorFromYearlyChain(skadesaar, beregningsaar, input.reguleringssats);
  const reguleringsaar = ealRegulering.reguleringsaar;
  const manglendeReguleringsaar = ealRegulering.manglendeAar;
  if (manglendeReguleringsaar.length > 0) {
    issues.push(
      toIssue(
        'reguleringssats-missing',
        `Reguleringssats mangler for år ${manglendeReguleringsaar.join(', ')}`
      )
    );
  }

  const eetMaks = input.erhvervsevnetabEalMax[beregningsaar];
  if (!Number.isFinite(eetMaks)) {
    issues.push(toIssue('eet-max-missing', `Maksimum for erhvervsevnetab mangler for år ${beregningsaar}`));
  }

  const alderVedSkade = calculateAgeInWholeYears(fodselsdato, skadedato);
  if (alderVedSkade === null) {
    // Samme navneregel som de to øvrige issues i denne funktion (BB-121); referencen er udledt ovenfor.
    issues.push(toIssue('alder-unresolved', `Alder på ${stamdataDatoReference.tidspunkt} kan ikke beregnes`));
  }

  const blockingIssues = issues.some((issue) => issue.severity === 'error');

  if (values.ealEetPct !== undefined && values.ealEetPct !== 0 && values.ealEetPct < 15) {
    issues.push(toWarning('warn-eal-eet-under-15', EET_UNDER_15_WARNING));
  }

  if (
    (values.ealEetPct === undefined || values.ealEetPct === 0) &&
    eetPctResolution.resolved?.source === 'asl' &&
    eetPctResolution.resolved.value < 15
  ) {
    issues.push(toWarning('warn-asl-eet-under-15', EET_UNDER_15_WARNING));
  }

  const ealAarsloenInput = amountValueToNumber(values.ealAarsloen);
  const maxAarsloenForSkadesaar = resolveAslAarsloensmaksimumForAar(skadesaar, input.aarsloenAslMax);
  const maxAarsloenWarningMessage =
    'Skadelidtes fulde årsløn skal indtastes for EAL – ikke maks. årslønnen efter ASL';
  const isSkadeFraJuli2024EllerSenere = skadedato >= SKAERING_2024_07_01;

  if (
    isSkadeFraJuli2024EllerSenere &&
    (ealAarsloenInput === undefined || !Number.isFinite(ealAarsloenInput))
  ) {
    issues.push(
      toWarning(
        'warn-eal-aarsloen-empty-for-2024-07-01',
        'For skader fra 1. juli 2024 og frem beregnes årsløn forskelligt efter EAL og ASL.'
      )
    );
  }

  if (maxAarsloenForSkadesaar !== undefined) {
    if (
      Number.isFinite(ealAarsloenInput) &&
      ealAarsloenInput !== undefined &&
      ealAarsloenInput === maxAarsloenForSkadesaar
    ) {
      issues.push(toWarning('warn-eal-aarsloen-is-max', maxAarsloenWarningMessage));
    } else if (hasEetAslAarsloenMaxWarning(
      values.aslAarsloen,
      values.ealAarsloen,
      skadedato,
      input.aarsloenAslMax,
    )) {
      issues.push(toWarning('warn-asl-aarsloen-is-max', maxAarsloenWarningMessage));
    }
  }

  if (blockingIssues || !Number.isFinite(eetMaks) || alderVedSkade === null) {
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const reguleringsfaktor = ealRegulering.faktor;

  const reguleringsPctRounded4 = round4((reguleringsfaktor - 1) * 100);
  const reguleringsfaktorRounded4 = 1 + reguleringsPctRounded4 / 100;
  const aarsloenOre = fromKroner(aarsloen.value);
  const reguleretAarsloenOre = fromKroner(reguleringsaar.length > 0
    ? round500(aarsloen.value * reguleringsfaktorRounded4)
    : aarsloen.value);

  // De lovbestemte round0-/maksimumgrænser ligger fortsat i kroner. Først derefter bliver
  // beløbene brandet, så MoneyOre-migrationen ikke flytter en eneste afrunding.
  const eetBeregnetOre = fromKroner(round0(
    toKroner(reguleretAarsloenOre) * 10 * (eetPctResolution.resolved.value / 100)
  ));
  const eetMaksOre = fromKroner(eetMaks);
  const eetReduceretTilMaks = eetBeregnetOre > eetMaksOre;
  const eetAnvendtOre = eetReduceretTilMaks ? eetMaksOre : eetBeregnetOre;

  const alderVedSkadeCapped = Math.min(alderVedSkade, 69);
  const aldersreduktionPct = calculateAldersreduktionPct(alderVedSkade);
  const aldersreduktionBeloebOre = fromKroner(round0(
    toKroner(eetAnvendtOre) * (aldersreduktionPct / 100)
  ));
  const ealKravOre = clampMoneyOreToZero(
    subtractMoneyOre(eetAnvendtOre, aldersreduktionBeloebOre)
  );

  const computation: EetEalComputation = {
    beregningsdato,
    skadedato,
    // Skadestypen følger med ud, så skærm og dokument kan navngive datoen ens (BB-121).
    skadestype: input.skadestype,
    fodselsdato,
    skadesaar,
    beregningsaar,
    aarsloenOre,
    aarsloenSource: aarsloen.source,
    reguleringsaar,
    reguleringsPctRounded4,
    reguleretAarsloenOre,
    eetPct: eetPctResolution.resolved.value,
    eetPctSource: eetPctResolution.resolved.source,
    kapitaliseringsfaktor: 10,
    eetBeregnetOre,
    eetMaksOre,
    eetAnvendtOre,
    eetReduceretTilMaks,
    alderVedSkade,
    alderVedSkadeCapped,
    aldersreduktionPct,
    aldersreduktionBeloebOre,
    ealKravOre,
  };

  return {
    issues: dedupeIssuesByIdentity(issues),
    computation,
  };
};

export { buildAldersreduktionEtiket } from './eetAldersreduktionFormel';
