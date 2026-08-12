import type { ISODateString } from '../../types/branded';
import { dateRange_systemramme } from '../../config/dateRanges';
import { NONEXISTENT_DAY_MESSAGE } from '../../utils/dateDraftCommit';
import { formatISOToDanish } from '../../utils/dateFormatting';
import { maxISO, minISO } from '../../utils/isoDateHelpers';
import {
  derivedDateBounds,
  resolveDateRangeErrorMessage,
  STATIC_DATE_BOUNDS,
} from '../../utils/dateRangeErrorMessages';
import type { DateRangeSpecialErrors } from '../../utils/dateRangeErrorMessages';
import type { FieldValidator } from '../fieldDescriptor';
import { isUnconstrainedDateBounds } from '../dateBoundsDeclaration';
import type {
  DateBoundResolver,
  DateBoundsContext,
  DateBoundsDeclaration,
  DateBoundsOriginSpec,
  DateBoundsSpec,
} from '../dateBoundsDeclaration';

// Datofelternes bounds-regel: ÉT sted, alle datofelter arver.
//
// Baggrunden er et strukturelt hul, ikke en enkeltfejl. `src/config/dateRanges.ts` DEKLARERER grænser for
// hvert datofelt, men intet bandt deklarationen til håndhævelsen: hver validator var håndskrevet på sin egen
// descriptor, så et felt havde grænser præcis hvis nogen huskede at skrive dem. Målingen 2026-08-09 viste, at
// 31 af 54 datofelter accepterede både år 1900 og år 2100 uden ét eneste issue — konfigurationen sagde ét, og
// programmet gjorde noget andet. En runtime-audit fandt kun 3 af de 31, fordi den prøvede
// felter stikprøvevis; hullet var aldrig lokalt for de felter, den nåede at ramme.
//
// Derfor er reglen nu DATA (en `DateBoundsSpec`) frem for kode pr. felt: et datofelt erklærer sine grænser, og
// denne fil oversætter erklæringen til det `FieldIssue`, den røde ring og tooltippet kræver. Værnet
// `dateFieldsDeclareBounds.test.ts` håndhæver, at ethvert datofelt i produktionskataloget bærer en erklæring —
// også den bevidst grænseløse (`unconstrainedDateBounds`), som skal fravælges aktivt og med en begrundelse.
//
// Grænserne læses PÅ VALIDERINGSTIDSPUNKTET (thunks), ikke når kataloget bygges. Flere grænser afhænger af
// dags dato; blev de indfanget ved modulets import, ville en session hen over midnat validere mod gårsdagens
// maksimum. Se `getToday` i `dateRanges.ts`, som løste samme fejl ét lag nede.

const resolveBound = (
  resolver: DateBoundResolver,
  context: DateBoundsContext
): ISODateString =>
  typeof resolver === 'function'
    ? (resolver as (c: DateBoundsContext) => ISODateString)(context)
    : resolver;

const toSpecialIssueDetail = (
  special: DateRangeSpecialErrors | undefined
): Readonly<Record<string, string | number | boolean>> => {
  if (special === undefined) return {};

  return {
    ...(special.fraTilRole === undefined ? {} : { fraTilRole: special.fraTilRole }),
    ...(special.minBoundKind === undefined ? {} : { minBoundKind: special.minBoundKind }),
    ...(special.minBoundReferenceISO === undefined ? {} : { minBoundReferenceISO: special.minBoundReferenceISO }),
    ...(special.minBoundLabel === undefined ? {} : { minBoundLabel: special.minBoundLabel }),
    ...(special.maxBoundKind === undefined ? {} : { maxBoundKind: special.maxBoundKind }),
    ...(special.maxBoundFieldLabel === undefined ? {} : { maxBoundFieldLabel: special.maxBoundFieldLabel }),
    ...(special.maxBoundReferenceISO === undefined ? {} : { maxBoundReferenceISO: special.maxBoundReferenceISO }),
  };
};

/**
 * Oversætter en `DateBoundsSpec` til feltets bounds-validator.
 *
 * Sammenligningen er inklusiv i begge ender: grænserne er tilladte værdier, ikke forbudte.
 * `code` følger den etablerede form `<descriptor.id>.bounds`, så tooltip, "Fejl og advarsler" og
 * download-gaten kan genkende issuet på tværs af felter.
 */
export const dateBoundsValidator = (
  spec: DateBoundsSpec
): FieldValidator<ISODateString | undefined> => (value, field, view) => {
  if (value === undefined) return undefined;
  const context: DateBoundsContext = { view, field };

  const outerMin = resolveBound(spec.min, context);
  const outerMax = resolveBound(spec.max, context);
  const narrowedMin = spec.narrowMin?.(context);
  const narrowedMax = spec.narrowMax?.(context);

  // Skærpelser kan kun indsnævre. maxISO/minISO gør reglen strukturel frem for at bero på,
  // at hvert kaldssted husker at kombinere korrekt.
  const minDate = narrowedMin === undefined
    ? outerMin
    : maxISO(outerMin, narrowedMin);
  const maxDate = narrowedMax === undefined
    ? outerMax
    : minISO(outerMax, narrowedMax);

  const belowMin = minDate !== undefined && value < minDate;
  const aboveMax = maxDate !== undefined && value > maxDate;
  if (!belowMin && !aboveMax) return undefined;

  const origin = typeof spec.origin === 'function' ? spec.origin(context) : spec.origin;
  const special = spec.special?.(context);

  return {
    reason: 'bounds',
    code: `${field.descriptor.id}.bounds`,
    message: resolveDateRangeErrorMessage({
      iso: value,
      minDate,
      maxDate,
      bounds: origin,
      ...(special === undefined ? {} : { special }),
    }),
    detail: {
      ...(minDate === undefined ? {} : { minDate }),
      ...(maxDate === undefined ? {} : { maxDate }),
      ...toSpecialIssueDetail(special),
    },
  };
};

/**
 * Den brugervendte tekst for et datofelt, hvis RÅTEKST blev afvist af en grund, der kan udtrykkes konkret.
 *
 * **Hvorfor teksten dannes her og ikke i codec'et.** Et codec er generisk: det kender formatet, men ikke
 * feltet. Parse-kernen kan konstatere, at årstallet ligger uden for det repræsenterbare domæne
 * (1900..2100) — men det er en egenskab ved `ISODateString`, ikke feltets regel. Sagde codec'et selv
 * «Årstallet skal være mellem 1900 og 2100», ville beskeden MODSIGE feltets faktiske grænse: Fødselsdato
 * slutter ved dags dato, ikke ved år 2100, og en dato efter i dag har allerede sin egen, korrekte besked.
 *
 * Her er feltets `dateBounds`-erklæring derimod kendt, og de samme grænser, som en canonical værdi ville
 * blive målt mod, kan derfor navngives med KONKRETE datoer — den samme ordlyd, brugeren får for en dato,
 * der lige akkurat ER repræsenterbar. De to fejlformer bliver dermed ikke til to forskellige sprog.
 *
 * Returnerer `undefined`, når der ikke kan siges noget bedre end den generiske «Fejl i indtastning».
 */
export const resolveDateFormatIssueText = (
  declaration: DateBoundsDeclaration | undefined,
  dateInvalidKind: string,
  context: DateBoundsContext
): string | undefined => {
  if (dateInvalidKind === 'nonexistentDay') return NONEXISTENT_DAY_MESSAGE;
  if (dateInvalidKind !== 'yearOutOfRepresentableRange') return undefined;
  // Et grænseløst felt har ingen konkrete datoer at nævne. Den generiske tekst er da det ærlige svar —
  // bedre end at opfinde en ramme, feltet ikke har.
  if (declaration === undefined || isUnconstrainedDateBounds(declaration)) return undefined;

  const minDate = resolveBound(declaration.min, context);
  const maxDate = resolveBound(declaration.max, context);
  // Kun de YDRE grænser bruges. En skærpelse udledt af andre felter kan ikke gøres skarpere af en værdi,
  // der aldrig blev canonical, og et umuligt interval ville her beskrive en tilstand, råteksten ikke nåede.
  return `Dato skal være mellem ${formatISOToDanish(minDate)} og ${formatISOToDanish(maxDate)}`;
};

/**
 * Systemets ydre ramme som spec — for datofelter uden en skarpere domæneregel.
 *
 * Grænserne er statiske konfigurationskonstanter, så oprindelsen er `STATIC_DATE_BOUNDS`: der findes intet
 * brugerinput at pege på, og et umuligt interval kan ikke opstå. Læses via gettere, fordi rammens max er
 * «31-12 året efter indeværende» og dermed flytter sig ved årsskifte.
 */
export const systemrammeSpec: DateBoundsSpec = {
  min: () => dateRange_systemramme.min,
  max: () => dateRange_systemramme.max,
  origin: STATIC_DATE_BOUNDS,
};

/**
 * Erklæringen OG dens validator i ét kald.
 *
 * Findes for at gøre de to uadskillelige. Var de to separate felter på descriptoren, kunne et felt erklære
 * grænser og glemme validatoren — og så ville værnet se en erklæring, mens brugeren fortsat kunne indtaste
 * år 1900. Præcis den slags "deklaration uden håndhævelse" er den fejl, hele denne fil findes for at lukke.
 *
 * Spredes ind i descriptor-konfigurationen: `...dateBounds(spec)` eller `...dateBounds(spec, [extraValidator])`.
 * Ekstra validatorer (typisk `dateOrderValidator`) kommer FØRST, fordi kronologireglen er den mest konkrete
 * besked, og §1.8 viser højst ét issue pr. felt. Den tredje parameter er kun til et domæne, hvor én samlet
 * validator allerede fletter den samme ydre erklæring med mere detaljerede rollegrænser; den erstatter
 * standardvalidatoren for at undgå to konkurrerende bounds-issues.
 */
export const dateBounds = (
  spec: DateBoundsSpec,
  extraValidators: readonly FieldValidator<ISODateString | undefined>[] = [],
  boundsValidatorFactory: (spec: DateBoundsSpec) => FieldValidator<ISODateString | undefined> = dateBoundsValidator
): Readonly<{
  dateBounds: DateBoundsSpec;
  validators: readonly FieldValidator<ISODateString | undefined>[];
}> => Object.freeze({
  dateBounds: spec,
  validators: Object.freeze([...extraValidators, boundsValidatorFactory(spec)]),
});

/**
 * Genbrugelig oprindelse: statisk indtil en skærpelse faktisk er aktiv, derefter navngivet.
 *
 * Skelnen er ikke kosmetisk. Et umuligt interval kan KUN opstå, når en skærpelse er i spil, og netop da
 * skal beskeden navngive de felter, brugeren skal rette. Er ingen skærpelse aktiv, er grænserne
 * konfigurationskonstanter, og der findes intet brugerinput at pege på.
 */
export const originWhenNarrowed = (
  causeInputs: string,
  isNarrowed: (context: DateBoundsContext) => boolean
): DateBoundsOriginSpec => (context) =>
  isNarrowed(context) ? derivedDateBounds(causeInputs) : STATIC_DATE_BOUNDS;
