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
  if (message === '') return `${row.label} mangler`;
  if (row.summaryDisplay === 'messageOnly') return message;
  if (message.startsWith('mangler')) return `${row.label} ${message}`;
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
  if (lower.includes('til-dato') || lower.includes('til og med') || lower.includes('efter ')) return 1;
  return 0;
};

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
  const svieSmerteRowId = rowIdSuffix(row.id, 'sviesmerte.periode.');
  if (svieSmerteRowId) {
    const lower = message.toLocaleLowerCase('da-DK');
    if (lower.includes('tilstand')) return tableFieldPath(CELL_TABLE_IDS.eoSvieSmerte, svieSmerteRowId, 3);
    return tableFieldPath(CELL_TABLE_IDS.eoSvieSmerte, svieSmerteRowId, inferDateColumn(message));
  }

  const tafRowId = rowIdSuffix(row.id, 'taf.periode.');
  if (tafRowId) return tableFieldPath(CELL_TABLE_IDS.eoTafPeriode, tafRowId, inferDateColumn(message));

  const tafFerieRowId = rowIdSuffix(row.id, 'taf.ferie.');
  if (tafFerieRowId) return tableFieldPath(CELL_TABLE_IDS.eoFerieperiode, tafFerieRowId, inferDateColumn(message));

  const beregningsFerieRowId = rowIdSuffix(row.id, 'taf.beregningsgrundlag.ferie.');
  if (beregningsFerieRowId) {
    return tableFieldPath(CELL_TABLE_IDS.eoBeregningsperiodeFerie, beregningsFerieRowId, inferDateColumn(message));
  }

  const oevrigeKravRowId = rowIdSuffix(row.id, 'oevrigekrav.');
  if (oevrigeKravRowId) {
    const lower = message.toLocaleLowerCase('da-DK');
    if (lower.includes('beløb')) return tableFieldPath(CELL_TABLE_IDS.eoOevrigeKrav, oevrigeKravRowId, 2);
    if (lower.includes('beskrivelse')) return tableFieldPath(CELL_TABLE_IDS.eoOevrigeKrav, oevrigeKravRowId, 1);
    return tableFieldPath(CELL_TABLE_IDS.eoOevrigeKrav, oevrigeKravRowId, 0);
  }

  return exactFieldTargets[row.id];
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
    summaryText: (_row, message) => {
      if (message.startsWith('Dato skal være mellem ')) {
        return `Svie/smerte-perioden skal være mellem ${message.replace('Dato skal være mellem ', '')}`;
      }
      return undefined;
    },
  },
  {
    key: 'taf-period-row',
    match: { kind: 'prefix', prefix: 'taf.periode.' },
    when: 'En TAF-række er delvist udfyldt, ugyldig, overlapper eller ligger efter en cutoff-dato.',
    suppresses: [
      { kind: 'id', id: 'taf.ophoerSkyldes' },
      { kind: 'prefix', prefix: 'taf.folkepensionsalder.' },
    ],
    summaryText: (_row, message) => {
      if (
        message.startsWith('Der er angivet tabt arbejdsfortjeneste efter ') ||
        message.startsWith('Der er angivet tabt arbejdsfortjeneste, efter differencekrav er opgjort ')
      ) {
        return message;
      }
      if (message.startsWith('Dato skal være mellem ')) {
        return `TAF-perioden skal være mellem ${message.replace('Dato skal være mellem ', '')}`;
      }
      return undefined;
    },
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
        return 'Der mangler indtastninger i perioden til beregning af før-løn.';
      }
      if (message.startsWith('Der er overlap mellem beregningsperioden (')) return message;
      return fallbackIssueText(row, message);
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
        return 'Angivelse af lønudvikling mangler';
      }
      if (message === 'Overenskomst er ikke valgt') {
        return 'Regulering er sat til \'Overenskomst\', men ingen overenskomst er valgt';
      }
      return undefined;
    },
  },
  {
    key: 'sfgg-root',
    match: { kind: 'regex', regex: /^sfgg\.(beregningskilde|overenskomst|satsvalg)\.[^.]+$/ },
    when: 'Sygeferiegodtgørelse kræver et valgt beregningsgrundlag, overenskomst eller satsvalg for ansættelsesforholdet.',
    summaryText: (row, message) => {
      if (row.id.startsWith('sfgg.beregningskilde.') && message === 'Intet valgt') {
        return 'Beregningsgrundlag for sygeferiegodtgørelse er ikke valgt';
      }
      if (row.id.startsWith('sfgg.overenskomst.') && message === 'Ingen overenskomst valgt') {
        return 'Det er angivet, at SFGG fastsættes efter overenskomst, men ingen overenskomst er valgt';
      }
      return undefined;
    },
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
