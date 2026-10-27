import { erStoreBededagstillaegRelevant } from '../../domain/loen/storeBededagstillaeg';
import { dateRanges_aarsloen, getCurrentYear, MIN_YEAR } from '../../config/dateRanges';
import { STATIC_DATE_BOUNDS } from '../../utils/dateRangeErrorMessages';
import {
  anciennitetSatsPerEnum,
  krlSatstabelEnum,
  loenPaaHelligdageEnum,
  loenperiodeEnum,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  offentligLoenTypeEnum,
  tillaegAngivesSomEnum,
  type PersistedLoenindkomstAnsaettelsesforhold,
  type LoenudviklingManuelProcentsatsRow,
  type LoenudviklingManuelRow,
  type StandardLoenTableRow,
} from '../../schemas/formSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { isoToDanish, type ISODateString } from '../../types/branded';
import {
  booleanFieldCodec,
  createAmountFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
  createOptionalTextFieldCodec,
  createPercentFieldCodec,
  createRequiredChoiceFieldCodec,
  createStringBackedFieldCodec,
  createWeekFieldCodec,
  createYearFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import { SHORT_TEXT_MAX_LENGTH } from './fieldLengthLimits';
import type { CanonicalView, ContextualLabelRule, FieldAddressTemplate, FieldControlKind, FieldDescriptor, FieldRef, FieldValidator, RelevanceRule } from '../fieldDescriptor';
import { dateOrderValidator, weekOrderValidator, type DatePairBinding, type WeekPairBinding } from './dateOrderValidators';
import { dateBounds, systemrammeSpec, systemrammeTilDagsDatoSpec } from './dateBoundsValidators';
import type { DateBoundsSpec } from '../dateBoundsDeclaration';
import type { FieldCodec } from '../fieldCodec';
import {
  defineStructuralCollection,
  defineStructuralField,
  isEmptyString,
  isUndefined,
} from '../structuralDescriptors';
import {
  amountBoundsValidator,
  integerBoundsValidator,
  integerStringBoundsValidator,
  percentBoundsValidator,
  positiveAmountValidator,
  weekYearBoundsValidator,
  yearStringBoundsValidator,
} from './boundsValidators';
import { createEmptyErstatningsopgoerelseSection } from './erstatningsopgoerelseEmptySection';
import { isStandardLoenRowPersistenceEmpty } from '../../domain/aarsloen/standardLoenRowInitialValues';
import { STANDARD_LOEN_COLUMN_LABELS } from '../../types/table';
import {
  isLoenudviklingManuelProcentsatsRowEmpty,
  isLoenudviklingManuelRowEmpty,
} from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';
import { resolveStamdataDatoReferenceFromView, stamdataSkadedatoField } from './stamdataDescriptors';
import {
  erDatoUdenOverenskomstSatser,
  formatReguleringsdatoUdenOverenskomstSatserBesked,
  resolvePrivatOverenskomstDaekning,
} from '../../domain/loen/overenskomstSatser';
// Gensidig import: `erstatningsopgoerelseDescriptors` læser lønindkomsttræet herfra. Begge læser kun den anden
// inde i en relevansregel – aldrig ved modul-evaluering – så rækkefølgen er ligegyldig.
import {
  eoBeregnesUdFraField,
  eoKravPaaTabtArbejdsfortjenesteField,
  eoTafBeregningsperiodeTilField,
} from './erstatningsopgoerelseDescriptors';
import { createCollectionRef, type CollectionRef } from '../fieldAddress';
import type { TafBeregningsenhedEmployment, TafBeregningsenhedLoenRow } from '../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import {
  erAngivetLoenLoenudviklingRelevant,
  erAnsaettelsesforholdOphoertRelevant,
  erBeregningsperiodeValgt,
  erLoenudviklingFeltRelevant,
  erSidsteArbejdsdagRelevant,
  erFuldLoenUnderFerieRelevant,
  type LoenudviklingFelt,
} from '../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';

// Produkt-descriptors for EO's nested løntræ (§3.2): samlingen `loenindkomstAnsaettelsesforhold`
// med skalarfelter + overenskomstFilter + tre nested tabeller, samt det singulære property-objekt
// `eoAngivetLoenLoenudvikling` med sin filter + to nested tabeller.

const S = 'erstatningsopgoerelse' as const;
const EMPLOYMENTS = 'loenindkomstAnsaettelsesforhold';
const STANDARD_ROWS = 'indtaegtsoplysningerTableData';
const MANUAL_ROWS = 'loenudviklingManuelTableData';
const MANUAL_PERCENT_ROWS = 'loenudviklingManuelProcentsatsTableData';
const EO_LOEN_PROPERTY = 'eoAngivetLoenLoenudvikling';

type PathSegments = FieldAddressTemplate['path'];

const employmentPath: PathSegments = [{ kind: 'entity', collection: EMPLOYMENTS }];
const eoLoenPath: PathSegments = [{ kind: 'property', name: EO_LOEN_PROPERTY }];

// Delte codecs for lønfelterne.
const optionalTextCodec = createOptionalTextFieldCodec({ maxLength: SHORT_TEXT_MAX_LENGTH });
const dateCodec = createDateFieldCodec({ twoDigitYearPolicy: 'infer' });
const percentCodec = createPercentFieldCodec({ allowNegative: false, allowDecimals: true, minValue: 0, maxValue: 100 });
const amountCodec = createAmountFieldCodec({ allowNegative: false, allowDecimals: true });
const tableAmountCodec = createAmountFieldCodec({ allowNegative: true, allowDecimals: true });
const integerCodec = (minValue: number, maxValue: number, maxDigits: number): FieldCodec<number | undefined> =>
  createIntegerFieldCodec({ allowNegative: false, minValue, maxValue, maxDigits });

/**
 * `createField` bygger en descriptor på en fast owner-sti. `id` udledes af sti+felt, så `overenskomstFilter`
 * under de to ejere (employment-række vs. eoLoen-property) får entydige id'er.
 */
const createField = <T>(options: Readonly<{
  ownerId: string;
  path: PathSegments;
  field: string;
  label: string;
  controlKind: FieldControlKind;
  codec: FieldCodec<T>;
  emptyValue: T;
  isEmpty: (value: T) => boolean;
  contextualLabel?: ContextualLabelRule;
  relevance?: RelevanceRule<T>;
  validators?: readonly FieldValidator<T>[];
  dateBounds?: DateBoundsSpec;
}>): FieldDescriptor<T> => defineStructuralField<T>({
  id: `${options.ownerId}.${options.field}`,
  template: { section: S, path: options.path, field: options.field },
  codec: options.codec,
  emptyValue: options.emptyValue,
  isEmpty: options.isEmpty,
  label: options.label,
  ...(options.contextualLabel === undefined ? {} : { contextualLabel: options.contextualLabel }),
  ...(options.relevance === undefined ? {} : { relevance: options.relevance }),
  controlKind: options.controlKind,
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  ...(options.validators === undefined ? {} : { validators: options.validators }),
  ...(options.dateBounds === undefined ? {} : { dateBounds: options.dateBounds }),
});

// Optionelle felter (canonical tomhed = undefined).
const optField = <T>(
  ownerId: string, path: PathSegments, field: string, label: string,
  controlKind: FieldControlKind, codec: FieldCodec<T | undefined>,
  validators?: readonly FieldValidator<T | undefined>[],
  relevance?: RelevanceRule<T | undefined>,
): FieldDescriptor<T | undefined> =>
  createField<T | undefined>({
    ownerId, path, field, label, controlKind, codec, emptyValue: undefined, isEmpty: isUndefined,
    ...(validators === undefined ? {} : { validators }),
    ...(relevance === undefined ? {} : { relevance }),
  });

/**
 * Et datofelt under lønindkomst-træet. Grænserne er PÅKRÆVEDE og påføres HER, ikke af kaldsstedet.
 *
 * Otte af træets datofelter – sidste arbejdsdag, de to anciennitetsdatoer, de to særlige
 * reguleringsdatoer og lønudviklingstabellernes datoer – stod uden nogen validator, fordi de blev bygget
 * med den generiske `optField`, hvor grænser er en glemsom ekstraparameter. Helperen fjerner det valg:
 * et datofelt her kan ikke opstå uden erklærede grænser.
 */
const dateFieldWithBounds = (
  ownerId: string, path: PathSegments, field: string, label: string,
  spec: DateBoundsSpec,
  extraValidators: readonly FieldValidator<ISODateString | undefined>[] = [],
  relevance?: RelevanceRule<ISODateString | undefined>,
): FieldDescriptor<ISODateString | undefined> =>
  createField<ISODateString | undefined>({
    ownerId, path, field, label, controlKind: 'text', codec: dateCodec,
    emptyValue: undefined, isEmpty: isUndefined,
    ...dateBounds(spec, extraValidators),
    ...(relevance === undefined ? {} : { relevance }),
  });

// Required-choice (canonical tomhed = defaultværdien; aldrig tom, aldrig rød).
const reqChoiceField = <T extends string>(
  ownerId: string, path: PathSegments, field: string, label: string,
  values: readonly T[], emptyValue: T, controlKind: FieldControlKind = 'choice',
  relevance?: RelevanceRule<T>,
): FieldDescriptor<T> =>
  createField<T>({
    ownerId, path, field, label, controlKind,
    codec: createRequiredChoiceFieldCodec<T>(values, emptyValue),
    emptyValue, isEmpty: () => false,
    ...(relevance === undefined ? {} : { relevance }),
  });

// ── Samlingen loenindkomstAnsaettelsesforhold ──────────────────────────────────────
export const eoLoenindkomstAnsaettelsesforholdCollection =
defineStructuralCollection<PersistedLoenindkomstAnsaettelsesforhold>({
  id: 'eo.loenindkomstAnsaettelsesforhold',
  template: { section: S, path: [], collection: EMPLOYMENTS },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// Skalarfelter under en ansættelsesforhold-række.
const EMP_ID = 'eo.loenindkomstAnsaettelsesforhold';
const emp = <T>(
  field: string, label: string, controlKind: FieldControlKind, codec: FieldCodec<T | undefined>,
  validators?: readonly FieldValidator<T | undefined>[],
  relevance?: RelevanceRule<T | undefined>,
) => optField<T>(EMP_ID, employmentPath, field, label, controlKind, codec, validators, relevance);

// Delt canonical bounds-validator for procentfelterne (0..100). Codecet afviser ikke længere out-of-bounds;
// grænsen er nu et afledt bounds-issue (§1.6).
const empPercentBounds = (field: string): readonly FieldValidator<number | undefined>[] =>
  [percentBoundsValidator(`${EMP_ID}.${field}.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })];
const empAmountBounds = (field: string): readonly FieldValidator<AmountValue | undefined>[] =>
  [amountBoundsValidator(`${EMP_ID}.${field}.bounds`, 0, undefined)];

/** Datofelt direkte på en ansættelsesforhold-række. Systemrammen medmindre feltet har en skarpere regel. */
const empDate = (
  field: string, label: string, spec: DateBoundsSpec = systemrammeSpec,
  relevance?: RelevanceRule<ISODateString | undefined>,
  extraValidators: readonly FieldValidator<ISODateString | undefined>[] = [],
): FieldDescriptor<ISODateString | undefined> =>
  createField<ISODateString | undefined>({
    ownerId: EMP_ID, path: employmentPath, field, label, controlKind: 'text', codec: dateCodec,
    emptyValue: undefined, isEmpty: isUndefined,
    ...dateBounds(spec, extraValidators),
    ...(relevance === undefined ? {} : { relevance }),
  });

const employmentIdFromField = <T,>(field: FieldRef<T>): string => {
  const employmentEntity = field.address.path.find(
    (segment): segment is Extract<typeof segment, { kind: 'entity' }> =>
      segment.kind === 'entity' && segment.collection === EMPLOYMENTS
  );
  if (employmentEntity === undefined) {
    throw new Error('Lønindkomst-relevans kræver et ansættelsesforhold i feltadressen');
  }
  return employmentEntity.entityId;
};

const employmentRelevance = <T,>(
  predicate: (employment: Pick<PersistedLoenindkomstAnsaettelsesforhold, 'ansatPaaSkadestidspunktet' | 'ansaettelsesforholdOphoert'>) => boolean,
): RelevanceRule<T> => (field, view: CanonicalView) => {
  const employmentId = employmentIdFromField(field);
  return predicate({
    ansatPaaSkadestidspunktet: view.readCanonical(eoEmploymentFields.ansatPaaSkadestidspunktet.bind(employmentId)),
    ansaettelsesforholdOphoert: view.readCanonical(eoEmploymentFields.ansaettelsesforholdOphoert.bind(employmentId)),
  });
};

/**
 * Lønudviklingens og anciennitetens felter på et ansættelsesforhold er relevante efter blokkens egen synlighed
 * (BB-301): blokken vises kun ved «Beregningsperiode», og hver reguleringsform åbner sine egne felter.
 * Prædikatet læser de styrende felter rå og tjekker selv deres relevans i rækkefølge (blok → form → toggle).
 */
const employmentLoenudviklingRelevance = <T,>(felt: LoenudviklingFelt): RelevanceRule<T> => (field, view) => {
  const id = employmentIdFromField(field);
  return erLoenudviklingFeltRelevant(felt, {
    blokVist: erBeregningsperiodeValgt({ beregnesUdFra: view.readCanonical(eoBeregnesUdFraField.bind()) }),
    grundlag: view.readCanonical(eoEmploymentFields.loenudviklingBeregningsgrundlag.bind(id)),
    overenskomstId: view.readCanonical(eoEmploymentFields.overenskomstId.bind(id)),
    harAnciennitetstillaeg: view.readCanonical(eoEmploymentFields.harAnciennitetstillaegEfterSkadedatoen.bind(id)),
  });
};

/**
 * «Sidste dag i ansættelsesforholdet» kan ikke ligge før skadedatoen, når skadelidte var ansat på
 * skadestidspunktet – én af de to oplysninger er da forkert (udviklerafgørelse 2026-10-06, BB-283). Feltet er
 * kun relevant (og valideres derfor kun), når både «Ansat på …» og «Opsagt fra stillingen» er slået til. Et
 * ansættelsesforhold, der sluttede før skaden, angives med «Ansat på …» slået fra.
 */
const sidsteDagEfterSkadedatoValidator: FieldValidator<ISODateString | undefined> = (value, field, view) => {
  if (value === undefined) return undefined;
  const skadedato = view.readCanonical(stamdataSkadedatoField.bind());
  if (skadedato === undefined || value >= skadedato) return undefined;
  const reference = resolveStamdataDatoReferenceFromView(view);
  return {
    reason: 'rule',
    code: `${field.descriptor.id}.foerSkadedato`,
    message: `Sidste dag i ansættelsesforholdet skal ligge på eller efter ${reference.labelLower} (${isoToDanish(skadedato) ?? skadedato}), når skadelidte var ansat på ${reference.tidspunktBestemt}`,
  };
};

/**
 * Den særlige fra-dato må ikke ligge før den valgte PRIVATE overenskomsts første satsperiode: programmet har
 * da ingen satser at regne tillæggene med (udviklerafgørelse 2026-10-06, BB-275). I beløb-tilstand bruges
 * satserne ikke, og datoen markeres ikke.
 */
const saerligFraDatoOverenskomstDaekningValidator: FieldValidator<ISODateString | undefined> = (value, field, view) => {
  if (value === undefined) return undefined;
  const employmentId = employmentIdFromField(field);
  if (view.readCanonical(eoEmploymentFields.tillaegAngivesSom.bind(employmentId)) === 'beloeb') return undefined;
  const daekning = resolvePrivatOverenskomstDaekning({
    harOverenskomst: view.readCanonical(eoEmploymentFields.harOverenskomst.bind(employmentId)),
    overenskomstId: view.readCanonical(eoEmploymentFields.overenskomstId.bind(employmentId)),
  });
  if (daekning === null || !erDatoUdenOverenskomstSatser(daekning, value)) return undefined;
  return {
    reason: 'rule',
    code: `${field.descriptor.id}.overenskomstDaekning`,
    message: formatReguleringsdatoUdenOverenskomstSatserBesked(daekning),
  };
};

/**
 * Satsfelterne vises kun ved «Tillæg angives som» = «Procent», som Årslønstabellens tvilling (`aarsloenDescriptors.ts`).
 * Uden relevans blev skjulte satser ved med at fodre overenskomstreguleringen og sygeferiegodtgørelsens pension, og
 * en rød sats spærrede med et link til et felt, brugeren ikke kunne se (udviklerafgørelse 2026-10-23, BB-301).
 */
const empSatsRelevance = <T,>(): RelevanceRule<T> => (field, view) =>
  view.readCanonical(eoEmploymentFields.tillaegAngivesSom.bind(employmentIdFromField(field))) !== 'beloeb';

// Navngivne employment-descriptors, som readerprojektion og grid binder direkte. Aggregatarrayet
// nedenfor afledes fra dette record, så kataloget ikke kan drive fra de eksporterede refs.
export const eoEmploymentFields = {
  navnPaaArbejdssted: emp<string>('navnPaaArbejdssted', 'Navn på arbejdssted', 'text', optionalTextCodec),
  harOverenskomst: createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'harOverenskomst', label: 'Overenskomst', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  overenskomstId: emp<string>('overenskomstId', 'Vælg overenskomst', 'choice', optionalTextCodec),
  // `contextualLabel` som naboen `harAnciennitetstillaegEfterSkadedatoen` (BB-121): den kontekstfrie label
  // var den eneste, der stadig sagde «skadestidspunktet» ved en erhvervssygdom. UI'en byggede allerede
  // selv det rigtige navn to steder, så det var descriptorens label, der drev fra dem.
  ansatPaaSkadestidspunktet: createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'ansatPaaSkadestidspunktet', label: 'Ansat på skadestidspunktet', contextualLabel: (view) => `Ansat på ${resolveStamdataDatoReferenceFromView(view).tidspunktBestemt}`, controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  ansaettelsesforholdOphoert: createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'ansaettelsesforholdOphoert', label: 'Opsagt fra stillingen', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false, relevance: employmentRelevance(erAnsaettelsesforholdOphoertRelevant) }),
  sidsteArbejdsdag: empDate('sidsteArbejdsdag', 'Sidste dag i ansættelsesforholdet', systemrammeSpec, employmentRelevance(erSidsteArbejdsdagRelevant), [sidsteDagEfterSkadedatoValidator]),
  fritvalgPct: emp<number>('fritvalgPct', 'Fritvalg', 'text', percentCodec, empPercentBounds('fritvalgPct'), empSatsRelevance()),
  shSoPct: emp<number>('shSoPct', 'SH/SO-sats', 'text', percentCodec, empPercentBounds('shSoPct'), empSatsRelevance()),
  pensionPct: emp<number>('pensionPct', 'Arbejdsgivers pensionsbidrag', 'text', percentCodec, empPercentBounds('pensionPct'), empSatsRelevance()),
  tillaegAngivesSom: reqChoiceField(EMP_ID, employmentPath, 'tillaegAngivesSom', 'Tillæg angives som', tillaegAngivesSomEnum.options, 'procent'),
  loenperiode: reqChoiceField(EMP_ID, employmentPath, 'loenperiode', 'Løn indtastes som', loenperiodeEnum.options, 'maaned'),
  fuldLoenUnderFerie: reqChoiceField(
    EMP_ID, employmentPath, 'fuldLoenUnderFerie', 'Fuld løn under ferie', ['Ja', 'Nej'] as const, 'Nej', 'toggle',
    (_field, view) => erFuldLoenUnderFerieRelevant({ beregnesUdFra: view.readCanonical(eoBeregnesUdFraField.bind()) }),
  ),
  harAnciennitetstillaegEfterSkadedatoen: createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'harAnciennitetstillaegEfterSkadedatoen', label: 'Anciennitetstillæg efter skadedatoen', contextualLabel: (view) => `Anciennitetstillæg efter ${resolveStamdataDatoReferenceFromView(view).labelLower}`, controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false, relevance: employmentLoenudviklingRelevance('anciennitet') }),
  anciennitetstillaegDato: empDate('anciennitetstillaegDato', 'Dato for opnået anciennitetstillæg', systemrammeSpec, employmentLoenudviklingRelevance('anciennitetDetaljer')),
  anciennitetstillaegSatsAngivesPer: reqChoiceField(EMP_ID, employmentPath, 'anciennitetstillaegSatsAngivesPer', 'Satsen angives per', anciennitetSatsPerEnum.options, 'Måned', 'choice', employmentLoenudviklingRelevance('anciennitetDetaljer')),
  anciennitetstillaegSats: emp<AmountValue>('anciennitetstillaegSats', 'Anciennitetstillægssats', 'text', amountCodec, empAmountBounds('anciennitetstillaegSats'), employmentLoenudviklingRelevance('anciennitetDetaljer')),
  feriePct: emp<number>('feriePct', 'Feriegodtgørelse/-tillæg', 'text', percentCodec, empPercentBounds('feriePct'), empSatsRelevance()),
  loenPaaHelligdage: reqChoiceField(EMP_ID, employmentPath, 'loenPaaHelligdage', 'Løn på helligdage', loenPaaHelligdageEnum.options, 'Almindelig løn'),
  beregnStoreBededagstillaeg: createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'beregnStoreBededagstillaeg', label: 'Beregn Store Bededagstillæg fra 1. januar 2024', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false,
    relevance: (field, view): boolean => {
      const id = employmentIdFromField(field);
      return erStoreBededagstillaegRelevant({
        beregnesUdFra: view.readCanonical(eoBeregnesUdFraField.bind()),
        loenPaaHelligdage: view.readCanonical(eoEmploymentFields.loenPaaHelligdage.bind(id)),
        reguleringsform: view.readCanonical(eoEmploymentFields.loenudviklingBeregningsgrundlag.bind(id)),
        reguleringsdato: view.readCanonical(eoEmploymentFields.saerligFraDatoRegulering.bind(id))
          ?? view.readCanonical(eoTafBeregningsperiodeTilField.bind()),
        tillaegAngivesSom: view.readCanonical(eoEmploymentFields.tillaegAngivesSom.bind(id)),
      });
    },
  }),
  // Reguleringsdatoen er den dato, lønnen afspejler – en senere dato end i dag er en tastefejl (BB-282).
  // Labelen er skærmens («Evt. særlig fra-dato …»), så linjen i «Fejl og advarsler» navngiver feltet, som det står.
  // Vises kun ved «Beregningsperiode», som resten af lønudviklingen (BB-301).
  saerligFraDatoRegulering: empDate(
    'saerligFraDatoRegulering', 'Evt. særlig fra-dato for regulering', systemrammeTilDagsDatoSpec,
    employmentLoenudviklingRelevance('grundlag'),
    [saerligFraDatoOverenskomstDaekningValidator],
  ),
  loenudviklingBeregningsgrundlag: optField(EMP_ID, employmentPath, 'loenudviklingBeregningsgrundlag', 'Lønudvikling beregnes ud fra', 'choice', createChoiceFieldCodec(loenudviklingBeregningsgrundlagEnum.options), undefined, employmentLoenudviklingRelevance('grundlag')),
  loenudviklingStatistikModel: optField(EMP_ID, employmentPath, 'loenudviklingStatistikModel', 'Statistisk beregningsmodel', 'choice', createChoiceFieldCodec(loenudviklingStatistikModelEnum.options), undefined, employmentLoenudviklingRelevance('statistikModel')),
  loenudviklingKRLSatstabel: optField(EMP_ID, employmentPath, 'loenudviklingKRLSatstabel', 'Satstabel', 'choice', createChoiceFieldCodec(krlSatstabelEnum.options), undefined, employmentLoenudviklingRelevance('krlSatstabel')),
  loenudviklingManuelNavn: emp<string>('loenudviklingManuelNavn', 'Navn på reguleringsform', 'text', optionalTextCodec, undefined, employmentLoenudviklingRelevance('manueltAngivet')),
  offentligLoenType: reqChoiceField(EMP_ID, employmentPath, 'offentligLoenType', 'Ansættelse', offentligLoenTypeEnum.options, 'Månedsløn', 'choice', employmentLoenudviklingRelevance('offentligLoen')),
  offentligLoenTrin: emp<number>('offentligLoenTrin', 'Løntrin', 'text', integerCodec(1, 55, 2), [integerBoundsValidator(`${EMP_ID}.offentligLoenTrin.bounds`, 1, 55)], employmentLoenudviklingRelevance('offentligLoen')),
  offentligLoenGruppe: emp<number>('offentligLoenGruppe', 'Gruppe', 'text', integerCodec(0, 4, 1), [integerBoundsValidator(`${EMP_ID}.offentligLoenGruppe.bounds`, 0, 4)], employmentLoenudviklingRelevance('offentligLoen')),
  offentligLoenEkstraGrundloen: emp<AmountValue>('offentligLoenEkstraGrundloen', 'Forhøjet grundløn ud over løntrin', 'text', amountCodec, empAmountBounds('offentligLoenEkstraGrundloen'), employmentLoenudviklingRelevance('offentligLoen')),
  // Samme relevans som beløbet: enheden hører til beløbet og må aldrig blive skjult, mens beløbet læses.
  offentligLoenEkstraGrundloenAngivesPer: reqChoiceField(EMP_ID, employmentPath, 'offentligLoenEkstraGrundloenAngivesPer', 'Forhøjet grundløn angives per', anciennitetSatsPerEnum.options, 'Måned', 'choice', employmentLoenudviklingRelevance('offentligLoen')),
} as const;

const employmentFields = Object.values(eoEmploymentFields);

// overenskomstFilter (property-objekt under ejeren).
const filterField = (ownerId: string, ownerPath: PathSegments, field: 'loenmodtager' | 'arbejdsgiver'): FieldDescriptor<string | undefined> =>
  optField<string>(
    `${ownerId}.overenskomstFilter`,
    [...ownerPath, { kind: 'property', name: 'overenskomstFilter' }],
    field,
    field === 'loenmodtager' ? 'Lønmodtagerfilter' : 'Arbejdsgiverfilter',
    'choice',
    optionalTextCodec,
  );

export const eoEmploymentFilterFields = {
  loenmodtager: filterField(EMP_ID, employmentPath, 'loenmodtager'),
  arbejdsgiver: filterField(EMP_ID, employmentPath, 'arbejdsgiver'),
} as const;

const employmentFilterFields = Object.values(eoEmploymentFilterFields);

// ── Nested standard-løntabel under en ansættelsesforhold-række ──────────────────────
export const eoLoenindkomstStandardRowsCollection = defineStructuralCollection<StandardLoenTableRow>({
  id: 'eo.loenindkomstAnsaettelsesforhold.indtaegtsoplysningerTableData',
  template: { section: S, path: employmentPath, collection: STANDARD_ROWS },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  isEntityEmpty: (row) => isStandardLoenRowPersistenceEmpty(row),
});

const STD_ID = 'eo.loenindkomstAnsaettelsesforhold.indtaegtsoplysningerTableData';
const stdRowPath: PathSegments = [...employmentPath, { kind: 'entity', collection: STANDARD_ROWS }];

/**
 * Indtægtstabellens datokolonner. Grænserne er Årslønstabellens: det er SAMME tabelform med samme
 * «Dato fra»/«Dato til»-semantik, men EO-tvillingen havde kun kronologivalidatoren, mens Årsløn-siden
 * håndhævede sine grænser. Den asymmetri var den tydeligste enkeltstående i kodebasen.
 */
const stdDate = (
  field: string, label: string,
  spec: DateBoundsSpec,
  extraValidators: readonly FieldValidator<ISODateString | undefined>[] = [],
  relevance?: RelevanceRule<ISODateString | undefined>,
): FieldDescriptor<ISODateString | undefined> =>
  dateFieldWithBounds(STD_ID, stdRowPath, field, label, spec, extraValidators, relevance);

/**
 * Indtægtstabellens celler følger ansættelsesforholdets valg som Årslønstabellens tvilling
 * (`aarsloenDescriptors.ts`): periodekolonnerne vises kun under deres «Løn indtastes som», og tillægs- og
 * pensionsbeløbene kun ved «Tillæg angives som» = «Beløb» (`StandardLoenTable`). Uden relevans blev en rød
 * uge-celle ved med at spærre opgørelsen, efter at brugeren var skiftet til måneder, med et link til en kolonne,
 * der ikke stod på skærmen. Alle læsere vælger i forvejen kolonnerne efter de to valg, så ingen beregning læser
 * de skjulte celler; værdierne bevares og kommer tilbage med valget.
 */
const stdLoenperiodeIs = <T,>(loenperiode: PersistedLoenindkomstAnsaettelsesforhold['loenperiode']): RelevanceRule<T> =>
  (field, view) => view.readCanonical(eoEmploymentFields.loenperiode.bind(employmentIdFromField(field))) === loenperiode;
const stdTillaegSomBeloeb = <T,>(): RelevanceRule<T> =>
  (field, view) => view.readCanonical(eoEmploymentFields.tillaegAngivesSom.bind(employmentIdFromField(field))) === 'beloeb';

/**
 * Indtægtstabellens «Dato fra»/«Dato til». Rækkerne ligger NESTET under et
 * ansættelsesforhold, så modparten skal bindes med BEGGE entity-id'er – ansættelsesforholdet og rækken –
 * i den rækkefølge, adressen har dem.
 */
const stdRowIds = <T,>(field: FieldRef<T>): readonly string[] =>
  field.address.path.flatMap((segment) => segment.kind === 'entity' ? [segment.entityId] : []);

const stdDagPair: DatePairBinding = {
  fra: () => eoStandardRowFields.col0_dag,
  til: () => eoStandardRowFields.col1_dag,
  bindIds: stdRowIds,
};
const stdUgePair: WeekPairBinding = {
  fra: () => eoStandardRowFields.col0_uge,
  til: () => eoStandardRowFields.col1_uge,
  bindIds: stdRowIds,
};
const stdString = (
  field: string, label: string, codec: FieldCodec<string | undefined>,
  validators: readonly FieldValidator<string | undefined>[],
  relevance: RelevanceRule<string | undefined>,
): FieldDescriptor<string | undefined> =>
  createField<string | undefined>({
    ownerId: STD_ID, path: stdRowPath, field, label, controlKind: 'text', codec, emptyValue: '', isEmpty: isEmptyString,
    validators, relevance,
  });

// Månedskolonnens 1..12 er en canonical bounds-feltvalidator (string-backed, §1.6).
const stdAmount = (
  field: string, label: string, relevance?: RelevanceRule<AmountValue | undefined>,
): FieldDescriptor<AmountValue | undefined> =>
  optField<AmountValue>(STD_ID, stdRowPath, field, label, 'text', tableAmountCodec, undefined, relevance);

// Kolonnenavnene er ét sandt sted (`STANDARD_LOEN_COLUMN_LABELS`, §3.2a): descriptor-labelen ER
// gridoverskriften, så en fejl på en celle navngiver den kolonne, brugeren faktisk ser. `col4`/`col5` hed
// tidligere «Løn (3)»/«Løn (4)» her, mens overskriften sagde noget andet.
const stdLabel = STANDARD_LOEN_COLUMN_LABELS;

export const eoStandardRowFields = {
  col0_maaned: stdString('col0_maaned', stdLabel.col0_maaned, createStringBackedFieldCodec(integerCodec(1, 12, 2)), [
    integerStringBoundsValidator(`${STD_ID}.col0_maaned.bounds`, 1, 12),
  ], stdLoenperiodeIs('maaned')),
  col1_maaned: stdString('col1_maaned', stdLabel.col1_maaned, createStringBackedFieldCodec(createYearFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: getCurrentYear() })), [yearStringBoundsValidator(`${STD_ID}.col1_maaned.bounds`, MIN_YEAR, getCurrentYear)], stdLoenperiodeIs('maaned')),
  col0_uge: stdString('col0_uge', stdLabel.col0_uge, createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: getCurrentYear(), maxDraftLength: 8 })), [weekYearBoundsValidator(`${STD_ID}.col0_uge.bounds`, MIN_YEAR, getCurrentYear), weekOrderValidator('fra', stdUgePair)], stdLoenperiodeIs('uge')),
  col1_uge: stdString('col1_uge', stdLabel.col1_uge, createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: getCurrentYear(), maxDraftLength: 8 })), [weekYearBoundsValidator(`${STD_ID}.col1_uge.bounds`, MIN_YEAR, getCurrentYear), weekOrderValidator('til', stdUgePair)], stdLoenperiodeIs('uge')),
  col0_dag: stdDate('col0_dag', stdLabel.col0_dag, {
    min: () => dateRanges_aarsloen.tabelAarsloenFra.min,
    max: () => dateRanges_aarsloen.tabelAarsloenFra.fallbackMax,
    origin: STATIC_DATE_BOUNDS,
  }, [dateOrderValidator('fra', stdDagPair)], stdLoenperiodeIs('dag')),
  col1_dag: stdDate('col1_dag', stdLabel.col1_dag, {
    min: () => dateRanges_aarsloen.tabelAarsloenTil.fallbackMin,
    max: () => dateRanges_aarsloen.tabelAarsloenTil.max,
    origin: STATIC_DATE_BOUNDS,
  }, [dateOrderValidator('til', stdDagPair)], stdLoenperiodeIs('dag')),
  col2: stdAmount('col2', stdLabel.col2),
  col3: stdAmount('col3', stdLabel.col3),
  col4: stdAmount('col4', stdLabel.col4),
  col5: stdAmount('col5', stdLabel.col5),
  fpFvShSoBeloeb: stdAmount('fpFvShSoBeloeb', stdLabel.fpFvShSoBeloeb, stdTillaegSomBeloeb()),
  pensionBeloeb: stdAmount('pensionBeloeb', stdLabel.pensionBeloeb, stdTillaegSomBeloeb()),
} as const;

const standardRowFields = Object.values(eoStandardRowFields);

const standardRowsOf = (employmentId: string): CollectionRef => createCollectionRef({
  section: S,
  path: [{ kind: 'entity', collection: EMPLOYMENTS, entityId: employmentId }],
  collection: STANDARD_ROWS,
});

/**
 * Lønindkomstens ansættelsesforhold, som `computeTafBeregningsenhed` læser dem, bygget fra en `CanonicalView`.
 * Bruges af relevansreglen for TAF-periodernes «Løse ferie-/feriefridage», hvis relevans følger
 * beregningsenheden (BB-247).
 *
 * Rækkerne og deres felter læses DOVENT: reglen kaldes, hver gang en reader dannes, og et lønindkomsttræ kan
 * have flere hundrede rækker. Afgørelsen stopper ved første række med løn i beregningsperioden og læser kun
 * en rækkes beløb, når dens periode rammer – så en fuld læsning af træet ikke lægges oven i hver indtastning.
 */
export const readTafBeregningsenhedEmployments = (view: CanonicalView): readonly TafBeregningsenhedEmployment[] =>
  view.listEntityIds(eoLoenindkomstAnsaettelsesforholdCollection.template as CollectionRef).map((employmentId) => {
    const e = eoEmploymentFields;
    const r = eoStandardRowFields;
    const rows = function* (): Generator<TafBeregningsenhedLoenRow> {
      for (const rowId of view.listEntityIds(standardRowsOf(employmentId))) {
        const read = <T,>(descriptor: FieldDescriptor<T>): T => view.readCanonical(descriptor.bind(employmentId, rowId));
        yield {
          get col0_maaned() { return read(r.col0_maaned); },
          get col1_maaned() { return read(r.col1_maaned); },
          get col0_uge() { return read(r.col0_uge); },
          get col1_uge() { return read(r.col1_uge); },
          get col0_dag() { return read(r.col0_dag); },
          get col1_dag() { return read(r.col1_dag); },
          get col2() { return read(r.col2); },
          get col3() { return read(r.col3); },
          get col4() { return read(r.col4); },
          get col5() { return read(r.col5); },
        };
      }
    };
    return {
      loenPaaHelligdage: view.readCanonical(e.loenPaaHelligdage.bind(employmentId)),
      fuldLoenUnderFerie: view.readCanonical(e.fuldLoenUnderFerie.bind(employmentId)),
      loenperiode: view.readCanonical(e.loenperiode.bind(employmentId)),
      indtaegtsoplysningerTableData: { [Symbol.iterator]: rows },
    };
  });

// ── Nested manuel-lønudviklings-tabeller (delt mellem de to ejere) ──────────────────
export type ManualBindings = Readonly<{
  manualCollection: ReturnType<typeof defineStructuralCollection<LoenudviklingManuelRow>>;
  manualPercentCollection: ReturnType<typeof defineStructuralCollection<LoenudviklingManuelProcentsatsRow>>;
  manualFields: Readonly<{
    dato: FieldDescriptor<ISODateString | undefined>;
    grundloen: FieldDescriptor<AmountValue | undefined>;
    feriepenge: FieldDescriptor<number | undefined>;
    shSoSats: FieldDescriptor<number | undefined>;
    fritvalg: FieldDescriptor<number | undefined>;
    agPension: FieldDescriptor<number | undefined>;
  }>;
  manualPercentFields: Readonly<{
    dato: FieldDescriptor<ISODateString | undefined>;
    procent: FieldDescriptor<number | undefined>;
  }>;
  collections: ReturnType<typeof catalogCollections>;
  fields: ReturnType<typeof catalogFields>;
}>;

/**
 * Grundlønnen i en manuel række skal være større end 0: en løn på 0 eller derunder kan ikke reguleres ud fra, og
 * motoren afviser den. Reglen stod før kun i validatoren og spærrede uden rød celle – og først når alt andet var
 * rettet (BB-308, samme form som BB-232).
 */
const manualGrundloenPositiveValidator = (code: string): FieldValidator<AmountValue | undefined> =>
  positiveAmountValidator(code, 'Grundløn skal være større end 0 kr.');

/** Ejerens relevansregel for en af de to manuelle tabeller – samme betingelse, som tabellen vises under. */
type ManualTableRelevance = <T>(felt: 'manueltAngivet' | 'manuelProcentsats') => RelevanceRule<T>;

const createManualBindings = (
  ownerId: string,
  ownerPath: PathSegments,
  relevance: ManualTableRelevance,
): ManualBindings => {
  const manualCollection = defineStructuralCollection<LoenudviklingManuelRow>({
    id: `${ownerId}.loenudviklingManuelTableData`,
    template: { section: S, path: ownerPath, collection: MANUAL_ROWS },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    // Første række er den programstyrede basisrække og må aldrig forsvinde ved almindelig field-clear.
    isEntityEmpty: (row, index) => index > 0 && isLoenudviklingManuelRowEmpty(row),
  });
  const manualPercentCollection = defineStructuralCollection<LoenudviklingManuelProcentsatsRow>({
    id: `${ownerId}.loenudviklingManuelProcentsatsTableData`,
    template: { section: S, path: ownerPath, collection: MANUAL_PERCENT_ROWS },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    // Som ovenfor: basisrækken er strukturel, mens efterfølgende bruger-rækker auto-ryddes når de tømmes.
    isEntityEmpty: (row, index) => index > 0 && isLoenudviklingManuelProcentsatsRowEmpty(row),
  });
  const manualRowPath: PathSegments = [...ownerPath, { kind: 'entity', collection: MANUAL_ROWS }];
  const manualPercentRowPath: PathSegments = [...ownerPath, { kind: 'entity', collection: MANUAL_PERCENT_ROWS }];
  const manualId = `${ownerId}.loenudviklingManuelTableData`;
  const manualPercentId = `${ownerId}.loenudviklingManuelProcentsatsTableData`;

  // Tabellernes celler er kun relevante, mens deres form er valgt og blokken vises (BB-301): en rød celle i en
  // fravalgt tabel spærrede før opgørelsen med en linje uden et sted at rette den.
  const angivet = <T,>(): RelevanceRule<T> => relevance<T>('manueltAngivet');
  const procentsats = <T,>(): RelevanceRule<T> => relevance<T>('manuelProcentsats');
  const pctBounds = (id: string) => [percentBoundsValidator(id, { minValue: 0, maxValue: 100, allowDecimals: true })];
  const manualFields = {
    dato: dateFieldWithBounds(manualId, manualRowPath, 'dato', 'Dato', systemrammeSpec, [], angivet()),
    grundloen: optField<AmountValue>(manualId, manualRowPath, 'grundloen', 'Grundløn', 'text', tableAmountCodec, [manualGrundloenPositiveValidator(`${manualId}.grundloen.positive`)], angivet()),
    feriepenge: optField<number>(manualId, manualRowPath, 'feriepenge', 'Feriegodtgørelse/-tillæg', 'text', percentCodec, pctBounds(`${manualId}.feriepenge.bounds`), angivet()),
    shSoSats: optField<number>(manualId, manualRowPath, 'shSoSats', 'SH/SO-sats', 'text', percentCodec, pctBounds(`${manualId}.shSoSats.bounds`), angivet()),
    fritvalg: optField<number>(manualId, manualRowPath, 'fritvalg', 'Fritvalg', 'text', percentCodec, pctBounds(`${manualId}.fritvalg.bounds`), angivet()),
    agPension: optField<number>(manualId, manualRowPath, 'agPension', 'Arbejdsgivers pension', 'text', percentCodec, pctBounds(`${manualId}.agPension.bounds`), angivet()),
  } as const;
  const manualPercentFields = {
    dato: dateFieldWithBounds(manualPercentId, manualPercentRowPath, 'dato', 'Dato', systemrammeSpec, [], procentsats()),
    procent: optField<number>(manualPercentId, manualPercentRowPath, 'procent', 'Procent', 'text', percentCodec, pctBounds(`${manualPercentId}.procent.bounds`), procentsats()),
  } as const;

  return {
    manualCollection,
    manualPercentCollection,
    manualFields,
    manualPercentFields,
    collections: catalogCollections(manualCollection, manualPercentCollection),
    fields: catalogFields(
      manualFields.dato,
      manualFields.grundloen,
      manualFields.feriepenge,
      manualFields.shSoSats,
      manualFields.fritvalg,
      manualFields.agPension,
      manualPercentFields.dato,
      manualPercentFields.procent,
    ),
  };
};

export const eoEmploymentManual = createManualBindings(EMP_ID, employmentPath, employmentLoenudviklingRelevance);
const employmentManual = eoEmploymentManual;

// ── eoAngivetLoenLoenudvikling (singulært property-objekt) ──────────────────────────
const EO_LOEN_ID = 'eo.eoAngivetLoenLoenudvikling';

/**
 * Den angivne løns lønudvikling vises kun under sin egen gren af «Beregnes ud fra» med TAF-sektionen aktiv
 * (BB-301); felterne indenfor følger reguleringsformen som på ansættelsesforholdet. Komprimeringen ved EO 2+
 * skjuler blokken, men gør den ikke irrelevant (`eoInputRelevance.ts`).
 */
const eoLoenudviklingRelevance = <T,>(felt: LoenudviklingFelt): RelevanceRule<T> => (_field, view) =>
  erLoenudviklingFeltRelevant(felt, {
    blokVist: erAngivetLoenLoenudviklingRelevant({
      kravPaaTabtArbejdsfortjeneste: view.readCanonical(eoKravPaaTabtArbejdsfortjenesteField.bind()),
      beregnesUdFra: view.readCanonical(eoBeregnesUdFraField.bind()),
    }),
    grundlag: view.readCanonical(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind()),
    overenskomstId: view.readCanonical(eoAngivetLoenFields.overenskomstId.bind()),
    harAnciennitetstillaeg: view.readCanonical(eoAngivetLoenFields.harAnciennitetstillaegEfterSkadedatoen.bind()),
  });

const eoLoen = <T>(
  field: string, label: string, controlKind: FieldControlKind, codec: FieldCodec<T | undefined>,
  validators?: readonly FieldValidator<T | undefined>[],
  relevance?: RelevanceRule<T | undefined>,
) => optField<T>(EO_LOEN_ID, eoLoenPath, field, label, controlKind, codec, validators, relevance);
const eoLoenAmountBounds = (field: string): readonly FieldValidator<AmountValue | undefined>[] =>
  [amountBoundsValidator(`${EO_LOEN_ID}.${field}.bounds`, 0, undefined)];

/** Datofelt på det singulære eoLoen-objekt – tvillingen til {@link empDate}. */
const eoLoenDate = (
  field: string, label: string, spec: DateBoundsSpec = systemrammeSpec,
  relevance?: RelevanceRule<ISODateString | undefined>,
): FieldDescriptor<ISODateString | undefined> =>
  dateFieldWithBounds(EO_LOEN_ID, eoLoenPath, field, label, spec, [], relevance);

export const eoAngivetLoenFields = {
  overenskomstId: eoLoen<string>('overenskomstId', 'Vælg overenskomst', 'choice', optionalTextCodec, undefined, eoLoenudviklingRelevance('overenskomst')),
  harAnciennitetstillaegEfterSkadedatoen: createField<boolean>({ ownerId: EO_LOEN_ID, path: eoLoenPath, field: 'harAnciennitetstillaegEfterSkadedatoen', label: 'Anciennitetstillæg efter skadedatoen', contextualLabel: (view) => `Anciennitetstillæg efter ${resolveStamdataDatoReferenceFromView(view).labelLower}`, controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false, relevance: eoLoenudviklingRelevance('anciennitet') }),
  anciennitetstillaegDato: eoLoenDate('anciennitetstillaegDato', 'Dato for opnået anciennitetstillæg', systemrammeSpec, eoLoenudviklingRelevance('anciennitetDetaljer')),
  anciennitetstillaegSatsAngivesPer: reqChoiceField(EO_LOEN_ID, eoLoenPath, 'anciennitetstillaegSatsAngivesPer', 'Satsen angives per', anciennitetSatsPerEnum.options, 'Måned', 'choice', eoLoenudviklingRelevance('anciennitetDetaljer')),
  anciennitetstillaegSats: eoLoen<AmountValue>('anciennitetstillaegSats', 'Anciennitetstillægssats', 'text', amountCodec, eoLoenAmountBounds('anciennitetstillaegSats'), eoLoenudviklingRelevance('anciennitetDetaljer')),
  feriePct: eoLoen<number>('feriePct', 'Feriegodtgørelse/-tillæg', 'text', percentCodec, [percentBoundsValidator(`${EO_LOEN_ID}.feriePct.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
  // Samme required-choice-kontrakt som ansættelsesforholdets tvilling (`eoEmploymentFields.loenPaaHelligdage`).
  // Tomværdien er den samme konkrete sats, som schemaets `.default()` giver: en tomværdi på `undefined` ville
  // føde motoren en tilstand, den erklærer umulig. Feltet vises og læses kun ved de reguleringsformer, der regner
  // med helligdagene (BB-315); ved de øvrige fik brugeren et valg, der intet ændrede.
  loenPaaHelligdage: reqChoiceField(EO_LOEN_ID, eoLoenPath, 'loenPaaHelligdage', 'Løn på helligdage', loenPaaHelligdageEnum.options, 'Almindelig løn', 'choice', eoLoenudviklingRelevance('loenPaaHelligdageVedAngivetLoen')),
  // Skjult input bevares; descriptoren giver alle læsere tomværdien, når valget er uden virkning.
  beregnStoreBededagstillaeg: createField<boolean>({
    ownerId: EO_LOEN_ID, path: eoLoenPath, field: 'beregnStoreBededagstillaeg', label: 'Beregn Store Bededagstillæg fra 1. januar 2024',
    controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false,
    relevance: (_field, view): boolean => erStoreBededagstillaegRelevant({
      beregnesUdFra: view.readCanonical(eoBeregnesUdFraField.bind()),
      loenPaaHelligdage: view.readCanonical(eoAngivetLoenFields.loenPaaHelligdage.bind()),
      reguleringsform: view.readCanonical(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind()),
      reguleringsdato: undefined,
    }),
  }),
  saerligFraDatoRegulering: eoLoenDate('saerligFraDatoRegulering', 'Særlig fra-dato for regulering', systemrammeTilDagsDatoSpec),
  loenudviklingBeregningsgrundlag: optField(EO_LOEN_ID, eoLoenPath, 'loenudviklingBeregningsgrundlag', 'Lønudvikling beregnes ud fra', 'choice', createChoiceFieldCodec(loenudviklingBeregningsgrundlagEnum.options), undefined, eoLoenudviklingRelevance('grundlag')),
  loenudviklingStatistikModel: optField(EO_LOEN_ID, eoLoenPath, 'loenudviklingStatistikModel', 'Statistisk beregningsmodel', 'choice', createChoiceFieldCodec(loenudviklingStatistikModelEnum.options), undefined, eoLoenudviklingRelevance('statistikModel')),
  loenudviklingKRLSatstabel: optField(EO_LOEN_ID, eoLoenPath, 'loenudviklingKRLSatstabel', 'Satstabel', 'choice', createChoiceFieldCodec(krlSatstabelEnum.options), undefined, eoLoenudviklingRelevance('krlSatstabel')),
  loenudviklingManuelNavn: eoLoen<string>('loenudviklingManuelNavn', 'Navn på reguleringsform', 'text', optionalTextCodec, undefined, eoLoenudviklingRelevance('manueltAngivet')),
  offentligLoenType: reqChoiceField(EO_LOEN_ID, eoLoenPath, 'offentligLoenType', 'Ansættelse', offentligLoenTypeEnum.options, 'Månedsløn', 'choice', eoLoenudviklingRelevance('offentligLoen')),
  offentligLoenTrin: eoLoen<number>('offentligLoenTrin', 'Løntrin', 'text', integerCodec(1, 55, 2), [integerBoundsValidator(`${EO_LOEN_ID}.offentligLoenTrin.bounds`, 1, 55)], eoLoenudviklingRelevance('offentligLoen')),
  offentligLoenGruppe: eoLoen<number>('offentligLoenGruppe', 'Gruppe', 'text', integerCodec(0, 4, 1), [integerBoundsValidator(`${EO_LOEN_ID}.offentligLoenGruppe.bounds`, 0, 4)], eoLoenudviklingRelevance('offentligLoen')),
  offentligLoenEkstraGrundloen: eoLoen<AmountValue>('offentligLoenEkstraGrundloen', 'Forhøjet grundløn ud over løntrin', 'text', amountCodec, eoLoenAmountBounds('offentligLoenEkstraGrundloen'), eoLoenudviklingRelevance('offentligLoen')),
  offentligLoenEkstraGrundloenAngivesPer: reqChoiceField(EO_LOEN_ID, eoLoenPath, 'offentligLoenEkstraGrundloenAngivesPer', 'Forhøjet grundløn angives per', anciennitetSatsPerEnum.options, 'Måned', 'choice', eoLoenudviklingRelevance('offentligLoen')),
} as const;

const eoLoenFields = Object.values(eoAngivetLoenFields);

export const eoAngivetLoenFilterFields = {
  loenmodtager: filterField(EO_LOEN_ID, eoLoenPath, 'loenmodtager'),
  arbejdsgiver: filterField(EO_LOEN_ID, eoLoenPath, 'arbejdsgiver'),
} as const;

const eoLoenFilterFields = Object.values(eoAngivetLoenFilterFields);

export const eoAngivetLoenManual = createManualBindings(EO_LOEN_ID, eoLoenPath, eoLoenudviklingRelevance);
const eoLoenManual = eoAngivetLoenManual;

// De navngivne descriptorgrupper eksporteres som records, som readerprojektion og grid binder direkte.
// Aggregatarrayet afledes fra `Object.values(...)` af de samme records, så kataloget ikke kan
// drive fra de eksporterede refs. `Object.values` giver et union-typet array; `eraseFieldGroup` type-eraser det til
// katalogets eksistentielle visning (samme erasure som `catalogFields`, men uden tuple-invarians på et union-array).
const eraseFieldGroup = (fields: readonly FieldDescriptor<unknown>[]): readonly FieldDescriptor<unknown>[] => fields;

export const erstatningsopgoerelseLoenFields = Object.freeze([
  ...eraseFieldGroup(employmentFields as readonly FieldDescriptor<unknown>[]),
  ...eraseFieldGroup(employmentFilterFields as readonly FieldDescriptor<unknown>[]),
  ...eraseFieldGroup(standardRowFields as readonly FieldDescriptor<unknown>[]),
  ...employmentManual.fields,
  ...eraseFieldGroup(eoLoenFields as readonly FieldDescriptor<unknown>[]),
  ...eraseFieldGroup(eoLoenFilterFields as readonly FieldDescriptor<unknown>[]),
  ...eoLoenManual.fields,
]);

export const erstatningsopgoerelseLoenCollections = Object.freeze([
  ...catalogCollections(eoLoenindkomstAnsaettelsesforholdCollection, eoLoenindkomstStandardRowsCollection),
  ...employmentManual.collections,
  ...eoLoenManual.collections,
]);
