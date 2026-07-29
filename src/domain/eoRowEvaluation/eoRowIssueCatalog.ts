import {
  eoAngivetMaanedsloenOpreguleresFraDatoField,
  eoBeregnesUdFraField,
  eoDagsloenenUdgoerField,
  eoDifferencekravDatoField,
  eoEndeligEETAfgoerelseDatoField,
  eoEndeligEETVirkningsdatoField,
  eoEndeligtEETAfgorelseField,
  eoFerieperiodeFraField,
  eoFerieperiodeTilField,
  eoForligAnsvarsgradProcentField,
  eoForligDatoField,
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoMaanedsloenenUdgoerField,
  eoMenAfgoerelseDatoField,
  eoMidlertidigEETAfgoerelseDatoField,
  eoMidlertidigEETVirkningsdatoField,
  eoMidlertidigtEETAfgorelseField,
  eoNummerField,
  eoOevrigeFravaersdageField,
  eoOevrigeKravBeloebField,
  eoOevrigeKravDatoField,
  eoOevrigeKravUdgiftTilField,
  eoOpgørelseLavetDenField,
  eoRevideretOpgoerelseField,
  eoSvieSmerteAktuelPeriodeField,
  eoSvieSmerteDelvisSygemeldingSatsField,
  eoSvieSmerteHelbredsstatusField,
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
  eoSvieSmertePeriodeTilstandField,
  eoSvieSmerteSatserAarField,
  eoSvieSmerteTidligereTotalField,
  eoTafArbejdsstatusField,
  eoTafBeregningsperiodeFraField,
  eoTafPeriodeFraField,
  eoTafPeriodeTilField,
  eoTidligereModtagetTafField,
  eoTidligereSsMaxField,
  eoUspecificeredeFerieFridageField,
  eoVarigeMenAfgorelseField,
  eoVedroererPeriodeFraField,
  eoVerserendeKlageEetField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  stamdataAdvokatField,
  stamdataJournalnrField,
  stamdataSkadedatoField,
  stamdataSkadelidteField,
  stamdataSkadestypeField,
} from '../../inputCore/catalog/stamdataDescriptors';
import type { AnyFieldRef, FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { DependencySpec, EoIssueFocusTarget, EoRowModel } from './eoRowTypes';

type RowMatch =
  | Readonly<{ kind: 'id'; id: string }>
  | Readonly<{ kind: 'prefix'; prefix: string }>
  | Readonly<{ kind: 'regex'; regex: RegExp }>;

type EoIssueCatalogEntry = Readonly<{
  key: string;
  match: RowMatch;
  /**
   * Kort domænebeskrivelse af situationen der gør rækken relevant som fejl/advarsel i
   * Beregning-fanen. Kataloget er dermed både routing- og vedligeholdelsessted for tekster.
   */
  when: string;
  /**
   * Rækker der er afledt af denne root cause og derfor skjules, hvis denne række selv har
   * samme eller højere severity. Reglen materialiseres i aggregatorens dependency-graf.
   */
  suppresses?: ReadonlyArray<DependencySpec>;
  summaryText?: (row: EoRowModel, message: string) => string | undefined;
  focusTarget?: (row: EoRowModel, message: string) => EoIssueFocusTarget | undefined;
}>;

const rowMatches = (rowId: string, match: RowMatch): boolean => {
  switch (match.kind) {
    case 'id':
      return rowId === match.id;
    case 'prefix':
      return rowId.startsWith(match.prefix);
    case 'regex':
      return match.regex.test(rowId);
    default: {
      const _exhaustive: never = match;
      return _exhaustive;
    }
  }
};

const extractStatusMessage = (row: Pick<EoRowModel, 'status' | 'displayValue' | 'message'>): string => {
  const explicit = row.message?.trim();
  if (explicit) return explicit;

  const trimmed = row.displayValue.trim();
  if (trimmed === '' || trimmed === '-') return '';
  if (row.status === 'ok') return '';

  const prefix = row.status === 'error' ? 'Fejl' : 'Advarsel';
  const match = trimmed.match(new RegExp(`^${prefix} \\((.*)\\)$`, 's'));
  if (match && typeof match[1] === 'string') return match[1].trim();
  return trimmed;
};

/**
 * Når en generisk frase (linje herunder) limes efter et label, sætter vi apostroffer om labelen,
 * hvis den består af to eller flere ord (indeholder mindst ét mellemrum). Uden det kan et
 * flerords-label læse sammen med frasen til én uklar sætning ("Vedrører perioden er ikke angivet"
 * → "'Vedrører perioden' er ikke angivet"). Enkeltords-labels ("Skadestype") lades urørt.
 * Reglen gælder kun her — forhåndsskrevne katalog-`summaryText`-sætninger rammes aldrig.
 */
const quoteLabelIfMultiWord = (label: string): string =>
  label.includes(' ') ? `'${label}'` : label;

const fallbackIssueText = (row: Pick<EoRowModel, 'label' | 'summaryDisplay'>, message: string): string => {
  if (message === '') return `${quoteLabelIfMultiWord(row.label)} er ikke angivet`;
  if (row.summaryDisplay === 'messageOnly') return message;
  // Fortsættelses-fraser limes direkte på label uden kolon ("Reguleringsværdi … er ikke angivet").
  if (/^(mangler|er ikke angivet|er ikke valgt|er ikke udfyldt)\b/.test(message)) {
    return `${quoteLabelIfMultiWord(row.label)} ${message}`;
  }
  return `${row.label}: ${message}`;
};

const rowIdSuffix = (rowId: string, prefix: string): string | null =>
  rowId.startsWith(prefix) ? rowId.slice(prefix.length) : null;

const target = (field: AnyFieldRef): EoIssueFocusTarget => ({ kind: 'fieldAddress', address: field.address });

const inferDateField = <T>(
  message: string,
  fraField: FieldDescriptor<T>,
  tilField: FieldDescriptor<T>
): FieldDescriptor<T> => {
  const lower = message.toLocaleLowerCase('da-DK');
  return lower.includes('til-dato') || lower.includes('til og med') ? tilField : fraField;
};

/**
 * Vælg fra-/til-feltet ud fra rækkens strukturelle felt-hint (sat af row-builderen fra
 * valideringsresultatet). Hintet er autoritativt, fordi det ved præcis hvilket input fejlen
 * vedrører — fx en fra-dato efter en cutoff, som et rent ordlyd-baseret gæt ville henføre til
 * til-feltet. Uden hint falder vi tilbage til ordlyd-heuristikken.
 */
const dateFieldFromHint = <T>(
  hint: EoRowModel['focusFieldHint'],
  message: string,
  fraField: FieldDescriptor<T>,
  tilField: FieldDescriptor<T>
): FieldDescriptor<T> =>
  hint === 'fra' ? fraField : hint === 'til' ? tilField : inferDateField(message, fraField, tilField);

/**
 * Rækkefelter: hver EO-rækkes fokusmål bindes af PRODUKTIONENS egen descriptor på rækkens id, så
 * målet er den samme adresse cellen redigeres på (`bindCollectionCell`) og undo/redo genfinder
 * (`findRestoreTarget`). Der findes derfor ingen kolonneindeks, intet tabel-id og ingen
 * DOM-strengkonvention i fokusmålet.
 */
const exactFieldTargets: Readonly<Record<string, EoIssueFocusTarget>> = {
  'stamdata.journalnr': target(stamdataJournalnrField.bind()),
  'stamdata.advokatSagsbehandler': target(stamdataAdvokatField.bind()),
  'stamdata.skadelidte': target(stamdataSkadelidteField.bind()),
  'stamdata.skadestype': target(stamdataSkadestypeField.bind()),
  'stamdata.skadedato': target(stamdataSkadedatoField.bind()),
  'erstatningsopgoerelse.eoNummer': target(eoNummerField.bind()),
  'erstatningsopgoerelse.revideretOpgoerelse': target(eoRevideretOpgoerelseField.bind()),
  'erstatningsopgoerelse.vedroererPeriode': target(eoVedroererPeriodeFraField.bind()),
  'erstatningsopgoerelse.opgørelseLavetDen': target(eoOpgørelseLavetDenField.bind()),
  'erstatningsopgoerelse.helbredsstatus': target(eoSvieSmerteHelbredsstatusField.bind()),
  'erstatningsopgoerelse.arbejdsstatus': target(eoTafArbejdsstatusField.bind()),
  'forlig.ansvarsgrad': target(eoForligAnsvarsgradProcentField.bind()),
  'forlig.dato': target(eoForligDatoField.bind()),
  'aes.varigeMenAfgorelse': target(eoVarigeMenAfgorelseField.bind()),
  'aes.menAfgoerelseDato': target(eoMenAfgoerelseDatoField.bind()),
  'aes.midlertidigtEETAfgorelse': target(eoMidlertidigtEETAfgorelseField.bind()),
  'aes.midlertidigEETAfgoerelseDato': target(eoMidlertidigEETAfgoerelseDatoField.bind()),
  'aes.midlertidigEETVirkningsdato': target(eoMidlertidigEETVirkningsdatoField.bind()),
  'aes.endeligtEETAfgorelse': target(eoEndeligtEETAfgorelseField.bind()),
  'aes.endeligEETAfgoerelseDato': target(eoEndeligEETAfgoerelseDatoField.bind()),
  'aes.endeligEETVirkningsdato': target(eoEndeligEETVirkningsdatoField.bind()),
  'aes.verserendeKlageEet': target(eoVerserendeKlageEetField.bind()),
  'aes.differencekravDato': target(eoDifferencekravDatoField.bind()),
  'sviesmerte.tidligereSsMax': target(eoTidligereSsMaxField.bind()),
  'sviesmerte.satserAar': target(eoSvieSmerteSatserAarField.bind()),
  'sviesmerte.delvisSygemeldingSats': target(eoSvieSmerteDelvisSygemeldingSatsField.bind()),
  'sviesmerte.tidligereTotal': target(eoSvieSmerteTidligereTotalField.bind()),
  'sviesmerte.aktuelPeriode': target(eoSvieSmerteAktuelPeriodeField.bind()),
  'taf.beregningsgrundlag.beregnesUdFra': target(eoBeregnesUdFraField.bind()),
  'taf.beregningsgrundlag.beregningsperiode': target(eoTafBeregningsperiodeFraField.bind()),
  'taf.beregningsgrundlag.uspecificeredeFerieFridage': target(eoUspecificeredeFerieFridageField.bind()),
  'taf.beregningsgrundlag.oevrigeFravaersdage': target(eoOevrigeFravaersdageField.bind()),
  'taf.beregningsgrundlag.maanedsloen': target(eoMaanedsloenenUdgoerField.bind()),
  'taf.beregningsgrundlag.dagsloen': target(eoDagsloenenUdgoerField.bind()),
  'taf.beregningsgrundlag.angivetLoenOpreguleresFraDato': target(eoAngivetMaanedsloenOpreguleresFraDatoField.bind()),
  'taf.tidligereModtagetTaf': target(eoTidligereModtagetTafField.bind()),
};

const focusByRowPattern = (row: EoRowModel, message: string): EoIssueFocusTarget | undefined => {
  const hint = row.focusFieldHint;

  const svieSmerteRowId = rowIdSuffix(row.id, 'sviesmerte.periode.');
  if (svieSmerteRowId) {
    const lower = message.toLocaleLowerCase('da-DK');
    if (hint === 'tilstand' || (hint === undefined && lower.includes('tilstand'))) {
      return target(eoSvieSmertePeriodeTilstandField.bind(svieSmerteRowId));
    }
    return target(dateFieldFromHint(
      hint,
      message,
      eoSvieSmertePeriodeFraField,
      eoSvieSmertePeriodeTilField
    ).bind(svieSmerteRowId));
  }

  const tafRowId = rowIdSuffix(row.id, 'taf.periode.');
  if (tafRowId) {
    return target(dateFieldFromHint(hint, message, eoTafPeriodeFraField, eoTafPeriodeTilField).bind(tafRowId));
  }

  const tafFerieRowId = rowIdSuffix(row.id, 'taf.ferie.');
  if (tafFerieRowId) {
    return target(dateFieldFromHint(hint, message, eoFerieperiodeFraField, eoFerieperiodeTilField).bind(tafFerieRowId));
  }

  // Beregningsgrundlagets ferierækker redigeres i `fravaerPerioder` (samme rækkeform, egen collection).
  const beregningsFerieRowId = rowIdSuffix(row.id, 'taf.beregningsgrundlag.ferie.');
  if (beregningsFerieRowId) {
    return target(dateFieldFromHint(
      hint,
      message,
      eoFravaerPeriodeFraField,
      eoFravaerPeriodeTilField
    ).bind(beregningsFerieRowId));
  }

  const oevrigeKravRowId = rowIdSuffix(row.id, 'oevrigekrav.');
  if (oevrigeKravRowId) {
    const lower = message.toLocaleLowerCase('da-DK');
    // Beskrivelse tjekkes før beløb, så "Beskrivelse og beløb mangler" peger på beskrivelsesfeltet.
    if (lower.includes('beskrivelse')) return target(eoOevrigeKravUdgiftTilField.bind(oevrigeKravRowId));
    if (lower.includes('beløb')) return target(eoOevrigeKravBeloebField.bind(oevrigeKravRowId));
    return target(eoOevrigeKravDatoField.bind(oevrigeKravRowId));
  }

  return exactFieldTargets[row.id];
};

/**
 * Selvstændig fejltekst for en periode-/tabelrække. Validatorerne leverer allerede
 * selvstændige, felt-specifikke beskeder ("Til-dato mangler", "Til-dato skal være efter fra-dato",
 * "Der er overlappende perioder", TAF-cutoff-tekster m.fl.), så de vises uændret. Den eneste
 * besked der ikke er selvforklarende er det generiske datointerval ("Dato skal være mellem …"),
 * der derfor får perioden navngivet, så brugeren ved hvilken tabel fejlen hører til.
 */
const periodSummaryText = (entity: string, message: string): string => {
  if (message.startsWith('Dato skal være mellem ')) {
    return `${entity} skal være mellem ${message.replace('Dato skal være mellem ', '')}`;
  }
  return message;
};

const CATALOG: readonly EoIssueCatalogEntry[] = [
  {
    key: 'eo-period',
    match: { kind: 'id', id: 'erstatningsopgoerelse.vedroererPeriode' },
    when: 'EO-perioden mangler eller er ugyldig; afledte TAF- og svie/smerte-perioder kan derfor ikke beregnes sikkert.',
    suppresses: [
      { kind: 'id', id: 'sviesmerte.beregnetPeriode' },
      { kind: 'id', id: 'sviesmerte.antalDage' },
      { kind: 'prefix', prefix: 'taf.periode.' },
    ],
  },
  {
    key: 'svie-smerte-ingen-i-eo-perioden',
    match: { kind: 'id', id: 'sviesmerte.ingenSvieSmerteIEoPerioden' },
    when: 'Der er angivet krav på svie/smerte, men ingen svie/smerte-perioder er registreret; sekundær advarsel om ufuldstændig dækning vises ikke.',
    suppresses: [
      { kind: 'id', id: 'sviesmerte.ophoerSkyldes' },
    ],
    summaryText: (_row, message) => message || 'Der er ikke angivet nogen svie/smerte-periode i EO-perioden',
  },
  {
    key: 'svie-smerte-tidligere-total',
    match: { kind: 'id', id: 'sviesmerte.tidligereTotal' },
    when: 'Det er ikke første erstatningsopgørelse, men der er ikke angivet et positivt svie-/smertebeløb fra tidligere opgørelser.',
    summaryText: (_row, message) =>
      message || 'Der er ikke angivet et svie-/smertebeløb for tidligere erstatningsopgørelser',
  },
  {
    key: 'svie-smerte-period-row',
    match: { kind: 'prefix', prefix: 'sviesmerte.periode.' },
    when: 'En svie/smerte-række er delvist udfyldt, ugyldig eller overlapper en anden række.',
    suppresses: [
      { kind: 'id', id: 'sviesmerte.beregnetPeriode' },
      { kind: 'id', id: 'sviesmerte.antalDage' },
      { kind: 'id', id: 'sviesmerte.beregnetBeloeb' },
    ],
    summaryText: (_row, message) => periodSummaryText('Svie/smerte-perioden', message),
  },
  {
    key: 'taf-ingen-i-eo-perioden',
    match: { kind: 'id', id: 'taf.ingenTafIEoPerioden' },
    when: 'Der er angivet krav på TAF, men ingen TAF-perioder er registreret; sekundær advarsel om ufuldstændig dækning vises ikke.',
    suppresses: [
      { kind: 'id', id: 'taf.ophoerSkyldes' },
    ],
    summaryText: (_row, message) => message || 'Der er ikke angivet nogen TAF-periode i EO-perioden',
  },
  {
    key: 'taf-period-row',
    match: { kind: 'prefix', prefix: 'taf.periode.' },
    when: 'En TAF-række er delvist udfyldt, ugyldig, overlapper eller ligger efter en cutoff-dato.',
    suppresses: [
      { kind: 'id', id: 'taf.ophoerSkyldes' },
      { kind: 'prefix', prefix: 'taf.folkepensionsalder.' },
    ],
    summaryText: (_row, message) => periodSummaryText('TAF-perioden', message),
  },
  {
    key: 'taf-beregningsperiode',
    match: { kind: 'id', id: 'taf.beregningsgrundlag.beregningsperiode' },
    when: 'TAF beregnes ud fra en beregningsperiode, men perioden mangler, er ugyldig eller overlapper TAF-perioden.',
    suppresses: [
      { kind: 'id', id: 'taf.beregningsgrundlag.indkomst' },
      { kind: 'id', id: 'taf.beregningsgrundlag.arbejdsdage' },
      { kind: 'id', id: 'taf.beregningsgrundlag.maaneder' },
      { kind: 'prefix', prefix: 'taf.beregningsgrundlag.ferie.' },
    ],
    summaryText: (row, message) => {
      if (message === 'Ikke alle felter udfyldt') {
        return 'Der mangler indtastninger i perioden til beregning af før-løn';
      }
      // Øvrige beskeder (overlap, rækkefølge, ugyldig dato) er allerede selvstændige sætninger.
      return message || fallbackIssueText(row, message);
    },
  },
  {
    key: 'forlig-ansvarsgrad',
    match: { kind: 'id', id: 'forlig.ansvarsgrad' },
    when: 'Forligsgraden er enten dobbelt udfyldt eller ugyldig.',
    suppresses: [
      { kind: 'id', id: 'forlig.beregnetAnsvarsgrad' },
      { kind: 'id', id: 'sviesmerte.satserPerDagMax' },
    ],
  },
  {
    key: 'forlig-dato',
    match: { kind: 'id', id: 'forlig.dato' },
    when: 'Der er angivet forligsdato uden en gyldig forligsgrad.',
    summaryText: (_row, message) =>
      message === 'Dato for forlig kræver, at ansvarsgrad angives som procent eller brøk'
        ? 'Der er indtastet forligsdato, men ikke forligsprocent eller -brøk'
        : undefined,
  },
  {
    key: 'loenindkomst-regulering',
    match: { kind: 'regex', regex: /^(loenindkomst\.[^.]+\.regulering|taf\.beregningsgrundlag\.loenudvikling\.[^.]+)\.(valgt|valgtRegulering)$/ },
    when: 'Reguleringsmetoden for lønudvikling mangler eller peger på et ikke-valgt grundlag.',
    summaryText: (_row, message) => {
      if (message === 'Lønudvikling beregnes ud fra mangler' || message === 'Lønudvikling beregnes ud fra er ikke valgt') {
        return 'Lønudvikling er ikke angivet';
      }
      if (message === 'Overenskomst er ikke valgt') {
        return 'Regulering er sat til \'Overenskomst\', men ingen overenskomst er valgt';
      }
      if (message === 'Statistisk beregningsmodel er ikke valgt') {
        return 'Regulering er sat til \'Statistik\', men ingen statistisk beregningsmodel er valgt';
      }
      if (message === 'KRL satstabel er ikke valgt') {
        return 'Regulering er sat til \'KRL\', men ingen KRL-satstabel er valgt';
      }
      return undefined;
    },
  },
  {
    key: 'loenindkomst-offentlig-loen',
    match: { kind: 'regex', regex: /^(loenindkomst\.[^.]+\.regulering|taf\.beregningsgrundlag\.loenudvikling\.[^.]+)\.offentligLoenoplysninger$/ },
    when: 'KL-/RLTN-lønoplysninger (ansættelse, løntrin eller gruppe) mangler eller er uden for gyldigt interval.',
    // Builderens beskeder ("Ansættelse er ikke valgt", "Løntrin mangler", "Gruppe skal være mellem 0 og 4"
    // m.fl.) er allerede selvstændige og specifikke; de vises uændret uden label-præfiks.
    summaryText: (_row, message) => message || undefined,
  },
  {
    key: 'sfgg-root',
    match: { kind: 'regex', regex: /^sfgg\.(beregningskilde|overenskomst|satsvalg)\.[^.]+$/ },
    when: 'Sygeferiegodtgørelse kræver et valgt beregningsgrundlag, overenskomst eller satsvalg for ansættelsesforholdet.',
    summaryText: (row, message) => {
      if (row.id.startsWith('sfgg.beregningskilde.')) {
        if (message === 'Intet valgt') return 'Beregningsgrundlag for sygeferiegodtgørelse er ikke valgt';
        if (message === 'Ukendt overenskomst-ID') return 'Den valgte overenskomst for sygeferiegodtgørelse er ukendt';
      }
      if (row.id.startsWith('sfgg.overenskomst.') && message === 'Ingen overenskomst valgt') {
        return 'Det er angivet, at SFGG fastsættes efter overenskomst, men ingen overenskomst er valgt';
      }
      if (row.id.startsWith('sfgg.satsvalg.') && message === 'Intet valgt') {
        return 'Uddannelse og arbejdssted for sygeferiegodtgørelse er ikke valgt';
      }
      return undefined;
    },
  },
  {
    key: 'taf-ferieperiode-row',
    match: { kind: 'prefix', prefix: 'taf.ferie.' },
    when: 'En ferieperiode i TAF-tabellen er delvist udfyldt, ugyldig eller overlapper.',
    summaryText: (_row, message) => periodSummaryText('Ferieperioden', message),
  },
  {
    key: 'taf-beregningsgrundlag-ferieperiode-row',
    match: { kind: 'prefix', prefix: 'taf.beregningsgrundlag.ferie.' },
    when: 'En ferieperiode i beregningsgrundlaget er delvist udfyldt, ugyldig, overlapper eller ligger uden for beregningsperioden.',
    summaryText: (_row, message) => periodSummaryText('Ferieperioden', message),
  },
  {
    key: 'oevrige-krav-row',
    match: { kind: 'prefix', prefix: 'oevrigekrav.' },
    when: 'Et øvrigt erstatningskrav mangler beskrivelse, beløb eller dato.',
    // Builderen leverer en selvstændig besked ("Beskrivelse og beløb mangler", "Beløb mangler",
    // "Dato mangler"); den vises uændret. Det højrestillede link angiver placeringen.
    summaryText: (_row, message) => message || undefined,
  },
  {
    key: 'aes-men-afgoerelsesdato',
    match: { kind: 'id', id: 'aes.menAfgoerelseDato' },
    when: 'Varige mén er sat til Ja, men ménafgørelsens dato mangler.',
    summaryText: (_row, message) =>
      message === 'Afgørelsesdato mangler' ? 'Dato for ménafgørelse er ikke angivet' : undefined,
  },
  {
    key: 'aes-midlertidig-eet-dato',
    match: { kind: 'id', id: 'aes.midlertidigEETAfgoerelseDato' },
    when: 'Midlertidigt EET er sat til Ja, men hverken afgørelses- eller virkningsdato er angivet.',
    summaryText: (_row, message) =>
      message === 'Afgørelsesdato eller virkningsdato mangler'
        ? 'Afgørelses- eller virkningsdato for midlertidig EET-afgørelse er ikke angivet'
        : undefined,
  },
  {
    key: 'aes-endelig-eet-dato',
    match: { kind: 'id', id: 'aes.endeligEETAfgoerelseDato' },
    when: 'Endeligt EET er sat til Ja, men hverken afgørelses- eller virkningsdato er angivet.',
    summaryText: (_row, message) =>
      message === 'Afgørelsesdato eller virkningsdato mangler'
        ? 'Afgørelses- eller virkningsdato for endelig EET-afgørelse er ikke angivet'
        : undefined,
  },
];

const getCatalogEntry = (row: EoRowModel): EoIssueCatalogEntry | undefined =>
  CATALOG.find((entry) => rowMatches(row.id, entry.match));

export const resolveCatalogSuppressionParents = (
  row: EoRowModel,
  possibleParents: ReadonlyArray<EoRowModel>
): ReadonlyArray<DependencySpec> => {
  const parents: DependencySpec[] = [];
  possibleParents.forEach((parent) => {
    if (parent.id === row.id) return;
    const entry = getCatalogEntry(parent);
    if (!entry?.suppresses) return;
    if (entry.suppresses.some((spec) =>
      spec.kind === 'id' ? row.id === spec.id : row.id.startsWith(spec.prefix)
    )) {
      parents.push({ kind: 'id', id: parent.id });
    }
  });
  return parents;
};

export const resolveEoIssueMessage = (row: EoRowModel): string | undefined => {
  const message = extractStatusMessage(row);
  if (row.status === 'ok') return undefined;
  return message === '' ? undefined : message;
};

export const resolveEoIssueSummaryText = (row: EoRowModel): string | undefined => {
  if (row.status === 'ok') return undefined;
  const message = extractStatusMessage(row);
  const entry = getCatalogEntry(row);
  return entry?.summaryText?.(row, message) ?? fallbackIssueText(row, message);
};

export const resolveEoIssueFocusTarget = (row: EoRowModel): EoIssueFocusTarget | undefined => {
  if (row.status === 'ok') return undefined;
  const message = extractStatusMessage(row);
  const entry = getCatalogEntry(row);
  return entry?.focusTarget?.(row, message) ?? focusByRowPattern(row, message);
};
