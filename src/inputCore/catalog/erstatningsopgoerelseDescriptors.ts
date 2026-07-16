import type {
  AfsluttesMed,
  Arbejdsstatus,
  Beregningsmetode,
  EoBilagLoenindkomstOgOffentligeYdelserIndgaar,
  Helbredsstatus,
  JaNej,
  JaNejSkjul,
  SvieSmerteDelvisSygemeldingSats,
  SygeferiegodtgoerelseBeregningskilde,
  SygeferiegodtgoerelseSatsvalg,
  Tilstand,
} from '../../schemas/formSchemas/enumSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import {
  erstatningsopgoerelseSchema,
  type FerieperiodeRow,
  type OevrigeKravRow,
  type OffentligeYdelserRow,
  type SvieSmertePeriodeRow,
  type SygeferiegodtgoerelseAnsaettelsesforholdRow,
  type TafPeriodeRow,
} from '../../schemas/formSchemas/sections/erstatningsopgoerelseSchemas';
import { CURRENT_YEAR, MIN_SVIESMERTE_YEAR } from '../../config/dateRanges';
import { DEFAULT_FRACTION_MAX_DIGITS } from '../../utils/fraction';
import type { ISODateString } from '../../types/branded';
import {
  booleanFieldCodec,
  createAmountFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createFractionFieldCodec,
  createIntegerFieldCodec,
  createOptionalTextFieldCodec,
  createPercentFieldCodec,
  createTextFieldCodec,
  createYearFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldControlKind, FieldAddressTemplate, FieldDescriptor } from '../fieldDescriptor';
import type { FieldCodec } from '../fieldCodec';
import {
  defineStructuralCollection,
  defineStructuralField,
  isUndefined,
} from '../structuralDescriptors';

// Greenfield produkt-descriptors for `erstatningsopgoerelse`-sektionen (§3.2): top-level skalarer (incl. nested
// bilagsvalgs-booleans) og de rene top-level samlinger med deres rækkefelter. Lønindkomstens/EO-angivet løns
// nested træ ligger i `erstatningsopgoerelseLoenDescriptors.ts`.
//
// Den tomme sektion er den fulde canonical default: `loenindkomstAnsaettelsesforhold` er en påkrævet (ikke-
// defaultet) array, så den skal angives eksplicit for at parse.

export const createEmptyErstatningsopgoerelseSection = (): unknown =>
  erstatningsopgoerelseSchema.parse({ loenindkomstAnsaettelsesforhold: [] });

const S = 'erstatningsopgoerelse' as const;

// ── Generiske top-level felt-hjælpere ────────────────────────────────────────────
const optionalTextField = (field: string, label: string): FieldDescriptor<string | undefined> =>
  defineStructuralField<string | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createOptionalTextFieldCodec(),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const dateField = (field: string, label: string): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const amountField = (field: string, label: string): FieldDescriptor<AmountValue | undefined> =>
  defineStructuralField<AmountValue | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const integerField = (field: string, label: string): FieldDescriptor<number | undefined> =>
  defineStructuralField<number | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createIntegerFieldCodec({ allowNegative: false }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const jaNejField = (field: string, label: string): FieldDescriptor<JaNej | undefined> =>
  defineStructuralField<JaNej | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createChoiceFieldCodec<JaNej>(['Ja', 'Nej']),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'toggle',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const jaNejSkjulField = (field: string, label: string): FieldDescriptor<JaNejSkjul | undefined> =>
  defineStructuralField<JaNejSkjul | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createChoiceFieldCodec<JaNejSkjul>(['Ja', 'Nej', 'Skjul']),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'choice',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const choiceField = <T extends string>(
  field: string,
  label: string,
  values: readonly T[],
  controlKind: FieldControlKind = 'choice',
): FieldDescriptor<T | undefined> =>
  defineStructuralField<T | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createChoiceFieldCodec<T>(values),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind,
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

// ── Base-blok ─────────────────────────────────────────────────────────────────────
export const eoNummerField = optionalTextField('eoNummer', 'EO-nummer');
export const eoLedsagetekstField = optionalTextField('eoLedsagetekst', 'Ledsagetekst');
export const eoOpgørelseLavetDenField = dateField('opgørelseLavetDen', 'Opgørelse lavet den');
export const eoIndsaetUdkastStempelField = jaNejField('indsaetUdkastStempel', 'Indsæt udkast-stempel');
export const eoVedroererPeriodeFraField = dateField('vedroererPeriodeFra', 'Vedrører periode fra');
export const eoVedroererPeriodeTilField = dateField('vedroererPeriodeTil', 'Vedrører periode til');
export const eoRevideretOpgoerelseField = jaNejField('revideretOpgoerelse', 'Revideret opgørelse');
export const eoMidlertidigtEetFraEetSidenField = jaNejField('midlertidigtEetFraEetSiden', 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden');
export const eoRegulerOffentligeYdelserField = jaNejField('regulerOffentligeYdelser', 'Regulér offentlige ydelser');

export const eoForligAnsvarsgradProcentField = defineStructuralField<number | undefined>({
  id: 'eo.forligAnsvarsgradProcent',
  template: { section: S, path: [], field: 'forligAnsvarsgradProcent' },
  codec: createPercentFieldCodec({ allowNegative: false, allowDecimals: true }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Forlig ansvarsgrad (%)',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// Brøk-controllen bruges med standard-props; schematypen forbliver optionalString (tom brøk = undefined).
export const eoForligAnsvarsgradBroekField = defineStructuralField<string | undefined>({
  id: 'eo.forligAnsvarsgradBroek',
  template: { section: S, path: [], field: 'forligAnsvarsgradBroek' },
  codec: createFractionFieldCodec({
    maxDigits: DEFAULT_FRACTION_MAX_DIGITS,
    allowNegative: false,
    allowZeroNumerator: false,
    canonicalizeOnCommit: false,
    requireIntegerFraction: false,
  }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Forlig ansvarsgrad (brøk)',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

export const eoForligDatoField = dateField('forligDato', 'Forligsdato');
export const eoKravPaaOevrigeErstatningskravField = jaNejSkjulField('kravPaaOevrigeErstatningskrav', 'Krav på øvrige erstatningskrav');
export const eoOffentligeYdelserKommentarerField = optionalTextField('offentligeYdelserKommentarer', 'Kommentarer');
export const eoSaerligeKommentarerField = optionalTextField('saerligeKommentarer', 'Særlige kommentarer');

export const eoAfsluttesMedField = defineStructuralField<AfsluttesMed | undefined>({
  id: 'eo.erstatningsopgoerelseAfsluttesMed',
  template: { section: S, path: [], field: 'erstatningsopgoerelseAfsluttesMed' },
  codec: createChoiceFieldCodec<AfsluttesMed>(['Bekræftet godkendt', 'Underskrift-linje', 'Ingen']),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Afsluttes med',
  controlKind: 'choice',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

export const eoBilagIndgaarField = choiceField<EoBilagLoenindkomstOgOffentligeYdelserIndgaar>(
  'eoBilagLoenindkomstOgOffentligeYdelserIndgaar',
  'Bilag: lønindkomst/off. ydelser indgår',
  ['Alle', 'Perioden'],
);

// ── Nested bilagsvalg (eoBilagSelection, 8 booleans) ──────────────────────────────
const bilagToggle = (field: string, label: string): FieldDescriptor<boolean> =>
  defineStructuralField<boolean>({
    id: `eo.eoBilagSelection.${field}`,
    template: { section: S, path: [{ kind: 'property', name: 'eoBilagSelection' }], field },
    codec: booleanFieldCodec,
    emptyValue: false,
    isEmpty: () => false,
    label,
    controlKind: 'toggle',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

export const eoBilagSelectionOpgoerelseField = bilagToggle('opgoerelse', 'Bilag: opgørelse');
export const eoBilagSelectionLoenindkomstField = bilagToggle('loenindkomst', 'Bilag: lønindkomst');
export const eoBilagSelectionOffentligeYdelserField = bilagToggle('offentligeYdelser', 'Bilag: offentlige ydelser');
export const eoBilagSelectionMidlertidigEetField = bilagToggle('midlertidigEet', 'Bilag: midlertidigt EET');
export const eoBilagSelectionShDageField = bilagToggle('shDage', 'Bilag: SH-dage');
export const eoBilagSelectionReguleringField = bilagToggle('regulering', 'Bilag: regulering');
export const eoBilagSelectionOkSatserField = bilagToggle('okSatser', 'Bilag: OK-satser');
export const eoBilagSelectionSygeferiegodtgoerelseField = bilagToggle('sygeferiegodtgoerelse', 'Bilag: sygeferiegodtgørelse');

// ── AES afgørelser (skalarer) ─────────────────────────────────────────────────────
export const eoVarigeMenAfgorelseField = jaNejField('varigeMenAfgorelse', 'Varige mén-afgørelse');
export const eoMenAfgoerelseDatoField = dateField('menAfgoerelseDato', 'Mén-afgørelsesdato');
export const eoVerserendeKlageMenField = jaNejField('verserendeKlageMen', 'Verserende klage (mén)');
export const eoMidlertidigtEETAfgorelseField = jaNejField('midlertidigtEETAfgorelse', 'Midlertidigt EET-afgørelse');
export const eoMidlertidigEETAfgoerelseDatoField = dateField('midlertidigEETAfgoerelseDato', 'Midlertidigt EET-afgørelsesdato');
export const eoMidlertidigEETVirkningsdatoField = dateField('midlertidigEETVirkningsdato', 'Midlertidigt EET-virkningsdato');
export const eoEndeligtEETAfgorelseField = jaNejField('endeligtEETAfgorelse', 'Endeligt EET-afgørelse');
export const eoEndeligEETAfgoerelseDatoField = dateField('endeligEETAfgoerelseDato', 'Endeligt EET-afgørelsesdato');
export const eoEndeligEETVirkningsdatoField = dateField('endeligEETVirkningsdato', 'Endeligt EET-virkningsdato');
export const eoVerserendeKlageEetField = jaNejField('verserendeKlageEet', 'Verserende klage (EET)');
export const eoDifferencekravDatoField = dateField('differencekravDato', 'Differencekravsdato');

// ── Svie/smerte (skalarer) ──────────────────────────────────────────────────────
export const eoKravPaaSvieSmerteGodtgoerelseField = jaNejSkjulField('kravPaaSvieSmerteGodtgoerelse', 'Krav på svie- og smertegodtgørelse');
export const eoSvieSmerteHelbredsstatusField = choiceField<Helbredsstatus>(
  'svieSmerteHelbredsstatus', 'Helbredsstatus', ['Sygemeldt', 'Delvist Sygemeldt', 'Raskmeldt'],
);
export const eoTidligereSsMaxField = jaNejField('tidligereSsMax', 'Tidligere svie/smerte-max nået');
// Årsfelt: tocifrede år infereres; MIN_SVIESMERTE_YEAR..CURRENT_YEAR er det afledte bounds-issue.
export const eoSvieSmerteSatserAarField = defineStructuralField<number | undefined>({
  id: 'eo.svieSmerteSatserAar',
  template: { section: S, path: [], field: 'svieSmerteSatserAar' },
  codec: createYearFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_SVIESMERTE_YEAR, maxYear: CURRENT_YEAR }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Svie/smerte satsår',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoSvieSmerteDelvisSygemeldingSatsField = choiceField<SvieSmerteDelvisSygemeldingSats>(
  'svieSmerteDelvisSygemeldingSats', 'Sats ved delvis sygemelding', ['fuld', 'halv'],
);
export const eoSvieSmerteTidligereTotalField = amountField('svieSmerteTidligereTotal', 'Tidligere udbetalt svie/smerte');
export const eoSvieSmerteAktuelPeriodeField = amountField('svieSmerteAktuelPeriode', 'Svie/smerte aktuel periode');

// ── TAF (skalarer) ──────────────────────────────────────────────────────────────
export const eoKravPaaTabtArbejdsfortjenesteField = jaNejSkjulField('kravPaaTabtArbejdsfortjeneste', 'Krav på tabt arbejdsfortjeneste');
export const eoTafArbejdsstatusField = choiceField<Arbejdsstatus>('tafArbejdsstatus', 'Arbejdsstatus', [
  'Uarbejdsdygtig', 'Delvist raskmeldt', 'Fuldt arbejdsdygtig', 'Fleksjob', 'Revalidering', 'Uddannelse',
  'Førtidspension', 'Seniorpension', 'Folkepension', 'Efterløn', 'Kontanthjælp',
]);
export const eoSidsteDagAnsaettelsesforholdField = dateField('sidsteDagAnsaettelsesforhold', 'Sidste dag i ansættelsesforhold');
export const eoTidligereModtagetTafField = amountField('tidligereModtagetTaf', 'Tidligere modtaget TAF');

// ── Indtægt før skaden (skalarer, fanen lønindkomst) ──────────────────────────────
export const eoKomprimerBeregningField = jaNejField('komprimerBeregningEfterFoersteOpgoerelse', 'Komprimér beregning efter første opgørelse');
export const eoBeregnesUdFraField = choiceField<Beregningsmetode>(
  'beregnesUdFra', 'Beregnes ud fra', ['Beregningsperiode', 'Angivet månedsløn', 'Angivet dagsløn'],
);
export const eoTafBeregningsperiodeFraField = dateField('tafBeregningsperiodeFra', 'Beregningsperiode fra');
export const eoTafBeregningsperiodeTilField = dateField('tafBeregningsperiodeTil', 'Beregningsperiode til');
export const eoUspecificeredeFerieFridageField = integerField('uspecificeredeFerieFridage', 'Uspecificerede ferie-/fridage');
export const eoOevrigtFravaerUdenLoenField = jaNejField('oevrigtFravaerUdenLoen', 'Øvrigt fravær uden løn');
export const eoOevrigeFravaersdageField = integerField('oevrigeFravaersdage', 'Øvrige fraværsdage');
export const eoOevrigeFravaersdageBeskrivelseField = optionalTextField('oevrigeFravaersdageBeskrivelse', 'Beskrivelse af øvrige fraværsdage');
export const eoMaanedsloenenUdgoerField = amountField('maanedsloenenUdgoer', 'Månedslønnen udgør');
export const eoDagsloenenUdgoerField = amountField('dagsloenenUdgoer', 'Dagslønnen udgør');
export const eoAngivetMaanedsloenBaseretPaaField = optionalTextField('angivetMaanedsloenBaseretPaa', 'Angivet månedsløn baseret på');
export const eoAngivetMaanedsloenOpreguleresFraDatoField = dateField('angivetMaanedsloenOpreguleresFraDato', 'Angivet månedsløn opreguleres fra');
export const eoAngivetDagsloenBaseretPaaField = optionalTextField('angivetDagsloenBaseretPaa', 'Angivet dagsløn baseret på');
export const eoAngivetDagsloenOpreguleresFraDatoField = dateField('angivetDagsloenOpreguleresFraDato', 'Angivet dagsløn opreguleres fra');

// ── Bilagsnumre (skalarer) ────────────────────────────────────────────────────────
export const eoVisBilagsnumreField = jaNejField('visBilagsnumre', 'Vis bilagsnumre');
export const eoBilagsnumreMenAfgoerelseField = optionalTextField('bilagsnumreMenAfgoerelse', 'Bilagsnr. mén-afgørelse');
export const eoBilagsnumreEetAfgoerelserField = optionalTextField('bilagsnumreEetAfgoerelser', 'Bilagsnr. EET-afgørelser');
export const eoBilagsnumreSvieSmerteDokumentationField = optionalTextField('bilagsnumreSvieSmerteDokumentation', 'Bilagsnr. svie/smerte-dokumentation');
export const eoBilagsnumreBeregningsgrundlagTafField = optionalTextField('bilagsnumreBeregningsgrundlagTaf', 'Bilagsnr. beregningsgrundlag TAF');
export const eoBilagsnumreLoenISygeperiodenField = optionalTextField('bilagsnumreLoenISygeperioden', 'Bilagsnr. løn i sygeperioden');
export const eoBilagsnumreOffentligeYdelserField = optionalTextField('bilagsnumreOffentligeYdelser', 'Bilagsnr. offentlige ydelser');
export const eoBilagsnumreOevrigeErstatningskravField = optionalTextField('bilagsnumreOevrigeErstatningskrav', 'Bilagsnr. øvrige erstatningskrav');

// ── Rene top-level samlinger + rækkefelter ─────────────────────────────────────────
const rowTemplate = (collection: string, field: string): FieldAddressTemplate => ({
  section: S, path: [{ kind: 'entity', collection }], field,
});

const rowDate = (collection: string, field: string, label: string): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `eo.${collection}.${field}`,
    template: rowTemplate(collection, field),
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const topLevelCollection = <TEntity extends Readonly<Record<string, unknown>>>(collection: string) =>
  defineStructuralCollection<TEntity>({
    id: `eo.${collection}`,
    template: { section: S, path: [], collection },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

// tafPerioder
export const eoTafPerioderCollection = topLevelCollection<TafPeriodeRow>('tafPerioder');
export const eoTafPeriodeFraField = rowDate('tafPerioder', 'fra', 'Fra o.m.');
export const eoTafPeriodeTilField = rowDate('tafPerioder', 'til', 'Til o.m.');
export const eoTafPeriodeLoseFeriedageField = defineStructuralField<number | undefined>({
  id: 'eo.tafPerioder.loseFeriedage',
  template: rowTemplate('tafPerioder', 'loseFeriedage'),
  codec: createIntegerFieldCodec({ allowNegative: false }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Løse feriedage',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// ferieperioder
export const eoFerieperioderCollection = topLevelCollection<FerieperiodeRow>('ferieperioder');
export const eoFerieperiodeFraField = rowDate('ferieperioder', 'fra', 'Fra o.m.');
export const eoFerieperiodeTilField = rowDate('ferieperioder', 'til', 'Til o.m.');

// fravaerPerioder (samme rækkeform som ferieperioder)
export const eoFravaerPerioderCollection = topLevelCollection<FerieperiodeRow>('fravaerPerioder');
export const eoFravaerPeriodeFraField = rowDate('fravaerPerioder', 'fra', 'Fra o.m.');
export const eoFravaerPeriodeTilField = rowDate('fravaerPerioder', 'til', 'Til o.m.');

// svieSmertePerioder
export const eoSvieSmertePerioderCollection = topLevelCollection<SvieSmertePeriodeRow>('svieSmertePerioder');
export const eoSvieSmertePeriodeFraField = rowDate('svieSmertePerioder', 'fra', 'Fra o.m.');
export const eoSvieSmertePeriodeTilField = rowDate('svieSmertePerioder', 'til', 'Til o.m.');
export const eoSvieSmertePeriodeTilstandField = defineStructuralField<Tilstand | undefined>({
  id: 'eo.svieSmertePerioder.tilstand',
  template: rowTemplate('svieSmertePerioder', 'tilstand'),
  codec: createChoiceFieldCodec<Tilstand>(['sygemeldt', 'delvist-sygemeldt']),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Tilstand',
  controlKind: 'choice',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// oevrigeKravPerioder
export const eoOevrigeKravPerioderCollection = topLevelCollection<OevrigeKravRow>('oevrigeKravPerioder');
export const eoOevrigeKravDatoField = rowDate('oevrigeKravPerioder', 'dato', 'Dato');
export const eoOevrigeKravUdgiftTilField = defineStructuralField<string>({
  id: 'eo.oevrigeKravPerioder.udgiftTil',
  template: rowTemplate('oevrigeKravPerioder', 'udgiftTil'),
  codec: createTextFieldCodec(),
  emptyValue: '',
  isEmpty: (value) => value === '',
  label: 'Udgift til',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoOevrigeKravBeloebField = defineStructuralField<AmountValue | undefined>({
  id: 'eo.oevrigeKravPerioder.beloeb',
  template: rowTemplate('oevrigeKravPerioder', 'beloeb'),
  codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Beløb',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// offentligeYdelserRows (ydelse/tillaeg tillader negative jf. TableAmountInput-default)
export const eoOffentligeYdelserRowsCollection = topLevelCollection<OffentligeYdelserRow>('offentligeYdelserRows');
export const eoOffentligeYdelserFraDatoField = rowDate('offentligeYdelserRows', 'fraDato', 'Fra dato');
export const eoOffentligeYdelserTilDatoField = rowDate('offentligeYdelserRows', 'tilDato', 'Til dato');
const offentligYdelseAmount = (field: string, label: string): FieldDescriptor<AmountValue | undefined> =>
  defineStructuralField<AmountValue | undefined>({
    id: `eo.offentligeYdelserRows.${field}`,
    template: rowTemplate('offentligeYdelserRows', field),
    codec: createAmountFieldCodec({ allowNegative: true, allowDecimals: true }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoOffentligeYdelserYdelseField = offentligYdelseAmount('ydelse', 'Ydelse');
export const eoOffentligeYdelserTillaegField = offentligYdelseAmount('tillaeg', 'Tillæg');
// ydelsestype er et frit valg fra ydelsestype-kataloget; registreres som fritekst (valgmængden bor i data-laget).
export const eoOffentligeYdelserYdelsestypeField = defineStructuralField<string | undefined>({
  id: 'eo.offentligeYdelserRows.ydelsestype',
  template: rowTemplate('offentligeYdelserRows', 'ydelsestype'),
  codec: createOptionalTextFieldCodec(),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Ydelsestype',
  controlKind: 'choice',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// sfggAnsaettelsesforhold — samling med custom entity-id (`ansaettelsesforholdId`).
const SFGG = 'sfggAnsaettelsesforhold';
const sfggEntityIdProps = { [SFGG]: 'ansaettelsesforholdId' } as const;

export const eoSfggAnsaettelsesforholdCollection = defineStructuralCollection<SygeferiegodtgoerelseAnsaettelsesforholdRow>({
  id: 'eo.sfggAnsaettelsesforhold',
  template: { section: S, path: [], collection: SFGG },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  entityIdProperty: 'ansaettelsesforholdId',
});

const sfggField = <T>(
  field: string,
  label: string,
  codec: FieldCodec<T>,
  emptyValue: T,
  isEmpty: (value: T) => boolean,
  controlKind: FieldControlKind,
): FieldDescriptor<T> =>
  defineStructuralField<T>({
    id: `eo.sfggAnsaettelsesforhold.${field}`,
    template: rowTemplate(SFGG, field),
    codec,
    emptyValue,
    isEmpty,
    label,
    controlKind,
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    entityIdProperties: sfggEntityIdProps,
  });

export const eoSfggBeregningskildeField = sfggField<SygeferiegodtgoerelseBeregningskilde | undefined>(
  'sfggBeregningskilde', 'Beregningskilde',
  createChoiceFieldCodec<SygeferiegodtgoerelseBeregningskilde>(['Overenskomst', 'Manuelt angivet', 'Ferieloven', 'Ingen']),
  undefined, isUndefined, 'choice',
);
export const eoSfggReferenceperiodeFraField = defineStructuralField<ISODateString | undefined>({
  id: 'eo.sfggAnsaettelsesforhold.sfggReferenceperiodeFra',
  template: rowTemplate(SFGG, 'sfggReferenceperiodeFra'),
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined, isEmpty: isUndefined, label: 'Referenceperiode fra', controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection, entityIdProperties: sfggEntityIdProps,
});
export const eoSfggReferenceperiodeTilField = defineStructuralField<ISODateString | undefined>({
  id: 'eo.sfggAnsaettelsesforhold.sfggReferenceperiodeTil',
  template: rowTemplate(SFGG, 'sfggReferenceperiodeTil'),
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined, isEmpty: isUndefined, label: 'Referenceperiode til', controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection, entityIdProperties: sfggEntityIdProps,
});
export const eoSfggReferenceperiodeFravaersdageUdenLoenField = sfggField<number | undefined>(
  'sfggReferenceperiodeFravaersdageUdenLoen', 'Fraværsdage uden løn i referenceperioden',
  createIntegerFieldCodec({ allowNegative: false }), undefined, isUndefined, 'text',
);
export const eoSfggManuelDagssatsField = sfggField<AmountValue | undefined>(
  'sfggManuelDagssats', 'Manuel dagssats',
  createAmountFieldCodec({ allowNegative: false, allowDecimals: true }), undefined, isUndefined, 'text',
);
export const eoSfggManuelBeloebIHenholdTilField = sfggField<string | undefined>(
  'sfggManuelBeloebIHenholdTil', 'Beløb i henhold til',
  createOptionalTextFieldCodec(), undefined, isUndefined, 'text',
);
export const eoSfggManuelFoerstEfterSygeloenField = sfggField<JaNej | undefined>(
  'sfggManuelFoerstEfterSygeloen', 'Først efter sygeløn',
  createChoiceFieldCodec<JaNej>(['Ja', 'Nej']), undefined, isUndefined, 'choice',
);
export const eoSfggSatsvalgField = sfggField<SygeferiegodtgoerelseSatsvalg | undefined>(
  'sfggSatsvalg', 'Satsvalg',
  createChoiceFieldCodec<SygeferiegodtgoerelseSatsvalg>([
    'Faglaert-Koebenhavn', 'Faglaert-Provinsen', 'Ufaglaert-Koebenhavn', 'Ufaglaert-Provinsen',
  ]), undefined, isUndefined, 'choice',
);
export const eoSfggAlleredeBetaltBeloebField = sfggField<AmountValue | undefined>(
  'sfggAlleredeBetaltBeloeb', 'Allerede betalt beløb',
  createAmountFieldCodec({ allowNegative: false, allowDecimals: true }), undefined, isUndefined, 'text',
);

export const erstatningsopgoerelseFields = catalogFields(
  eoNummerField,
  eoLedsagetekstField,
  eoOpgørelseLavetDenField,
  eoIndsaetUdkastStempelField,
  eoVedroererPeriodeFraField,
  eoVedroererPeriodeTilField,
  eoRevideretOpgoerelseField,
  eoMidlertidigtEetFraEetSidenField,
  eoRegulerOffentligeYdelserField,
  eoAfsluttesMedField,
  eoForligAnsvarsgradProcentField,
  eoForligAnsvarsgradBroekField,
  eoForligDatoField,
  eoKravPaaOevrigeErstatningskravField,
  eoOffentligeYdelserKommentarerField,
  eoSaerligeKommentarerField,
  eoBilagIndgaarField,
  eoBilagSelectionOpgoerelseField,
  eoBilagSelectionLoenindkomstField,
  eoBilagSelectionOffentligeYdelserField,
  eoBilagSelectionMidlertidigEetField,
  eoBilagSelectionShDageField,
  eoBilagSelectionReguleringField,
  eoBilagSelectionOkSatserField,
  eoBilagSelectionSygeferiegodtgoerelseField,
  eoVarigeMenAfgorelseField,
  eoMenAfgoerelseDatoField,
  eoVerserendeKlageMenField,
  eoMidlertidigtEETAfgorelseField,
  eoMidlertidigEETAfgoerelseDatoField,
  eoMidlertidigEETVirkningsdatoField,
  eoEndeligtEETAfgorelseField,
  eoEndeligEETAfgoerelseDatoField,
  eoEndeligEETVirkningsdatoField,
  eoVerserendeKlageEetField,
  eoDifferencekravDatoField,
  eoKravPaaSvieSmerteGodtgoerelseField,
  eoSvieSmerteHelbredsstatusField,
  eoTidligereSsMaxField,
  eoSvieSmerteSatserAarField,
  eoSvieSmerteDelvisSygemeldingSatsField,
  eoSvieSmerteTidligereTotalField,
  eoSvieSmerteAktuelPeriodeField,
  eoKravPaaTabtArbejdsfortjenesteField,
  eoTafArbejdsstatusField,
  eoSidsteDagAnsaettelsesforholdField,
  eoTidligereModtagetTafField,
  eoKomprimerBeregningField,
  eoBeregnesUdFraField,
  eoTafBeregningsperiodeFraField,
  eoTafBeregningsperiodeTilField,
  eoUspecificeredeFerieFridageField,
  eoOevrigtFravaerUdenLoenField,
  eoOevrigeFravaersdageField,
  eoOevrigeFravaersdageBeskrivelseField,
  eoMaanedsloenenUdgoerField,
  eoDagsloenenUdgoerField,
  eoAngivetMaanedsloenBaseretPaaField,
  eoAngivetMaanedsloenOpreguleresFraDatoField,
  eoAngivetDagsloenBaseretPaaField,
  eoAngivetDagsloenOpreguleresFraDatoField,
  eoVisBilagsnumreField,
  eoBilagsnumreMenAfgoerelseField,
  eoBilagsnumreEetAfgoerelserField,
  eoBilagsnumreSvieSmerteDokumentationField,
  eoBilagsnumreBeregningsgrundlagTafField,
  eoBilagsnumreLoenISygeperiodenField,
  eoBilagsnumreOffentligeYdelserField,
  eoBilagsnumreOevrigeErstatningskravField,
  eoTafPeriodeFraField,
  eoTafPeriodeTilField,
  eoTafPeriodeLoseFeriedageField,
  eoFerieperiodeFraField,
  eoFerieperiodeTilField,
  eoSfggBeregningskildeField,
  eoSfggReferenceperiodeFraField,
  eoSfggReferenceperiodeTilField,
  eoSfggReferenceperiodeFravaersdageUdenLoenField,
  eoSfggManuelDagssatsField,
  eoSfggManuelBeloebIHenholdTilField,
  eoSfggManuelFoerstEfterSygeloenField,
  eoSfggSatsvalgField,
  eoSfggAlleredeBetaltBeloebField,
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
  eoSvieSmertePeriodeTilstandField,
  eoOevrigeKravDatoField,
  eoOevrigeKravUdgiftTilField,
  eoOevrigeKravBeloebField,
  eoOffentligeYdelserFraDatoField,
  eoOffentligeYdelserTilDatoField,
  eoOffentligeYdelserYdelseField,
  eoOffentligeYdelserTillaegField,
  eoOffentligeYdelserYdelsestypeField,
);

export const erstatningsopgoerelseCollections = catalogCollections(
  eoTafPerioderCollection,
  eoFerieperioderCollection,
  eoSfggAnsaettelsesforholdCollection,
  eoFravaerPerioderCollection,
  eoSvieSmertePerioderCollection,
  eoOevrigeKravPerioderCollection,
  eoOffentligeYdelserRowsCollection,
);
