import type { Koen } from '../../schemas/formSchemas/enumSchemas';
import type { ISODateString } from '../../types/branded';
import { dateRanges_forsoergertab } from '../../config/dateRanges';
import { maxISO } from '../../utils/isoDateHelpers';
import { derivedDateBounds, STATIC_DATE_BOUNDS } from '../../utils/dateRangeErrorMessages';
import { dateBounds } from './dateBoundsValidators';
import type { DateBoundsSpec } from '../dateBoundsDeclaration';
import {
  createChoiceFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldDescriptor, FieldValidator } from '../fieldDescriptor';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';
import { integerBoundsValidator } from './boundsValidators';
import { digitsRequiredFor } from './fieldLengthLimits';
import {
  resolveStamdataDatoReferenceFromView,
  stamdataSkadedatoField,
} from './stamdataDescriptors';

// Produkt-descriptors for `forsoergertab`-sektionen (§3.2). Kun top-level skalarer.
//
// **Datogrænser (§1.6):** de dynamiske min/max-grænser er canonical bounds-FELTVALIDATORER på
// descriptoren. En schema-repræsenterbar dato uden for grænsen committes canonical (kan gemmes i `.eo`) og
// bærer et rødt bounds-issue, som readeren skjuler for afhængige consumers. Grænser og beskedtekst kommer
// fra `dateRanges_forsoergertab` og `resolveDateRangeErrorMessage`. Krydsfeltafhængigheder læses via
// `view.readCanonical`, fordi grænsen afledes af den canonical virkningsdato/skadedato.

const createEmptyForsoergertabSection = (): unknown => ({});

// Mangler skadedatoen, bruges den faste fallbackgrænse.
const resolveSkadedatoMin = (skadedato: ISODateString | undefined): ISODateString =>
  skadedato ?? dateRanges_forsoergertab.virkningsdato.fallbackMin;

/** Grænserne er PÅKRÆVEDE og leveres som en `dateBounds(...)`-spredning (erklæring + validator i ét). */
const dateField = (
  field: string,
  label: string,
  bounds: Readonly<{
    dateBounds: DateBoundsSpec;
    validators: readonly FieldValidator<ISODateString | undefined>[];
  }>
): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `forsoergertab.${field}`,
    template: { section: 'forsoergertab', path: [], field },
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyForsoergertabSection,
    ...bounds,
  });

// Efterladtes fødselsdato: statisk 1900-01-01 .. i dag (dateRanges_forsoergertab.efterladteFodselsdato).
export const forsoergertabEfterladteFodselsdatoField = dateField(
  'efterladteFodselsdato', 'Efterladte ægtefælle/samlevers fødselsdato',
  dateBounds({
    min: () => dateRanges_forsoergertab.efterladteFodselsdato.min,
    max: () => dateRanges_forsoergertab.efterladteFodselsdato.max,
    // Begge grænser er konstanter fra konfigurationen; intervallet kan ikke blive umuligt.
    origin: STATIC_DATE_BOUNDS,
  }),
);

// Beregningsdato: min = max(skadedatoMin, virkningsdato); max = forsørgertab-datadækning (dataCoverageMax).
export const forsoergertabBeregningsdatoField = dateField('beregningsdato', 'Beregningsdato', dateBounds({
  min: () => dateRanges_forsoergertab.beregningsdato.fallbackMin,
  max: () => dateRanges_forsoergertab.beregningsdato.max,
  // Både Skadedato og Startdato for ASL-ydelse hæver gulvet; `narrowMin` tager den højeste af dem.
  narrowMin: (context) => {
    const skadedatoMin = resolveSkadedatoMin(context.view.readCanonical(stamdataSkadedatoField.bind()));
    const virkningsdato = context.view.readCanonical(forsoergertabVirkningsdatoField.bind());
    return virkningsdato === undefined ? skadedatoMin : maxISO(skadedatoMin, virkningsdato);
  },
  special: () => ({ maxBoundKind: 'dataCoverageMax', maxBoundFieldLabel: 'Beregningsdato' }),
  // Min udledes af Skadedato og Startdato for ASL-ydelse; en for sen af dem gør intervallet umuligt.
  origin: (context) => derivedDateBounds(
    `${resolveStamdataDatoReferenceFromView(context.view).label} og Startdato for ASL-ydelse`
  ),
}));

// Startdato for ASL-ydelse (virkningsdato): min = skadedatoMin; max = min(dataCoverageMax, beregningsdato).
// Legacy: `minDate={snapshot.inputBounds.skadedatoMin}` / `maxDate={snapshot.inputBounds.virkningsdatoMax}`.
export const forsoergertabVirkningsdatoField = dateField('virkningsdato', 'Startdato for ASL-ydelse', dateBounds({
  min: () => dateRanges_forsoergertab.virkningsdato.fallbackMin,
  max: () => dateRanges_forsoergertab.virkningsdato.max,
  narrowMin: (context) => resolveSkadedatoMin(context.view.readCanonical(stamdataSkadedatoField.bind())),
  // Beregningsdatoen sænker loftet: ydelsen kan ikke starte efter den dato, der beregnes til.
  narrowMax: (context) => context.view.readCanonical(forsoergertabBeregningsdatoField.bind()),
  special: (context) => {
    const beregningsdato = context.view.readCanonical(forsoergertabBeregningsdatoField.bind());
    return beregningsdato !== undefined && beregningsdato < dateRanges_forsoergertab.virkningsdato.max
      ? undefined
      : { maxBoundKind: 'dataCoverageMax', maxBoundFieldLabel: 'Virkningsdato' };
  },
  // Min fra Skadedato, max fra Beregningsdato: en Beregningsdato før Skadedato gør intervallet umuligt.
  origin: (context) => derivedDateBounds(
    `${resolveStamdataDatoReferenceFromView(context.view).label} og Beregningsdato`
  ),
}));

export const forsoergertabKoenField = defineStructuralField<Koen | undefined>({
  id: 'forsoergertab.koen',
  template: { section: 'forsoergertab', path: [], field: 'koen' },
  codec: createChoiceFieldCodec<Koen>(['Mand', 'Kvinde']),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Køn',
  controlKind: 'choice',
  createEmptySection: createEmptyForsoergertabSection,
});

// 1..10 er en domænegrænse (afledt bounds-issue), ikke en codec-parseregel. Cifferloftet UDLEDES af
// maksimum, så indtastningsgrænsen og talværdigrænsen ikke kan komme fra hinanden ved en senere ændring.
const TILKENDT_PERIODE_MIN_AAR = 1;
const TILKENDT_PERIODE_MAX_AAR = 10;
export const forsoergertabTilkendtForPeriodeAarField = defineStructuralField<number | undefined>({
  id: 'forsoergertab.tilkendtForPeriodeAar',
  template: { section: 'forsoergertab', path: [], field: 'tilkendtForPeriodeAar' },
  codec: createIntegerFieldCodec({
    allowNegative: false,
    maxDigits: digitsRequiredFor(TILKENDT_PERIODE_MAX_AAR),
  }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Tilkendt for periode',
  controlKind: 'text',
  createEmptySection: createEmptyForsoergertabSection,
  validators: [integerBoundsValidator(
    'forsoergertab.tilkendtForPeriodeAar.bounds', TILKENDT_PERIODE_MIN_AAR, TILKENDT_PERIODE_MAX_AAR
  )],
});

export const forsoergertabFields = catalogFields(
  forsoergertabEfterladteFodselsdatoField,
  forsoergertabBeregningsdatoField,
  forsoergertabVirkningsdatoField,
  forsoergertabKoenField,
  forsoergertabTilkendtForPeriodeAarField,
);
export const forsoergertabCollections = catalogCollections();
