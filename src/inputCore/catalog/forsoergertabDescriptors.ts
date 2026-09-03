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
import { FORSOERGERTAB_SKADELIDTES_KOEN_LABEL } from '../../domain/forsoergertab/forsoergertabLabels';
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

/**
 * Virkningsdatoens navn – ÉT sted (BB-120).
 *
 * Feltet hed før «Startdato for ASL-ydelse» på skærmen og i dokumentet, mens grænsebeskeden sagde
 * «Virkningsdato kan senest være …» – et ord, der ikke fandtes nogen steder på skærmen, så brugeren fik en
 * fejl om et felt, han ikke kunne finde. Udvikleren har afgjort (2026-08-28), at det juridisk formelle
 * «virkningsdato» er det navn, der skal bruges konsekvent. Både labelen, `maxBoundFieldLabel` og
 * beregningsdatoens `origin`-tekst læser denne konstant, så de tre ikke kan drifte fra hinanden igen.
 */
const VIRKNINGSDATO_LABEL = 'Virkningsdato';

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
  // Både Skadedato og Virkningsdato hæver gulvet; `narrowMin` tager den højeste af dem.
  narrowMin: (context) => {
    const skadedatoMin = resolveSkadedatoMin(context.view.readCanonical(stamdataSkadedatoField.bind()));
    const virkningsdato = context.view.readCanonical(forsoergertabVirkningsdatoField.bind());
    return virkningsdato === undefined ? skadedatoMin : maxISO(skadedatoMin, virkningsdato);
  },
  special: (context) => {
    const skadedato = context.view.readCanonical(stamdataSkadedatoField.bind());
    const virkningsdato = context.view.readCanonical(forsoergertabVirkningsdatoField.bind());
    const skadedatoMin = resolveSkadedatoMin(skadedato);
    const minFromVirkningsdato = virkningsdato !== undefined && virkningsdato >= skadedatoMin;
    return {
      ...(minFromVirkningsdato
        ? { minBoundKind: 'efterFelt' as const, minBoundReferenceISO: virkningsdato, minBoundLabel: VIRKNINGSDATO_LABEL.toLowerCase() }
        : skadedato !== undefined && skadedato > dateRanges_forsoergertab.beregningsdato.fallbackMin
          ? { minBoundKind: 'skadedato' as const, minBoundReferenceISO: skadedato }
          : {}),
      maxBoundKind: 'dataCoverageMax' as const,
      maxBoundFieldLabel: 'Beregningsdato',
    };
  },
  // Min udledes af Skadedato og Virkningsdato; en for sen af dem gør intervallet umuligt.
  origin: (context) => derivedDateBounds(
    `${resolveStamdataDatoReferenceFromView(context.view).label} og ${VIRKNINGSDATO_LABEL}`
  ),
}));

// Virkningsdatoen for ASL-ydelsen: min = skadedatoMin; max = min(dataCoverageMax, beregningsdato).
export const forsoergertabVirkningsdatoField = dateField('virkningsdato', VIRKNINGSDATO_LABEL, dateBounds({
  min: () => dateRanges_forsoergertab.virkningsdato.fallbackMin,
  max: () => dateRanges_forsoergertab.virkningsdato.max,
  narrowMin: (context) => resolveSkadedatoMin(context.view.readCanonical(stamdataSkadedatoField.bind())),
  // Beregningsdatoen sænker loftet: ydelsen kan ikke starte efter den dato, der beregnes til.
  narrowMax: (context) => context.view.readCanonical(forsoergertabBeregningsdatoField.bind()),
  /**
   * Loftet navngiver den dato, det kommer fra (BB-127).
   *
   * Er beregningsdatoen den bindende grænse, sagde beskeden før blot «Dato skal være mellem 10-06-2020 og
   * 01-07-2025» – to bare datoer uden afsender, hvor brugeren selv skulle gætte, at `01-07-2025` var den
   * beregningsdato, han netop havde skrevet lige ovenfor. Modparten i parret (Beregningsdato) navngav til
   * gengæld SIN grænse. Nu er de to hinandens spejlbillede, hver set fra sit eget felts synsvinkel.
   */
  special: (context) => {
    const beregningsdato = context.view.readCanonical(forsoergertabBeregningsdatoField.bind());
    return beregningsdato !== undefined && beregningsdato < dateRanges_forsoergertab.virkningsdato.max
      ? {
        maxBoundKind: 'efterFelt',
        maxBoundFieldLabel: 'Beregningsdato',
        maxBoundReferenceISO: beregningsdato,
      }
      : { maxBoundKind: 'dataCoverageMax', maxBoundFieldLabel: VIRKNINGSDATO_LABEL };
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
  // Labelen er navneautoriteten for feltets fejltekster og oplæsning, så den skal bære samme ordlyd som
  // rækken på skærmen og i dokumentet (BB-134/BB-137).
  label: FORSOERGERTAB_SKADELIDTES_KOEN_LABEL,
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
  // Enheden står i beskeden (BB-125): «Værdi skal være mellem 1 og 10» siger ikke, at der tælles ÅR.
  validators: [integerBoundsValidator(
    'forsoergertab.tilkendtForPeriodeAar.bounds', TILKENDT_PERIODE_MIN_AAR, TILKENDT_PERIODE_MAX_AAR, 'år'
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
