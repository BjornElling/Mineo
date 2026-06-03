import type { AppSettings } from '../../settings/appSettingsSchema';
import { isLoenindkomstAnsaettelsesforholdEffectivelyEmpty } from './eoDebugIndkomstModel';
import type { RegulationDebugSection } from './eoDebugRegulationViewModel';
import type { DebugRowModel } from './eoDebugTypes';
import type { EoDebugViewReady } from '../erstatningsopgoerelse/snapshot/eoSnapshotToDebugView';
import { buildOffentligeYdelserReguleringTableData } from '../erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning';
import { formatISOToDanish } from '../../utils/dateFormatting';

export type EODebugDisplayTable = Readonly<{
  id: string;
  title: string;
  columns: readonly string[];
  rows: readonly Readonly<{
    id: string;
    cells: readonly string[];
  }>[];
}>;

export type EODebugEmploymentSectionViewModel = Readonly<{
  id: string;
  title: string;
  ansatPaaSkadestidspunktet: boolean;
  loenRows: readonly DebugRowModel[];
  regulationRows: readonly DebugRowModel[];
  regulationSection?: RegulationDebugSection;
  sfggRows: readonly DebugRowModel[];
  sfggTables: readonly EODebugDisplayTable[];
}>;

export type EODebugGroupedSectionViewModel = Readonly<{
  id: string;
  title: string;
  rows: readonly DebugRowModel[];
  tables: readonly EODebugDisplayTable[];
}>;

export type EODebugPageViewModel = Readonly<{
  showSvieSmerteSection: boolean;
  showTabtArbejdsfortjenesteSections: boolean;
  stamdataRows: readonly DebugRowModel[];
  erstatningsopgoerelseRows: readonly DebugRowModel[];
  forligRows: readonly DebugRowModel[];
  aesRows: readonly DebugRowModel[];
  svieSmerteRows: readonly DebugRowModel[];
  tafRows: readonly DebugRowModel[];
  tafBeregningsgrundlagRows: readonly DebugRowModel[];
  loenindkomstRows: readonly DebugRowModel[];
  offentligeYdelserRows: readonly DebugRowModel[];
  offentligeYdelserTables: readonly EODebugDisplayTable[];
  orphanSfggSections: readonly EODebugGroupedSectionViewModel[];
  orphanRegulationSections: readonly RegulationDebugSection[];
  employmentSections: readonly EODebugEmploymentSectionViewModel[];
  oevrigeKravRows: readonly DebugRowModel[];
  saerligeKommentarerRows: readonly DebugRowModel[];
  bilagsnumreRows: readonly DebugRowModel[];
}>;

// NOTE:
// Disse helpers afleder struktur fra builder-id-konventioner.
// Hvis builders senere får eksplicit metadata for section/employment-tilhørsforhold,
// skal disse regex-baserede helpers erstattes af den strukturerede metadata-kilde.
const getLoenindkomstAnsaettelsesforholdId = (rowId: string): string | null => {
  const match = /^loenindkomst\.([^.]+)\./.exec(rowId);
  return match?.[1] ?? null;
};

const isLoenindkomstRegulationRow = (row: DebugRowModel): boolean => row.id.includes('.regulering.');

const buildLoenindkomstSections = (rows: readonly DebugRowModel[]) => {
  const grouped = new Map<string, DebugRowModel[]>();
  const order: string[] = [];

  rows.forEach((row) => {
    const ansaettelsesforholdId = getLoenindkomstAnsaettelsesforholdId(row.id);
    if (!ansaettelsesforholdId) return;
    if (!grouped.has(ansaettelsesforholdId)) {
      grouped.set(ansaettelsesforholdId, []);
      order.push(ansaettelsesforholdId);
    }
    grouped.get(ansaettelsesforholdId)?.push(row);
  });

  return order.map((ansaettelsesforholdId, index) => {
    const sectionRows = grouped.get(ansaettelsesforholdId) ?? [];
    const arbejdsstedNavn = sectionRows.find((row) => row.label === 'Navn på arbejdssted')?.displayValue.trim() ?? '';
    const hasNamedArbejdssted = arbejdsstedNavn !== '' && arbejdsstedNavn !== '-';
    const title = hasNamedArbejdssted
      ? arbejdsstedNavn
      : `Arbejdssted ${index + 1}`;
    const visibleRows = hasNamedArbejdssted
      ? sectionRows.filter((row) => row.label !== 'Navn på arbejdssted')
      : sectionRows;
    const loenRows = visibleRows.filter((row) => !isLoenindkomstRegulationRow(row));
    const regulationRows = visibleRows.filter(isLoenindkomstRegulationRow);

    return {
      id: ansaettelsesforholdId,
      title,
      loenRows,
      regulationRows,
    };
  });
};

const getRegulationEmploymentId = (section: RegulationDebugSection): string | null => {
  const match = /^regulation\.(.+)$/.exec(section.id);
  return match?.[1] ?? null;
};

const getSfggEmploymentId = (rowId: string): string | null => {
  const postTableMatch = /^sfgg\.eftertabel\.[^.]+\.([^.]+)$/.exec(rowId);
  if (postTableMatch) return postTableMatch[1] ?? null;

  const match = /^sfgg\.[^.]+\.([^.]+)(?:\.|$)/.exec(rowId);
  return match?.[1] ?? null;
};

const parseSfggTable = (row: DebugRowModel): EODebugDisplayTable | null => {
  const lines = row.displayValue
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (lines.length < 2) return null;

  const columns = lines[0]?.split('|').map((cell) => cell.trim()).filter((cell) => cell !== '') ?? [];
  if (columns.length === 0) return null;

  const parsedRows = lines.slice(1).map((line, index) => ({
    id: `${row.id}.row.${index + 1}`,
    cells: line.split('|').map((cell) => cell.trim()),
  }));
  const hasMultipleDataRows = parsedRows.filter((tableRow) => tableRow.cells[0] !== 'I alt').length > 1;
  const tableRows = hasMultipleDataRows
    ? parsedRows
    : parsedRows.filter((tableRow) => tableRow.cells[0] !== 'I alt');

  return {
    id: row.id,
    title: row.label,
    columns,
    rows: tableRows,
  };
};

const buildSfggSections = (
  rows: readonly DebugRowModel[],
  employmentNamesById: ReadonlyMap<string, string>
): readonly EODebugGroupedSectionViewModel[] => {
  const grouped = new Map<string, DebugRowModel[]>();
  const groupedTables = new Map<string, EODebugDisplayTable[]>();
  const order: string[] = [];

  rows.forEach((row) => {
    const employmentId = getSfggEmploymentId(row.id);
    if (!employmentId) return;
    if (!grouped.has(employmentId)) {
      grouped.set(employmentId, []);
      groupedTables.set(employmentId, []);
      order.push(employmentId);
    }
    if (row.id.startsWith('sfgg.tabel.') || row.id.startsWith('sfgg.aarsfordeling.')) {
      const parsedTable = parseSfggTable(row);
      if (parsedTable) {
        groupedTables.get(employmentId)?.push(parsedTable);
        return;
      }
    }
    grouped.get(employmentId)?.push(row);
  });

  return order.map((employmentId, index) => ({
    id: employmentId,
    title: employmentNamesById.get(employmentId) ?? `Arbejdssted ${index + 1}`,
    rows: grouped.get(employmentId) ?? [],
    tables: groupedTables.get(employmentId) ?? [],
  }));
};

export const buildEODebugPageViewModel = (
  view: EoDebugViewReady,
  appSettings: AppSettings
): EODebugPageViewModel => {
  const { erstatningsopgoerelseValues, rowsBySection, regulationSections } = view;
  // 'Nej' og 'Skjul' har begge ingen beregning — debug viser kun emnet ved 'Ja'.
  const viserSvieSmerte = erstatningsopgoerelseValues.kravPaaSvieSmerteGodtgoerelse === 'Ja';
  const viserTabtArbejdsfortjeneste = erstatningsopgoerelseValues.kravPaaTabtArbejdsfortjeneste === 'Ja';
  const viserOevrigeKrav = erstatningsopgoerelseValues.kravPaaOevrigeErstatningskrav === 'Ja';
  const skjulerUdvidedeSvieSmerteRows = erstatningsopgoerelseValues.tidligereSsMax === 'Ja';
  const viserMidlertidigtEet = erstatningsopgoerelseValues.midlertidigtEETAfgorelse === 'Ja';
  const viserEndeligtEet = erstatningsopgoerelseValues.endeligtEETAfgorelse === 'Ja';

  const svieSmerteRows = viserSvieSmerte
    ? (rowsBySection.get('sviesmerte') ?? []).filter((row) =>
        !skjulerUdvidedeSvieSmerteRows || row.id === 'sviesmerte.tidligereSsMax'
      )
    : [];

  const aesRows = (rowsBySection.get('aes') ?? []).filter((row) => {
    if (!viserMidlertidigtEet && row.group === 'aes.midlertidigtEet' && row.id !== 'aes.midlertidigtEETAfgorelse') {
      return false;
    }
    if (!viserEndeligtEet && row.group === 'aes.endeligtEet' && row.id !== 'aes.endeligtEETAfgorelse') {
      return false;
    }
    return true;
  });

  const visibleEmploymentIds = new Set(
    (erstatningsopgoerelseValues.loenindkomstAnsaettelsesforhold ?? [])
      .filter((af) => !isLoenindkomstAnsaettelsesforholdEffectivelyEmpty(af, appSettings))
      .map((af) => af.id)
  );

  const loenindkomstRows = viserTabtArbejdsfortjeneste
    ? (rowsBySection.get('loenindkomst') ?? []).filter((row) => {
        const ansaettelsesforholdId = getLoenindkomstAnsaettelsesforholdId(row.id);
        return ansaettelsesforholdId === null || visibleEmploymentIds.has(ansaettelsesforholdId);
      })
    : [];

  const loenindkomstSections = buildLoenindkomstSections(loenindkomstRows);
  const employmentNamesById = new Map(
    (erstatningsopgoerelseValues.loenindkomstAnsaettelsesforhold ?? []).map((af, index) => [
      af.id,
      (af.navnPaaArbejdssted ?? '').trim() || `Arbejdssted ${index + 1}`,
    ] as const)
  );

  const regulationSectionsByEmploymentId = new Map<string, RegulationDebugSection>();
  regulationSections.forEach((section) => {
    const employmentId = getRegulationEmploymentId(section);
    if (!employmentId) return;
    regulationSectionsByEmploymentId.set(employmentId, section);
  });

  const sfggSections = viserTabtArbejdsfortjeneste
    ? buildSfggSections(rowsBySection.get('sygeferiegodtgoerelse') ?? [], employmentNamesById)
    : [];
  const sfggSectionsByEmploymentId = new Map(sfggSections.map((section) => [section.id, section] as const));

  const ansatPaaSkadestidspunktetById = new Map(
    (erstatningsopgoerelseValues.loenindkomstAnsaettelsesforhold ?? []).map((af) => [af.id, af.ansatPaaSkadestidspunktet] as const)
  );

  const employmentSections: EODebugEmploymentSectionViewModel[] = viserTabtArbejdsfortjeneste
    ? loenindkomstSections.map((section) => {
        const sfggSection = sfggSectionsByEmploymentId.get(section.id);
        const ansatPaaSkadestidspunktet = ansatPaaSkadestidspunktetById.get(section.id) ?? true;
        return {
          id: section.id,
          title: section.title,
          ansatPaaSkadestidspunktet,
          loenRows: section.loenRows,
          regulationRows: section.regulationRows,
          regulationSection: regulationSectionsByEmploymentId.get(section.id),
          sfggRows: sfggSection?.rows ?? [],
          sfggTables: sfggSection?.tables ?? [],
        };
      })
    : [];

  const orphanRegulationSections = viserTabtArbejdsfortjeneste
    ? regulationSections.filter((section) => {
        const employmentId = getRegulationEmploymentId(section);
        return !employmentId || !loenindkomstSections.some((loenSection) => loenSection.id === employmentId);
      })
    : [];

  const orphanSfggSections = viserTabtArbejdsfortjeneste
    ? sfggSections.filter((section) =>
        !employmentSections.some((employmentSection) => employmentSection.id === section.id)
      )
    : [];
  const offentligeYdelserReguleringTableData = (() => {
    const offentligeYdelserUdvikling = view.pdfModel?.tabtArbejdsfortjeneste.offentligeYdelserUdvikling;
    if (!offentligeYdelserUdvikling) return null;
    try {
      return buildOffentligeYdelserReguleringTableData(offentligeYdelserUdvikling);
    } catch {
      return null;
    }
  })();
  const offentligeYdelserReguleringsBaseIso =
    view.pdfModel?.tabtArbejdsfortjeneste.offentligeYdelserUdvikling?.reguleringsBaseIso;
  const offentligeYdelserBaseRow: readonly DebugRowModel[] =
    offentligeYdelserReguleringTableData && offentligeYdelserReguleringsBaseIso
      ? [{
          id: 'offentligeYdelser.regulering.anvendtReguleringsdato',
          label: 'Regulering foretages med afsæt i værdier den',
          displayValue: formatISOToDanish(offentligeYdelserReguleringsBaseIso) ?? offentligeYdelserReguleringsBaseIso,
          status: 'ok',
        }]
      : [];
  const offentligeYdelserTables: readonly EODebugDisplayTable[] =
    offentligeYdelserReguleringTableData && offentligeYdelserReguleringTableData.rows.length > 0
      ? [{
          id: 'offentligeYdelser.regulering.vaerdier',
          title: 'Reguleringsværdier:',
          columns: offentligeYdelserReguleringTableData.columns,
          rows: offentligeYdelserReguleringTableData.rows.map((row, index) => ({
            id: `offentligeYdelser.regulering.vaerdier.${index}`,
            cells: row,
          })),
        }]
      : [];

  return {
    showSvieSmerteSection: viserSvieSmerte,
    showTabtArbejdsfortjenesteSections: viserTabtArbejdsfortjeneste,
    stamdataRows: rowsBySection.get('stamdata') ?? [],
    erstatningsopgoerelseRows: rowsBySection.get('erstatningsopgoerelse') ?? [],
    forligRows: rowsBySection.get('forlig') ?? [],
    aesRows,
    svieSmerteRows,
    tafRows: viserTabtArbejdsfortjeneste ? (rowsBySection.get('taf') ?? []) : [],
    tafBeregningsgrundlagRows: viserTabtArbejdsfortjeneste ? (rowsBySection.get('taf-beregningsgrundlag') ?? []) : [],
    loenindkomstRows,
    offentligeYdelserRows: viserTabtArbejdsfortjeneste
      ? [...(rowsBySection.get('offentlige-ydelser') ?? []), ...offentligeYdelserBaseRow]
      : [],
    offentligeYdelserTables: viserTabtArbejdsfortjeneste ? offentligeYdelserTables : [],
    orphanSfggSections,
    orphanRegulationSections,
    employmentSections,
    oevrigeKravRows: viserOevrigeKrav ? (rowsBySection.get('oevrige-krav') ?? []) : [],
    saerligeKommentarerRows: rowsBySection.get('saerlige-kommentarer') ?? [],
    bilagsnumreRows: rowsBySection.get('bilagsnumre') ?? [],
  };
};
