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
import type { CollectionBinding, FieldAddressTemplate, FieldBinding } from '../fieldCatalog';
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
import { defineField } from '../fieldDefinition';
import { createStructuralCollectionBinding, createStructuralFieldBinding } from '../structuralBindings';
import { defineInputManifest } from './inputManifest';

/**
 * Strukturelle bindinger for `erstatningsopgoerelse`-sektionen: top-level skalarer (incl. nested
 * bilagsvalgs-booleans) og de rene top-level samlinger med deres rækkefelter.
 *
 * `sfggAnsaettelsesforhold` er en ren top-level samling som de øvrige (kun rene canonical rækkefelter),
 * men identificeres på `ansaettelsesforholdId` i stedet for `id`; den registreres derfor med en
 * `entityIdProperty` på den strukturelle collection-binding (jf. `createStructuralCollectionBinding`).
 *
 * Lønindkomstens og EO-angivet løns nested træ ligger i den særskilte
 * `erstatningsopgoerelseLoenInputBindings.ts`, fordi det udgør én sammenhængende bindinggraf med
 * parent-samling, nested tabeller og fælles løncodecs.
 *
 * Den tomme sektion er den fulde canonical default: `loenindkomstAnsaettelsesforhold` er en påkrævet
 * (ikke-defaultet) array, så den skal angives eksplicit for at parse.
 */
export const createEmptyErstatningsopgoerelseSection = (): unknown =>
  erstatningsopgoerelseSchema.parse({ loenindkomstAnsaettelsesforhold: [] });



// ─── Generiske top-level felt-hjælpere ──────────────────────────────────────────

const optionalTextField = (field: string, label: string): FieldBinding<string | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<string | undefined>({
      label,
      controlKind: 'text',
      codec: createOptionalTextFieldCodec(),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const dateField = (field: string, label: string): FieldBinding<ISODateString | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<ISODateString | undefined>({
      label,
      controlKind: 'text',
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const amountField = (field: string, label: string): FieldBinding<AmountValue | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<AmountValue | undefined>({
      label,
      controlKind: 'text',
      codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const integerField = (field: string, label: string): FieldBinding<number | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<number | undefined>({
      label,
      controlKind: 'text',
      codec: createIntegerFieldCodec({ allowNegative: false }),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const jaNejField = (field: string, label: string): FieldBinding<JaNej | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<JaNej | undefined>({
      label,
      controlKind: 'choice',
      codec: createChoiceFieldCodec<JaNej>(['Ja', 'Nej']),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const jaNejSkjulField = (field: string, label: string): FieldBinding<JaNejSkjul | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<JaNejSkjul | undefined>({
      label,
      controlKind: 'choice',
      codec: createChoiceFieldCodec<JaNejSkjul>(['Ja', 'Nej', 'Skjul']),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

// ─── Base-blok ──────────────────────────────────────────────────────────────────

export const eoNummerBinding = optionalTextField('eoNummer', 'EO-nummer');
export const eoLedsagetekstBinding = optionalTextField('eoLedsagetekst', 'Ledsagetekst');
export const eoOpgørelseLavetDenBinding = dateField('opgørelseLavetDen', 'Opgørelse lavet den');
export const eoIndsaetUdkastStempelBinding = jaNejField('indsaetUdkastStempel', 'Indsæt udkast-stempel');
export const eoVedroererPeriodeFraBinding = dateField('vedroererPeriodeFra', 'Vedrører periode fra');
export const eoVedroererPeriodeTilBinding = dateField('vedroererPeriodeTil', 'Vedrører periode til');
export const eoRevideretOpgoerelseBinding = jaNejField('revideretOpgoerelse', 'Revideret opgørelse');
export const eoMidlertidigtEetFraEetSidenBinding = jaNejField('midlertidigtEetFraEetSiden', 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden');
export const eoRegulerOffentligeYdelserBinding = jaNejField('regulerOffentligeYdelser', 'Regulér offentlige ydelser');
export const eoForligAnsvarsgradProcentBinding: FieldBinding<number | undefined> = createStructuralFieldBinding({
  definition: defineField<number | undefined>({
    label: 'Forlig ansvarsgrad (%)',
    controlKind: 'text',
    codec: createPercentFieldCodec({ allowNegative: false, allowDecimals: true }),
  }),
  template: { section: 'erstatningsopgoerelse', path: [], field: 'forligAnsvarsgradProcent' },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
// Brøk-controllen (`StyledFractionField` i ForligSection.tsx og EetDifferencekravTab.tsx) bruges begge
// steder med feltets standard-props; codec-configen afspejler dem eksplicit, så katalogets raw→canonical
// er identisk med UI-controllens. Schematypen forbliver `optionalString` (tom brøk = `undefined`).
export const eoForligAnsvarsgradBroekBinding: FieldBinding<string | undefined> = createStructuralFieldBinding({
  definition: defineField<string | undefined>({
    label: 'Forlig ansvarsgrad (brøk)',
    controlKind: 'text',
    codec: createFractionFieldCodec({
      maxDigits: DEFAULT_FRACTION_MAX_DIGITS,
      allowNegative: false,
      allowZeroNumerator: false,
      canonicalizeOnCommit: false,
      requireIntegerFraction: false,
    }),
  }),
  template: { section: 'erstatningsopgoerelse', path: [], field: 'forligAnsvarsgradBroek' },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoForligDatoBinding = dateField('forligDato', 'Forligsdato');
export const eoKravPaaOevrigeErstatningskravBinding = jaNejSkjulField('kravPaaOevrigeErstatningskrav', 'Krav på øvrige erstatningskrav');
export const eoOffentligeYdelserKommentarerBinding = optionalTextField('offentligeYdelserKommentarer', 'Kommentarer');
export const eoLoenudviklingPaaGrundlagAfBinding = optionalTextField('loenudviklingPaaGrundlagAf', 'Lønudvikling på grundlag af');
export const eoSaerligeKommentarerBinding = optionalTextField('saerligeKommentarer', 'Særlige kommentarer');

export const eoAfsluttesMedBinding: FieldBinding<AfsluttesMed | undefined> = createStructuralFieldBinding({
  definition: defineField<AfsluttesMed | undefined>({
    label: 'Afsluttes med',
    controlKind: 'choice',
    codec: createChoiceFieldCodec<AfsluttesMed>(['Bekræftet godkendt', 'Underskrift-linje', 'Ingen']),
  }),
  template: { section: 'erstatningsopgoerelse', path: [], field: 'erstatningsopgoerelseAfsluttesMed' },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

export const eoBilagIndgaarBinding: FieldBinding<EoBilagLoenindkomstOgOffentligeYdelserIndgaar | undefined> =
  createStructuralFieldBinding({
    definition: defineField<EoBilagLoenindkomstOgOffentligeYdelserIndgaar | undefined>({
      label: 'Bilag: lønindkomst/off. ydelser indgår',
      controlKind: 'choice',
      codec: createChoiceFieldCodec<EoBilagLoenindkomstOgOffentligeYdelserIndgaar>(['Alle', 'Perioden']),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field: 'eoBilagLoenindkomstOgOffentligeYdelserIndgaar' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

// ─── Nested bilagsvalg (eoBilagSelection, 8 booleans) ───────────────────────────

const eoBilagSelectionToggle = (field: string, label: string): FieldBinding<boolean> =>
  createStructuralFieldBinding({
    definition: defineField<boolean>({
      label,
      controlKind: 'toggle',
      codec: booleanFieldCodec,
    }),
    template: {
      section: 'erstatningsopgoerelse',
      path: [{ kind: 'property', name: 'eoBilagSelection' }],
      field,
    },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

export const eoBilagSelectionOpgoerelseBinding = eoBilagSelectionToggle('opgoerelse', 'Bilag: opgørelse');
export const eoBilagSelectionLoenindkomstBinding = eoBilagSelectionToggle('loenindkomst', 'Bilag: lønindkomst');
export const eoBilagSelectionOffentligeYdelserBinding = eoBilagSelectionToggle('offentligeYdelser', 'Bilag: offentlige ydelser');
export const eoBilagSelectionMidlertidigEetBinding = eoBilagSelectionToggle('midlertidigEet', 'Bilag: midlertidigt EET');
export const eoBilagSelectionShDageBinding = eoBilagSelectionToggle('shDage', 'Bilag: SH-dage');
export const eoBilagSelectionReguleringBinding = eoBilagSelectionToggle('regulering', 'Bilag: regulering');
export const eoBilagSelectionOkSatserBinding = eoBilagSelectionToggle('okSatser', 'Bilag: OK-satser');
export const eoBilagSelectionSygeferiegodtgoerelseBinding = eoBilagSelectionToggle('sygeferiegodtgoerelse', 'Bilag: sygeferiegodtgørelse');

// ─── AES afgørelser (skalarer) ──────────────────────────────────────────────────

export const eoVarigeMenAfgorelseBinding = jaNejField('varigeMenAfgorelse', 'Varige mén-afgørelse');
export const eoMenAfgoerelseDatoBinding = dateField('menAfgoerelseDato', 'Mén-afgørelsesdato');
export const eoVerserendeKlageMenBinding = jaNejField('verserendeKlageMen', 'Verserende klage (mén)');
export const eoMidlertidigtEETAfgorelseBinding = jaNejField('midlertidigtEETAfgorelse', 'Midlertidigt EET-afgørelse');
export const eoMidlertidigEETAfgoerelseDatoBinding = dateField('midlertidigEETAfgoerelseDato', 'Midlertidigt EET-afgørelsesdato');
export const eoMidlertidigEETVirkningsdatoBinding = dateField('midlertidigEETVirkningsdato', 'Midlertidigt EET-virkningsdato');
export const eoEndeligtEETAfgorelseBinding = jaNejField('endeligtEETAfgorelse', 'Endeligt EET-afgørelse');
export const eoEndeligEETAfgoerelseDatoBinding = dateField('endeligEETAfgoerelseDato', 'Endeligt EET-afgørelsesdato');
export const eoEndeligEETVirkningsdatoBinding = dateField('endeligEETVirkningsdato', 'Endeligt EET-virkningsdato');
export const eoVerserendeKlageEetBinding = jaNejField('verserendeKlageEet', 'Verserende klage (EET)');
export const eoDifferencekravDatoBinding = dateField('differencekravDato', 'Differencekravsdato');

// ─── Svie/smerte (skalarer) ─────────────────────────────────────────────────────

export const eoKravPaaSvieSmerteGodtgoerelseBinding = jaNejSkjulField('kravPaaSvieSmerteGodtgoerelse', 'Krav på svie- og smertegodtgørelse');
export const eoSvieSmerteHelbredsstatusBinding: FieldBinding<Helbredsstatus | undefined> = createStructuralFieldBinding({
  definition: defineField<Helbredsstatus | undefined>({
    label: 'Helbredsstatus',
    controlKind: 'choice',
    codec: createChoiceFieldCodec<Helbredsstatus>(['Sygemeldt', 'Delvist Sygemeldt', 'Raskmeldt']),
  }),
  template: { section: 'erstatningsopgoerelse', path: [], field: 'svieSmerteHelbredsstatus' },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoTidligereSsMaxBinding = jaNejField('tidligereSsMax', 'Tidligere svie/smerte-max nået');
// Årsfelt (StyledYearField): tocifrede år infereres, og MIN_SVIESMERTE_YEAR..CURRENT_YEAR er
// det afledte bounds-issue. Et heltalscodec ville fortolke "23" som 23 i stedet for 2023.
export const eoSvieSmerteSatserAarBinding: FieldBinding<number | undefined> = createStructuralFieldBinding({
  definition: defineField<number | undefined>({
    label: 'Svie/smerte satsår',
    controlKind: 'text',
    codec: createYearFieldCodec({
      twoDigitYearPolicy: 'infer',
      minYear: MIN_SVIESMERTE_YEAR,
      maxYear: CURRENT_YEAR,
    }),
  }),
  template: { section: 'erstatningsopgoerelse', path: [], field: 'svieSmerteSatserAar' },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoSvieSmerteDelvisSygemeldingSatsBinding: FieldBinding<SvieSmerteDelvisSygemeldingSats | undefined> =
  createStructuralFieldBinding({
    definition: defineField<SvieSmerteDelvisSygemeldingSats | undefined>({
      label: 'Sats ved delvis sygemelding',
      controlKind: 'choice',
      codec: createChoiceFieldCodec<SvieSmerteDelvisSygemeldingSats>(['fuld', 'halv']),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field: 'svieSmerteDelvisSygemeldingSats' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoSvieSmerteTidligereTotalBinding = amountField('svieSmerteTidligereTotal', 'Tidligere udbetalt svie/smerte');
export const eoSvieSmerteAktuelPeriodeBinding = amountField('svieSmerteAktuelPeriode', 'Svie/smerte aktuel periode');

// ─── TAF (skalarer) ─────────────────────────────────────────────────────────────

export const eoKravPaaTabtArbejdsfortjenesteBinding = jaNejSkjulField('kravPaaTabtArbejdsfortjeneste', 'Krav på tabt arbejdsfortjeneste');
export const eoTafArbejdsstatusBinding: FieldBinding<Arbejdsstatus | undefined> = createStructuralFieldBinding({
  definition: defineField<Arbejdsstatus | undefined>({
    label: 'Arbejdsstatus',
    controlKind: 'choice',
    codec: createChoiceFieldCodec<Arbejdsstatus>([
      'Uarbejdsdygtig',
      'Delvist raskmeldt',
      'Fuldt arbejdsdygtig',
      'Fleksjob',
      'Revalidering',
      'Uddannelse',
      'Førtidspension',
      'Seniorpension',
      'Folkepension',
      'Efterløn',
      'Kontanthjælp',
    ]),
  }),
  template: { section: 'erstatningsopgoerelse', path: [], field: 'tafArbejdsstatus' },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoOpsagtFraStillingBinding = jaNejField('opsagtFraStilling', 'Opsagt fra stilling');
export const eoSidsteDagAnsaettelsesforholdBinding = dateField('sidsteDagAnsaettelsesforhold', 'Sidste dag i ansættelsesforhold');
export const eoTidligereModtagetTafBinding = amountField('tidligereModtagetTaf', 'Tidligere modtaget TAF');

// ─── Indtægt før skaden (skalarer, fanen lønindkomst) ───────────────────────────

export const eoKomprimerBeregningBinding = jaNejField('komprimerBeregningEfterFoersteOpgoerelse', 'Komprimér beregning efter første opgørelse');
export const eoBeregnesUdFraBinding: FieldBinding<Beregningsmetode | undefined> = createStructuralFieldBinding({
  definition: defineField<Beregningsmetode | undefined>({
    label: 'Beregnes ud fra',
    controlKind: 'choice',
    codec: createChoiceFieldCodec<Beregningsmetode>(['Beregningsperiode', 'Angivet månedsløn', 'Angivet dagsløn']),
  }),
  template: { section: 'erstatningsopgoerelse', path: [], field: 'beregnesUdFra' },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoTafBeregningsperiodeFraBinding = dateField('tafBeregningsperiodeFra', 'Beregningsperiode fra');
export const eoTafBeregningsperiodeTilBinding = dateField('tafBeregningsperiodeTil', 'Beregningsperiode til');
export const eoUspecificeredeFerieFridageBinding = integerField('uspecificeredeFerieFridage', 'Uspecificerede ferie-/fridage');
export const eoOevrigtFravaerUdenLoenBinding = jaNejField('oevrigtFravaerUdenLoen', 'Øvrigt fravær uden løn');
export const eoOevrigeFravaersdageBinding = integerField('oevrigeFravaersdage', 'Øvrige fraværsdage');
export const eoOevrigeFravaersdageBeskrivelseBinding = optionalTextField('oevrigeFravaersdageBeskrivelse', 'Beskrivelse af øvrige fraværsdage');
export const eoMaanedsloenenUdgoerBinding = amountField('maanedsloenenUdgoer', 'Månedslønnen udgør');
export const eoDagsloenenUdgoerBinding = amountField('dagsloenenUdgoer', 'Dagslønnen udgør');
export const eoAngivetMaanedsloenBaseretPaaBinding = optionalTextField('angivetMaanedsloenBaseretPaa', 'Angivet månedsløn baseret på');
export const eoAngivetMaanedsloenOpreguleresFraDatoBinding = dateField('angivetMaanedsloenOpreguleresFraDato', 'Angivet månedsløn opreguleres fra');
export const eoAngivetDagsloenBaseretPaaBinding = optionalTextField('angivetDagsloenBaseretPaa', 'Angivet dagsløn baseret på');
export const eoAngivetDagsloenOpreguleresFraDatoBinding = dateField('angivetDagsloenOpreguleresFraDato', 'Angivet dagsløn opreguleres fra');

// ─── Bilagsnumre (skalarer) ─────────────────────────────────────────────────────

export const eoVisBilagsnumreBinding = jaNejField('visBilagsnumre', 'Vis bilagsnumre');
export const eoBilagsnumreMenAfgoerelseBinding = optionalTextField('bilagsnumreMenAfgoerelse', 'Bilagsnr. mén-afgørelse');
export const eoBilagsnumreEetAfgoerelserBinding = optionalTextField('bilagsnumreEetAfgoerelser', 'Bilagsnr. EET-afgørelser');
export const eoBilagsnumreSvieSmerteDokumentationBinding = optionalTextField('bilagsnumreSvieSmerteDokumentation', 'Bilagsnr. svie/smerte-dokumentation');
export const eoBilagsnumreBeregningsgrundlagTafBinding = optionalTextField('bilagsnumreBeregningsgrundlagTaf', 'Bilagsnr. beregningsgrundlag TAF');
export const eoBilagsnumreLoenISygeperiodenBinding = optionalTextField('bilagsnumreLoenISygeperioden', 'Bilagsnr. løn i sygeperioden');
export const eoBilagsnumreOffentligeYdelserBinding = optionalTextField('bilagsnumreOffentligeYdelser', 'Bilagsnr. offentlige ydelser');
export const eoBilagsnumreOevrigeErstatningskravBinding = optionalTextField('bilagsnumreOevrigeErstatningskrav', 'Bilagsnr. øvrige erstatningskrav');

// ─── Rene top-level samlinger + rækkefelter ─────────────────────────────────────

const rowFieldTemplate = (collection: string, field: string): FieldAddressTemplate => ({
  section: 'erstatningsopgoerelse',
  path: [{ kind: 'entity', collection }],
  field,
});

const rowDateField = (collection: string, field: string, label: string): FieldBinding<ISODateString | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<ISODateString | undefined>({
      label,
      controlKind: 'text',
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    }),
    template: rowFieldTemplate(collection, field),
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

// tafPerioder
export const eoTafPerioderBinding: CollectionBinding<TafPeriodeRow> =
  createStructuralCollectionBinding<TafPeriodeRow>({
    template: { section: 'erstatningsopgoerelse', path: [], collection: 'tafPerioder' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoTafPeriodeFraBinding = rowDateField('tafPerioder', 'fra', 'Fra o.m.');
export const eoTafPeriodeTilBinding = rowDateField('tafPerioder', 'til', 'Til o.m.');
export const eoTafPeriodeLoseFeriedageBinding: FieldBinding<number | undefined> = createStructuralFieldBinding({
  definition: defineField<number | undefined>({
    label: 'Løse feriedage',
    controlKind: 'text',
    codec: createIntegerFieldCodec({ allowNegative: false }),
  }),
  template: rowFieldTemplate('tafPerioder', 'loseFeriedage'),
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// ferieperioder
export const eoFerieperioderBinding: CollectionBinding<FerieperiodeRow> =
  createStructuralCollectionBinding<FerieperiodeRow>({
    template: { section: 'erstatningsopgoerelse', path: [], collection: 'ferieperioder' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoFerieperiodeFraBinding = rowDateField('ferieperioder', 'fra', 'Fra o.m.');
export const eoFerieperiodeTilBinding = rowDateField('ferieperioder', 'til', 'Til o.m.');

// sfggSygeperioderFoer2015 (samme rækkeform som ferieperioder)
export const eoSfggSygeperioderFoer2015Binding: CollectionBinding<FerieperiodeRow> =
  createStructuralCollectionBinding<FerieperiodeRow>({
    template: { section: 'erstatningsopgoerelse', path: [], collection: 'sfggSygeperioderFoer2015' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoSfggSygeperiodeFraBinding = rowDateField('sfggSygeperioderFoer2015', 'fra', 'Fra o.m.');
export const eoSfggSygeperiodeTilBinding = rowDateField('sfggSygeperioderFoer2015', 'til', 'Til o.m.');

// fravaerPerioder (samme rækkeform som ferieperioder)
export const eoFravaerPerioderBinding: CollectionBinding<FerieperiodeRow> =
  createStructuralCollectionBinding<FerieperiodeRow>({
    template: { section: 'erstatningsopgoerelse', path: [], collection: 'fravaerPerioder' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoFravaerPeriodeFraBinding = rowDateField('fravaerPerioder', 'fra', 'Fra o.m.');
export const eoFravaerPeriodeTilBinding = rowDateField('fravaerPerioder', 'til', 'Til o.m.');

// svieSmertePerioder
export const eoSvieSmertePerioderBinding: CollectionBinding<SvieSmertePeriodeRow> =
  createStructuralCollectionBinding<SvieSmertePeriodeRow>({
    template: { section: 'erstatningsopgoerelse', path: [], collection: 'svieSmertePerioder' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoSvieSmertePeriodeFraBinding = rowDateField('svieSmertePerioder', 'fra', 'Fra o.m.');
export const eoSvieSmertePeriodeTilBinding = rowDateField('svieSmertePerioder', 'til', 'Til o.m.');
export const eoSvieSmertePeriodeTilstandBinding: FieldBinding<Tilstand | undefined> = createStructuralFieldBinding({
  definition: defineField<Tilstand | undefined>({
    label: 'Tilstand',
    controlKind: 'choice',
    codec: createChoiceFieldCodec<Tilstand>(['sygemeldt', 'delvist-sygemeldt']),
  }),
  template: rowFieldTemplate('svieSmertePerioder', 'tilstand'),
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// oevrigeKravPerioder
export const eoOevrigeKravPerioderBinding: CollectionBinding<OevrigeKravRow> =
  createStructuralCollectionBinding<OevrigeKravRow>({
    template: { section: 'erstatningsopgoerelse', path: [], collection: 'oevrigeKravPerioder' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoOevrigeKravDatoBinding = rowDateField('oevrigeKravPerioder', 'dato', 'Dato');
export const eoOevrigeKravUdgiftTilBinding: FieldBinding<string> = createStructuralFieldBinding({
  definition: defineField<string>({
    label: 'Udgift til',
    controlKind: 'text',
    codec: createTextFieldCodec(),
  }),
  template: rowFieldTemplate('oevrigeKravPerioder', 'udgiftTil'),
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoOevrigeKravBeloebBinding: FieldBinding<AmountValue | undefined> = createStructuralFieldBinding({
  definition: defineField<AmountValue | undefined>({
    label: 'Beløb',
    controlKind: 'text',
    codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
  }),
  template: rowFieldTemplate('oevrigeKravPerioder', 'beloeb'),
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// offentligeYdelserRows (ydelse/tillaeg tillader negative jf. TableAmountInput-default)
export const eoOffentligeYdelserRowsBinding: CollectionBinding<OffentligeYdelserRow> =
  createStructuralCollectionBinding<OffentligeYdelserRow>({
    template: { section: 'erstatningsopgoerelse', path: [], collection: 'offentligeYdelserRows' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoOffentligeYdelserFraDatoBinding = rowDateField('offentligeYdelserRows', 'fraDato', 'Fra dato');
export const eoOffentligeYdelserTilDatoBinding = rowDateField('offentligeYdelserRows', 'tilDato', 'Til dato');
const offentligYdelseAmount = (field: string, label: string): FieldBinding<AmountValue | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<AmountValue | undefined>({
      label,
      controlKind: 'text',
      codec: createAmountFieldCodec({ allowNegative: true, allowDecimals: true }),
    }),
    template: rowFieldTemplate('offentligeYdelserRows', field),
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoOffentligeYdelserYdelseBinding = offentligYdelseAmount('ydelse', 'Ydelse');
export const eoOffentligeYdelserTillaegBinding = offentligYdelseAmount('tillaeg', 'Tillæg');
// ydelsestype er et frit valg fra ydelsestype-kataloget (tableCellString); registreres som fritekst,
// da valgmængden defineres i data-laget (ydelsestypeKeys), ikke som en fast enum i schemaet.
export const eoOffentligeYdelserYdelsestypeBinding: FieldBinding<string | undefined> = createStructuralFieldBinding({
  definition: defineField<string | undefined>({
    label: 'Ydelsestype',
    controlKind: 'choice',
    codec: createOptionalTextFieldCodec(),
  }),
  template: rowFieldTemplate('offentligeYdelserRows', 'ydelsestype'),
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// sfggAnsaettelsesforhold — samling med custom entity-id (`ansaettelsesforholdId`, ikke `id`).
// Kun rene canonical rækkefelter (enum/dato/heltal/beløb/fritekst/JaNej), så de registreres som
// de øvrige samlinger; entity-id'et threades gennem den strukturelle collection-binding.
const SFGG = 'sfggAnsaettelsesforhold';

export const eoSfggAnsaettelsesforholdBinding: CollectionBinding<SygeferiegodtgoerelseAnsaettelsesforholdRow> =
  createStructuralCollectionBinding<SygeferiegodtgoerelseAnsaettelsesforholdRow>({
    template: { section: 'erstatningsopgoerelse', path: [], collection: SFGG },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    entityIdProperty: 'ansaettelsesforholdId',
  });

/** Rækkefelt-binding under sfgg-samlingen; entity-led resolver på `ansaettelsesforholdId`. */
const sfggRowField = <T>(field: string, definition: FieldBinding<T>['definition']): FieldBinding<T> =>
  createStructuralFieldBinding<T>({
    definition,
    template: rowFieldTemplate(SFGG, field),
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    entityIdProperties: { [SFGG]: 'ansaettelsesforholdId' },
  });

export const eoSfggBeregningskildeBinding = sfggRowField<SygeferiegodtgoerelseBeregningskilde | undefined>(
  'sfggBeregningskilde',
  defineField<SygeferiegodtgoerelseBeregningskilde | undefined>({
    label: 'Beregningskilde',
    controlKind: 'choice',
    codec: createChoiceFieldCodec<SygeferiegodtgoerelseBeregningskilde>([
      'Overenskomst',
      'Manuelt angivet',
      'Ferieloven',
      'Ingen',
    ]),
  })
);
export const eoSfggReferenceperiodeFraBinding = rowDateField(SFGG, 'sfggReferenceperiodeFra', 'Referenceperiode fra');
export const eoSfggReferenceperiodeTilBinding = rowDateField(SFGG, 'sfggReferenceperiodeTil', 'Referenceperiode til');
export const eoSfggReferenceperiodeFravaersdageUdenLoenBinding = sfggRowField<number | undefined>(
  'sfggReferenceperiodeFravaersdageUdenLoen',
  defineField<number | undefined>({
    label: 'Fraværsdage uden løn i referenceperioden',
    controlKind: 'text',
    codec: createIntegerFieldCodec({ allowNegative: false }),
  })
);
export const eoSfggManuelDagssatsBinding = sfggRowField<AmountValue | undefined>(
  'sfggManuelDagssats',
  defineField<AmountValue | undefined>({
    label: 'Manuel dagssats',
    controlKind: 'text',
    codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
  })
);
export const eoSfggManuelBeloebIHenholdTilBinding = sfggRowField<string | undefined>(
  'sfggManuelBeloebIHenholdTil',
  defineField<string | undefined>({
    label: 'Beløb i henhold til',
    controlKind: 'text',
    codec: createOptionalTextFieldCodec(),
  })
);
export const eoSfggManuelFoerstEfterSygeloenBinding = sfggRowField<JaNej | undefined>(
  'sfggManuelFoerstEfterSygeloen',
  defineField<JaNej | undefined>({
    label: 'Først efter sygeløn',
    controlKind: 'choice',
    codec: createChoiceFieldCodec<JaNej>(['Ja', 'Nej']),
  })
);
export const eoSfggSatsvalgBinding = sfggRowField<SygeferiegodtgoerelseSatsvalg | undefined>(
  'sfggSatsvalg',
  defineField<SygeferiegodtgoerelseSatsvalg | undefined>({
    label: 'Satsvalg',
    controlKind: 'choice',
    codec: createChoiceFieldCodec<SygeferiegodtgoerelseSatsvalg>([
      'Faglaert-Koebenhavn',
      'Faglaert-Provinsen',
      'Ufaglaert-Koebenhavn',
      'Ufaglaert-Provinsen',
    ]),
  })
);
export const eoSfggAlleredeBetaltBeloebBinding = sfggRowField<AmountValue | undefined>(
  'sfggAlleredeBetaltBeloeb',
  defineField<AmountValue | undefined>({
    label: 'Allerede betalt beløb',
    controlKind: 'text',
    codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
  })
);

export const erstatningsopgoerelseInputManifest = defineInputManifest({
  id: 'erstatningsopgoerelse',
  fields: [
    eoNummerBinding,
    eoLedsagetekstBinding,
    eoOpgørelseLavetDenBinding,
    eoIndsaetUdkastStempelBinding,
    eoVedroererPeriodeFraBinding,
    eoVedroererPeriodeTilBinding,
    eoRevideretOpgoerelseBinding,
    eoMidlertidigtEetFraEetSidenBinding,
    eoRegulerOffentligeYdelserBinding,
    eoAfsluttesMedBinding,
    eoForligAnsvarsgradProcentBinding,
    eoForligAnsvarsgradBroekBinding,
    eoForligDatoBinding,
    eoKravPaaOevrigeErstatningskravBinding,
    eoOffentligeYdelserKommentarerBinding,
    eoLoenudviklingPaaGrundlagAfBinding,
    eoSaerligeKommentarerBinding,
    eoBilagIndgaarBinding,
    eoBilagSelectionOpgoerelseBinding,
    eoBilagSelectionLoenindkomstBinding,
    eoBilagSelectionOffentligeYdelserBinding,
    eoBilagSelectionMidlertidigEetBinding,
    eoBilagSelectionShDageBinding,
    eoBilagSelectionReguleringBinding,
    eoBilagSelectionOkSatserBinding,
    eoBilagSelectionSygeferiegodtgoerelseBinding,
    eoVarigeMenAfgorelseBinding,
    eoMenAfgoerelseDatoBinding,
    eoVerserendeKlageMenBinding,
    eoMidlertidigtEETAfgorelseBinding,
    eoMidlertidigEETAfgoerelseDatoBinding,
    eoMidlertidigEETVirkningsdatoBinding,
    eoEndeligtEETAfgorelseBinding,
    eoEndeligEETAfgoerelseDatoBinding,
    eoEndeligEETVirkningsdatoBinding,
    eoVerserendeKlageEetBinding,
    eoDifferencekravDatoBinding,
    eoKravPaaSvieSmerteGodtgoerelseBinding,
    eoSvieSmerteHelbredsstatusBinding,
    eoTidligereSsMaxBinding,
    eoSvieSmerteSatserAarBinding,
    eoSvieSmerteDelvisSygemeldingSatsBinding,
    eoSvieSmerteTidligereTotalBinding,
    eoSvieSmerteAktuelPeriodeBinding,
    eoKravPaaTabtArbejdsfortjenesteBinding,
    eoTafArbejdsstatusBinding,
    eoOpsagtFraStillingBinding,
    eoSidsteDagAnsaettelsesforholdBinding,
    eoTidligereModtagetTafBinding,
    eoKomprimerBeregningBinding,
    eoBeregnesUdFraBinding,
    eoTafBeregningsperiodeFraBinding,
    eoTafBeregningsperiodeTilBinding,
    eoUspecificeredeFerieFridageBinding,
    eoOevrigtFravaerUdenLoenBinding,
    eoOevrigeFravaersdageBinding,
    eoOevrigeFravaersdageBeskrivelseBinding,
    eoMaanedsloenenUdgoerBinding,
    eoDagsloenenUdgoerBinding,
    eoAngivetMaanedsloenBaseretPaaBinding,
    eoAngivetMaanedsloenOpreguleresFraDatoBinding,
    eoAngivetDagsloenBaseretPaaBinding,
    eoAngivetDagsloenOpreguleresFraDatoBinding,
    eoVisBilagsnumreBinding,
    eoBilagsnumreMenAfgoerelseBinding,
    eoBilagsnumreEetAfgoerelserBinding,
    eoBilagsnumreSvieSmerteDokumentationBinding,
    eoBilagsnumreBeregningsgrundlagTafBinding,
    eoBilagsnumreLoenISygeperiodenBinding,
    eoBilagsnumreOffentligeYdelserBinding,
    eoBilagsnumreOevrigeErstatningskravBinding,
    eoTafPeriodeFraBinding,
    eoTafPeriodeTilBinding,
    eoTafPeriodeLoseFeriedageBinding,
    eoFerieperiodeFraBinding,
    eoFerieperiodeTilBinding,
    eoSfggSygeperiodeFraBinding,
    eoSfggSygeperiodeTilBinding,
    eoSfggBeregningskildeBinding,
    eoSfggReferenceperiodeFraBinding,
    eoSfggReferenceperiodeTilBinding,
    eoSfggReferenceperiodeFravaersdageUdenLoenBinding,
    eoSfggManuelDagssatsBinding,
    eoSfggManuelBeloebIHenholdTilBinding,
    eoSfggManuelFoerstEfterSygeloenBinding,
    eoSfggSatsvalgBinding,
    eoSfggAlleredeBetaltBeloebBinding,
    eoFravaerPeriodeFraBinding,
    eoFravaerPeriodeTilBinding,
    eoSvieSmertePeriodeFraBinding,
    eoSvieSmertePeriodeTilBinding,
    eoSvieSmertePeriodeTilstandBinding,
    eoOevrigeKravDatoBinding,
    eoOevrigeKravUdgiftTilBinding,
    eoOevrigeKravBeloebBinding,
    eoOffentligeYdelserFraDatoBinding,
    eoOffentligeYdelserTilDatoBinding,
    eoOffentligeYdelserYdelseBinding,
    eoOffentligeYdelserTillaegBinding,
    eoOffentligeYdelserYdelsestypeBinding,
  ],
  collections: [
    eoTafPerioderBinding,
    eoFerieperioderBinding,
    eoSfggSygeperioderFoer2015Binding,
    eoSfggAnsaettelsesforholdBinding,
    eoFravaerPerioderBinding,
    eoSvieSmertePerioderBinding,
    eoOevrigeKravPerioderBinding,
    eoOffentligeYdelserRowsBinding,
  ],
});
