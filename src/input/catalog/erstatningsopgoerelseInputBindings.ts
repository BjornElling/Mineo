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

const EO_OPLYSNINGER = 'eo_oplysninger';
const EO_LOENINDKOMST = 'loenindkomst';
const EO_OFFENTLIGE_YDELSER = 'offentlige_ydelser';

const focus = (tab: string) => ({ route: '/erstatningsopgoerelse', tab } as const);

// ─── Generiske top-level felt-hjælpere ──────────────────────────────────────────

const optionalTextField = (field: string, label: string, tab: string): FieldBinding<string | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<string | undefined>({
      label,
      controlKind: 'text',
      focusTarget: focus(tab),
      codec: createOptionalTextFieldCodec(),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const dateField = (field: string, label: string, tab: string): FieldBinding<ISODateString | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<ISODateString | undefined>({
      label,
      controlKind: 'text',
      focusTarget: focus(tab),
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const amountField = (field: string, label: string, tab: string): FieldBinding<AmountValue | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<AmountValue | undefined>({
      label,
      controlKind: 'text',
      focusTarget: focus(tab),
      codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const integerField = (field: string, label: string, tab: string): FieldBinding<number | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<number | undefined>({
      label,
      controlKind: 'text',
      focusTarget: focus(tab),
      codec: createIntegerFieldCodec({ allowNegative: false }),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const jaNejField = (field: string, label: string, tab: string): FieldBinding<JaNej | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<JaNej | undefined>({
      label,
      controlKind: 'choice',
      focusTarget: focus(tab),
      codec: createChoiceFieldCodec<JaNej>(['Ja', 'Nej']),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const jaNejSkjulField = (field: string, label: string, tab: string): FieldBinding<JaNejSkjul | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<JaNejSkjul | undefined>({
      label,
      controlKind: 'choice',
      focusTarget: focus(tab),
      codec: createChoiceFieldCodec<JaNejSkjul>(['Ja', 'Nej', 'Skjul']),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

// ─── Base-blok ──────────────────────────────────────────────────────────────────

export const eoNummerBinding = optionalTextField('eoNummer', 'EO-nummer', EO_OPLYSNINGER);
export const eoLedsagetekstBinding = optionalTextField('eoLedsagetekst', 'Ledsagetekst', EO_OPLYSNINGER);
export const eoOpgørelseLavetDenBinding = dateField('opgørelseLavetDen', 'Opgørelse lavet den', EO_OPLYSNINGER);
export const eoIndsaetUdkastStempelBinding = jaNejField('indsaetUdkastStempel', 'Indsæt udkast-stempel', EO_OPLYSNINGER);
export const eoVedroererPeriodeFraBinding = dateField('vedroererPeriodeFra', 'Vedrører periode fra', EO_OPLYSNINGER);
export const eoVedroererPeriodeTilBinding = dateField('vedroererPeriodeTil', 'Vedrører periode til', EO_OPLYSNINGER);
export const eoRevideretOpgoerelseBinding = jaNejField('revideretOpgoerelse', 'Revideret opgørelse', EO_OPLYSNINGER);
export const eoMidlertidigtEetFraEetSidenBinding = jaNejField('midlertidigtEetFraEetSiden', 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden', EO_OPLYSNINGER);
export const eoRegulerOffentligeYdelserBinding = jaNejField('regulerOffentligeYdelser', 'Regulér offentlige ydelser', EO_OFFENTLIGE_YDELSER);
export const eoForligAnsvarsgradProcentBinding: FieldBinding<number | undefined> = createStructuralFieldBinding({
  definition: defineField<number | undefined>({
    label: 'Forlig ansvarsgrad (%)',
    controlKind: 'text',
    focusTarget: focus(EO_OPLYSNINGER),
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
    focusTarget: focus(EO_OPLYSNINGER),
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
export const eoForligDatoBinding = dateField('forligDato', 'Forligsdato', EO_OPLYSNINGER);
export const eoKravPaaOevrigeErstatningskravBinding = jaNejSkjulField('kravPaaOevrigeErstatningskrav', 'Krav på øvrige erstatningskrav', EO_OPLYSNINGER);
export const eoOffentligeYdelserKommentarerBinding = optionalTextField('offentligeYdelserKommentarer', 'Kommentarer', EO_OFFENTLIGE_YDELSER);
export const eoLoenudviklingPaaGrundlagAfBinding = optionalTextField('loenudviklingPaaGrundlagAf', 'Lønudvikling på grundlag af', EO_LOENINDKOMST);
export const eoSaerligeKommentarerBinding = optionalTextField('saerligeKommentarer', 'Særlige kommentarer', EO_OPLYSNINGER);

export const eoAfsluttesMedBinding: FieldBinding<AfsluttesMed | undefined> = createStructuralFieldBinding({
  definition: defineField<AfsluttesMed | undefined>({
    label: 'Afsluttes med',
    controlKind: 'choice',
    focusTarget: focus(EO_OPLYSNINGER),
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
      focusTarget: focus(EO_OPLYSNINGER),
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
      focusTarget: focus(EO_OPLYSNINGER),
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

export const eoVarigeMenAfgorelseBinding = jaNejField('varigeMenAfgorelse', 'Varige mén-afgørelse', EO_OPLYSNINGER);
export const eoMenAfgoerelseDatoBinding = dateField('menAfgoerelseDato', 'Mén-afgørelsesdato', EO_OPLYSNINGER);
export const eoVerserendeKlageMenBinding = jaNejField('verserendeKlageMen', 'Verserende klage (mén)', EO_OPLYSNINGER);
export const eoMidlertidigtEETAfgorelseBinding = jaNejField('midlertidigtEETAfgorelse', 'Midlertidigt EET-afgørelse', EO_OPLYSNINGER);
export const eoMidlertidigEETAfgoerelseDatoBinding = dateField('midlertidigEETAfgoerelseDato', 'Midlertidigt EET-afgørelsesdato', EO_OPLYSNINGER);
export const eoMidlertidigEETVirkningsdatoBinding = dateField('midlertidigEETVirkningsdato', 'Midlertidigt EET-virkningsdato', EO_OPLYSNINGER);
export const eoEndeligtEETAfgorelseBinding = jaNejField('endeligtEETAfgorelse', 'Endeligt EET-afgørelse', EO_OPLYSNINGER);
export const eoEndeligEETAfgoerelseDatoBinding = dateField('endeligEETAfgoerelseDato', 'Endeligt EET-afgørelsesdato', EO_OPLYSNINGER);
export const eoEndeligEETVirkningsdatoBinding = dateField('endeligEETVirkningsdato', 'Endeligt EET-virkningsdato', EO_OPLYSNINGER);
export const eoVerserendeKlageEetBinding = jaNejField('verserendeKlageEet', 'Verserende klage (EET)', EO_OPLYSNINGER);
export const eoDifferencekravDatoBinding = dateField('differencekravDato', 'Differencekravsdato', EO_OPLYSNINGER);

// ─── Svie/smerte (skalarer) ─────────────────────────────────────────────────────

export const eoKravPaaSvieSmerteGodtgoerelseBinding = jaNejSkjulField('kravPaaSvieSmerteGodtgoerelse', 'Krav på svie- og smertegodtgørelse', EO_OPLYSNINGER);
export const eoSvieSmerteHelbredsstatusBinding: FieldBinding<Helbredsstatus | undefined> = createStructuralFieldBinding({
  definition: defineField<Helbredsstatus | undefined>({
    label: 'Helbredsstatus',
    controlKind: 'choice',
    focusTarget: focus(EO_OPLYSNINGER),
    codec: createChoiceFieldCodec<Helbredsstatus>(['Sygemeldt', 'Delvist Sygemeldt', 'Raskmeldt']),
  }),
  template: { section: 'erstatningsopgoerelse', path: [], field: 'svieSmerteHelbredsstatus' },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoTidligereSsMaxBinding = jaNejField('tidligereSsMax', 'Tidligere svie/smerte-max nået', EO_OPLYSNINGER);
// Årsfelt (StyledYearField): tocifrede år infereres, og MIN_SVIESMERTE_YEAR..CURRENT_YEAR er
// det afledte bounds-issue. Et heltalscodec ville fortolke "23" som 23 i stedet for 2023.
export const eoSvieSmerteSatserAarBinding: FieldBinding<number | undefined> = createStructuralFieldBinding({
  definition: defineField<number | undefined>({
    label: 'Svie/smerte satsår',
    controlKind: 'text',
    focusTarget: focus(EO_OPLYSNINGER),
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
      focusTarget: focus(EO_OPLYSNINGER),
      codec: createChoiceFieldCodec<SvieSmerteDelvisSygemeldingSats>(['fuld', 'halv']),
    }),
    template: { section: 'erstatningsopgoerelse', path: [], field: 'svieSmerteDelvisSygemeldingSats' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoSvieSmerteTidligereTotalBinding = amountField('svieSmerteTidligereTotal', 'Tidligere udbetalt svie/smerte', EO_OPLYSNINGER);
export const eoSvieSmerteAktuelPeriodeBinding = amountField('svieSmerteAktuelPeriode', 'Svie/smerte aktuel periode', EO_OPLYSNINGER);

// ─── TAF (skalarer) ─────────────────────────────────────────────────────────────

export const eoKravPaaTabtArbejdsfortjenesteBinding = jaNejSkjulField('kravPaaTabtArbejdsfortjeneste', 'Krav på tabt arbejdsfortjeneste', EO_OPLYSNINGER);
export const eoTafArbejdsstatusBinding: FieldBinding<Arbejdsstatus | undefined> = createStructuralFieldBinding({
  definition: defineField<Arbejdsstatus | undefined>({
    label: 'Arbejdsstatus',
    controlKind: 'choice',
    focusTarget: focus(EO_OPLYSNINGER),
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
export const eoOpsagtFraStillingBinding = jaNejField('opsagtFraStilling', 'Opsagt fra stilling', EO_OPLYSNINGER);
export const eoSidsteDagAnsaettelsesforholdBinding = dateField('sidsteDagAnsaettelsesforhold', 'Sidste dag i ansættelsesforhold', EO_OPLYSNINGER);
export const eoTidligereModtagetTafBinding = amountField('tidligereModtagetTaf', 'Tidligere modtaget TAF', EO_OPLYSNINGER);

// ─── Indtægt før skaden (skalarer, fanen lønindkomst) ───────────────────────────

export const eoKomprimerBeregningBinding = jaNejField('komprimerBeregningEfterFoersteOpgoerelse', 'Komprimér beregning efter første opgørelse', EO_LOENINDKOMST);
export const eoBeregnesUdFraBinding: FieldBinding<Beregningsmetode | undefined> = createStructuralFieldBinding({
  definition: defineField<Beregningsmetode | undefined>({
    label: 'Beregnes ud fra',
    controlKind: 'choice',
    focusTarget: focus(EO_LOENINDKOMST),
    codec: createChoiceFieldCodec<Beregningsmetode>(['Beregningsperiode', 'Angivet månedsløn', 'Angivet dagsløn']),
  }),
  template: { section: 'erstatningsopgoerelse', path: [], field: 'beregnesUdFra' },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoTafBeregningsperiodeFraBinding = dateField('tafBeregningsperiodeFra', 'Beregningsperiode fra', EO_LOENINDKOMST);
export const eoTafBeregningsperiodeTilBinding = dateField('tafBeregningsperiodeTil', 'Beregningsperiode til', EO_LOENINDKOMST);
export const eoUspecificeredeFerieFridageBinding = integerField('uspecificeredeFerieFridage', 'Uspecificerede ferie-/fridage', EO_LOENINDKOMST);
export const eoOevrigtFravaerUdenLoenBinding = jaNejField('oevrigtFravaerUdenLoen', 'Øvrigt fravær uden løn', EO_LOENINDKOMST);
export const eoOevrigeFravaersdageBinding = integerField('oevrigeFravaersdage', 'Øvrige fraværsdage', EO_LOENINDKOMST);
export const eoOevrigeFravaersdageBeskrivelseBinding = optionalTextField('oevrigeFravaersdageBeskrivelse', 'Beskrivelse af øvrige fraværsdage', EO_LOENINDKOMST);
export const eoMaanedsloenenUdgoerBinding = amountField('maanedsloenenUdgoer', 'Månedslønnen udgør', EO_LOENINDKOMST);
export const eoDagsloenenUdgoerBinding = amountField('dagsloenenUdgoer', 'Dagslønnen udgør', EO_LOENINDKOMST);
export const eoAngivetMaanedsloenBaseretPaaBinding = optionalTextField('angivetMaanedsloenBaseretPaa', 'Angivet månedsløn baseret på', EO_LOENINDKOMST);
export const eoAngivetMaanedsloenOpreguleresFraDatoBinding = dateField('angivetMaanedsloenOpreguleresFraDato', 'Angivet månedsløn opreguleres fra', EO_LOENINDKOMST);
export const eoAngivetDagsloenBaseretPaaBinding = optionalTextField('angivetDagsloenBaseretPaa', 'Angivet dagsløn baseret på', EO_LOENINDKOMST);
export const eoAngivetDagsloenOpreguleresFraDatoBinding = dateField('angivetDagsloenOpreguleresFraDato', 'Angivet dagsløn opreguleres fra', EO_LOENINDKOMST);

// ─── Bilagsnumre (skalarer) ─────────────────────────────────────────────────────

export const eoVisBilagsnumreBinding = jaNejField('visBilagsnumre', 'Vis bilagsnumre', EO_OPLYSNINGER);
export const eoBilagsnumreMenAfgoerelseBinding = optionalTextField('bilagsnumreMenAfgoerelse', 'Bilagsnr. mén-afgørelse', EO_OPLYSNINGER);
export const eoBilagsnumreEetAfgoerelserBinding = optionalTextField('bilagsnumreEetAfgoerelser', 'Bilagsnr. EET-afgørelser', EO_OPLYSNINGER);
export const eoBilagsnumreSvieSmerteDokumentationBinding = optionalTextField('bilagsnumreSvieSmerteDokumentation', 'Bilagsnr. svie/smerte-dokumentation', EO_OPLYSNINGER);
export const eoBilagsnumreBeregningsgrundlagTafBinding = optionalTextField('bilagsnumreBeregningsgrundlagTaf', 'Bilagsnr. beregningsgrundlag TAF', EO_OPLYSNINGER);
export const eoBilagsnumreLoenISygeperiodenBinding = optionalTextField('bilagsnumreLoenISygeperioden', 'Bilagsnr. løn i sygeperioden', EO_OPLYSNINGER);
export const eoBilagsnumreOffentligeYdelserBinding = optionalTextField('bilagsnumreOffentligeYdelser', 'Bilagsnr. offentlige ydelser', EO_OPLYSNINGER);
export const eoBilagsnumreOevrigeErstatningskravBinding = optionalTextField('bilagsnumreOevrigeErstatningskrav', 'Bilagsnr. øvrige erstatningskrav', EO_OPLYSNINGER);

// ─── Rene top-level samlinger + rækkefelter ─────────────────────────────────────

const rowFieldTemplate = (collection: string, field: string): FieldAddressTemplate => ({
  section: 'erstatningsopgoerelse',
  path: [{ kind: 'entity', collection }],
  field,
});

const rowDateField = (collection: string, field: string, label: string, tab: string): FieldBinding<ISODateString | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<ISODateString | undefined>({
      label,
      controlKind: 'text',
      focusTarget: focus(tab),
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
export const eoTafPeriodeFraBinding = rowDateField('tafPerioder', 'fra', 'Fra o.m.', EO_OPLYSNINGER);
export const eoTafPeriodeTilBinding = rowDateField('tafPerioder', 'til', 'Til o.m.', EO_OPLYSNINGER);
export const eoTafPeriodeLoseFeriedageBinding: FieldBinding<number | undefined> = createStructuralFieldBinding({
  definition: defineField<number | undefined>({
    label: 'Løse feriedage',
    controlKind: 'text',
    focusTarget: focus(EO_OPLYSNINGER),
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
export const eoFerieperiodeFraBinding = rowDateField('ferieperioder', 'fra', 'Fra o.m.', EO_OPLYSNINGER);
export const eoFerieperiodeTilBinding = rowDateField('ferieperioder', 'til', 'Til o.m.', EO_OPLYSNINGER);

// sfggSygeperioderFoer2015 (samme rækkeform som ferieperioder)
export const eoSfggSygeperioderFoer2015Binding: CollectionBinding<FerieperiodeRow> =
  createStructuralCollectionBinding<FerieperiodeRow>({
    template: { section: 'erstatningsopgoerelse', path: [], collection: 'sfggSygeperioderFoer2015' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoSfggSygeperiodeFraBinding = rowDateField('sfggSygeperioderFoer2015', 'fra', 'Fra o.m.', EO_LOENINDKOMST);
export const eoSfggSygeperiodeTilBinding = rowDateField('sfggSygeperioderFoer2015', 'til', 'Til o.m.', EO_LOENINDKOMST);

// fravaerPerioder (samme rækkeform som ferieperioder)
export const eoFravaerPerioderBinding: CollectionBinding<FerieperiodeRow> =
  createStructuralCollectionBinding<FerieperiodeRow>({
    template: { section: 'erstatningsopgoerelse', path: [], collection: 'fravaerPerioder' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoFravaerPeriodeFraBinding = rowDateField('fravaerPerioder', 'fra', 'Fra o.m.', EO_LOENINDKOMST);
export const eoFravaerPeriodeTilBinding = rowDateField('fravaerPerioder', 'til', 'Til o.m.', EO_LOENINDKOMST);

// svieSmertePerioder
export const eoSvieSmertePerioderBinding: CollectionBinding<SvieSmertePeriodeRow> =
  createStructuralCollectionBinding<SvieSmertePeriodeRow>({
    template: { section: 'erstatningsopgoerelse', path: [], collection: 'svieSmertePerioder' },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoSvieSmertePeriodeFraBinding = rowDateField('svieSmertePerioder', 'fra', 'Fra o.m.', EO_OPLYSNINGER);
export const eoSvieSmertePeriodeTilBinding = rowDateField('svieSmertePerioder', 'til', 'Til o.m.', EO_OPLYSNINGER);
export const eoSvieSmertePeriodeTilstandBinding: FieldBinding<Tilstand | undefined> = createStructuralFieldBinding({
  definition: defineField<Tilstand | undefined>({
    label: 'Tilstand',
    controlKind: 'choice',
    focusTarget: focus(EO_OPLYSNINGER),
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
export const eoOevrigeKravDatoBinding = rowDateField('oevrigeKravPerioder', 'dato', 'Dato', EO_OPLYSNINGER);
export const eoOevrigeKravUdgiftTilBinding: FieldBinding<string> = createStructuralFieldBinding({
  definition: defineField<string>({
    label: 'Udgift til',
    controlKind: 'text',
    focusTarget: focus(EO_OPLYSNINGER),
    codec: createTextFieldCodec(),
  }),
  template: rowFieldTemplate('oevrigeKravPerioder', 'udgiftTil'),
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoOevrigeKravBeloebBinding: FieldBinding<AmountValue | undefined> = createStructuralFieldBinding({
  definition: defineField<AmountValue | undefined>({
    label: 'Beløb',
    controlKind: 'text',
    focusTarget: focus(EO_OPLYSNINGER),
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
export const eoOffentligeYdelserFraDatoBinding = rowDateField('offentligeYdelserRows', 'fraDato', 'Fra dato', EO_OFFENTLIGE_YDELSER);
export const eoOffentligeYdelserTilDatoBinding = rowDateField('offentligeYdelserRows', 'tilDato', 'Til dato', EO_OFFENTLIGE_YDELSER);
const offentligYdelseAmount = (field: string, label: string): FieldBinding<AmountValue | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<AmountValue | undefined>({
      label,
      controlKind: 'text',
      focusTarget: focus(EO_OFFENTLIGE_YDELSER),
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
    focusTarget: focus(EO_OFFENTLIGE_YDELSER),
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
    focusTarget: focus(EO_LOENINDKOMST),
    codec: createChoiceFieldCodec<SygeferiegodtgoerelseBeregningskilde>([
      'Overenskomst',
      'Manuelt angivet',
      'Ferieloven',
      'Ingen',
    ]),
  })
);
export const eoSfggReferenceperiodeFraBinding = rowDateField(SFGG, 'sfggReferenceperiodeFra', 'Referenceperiode fra', EO_LOENINDKOMST);
export const eoSfggReferenceperiodeTilBinding = rowDateField(SFGG, 'sfggReferenceperiodeTil', 'Referenceperiode til', EO_LOENINDKOMST);
export const eoSfggReferenceperiodeFravaersdageUdenLoenBinding = sfggRowField<number | undefined>(
  'sfggReferenceperiodeFravaersdageUdenLoen',
  defineField<number | undefined>({
    label: 'Fraværsdage uden løn i referenceperioden',
    controlKind: 'text',
    focusTarget: focus(EO_LOENINDKOMST),
    codec: createIntegerFieldCodec({ allowNegative: false }),
  })
);
export const eoSfggManuelDagssatsBinding = sfggRowField<AmountValue | undefined>(
  'sfggManuelDagssats',
  defineField<AmountValue | undefined>({
    label: 'Manuel dagssats',
    controlKind: 'text',
    focusTarget: focus(EO_LOENINDKOMST),
    codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
  })
);
export const eoSfggManuelBeloebIHenholdTilBinding = sfggRowField<string | undefined>(
  'sfggManuelBeloebIHenholdTil',
  defineField<string | undefined>({
    label: 'Beløb i henhold til',
    controlKind: 'text',
    focusTarget: focus(EO_LOENINDKOMST),
    codec: createOptionalTextFieldCodec(),
  })
);
export const eoSfggManuelFoerstEfterSygeloenBinding = sfggRowField<JaNej | undefined>(
  'sfggManuelFoerstEfterSygeloen',
  defineField<JaNej | undefined>({
    label: 'Først efter sygeløn',
    controlKind: 'choice',
    focusTarget: focus(EO_LOENINDKOMST),
    codec: createChoiceFieldCodec<JaNej>(['Ja', 'Nej']),
  })
);
export const eoSfggSatsvalgBinding = sfggRowField<SygeferiegodtgoerelseSatsvalg | undefined>(
  'sfggSatsvalg',
  defineField<SygeferiegodtgoerelseSatsvalg | undefined>({
    label: 'Satsvalg',
    controlKind: 'choice',
    focusTarget: focus(EO_LOENINDKOMST),
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
    focusTarget: focus(EO_LOENINDKOMST),
    codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
  })
);
