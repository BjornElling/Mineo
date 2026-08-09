import { productionInputFields } from '../../inputCore/catalog/productionCatalog';
import { isUnconstrainedDateBounds, type DateBoundsContext } from '../../inputCore/dateBoundsDeclaration';
import type { CanonicalView, FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';
import type { ISODateString } from '../../types/branded';
import { maxISO, minISO } from '../../utils/isoDateHelpers';

// VÆRN: ethvert datofelt i produktionskataloget håndhæver erklærede grænser.
//
// Baggrund. `src/config/dateRanges.ts` DEKLAREREDE grænser for hvert datofelt, men intet bandt
// deklarationen til håndhævelsen: hver validator var håndskrevet pr. descriptor, så et felt havde grænser
// præcis hvis nogen huskede at skrive dem. Målingen 2026-08-09 viste 31 af 54 datofelter, der accepterede
// BÅDE år 1900 og år 2100 uden ét issue — heriblandt alle fem AES-datoer, differencekravsdatoen og
// samtlige EO-tabellers dato-par. En runtime-audit nåede kun at ramme 3 af dem.
//
// Værnet måler ADFÆRD, ikke kildekode. En descriptor kunne bære en `dateBounds`-erklæring, som ingen
// validator læste, og et regex/AST-værn ville da være grønt, mens brugeren fortsat kunne indtaste år 1900.
// Derfor kaldes feltets faktiske validatorer med en dato langt uden for enhver tænkelig grænse.

/**
 * Prøvedatoerne udledes af feltets EGEN erklæring — én global datopar duer ikke.
 *
 * Fødselsdato-felterne har `01-01-1900` som deres LOVLIGE min, så en fast prøve nær år 1900 ville kalde
 * korrekt adfærd for en fejl. I stedet prøves dagen FØR feltets erklærede min og dagen EFTER dets max,
 * med ISO-domænets yderpunkter (1900..2100) som loft: kan en grænse ikke overskrides inden for det
 * repræsenterbare, er den pr. konstruktion ikke et hul.
 */
const ISO_DOMAIN_MIN = '1900-01-01';
const ISO_DOMAIN_MAX = '2100-12-31';

const dayBefore = (iso: string): string => shiftIsoDay(iso, -1);
const dayAfter = (iso: string): string => shiftIsoDay(iso, 1);

const shiftIsoDay = (iso: string, deltaDays: number): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
};

/** Canonical view hvor INTET andet felt er udfyldt: den tilstand, en bruger møder i en ny sag. */
const emptyView = {
  readCanonical: () => undefined,
} as unknown as CanonicalView;

/** En afhængighedsdato, der aktiverer alle almindelige krydsfelt-skarpelser. */
const ACTIVE_DEPENDENCY_DATE = '2020-01-01';
const activeDependencyView = {
  readCanonical: <T>(_field: FieldRef<T>): T => ACTIVE_DEPENDENCY_DATE as T,
} as CanonicalView;

const dateFields = productionInputFields.filter((field) => field.codec.family === 'date');

/** Binder feltet med et syntetisk række-id pr. entity-led i templaten. */
const bindWithSyntheticRows = (field: FieldDescriptor<unknown>): FieldRef<unknown> =>
  field.bind(...field.template.path.flatMap((segment) => segment.kind === 'entity' ? ['row-1'] : []));

/** Læser en erklæret grænse, uanset om den er en konstant, en thunk eller en kontekstfunktion. */
const resolveDeclaredBound = (bound: unknown, context: unknown): string | undefined =>
  typeof bound === 'function' ? (bound as (c: unknown) => string | undefined)(context) : bound as string;

const effectiveBoundsFor = (
  field: FieldDescriptor<unknown>,
  declaration: Exclude<NonNullable<FieldDescriptor<unknown>['dateBounds']>, { unconstrained: true }>,
  view: CanonicalView,
): Readonly<{ minDate: string | undefined; maxDate: string | undefined }> => {
  const context = {
    view,
    field: bindWithSyntheticRows(field) as unknown as FieldRef<ISODateString | undefined>,
  } as DateBoundsContext;
  const outerMin = resolveDeclaredBound(declaration.min, context);
  const outerMax = resolveDeclaredBound(declaration.max, context);
  const narrowedMin = declaration.narrowMin?.(context);
  const narrowedMax = declaration.narrowMax?.(context);
  return {
    minDate: narrowedMin === undefined
      ? outerMin
      : outerMin === undefined ? narrowedMin : maxISO(outerMin as ISODateString, narrowedMin),
    maxDate: narrowedMax === undefined
      ? outerMax
      : outerMax === undefined ? narrowedMax : minISO(outerMax as ISODateString, narrowedMax),
  };
};

const boundsReasonsFor = (
  field: FieldDescriptor<unknown>,
  iso: string,
  view: CanonicalView,
): readonly string[] => {
  const ref = bindWithSyntheticRows(field);
  return (field.validators ?? []).flatMap((validate) => {
    const issue = validate(iso, ref, view);
    return issue === undefined ? [] : [issue.reason];
  });
};

const assertDeclaredBoundsAreEnforced = (
  field: FieldDescriptor<unknown>,
  declaration: Exclude<NonNullable<FieldDescriptor<unknown>['dateBounds']>, { unconstrained: true }>,
  view: CanonicalView,
  viewLabel: string,
): void => {
  const { minDate, maxDate } = effectiveBoundsFor(field, declaration, view);

  // Kun grænser, der kan overskrides inden for det repræsenterbare domæne, kan udgøre et hul.
  if (minDate !== undefined && minDate > ISO_DOMAIN_MIN) {
    const candidate = dayBefore(minDate);
    expect(
      boundsReasonsFor(field, candidate, view),
      `${field.id} accepterede ${candidate} (${viewLabel}), som ligger under feltets effektive min ${minDate}. `
      + 'Erklæringen findes, men ingen validator håndhæver den — brug dateBounds(spec).',
    ).toContain('bounds');
  }
  if (maxDate !== undefined && maxDate < ISO_DOMAIN_MAX) {
    const candidate = dayAfter(maxDate);
    expect(
      boundsReasonsFor(field, candidate, view),
      `${field.id} accepterede ${candidate} (${viewLabel}), som ligger over feltets effektive max ${maxDate}. `
      + 'Erklæringen findes, men ingen validator håndhæver den — brug dateBounds(spec).',
    ).toContain('bounds');
  }
};

describe('datofelter håndhæver deres erklærede grænser', () => {
  it('finder datofelter i produktionskataloget (værnet kan ikke være grønt af tomhed)', () => {
    // Uden denne kontrol ville værnet bestå, hvis `family: 'date'` blev omdøbt eller kataloget tømt.
    expect(dateFields.length).toBeGreaterThanOrEqual(50);
  });

  it.each(dateFields.map((field) => [field.id, field] as const))(
    '%s afviser datoer uden for enhver grænse',
    (_id, field) => {
      const declaration = field.dateBounds;
      expect(
        declaration,
        `${field.id} mangler en dateBounds-erklæring. Erklær grænserne med dateBounds(...) — eller `
        + 'unconstrainedDateBounds("<begrundelse>"), hvis feltet bevidst ikke har nogen.',
      ).toBeDefined();

      if (declaration === undefined) return;

      // Et bevidst grænseløst felt skal bære sin begrundelse, men kan pr. definition ikke afvise noget.
      if (isUnconstrainedDateBounds(declaration)) {
        expect(declaration.reason.trim().length).toBeGreaterThan(0);
        return;
      }

      // Kør både uden afhængigheder og med en aktiv canonical afhængighed. Den første akse fanger manglende
      // ydre bounds; den anden fanger en dateBounds-validator, der håndhæver erklæringen men ignorerer
      // `narrowMin`/`narrowMax`.
      assertDeclaredBoundsAreEnforced(field, declaration, emptyView, 'tom view');
      assertDeclaredBoundsAreEnforced(field, declaration, activeDependencyView, 'aktiv afhængighed');
    },
  );
});
