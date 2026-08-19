import type { ISODateString } from '../types/branded';
import { coerceToISODateString } from '../types/branded';
import { interpretYear, isValidDate } from './dateInputValidation';
import { normalizeDateDraftSeparators } from './dateDraftNormalization';
import { shouldClearField } from './inputValidation';

export type DateYearPolicy = 'reject' | 'infer' | 'assume20xx';

/**
 * HVORFOR et datodraft ikke kunne parses. Årsagen er MASKINLÆSBAR, fordi de tre udfald ikke er lige
 * informative for brugeren:
 *
 * - `malformed` – teksten er slet ikke en dato (bogstaver, for få/mange felter, delvist indtastet). Der er
 *   intet konkret at fortælle ud over "dette er ikke en dato"; feltets eget navn står allerede ved markøren.
 * - `nonexistentDay` – dag/måned/år er hver for sig velformede, men kombinationen findes ikke i kalenderen
 *   (`31-02-2026`, `29-02-2023`). Her ER der noget konkret at sige.
 * - `yearOutOfRepresentableRange` – en fuldt gyldig kalenderdato, hvis ÅRSTAL ligger uden for det domæne,
 *   `ISODateString` overhovedet kan repræsentere ({@link MIN_REPRESENTABLE_DATE_YEAR}..{@link MAX_REPRESENTABLE_DATE_YEAR}).
 *   Udfaldet har sin egen årsag, fordi et årstal som `1899` ALDRIG kan nå frem til en bounds-validator:
 *   værdien er urepræsenterbar, så feltet afviser den som `format`, og `format` viser pr.
 *   `error-contract.md` §4 den generiske «Fejl i indtastning». Datofelternes egne nedre grænser er
 *   håndhævede, men den nederste af dem er uopnåelig, fordi det repræsenterbare domæne stopper samme sted.
 *   Uden denne årsag ville brugeren derfor aldrig få at vide, hvilket årstal der er tidligst muligt.
 */
export type DateDraftInvalidKind = 'malformed' | 'nonexistentDay' | 'yearOutOfRepresentableRange';

export type ParsedDateDraft =
  | Readonly<{ ok: true; danish: string; iso: ISODateString | undefined }>
  | Readonly<{ ok: false; kind: 'invalid'; invalidKind: DateDraftInvalidKind; message: string }>;

const INVALID_DATE_MESSAGE = 'Ugyldig dato';
/** Fælles rå draft-grænse for persisterede og grid-baserede datofelter. */
export const MAX_DATE_DRAFT_LENGTH = 16;

/**
 * Det årsinterval, en {@link ISODateString} kan repræsentere. Spejler `isISODateString` (`types/branded.ts`)
 * – den ENE kilde til, hvad der er en gyldig ISO-dato. Konstanterne står her, fordi det er her, et draft
 * afvises på grund af dem.
 *
 * De er en REPRÆSENTATIONSgrænse, ikke en brugerregel, og må derfor ikke lække til brugerteksten: hvert
 * datofelt har sin egen, ofte smallere grænse (Fødselsdato slutter ved dags dato), og en besked om
 * «1900..2100» ville modsige den. Feltets konkrete datoer formuleres af `resolveDateFormatIssueText`.
 */
export const MIN_REPRESENTABLE_DATE_YEAR = 1900;
export const MAX_REPRESENTABLE_DATE_YEAR = 2100;

/**
 * Fald-tilbage-teksten for et urepræsenterbart årstal på en flade UDEN en feltgrænse-erklæring (den
 * transiente dato-overlay). Den taler bevidst om DATOEN og ikke om et årsinterval – se konstanterne ovenfor.
 */
export const DATE_YEAR_OUT_OF_RANGE_MESSAGE = 'Datoen ligger uden for det gyldige interval';

/** Konkret besked for en velformet, men ikke-eksisterende kalenderdato (`31-02-2026`). */
export const NONEXISTENT_DAY_MESSAGE = 'Datoen findes ikke i kalenderen';

// Parse afledes altid på commit (form-kernereglen forbyder typing-feedback), så et ufuldstændigt
// input er en egentlig fejl – ikke en "endnu ikke færdig"-tilstand.
const INVALID_DATE: ParsedDateDraft = {
  ok: false,
  kind: 'invalid',
  invalidKind: 'malformed',
  message: INVALID_DATE_MESSAGE,
};

const invalidDate = (invalidKind: DateDraftInvalidKind, message: string): ParsedDateDraft =>
  ({ ok: false, kind: 'invalid', invalidKind, message });

const resolveYear = (yearRaw: string, policy: DateYearPolicy): number | null => {
  if (yearRaw.length === 1 || yearRaw.length === 2) {
    if (policy === 'reject') return null;
    if (policy === 'assume20xx') {
      const parsed = Number.parseInt(yearRaw, 10);
      return Number.isFinite(parsed) ? 2000 + parsed : null;
    }
    return interpretYear(yearRaw);
  }

  if (yearRaw.length === 4) {
    const parsed = Number.parseInt(yearRaw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const parseDateDraftForCommit = (
  draft: string,
  options: Readonly<{ twoDigitYearPolicy: DateYearPolicy }>
): ParsedDateDraft => {
  const trimmed = draft.trim();
  if (trimmed === '' || shouldClearField(trimmed)) return { ok: true, danish: '', iso: undefined };
  if (trimmed.length > MAX_DATE_DRAFT_LENGTH) return INVALID_DATE;

  let dayRaw: string;
  let monthRaw: string;
  let yearRaw: string;

  if (/^\d{6,8}$/.test(trimmed)) {
    dayRaw = trimmed.slice(0, 2);
    monthRaw = trimmed.slice(2, 4);
    yearRaw = trimmed.slice(4);
  } else {
    const normalized = normalizeDateDraftSeparators(trimmed);
    const [dayPart = '', monthPart = '', yearPart = '', ...rest] = normalized.split('-');
    if (rest.length > 0 || dayPart === '' || monthPart === '' || yearPart === '') return INVALID_DATE;
    dayRaw = dayPart;
    monthRaw = monthPart;
    yearRaw = yearPart;
  }

  if (/[^0-9]/.test(dayRaw) || /[^0-9]/.test(monthRaw) || /[^0-9]/.test(yearRaw)) {
    return INVALID_DATE;
  }
  if (dayRaw.length > 2 || monthRaw.length > 2 || yearRaw.length > 4 || yearRaw.length === 3) {
    return INVALID_DATE;
  }

  const dayNum = Number.parseInt(dayRaw, 10);
  const monthNum = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(dayNum) || !Number.isFinite(monthNum)) return INVALID_DATE;
  if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) return INVALID_DATE;

  const resolvedYear = resolveYear(yearRaw, options.twoDigitYearPolicy);
  if (resolvedYear === null) return INVALID_DATE;

  // Årstallet vurderes FØR kalenderdagen, så `31-02-1899` meldes som det ydre problem, brugeren skal løse
  // først: årstallet ligger uden for programmets ramme uanset hvilken dag der vælges.
  if (resolvedYear < MIN_REPRESENTABLE_DATE_YEAR || resolvedYear > MAX_REPRESENTABLE_DATE_YEAR) {
    return invalidDate('yearOutOfRepresentableRange', DATE_YEAR_OUT_OF_RANGE_MESSAGE);
  }

  // Kanonisk dag-i-måned-validering (skudår mv.) – én sand kilde i isValidDate,
  // frem for ad hoc Date.UTC(...,0)-konstruktion her.
  if (!isValidDate(dayNum, monthNum, resolvedYear)) {
    return invalidDate('nonexistentDay', NONEXISTENT_DAY_MESSAGE);
  }

  const danish = `${String(dayNum).padStart(2, '0')}-${String(monthNum).padStart(2, '0')}-${String(resolvedYear)}`;
  const iso = coerceToISODateString(danish);
  // Uopnåelig i praksis: årstal og kalenderdag er allerede kontrolleret ovenfor mod præcis de regler,
  // `isISODateString` håndhæver. Grenen bevares som fail-closed sikkerhedsnet, ikke som en brugertilstand.
  if (!iso) return INVALID_DATE;

  return { ok: true, danish, iso };
};
