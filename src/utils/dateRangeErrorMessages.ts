import { isoToDanish } from '../types/branded';
import type { ISODateString } from '../types/branded';
import { getToday } from '../config/dateRanges';
import { validateISODateRange } from './isoDateHelpers';
import { DATE_ORDER_ERROR_MESSAGE } from './dateOrderValidation';

export type DateRangeSpecialErrors = {
  /** Kontekstnavnet på stamdata-datoen, når beskeden handler om den. */
  stamdataDatoReference?: Readonly<{ label: string; labelLower: string }>;
  /**
   * Bruges til parrede "Fra-dato" / "Til-dato"-inputs, hvor max/min udledes fra det andet felt.
   */
  fraTilRole?: 'fra' | 'til';
  /**
   * Identificerer min-grænsens semantiske oprindelse til domæne-specifikke fejlbeskeder.
   */
  minBoundKind?: 'skadedato' | 'anmeldelsesdatoMinus5Aar' | 'kapDatoFoerAfgoerelsesdato' | 'efterAnvendtReguleringsdato' | 'fodselsdato' | 'efterFelt';
  /**
   * Den brugersynlige referencedato, der frembragte grænsen (typisk Skadedato/Anmeldelsesdato).
   * Bruges til specielle beskeder, der skal nævne den konkrete referencedato.
   */
  minBoundReferenceISO?: ISODateString;
  /**
   * Brugervendt navn på min-grænsen inkl. evt. dato, fx
   * "beregningsperiodens udløb (08-10-2023)".
   */
  minBoundLabel?: string;
  /**
   * Når sat, overskriver den den generiske max-dato-fejl med "[fieldLabel] kan senest være 31. december ÅÅÅÅ".
   * Året udtrækkes fra maxDate. Bruges til EET-felter afgrænset af data-dækningsår.
   */
  maxBoundKind?: 'eetDataMax' | 'dataCoverageMax' | 'foerAfgoerelsesdato' | 'foerFoersteTafFraDato' | 'skadedato' | 'efterFelt';
  /** Feltlabelet brugt i maxBoundKind-fejlbeskeden, fx "Beregningsdato". */
  maxBoundFieldLabel?: string;
  /**
   * Referencedatoen vist i 'foerAfgoerelsesdato'-max-grænsefejlbeskeden.
   * Skal være rækkens afgørelsesdato (ikke den udledte max = subtractOneDay(afgørelsesdato)).
   */
  maxBoundReferenceISO?: ISODateString;
};

const formatISOForTooltip = (iso: ISODateString): string => isoToDanish(iso) ?? iso;

/**
 * Hvor intervallets grænser kommer fra – og dermed om et UMULIGT interval (min > max) kan opstå.
 *
 * `'static'`: begge grænser er konstanter fra `dateRanges`-konfigurationen. `min > max` er da urepræsenterbart,
 * og der findes intet årsagsinput at nævne, fordi brugeren ikke har frembragt grænserne.
 *
 * `'derived'`: mindst én grænse er udledt af ANDRE felters værdier. Her KAN intervallet blive umuligt, og
 * beskeden skal navngive de inputs, brugeren skal rette – ellers får de at vide, at ingen dato er gyldig, uden
 * at vide hvorfor. Derfor er `causeInputs` PÅKRÆVET i netop denne arm: kravet er en TYPE, ikke en konvention,
 * så et nyt dynamisk datofelt ikke kan glemme årsagen og lydløst vise den halve besked.
 */
export type DateRangeBoundsOrigin =
  | Readonly<{ kind: 'static' }>
  | Readonly<{ kind: 'derived'; causeInputs: string }>;

/** Statiske grænser: ét delt objekt, så det almindelige tilfælde ikke allokerer pr. validering. */
export const STATIC_DATE_BOUNDS: DateRangeBoundsOrigin = Object.freeze({ kind: 'static' });

/** Udledte grænser fra navngivne inputs. Navnene vises ordret til brugeren. */
export const derivedDateBounds = (causeInputs: string): DateRangeBoundsOrigin =>
  Object.freeze({ kind: 'derived', causeInputs });

export const resolveDateRangeErrorMessage = (args: {
  iso: ISODateString;
  minDate: ISODateString | undefined;
  maxDate: ISODateString | undefined;
  special?: DateRangeSpecialErrors;
  /**
   * Grænsernes oprindelse. PÅKRÆVET: den afløste `noValidRangeInputs?: string` gjorde årsagen valgfri, og de
   * fleste descriptors udelod den derfor – brugeren fik at vide, at ingen dato var gyldig, men ikke hvilke
   * inputs der skulle rettes.
   */
  bounds: DateRangeBoundsOrigin;
}): string => {
  const { iso, minDate, maxDate, special, bounds } = args;

  // Umuligt interval (tidligst tilladte efter senest tilladte) har forrang over alle
  // andre beskeder: når ingen dato er mulig, er den vigtigste oplysning netop dét,
  // med begge grænser (jf. AGENTS.md §Validering og fejl-UI).
  if (minDate && maxDate && minDate > maxDate) {
    // Kun udledte grænser kan nå hertil i praksis; statiske intervaller er gyldige pr. konstruktion. Er en
    // statisk konfiguration alligevel selvmodsigende, er det en KONFIGURATIONSfejl uden brugerinput at rette,
    // og beskeden nævner derfor ingen årsag frem for at pege på et vilkårligt felt.
    const inputCause = bounds.kind === 'derived' ? ` Grænserne kommer fra ${bounds.causeInputs}.` : '';
    return `Der findes ingen gyldig dato her: tidligst tilladte (${formatISOForTooltip(minDate)}) ligger efter senest tilladte (${formatISOForTooltip(maxDate)}).${inputCause}`;
  }

  // Bound-kind-beskeder skal have forrang over parrede Fra/Til-beskeder for at undgå misvisende output.
  // Eksempel: når den effektive min er "Skadedato", er den korrekte besked om Skadedato, ikke "Til < Fra".
  //
  // «Dags dato» kræver, at grænsen FAKTISK er kalenderen – ikke blot at den tilfældigvis lander på i dag.
  // Er max udledt af et andet felt (`kind: 'derived'`), navngiver `maxBoundFieldLabel`-grenen nedenfor
  // kilden i stedet. Uden det forbehold tilskrev beskeden grænsen det forkerte ophav i netop det
  // hyppigste tilfælde: en beregningsdato sat med «Indsæt dags dato» er dags dato, og brugeren fik at
  // vide, at datoen lå i fremtiden, mens han i virkeligheden skulle flytte beregningsdatoen (BB-043).
  if (bounds.kind === 'static' && maxDate && maxDate === getToday() && iso > maxDate) {
    return `Datoen er efter dags dato (${formatISOForTooltip(maxDate)})`;
  }

  if (special?.minBoundKind === 'skadedato' && minDate && iso < minDate) {
    const reference = special.minBoundReferenceISO ?? minDate;
    const labelLower = special.stamdataDatoReference?.labelLower ?? 'skadedatoen';
    return `Datoen kan ikke være før ${labelLower} (${formatISOForTooltip(reference)})`;
  }

  if (special?.minBoundKind === 'anmeldelsesdatoMinus5Aar' && minDate && iso < minDate) {
    const reference = special.minBoundReferenceISO ?? minDate;
    const labelLower = special.stamdataDatoReference?.labelLower ?? 'anmeldelsesdatoen';
    return `Datoen er mere end 5 år før ${labelLower} (${formatISOForTooltip(reference)})`;
  }

  if (special?.minBoundKind === 'kapDatoFoerAfgoerelsesdato' && minDate && iso < minDate) {
    const reference = special.minBoundReferenceISO ?? minDate;
    return `Kapitaliseringsdato kan ikke være før afgørelsesdatoen (${formatISOForTooltip(reference)})`;
  }

  if (special?.minBoundKind === 'efterAnvendtReguleringsdato' && minDate && iso < minDate) {
    const reference = special.minBoundReferenceISO ?? minDate;
    const referenceLabel = special.minBoundLabel ?? `reguleringsdatoen (${formatISOForTooltip(reference)})`;
    return `Datoen for anciennitetstillæg skal være efter ${referenceLabel}`;
  }

  if (special?.minBoundKind === 'fodselsdato' && minDate && iso < minDate) {
    const reference = special.minBoundReferenceISO ?? minDate;
    const label = special.stamdataDatoReference?.label ?? 'Skadedato';
    return `Der er angivet en ${label.toLowerCase()} før skadelidtes fødselsdato (${formatISOForTooltip(reference)})`;
  }

  if (special?.minBoundKind === 'efterFelt' && minDate && iso < minDate) {
    const reference = special.minBoundReferenceISO ?? minDate;
    const label = special.minBoundLabel ?? 'den tidligst tilladte dato';
    return `Datoen kan ikke være før ${label} (${formatISOForTooltip(reference)})`;
  }

  if ((special?.maxBoundKind === 'eetDataMax' || special?.maxBoundKind === 'dataCoverageMax') && maxDate && iso > maxDate) {
    const label = special.maxBoundFieldLabel ?? 'Datoen';
    return `${label} kan senest være ${formatISOForTooltip(maxDate)}`;
  }

  if (special?.maxBoundKind === 'foerAfgoerelsesdato' && maxDate && iso > maxDate) {
    const reference = special.maxBoundReferenceISO ?? maxDate;
    return `Tidl. kap.dato skal være før afgørelsesdatoen (${formatISOForTooltip(reference)})`;
  }

  if (special?.maxBoundKind === 'foerFoersteTafFraDato' && maxDate && iso > maxDate) {
    const reference = special.maxBoundReferenceISO ?? maxDate;
    return `Referenceperioden skal ligge før første TAF-periode (${formatISOForTooltip(reference)})`;
  }

  // Grænsen er et ANDET felts værdi. Beskeden navngiver kilden frem for at lade brugeren gætte, hvor
  // tallet kommer fra – og frem for at tilskrive det kalenderen, når det tilfældigvis er dags dato
  // (BB-043). `maxBoundFieldLabel` er feltets brugervendte navn i mundret, bestemt form.
  if (special?.maxBoundKind === 'efterFelt' && maxDate && iso > maxDate) {
    const reference = special.maxBoundReferenceISO ?? maxDate;
    const label = special.maxBoundFieldLabel ?? 'den senest tilladte dato';
    return `Datoen er efter ${label} (${formatISOForTooltip(reference)})`;
  }

  if (special?.maxBoundKind === 'skadedato' && maxDate && iso > maxDate) {
    const reference = special.maxBoundReferenceISO ?? maxDate;
    const label = special.stamdataDatoReference?.label.toLowerCase() ?? 'skadedato';
    return `Fødselsdatoen ligger efter den angivne ${label} (${formatISOForTooltip(reference)})`;
  }

  if (special?.fraTilRole === 'fra' && maxDate && iso > maxDate) {
    return DATE_ORDER_ERROR_MESSAGE;
  }
  if (special?.fraTilRole === 'til' && minDate && iso < minDate) {
    return DATE_ORDER_ERROR_MESSAGE;
  }

  return validateISODateRange(iso, minDate, maxDate).errorMessage;
};
