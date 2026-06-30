import { buildCellInvalidDraftFieldPath, CELL_TABLE_IDS } from '../../config/cellInvalidDraftScopes';
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

const fallbackIssueText = (row: Pick<EoRowModel, 'label' | 'summaryDisplay'>, message: string): string => {
  if (message === '') return `${row.label} er ikke angivet`;
  if (row.summaryDisplay === 'messageOnly') return message;
  // Fortsættelses-fraser limes direkte på label uden kolon ("Reguleringsværdi … er ikke angivet").
  if (/^(mangler|er ikke angivet|er ikke valgt|er ikke udfyldt)\b/.test(message)) {
    return `${row.label} ${message}`;
  }
  return `${row.label}: ${message}`;
};

const rowIdSuffix = (rowId: string, prefix: string): string | null =>
  rowId.startsWith(prefix) ? rowId.slice(prefix.length) : null;

const tableFieldPath = (
  tableId: string,
  rowId: string,
  colIndex: number,
  rowScope = ''
): EoIssueFocusTarget => ({
  kind: 'fieldPath',
  fieldPath: buildCellInvalidDraftFieldPath(tableId, rowScope, `${rowId}:${colIndex}`),
});

const inferDateColumn = (message: string): 0 | 1 => {
  const lower = message.toLocaleLowerCase('da-DK');
  if (lower.includes('til-dato') || lower.includes('til og med')) return 1;
  return 0;
};

/**
 * Vælg fra-/til-kolonnen ud fra rækkens strukturelle felt-hint (sat af row-builderen fra
 * valideringsresultatet). Hintet er autoritativt, fordi det ved præcis hvilket input fejlen
 * vedrører — fx en fra-dato efter en cutoff, som en ren ordlyd-baseret gæt ville henføre til
 * til-cellen. Uden hint falder vi tilbage til ordlyd-heuristikken (`inferDateColumn`).
 */
const dateColumnFromHint = (hint: EoRowModel['focusFieldHint'], message: string): 0 | 1 =>
  hint === 'fra' ? 0 : hint === 'til' ? 1 : inferDateColumn(message);

const normalField = (fieldPath: string): EoIssueFocusTarget => ({ kind: 'fieldPath', fieldPath });

const exactFieldTargets: Readonly<Record<string, EoIssueFocusTarget>> = {
  'stamdata.journalnr': normalField('journalnr'),
  'stamdata.advokatSagsbehandler': normalField('advokat'),
  'stamdata.skadelidte': normalField('skadelidte'),
  'stamdata.skadestype': normalField('skadestype'),
  'stamdata.skadedato': normalField('skadedato'),
  'erstatningsopgoerelse.eoNummer': normalField('eoNummer'),
  'erstatningsopgoerelse.revideretOpgoerelse': normalField('revideretOpgoerelse'),
  'erstatningsopgoerelse.vedroererPeriode': normalField('vedroererPeriodeFra'),
  'erstatningsopgoerelse.opgørelseLavetDen': normalField('opgørelseLavetDen'),
  'erstatningsopgoerelse.helbredsstatus': normalField('svieSmerteHelbredsstatus'),
  'erstatningsopgoerelse.arbejdsstatus': normalField('tafArbejdsstatus'),
  'forlig.ansvarsgrad': normalField('forligAnsvarsgradProcent'),
  'forlig.dato': normalField('forligDato'),
  'aes.varigeMenAfgorelse': normalField('varigeMenAfgorelse'),
  'aes.menAfgoerelseDato': normalField('menAfgoerelseDato'),
  'aes.midlertidigtEETAfgorelse': normalField('midlertidigtEETAfgorelse'),
  'aes.midlertidigEETAfgoerelseDato': normalField('midlertidigEETAfgoerelseDato'),
  'aes.midlertidigEETVirkningsdato': normalField('midlertidigEETVirkningsdato'),
  'aes.endeligtEETAfgorelse': normalField('endeligtEETAfgorelse'),
  'aes.endeligEETAfgoerelseDato': normalField('endeligEETAfgoerelseDato'),
  'aes.endeligEETVirkningsdato': normalField('endeligEETVirkningsdato'),
  'aes.verserendeKlageEet': normalField('verserendeKlageEet'),
  'aes.differencekravDato': normalField('differencekravDato'),
  'sviesmerte.tidligereSsMax': normalField('tidligereSsMax'),
  'sviesmerte.satserAar': normalField('svieSmerteSatserAar'),
  'sviesmerte.delvisSygemeldingSats': normalField('svieSmerteDelvisSygemeldingSats'),
  'sviesmerte.tidligereTotal': normalField('svieSmerteTidligereTotal'),
  'sviesmerte.aktuelPeriode': normalField('svieSmerteAktuelPeriode'),
  'taf.beregningsgrundlag.beregnesUdFra': normalField('beregnesUdFra'),
  'taf.beregningsgrundlag.beregningsperiode': normalField('tafBeregningsperiodeFra'),
  'taf.beregningsgrundlag.uspecificeredeFerieFridage': normalField('uspecificeredeFerieFridage'),
  'taf.beregningsgrundlag.oevrigeFravaersdage': normalField('oevrigeFravaersdage'),
  'taf.beregningsgrundlag.maanedsloen': normalField('maanedsloenenUdgoer'),
  'taf.beregningsgrundlag.dagsloen': normalField('dagsloenenUdgoer'),
  'taf.beregningsgrundlag.angivetLoenOpreguleresFraDato': normalField('angivetMaanedsloenOpreguleresFraDato'),
  'taf.tidligereModtagetTaf': normalField('tidligereModtagetTaf'),
};

const focusByRowPattern = (row: EoRowModel, message: string): EoIssueFocusTarget | undefined => {
  const hint = row.focusFieldHint;

  const svieSmerteRowId = rowIdSuffix(row.id, 'sviesmerte.periode.');
  if (svieSmerteRowId) {
    if (hint === 'tilstand') return tableFieldPath(CELL_TABLE_IDS.eoSvieSmerte, svieSmerteRowId, 3);
    if (hint === 'fra') return tableFieldPath(CELL_TABLE_IDS.eoSvieSmerte, svieSmerteRowId, 0);
    if (hint === 'til') return tableFieldPath(CELL_TABLE_IDS.eoSvieSmerte, svieSmerteRowId, 1);
    const lower = message.toLocaleLowerCase('da-DK');
    if (lower.includes('tilstand')) return tableFieldPath(CELL_TABLE_IDS.eoSvieSmerte, svieSmerteRowId, 3);
    return tableFieldPath(CELL_TABLE_IDS.eoSvieSmerte, svieSmerteRowId, inferDateColumn(message));
  }

  const tafRowId = rowIdSuffix(row.id, 'taf.periode.');
  if (tafRowId) return tableFieldPath(CELL_TABLE_IDS.eoTafPeriode, tafRowId, dateColumnFromHint(hint, message));

  const tafFerieRowId = rowIdSuffix(row.id, 'taf.ferie.');
  if (tafFerieRowId) return tableFieldPath(CELL_TABLE_IDS.eoFerieperiode, tafFerieRowId, dateColumnFromHint(hint, message));

  const beregningsFerieRowId = rowIdSuffix(row.id, 'taf.beregningsgrundlag.ferie.');
  if (beregningsFerieRowId) {
    return tableFieldPath(CELL_TABLE_IDS.eoBeregningsperiodeFerie, beregningsFerieRowId, dateColumnFromHint(hint, message));
  }

  const oevrigeKravRowId = rowIdSuffix(row.id, 'oevrigekrav.');
  if (oevrigeKravRowId) {
    const lower = message.toLocaleLowerCase('da-DK');
    // Beskrivelse tjekkes før beløb, så "Beskrivelse og beløb mangler" peger på beskrivelsescellen.
    if (lower.includes('beskrivelse')) return tableFieldPath(CELL_TABLE_IDS.eoOevrigeKrav, oevrigeKravRowId, 1);
    if (lower.includes('beløb')) return tableFieldPath(CELL_TABLE_IDS.eoOevrigeKrav, oevrigeKravRowId, 2);
    return tableFieldPath(CELL_TABLE_IDS.eoOevrigeKrav, oevrigeKravRowId, 0);
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
