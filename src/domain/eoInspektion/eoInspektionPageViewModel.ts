import type { AppSettings } from '../../settings/appSettingsSchema';
import { isLoenindkomstAnsaettelsesforholdEffectivelyEmpty } from '../eoRowEvaluation/eoRowIndkomstModel';
import type { RegulationInspektionSection } from './eoInspektionRegulationViewModel';
import type { EoRowModel } from '../eoRowEvaluation/eoRowTypes';
import type { EoInspektionViewReady } from '../erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView';
import { buildOffentligeYdelserReguleringTableData } from '../erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning';
import { resolveArbejdsstedDisplayName } from '../erstatningsopgoerelse/helpers/indtaegtPerioder';
import { formatISOToDanish } from '../../utils/dateFormatting';

export type EOInspektionDisplayTable = Readonly<{
  id: string;
  title: string;
  columns: readonly string[];
  rows: readonly Readonly<{
    id: string;
    cells: readonly string[];
  }>[];
}>;

export type EOInspektionEmploymentSectionViewModel = Readonly<{
  id: string;
  title: string;
  ansatPaaSkadestidspunktet: boolean;
  loenRows: readonly EoRowModel[];
  regulationRows: readonly EoRowModel[];
  regulationSection?: RegulationInspektionSection;
  sfggRows: readonly EoRowModel[];
  sfggTables: readonly EOInspektionDisplayTable[];
}>;

export type EOInspektionGroupedSectionViewModel = Readonly<{
  id: string;
  title: string;
  rows: readonly EoRowModel[];
  tables: readonly EOInspektionDisplayTable[];
}>;

export type EOInspektionPageViewModel = Readonly<{
  showSvieSmerteSection: boolean;
  showTabtArbejdsfortjenesteSections: boolean;
  stamdataRows: readonly EoRowModel[];
  erstatningsopgoerelseRows: readonly EoRowModel[];
  forligRows: readonly EoRowModel[];
  aesRows: readonly EoRowModel[];
  svieSmerteRows: readonly EoRowModel[];
  tafRows: readonly EoRowModel[];
  tafBeregningsgrundlagRows: readonly EoRowModel[];
  loenindkomstRows: readonly EoRowModel[];
  offentligeYdelserRows: readonly EoRowModel[];
  offentligeYdelserTables: readonly EOInspektionDisplayTable[];
  orphanSfggSections: readonly EOInspektionGroupedSectionViewModel[];
  orphanRegulationSections: readonly RegulationInspektionSection[];
  employmentSections: readonly EOInspektionEmploymentSectionViewModel[];
  oevrigeKravRows: readonly EoRowModel[];
  saerligeKommentarerRows: readonly EoRowModel[];
  bilagsnumreRows: readonly EoRowModel[];
}>;

// NOTE:
// Disse helpers afleder struktur fra builder-id-konventioner.
// Hvis builders senere får eksplicit metadata for section/employment-tilhørsforhold,
// skal disse regex-baserede helpers erstattes af den strukturerede metadata-kilde.
const getLoenindkomstAnsaettelsesforholdId = (rowId: string): string | null => {
  const match = /^loenindkomst\.([^.]+)\./.exec(rowId);
  return match?.[1] ?? null;
};

const isLoenindkomstRegulationRow = (row: EoRowModel): boolean => row.id.includes('.regulering.');

const buildLoenindkomstSections = (rows: readonly EoRowModel[]) => {
  const grouped = new Map<string, EoRowModel[]>();
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

const getRegulationEmploymentId = (section: RegulationInspektionSection): string | null => {
  const match = /^regulation\.(.+)$/.exec(section.id);
  return match?.[1] ?? null;
};

const getSfggEmploymentId = (rowId: string): string | null => {
  const postTableMatch = /^sfgg\.eftertabel\.[^.]+\.([^.]+)$/.exec(rowId);
  if (postTableMatch) return postTableMatch[1] ?? null;

  const match = /^sfgg\.[^.]+\.([^.]+)(?:\.|$)/.exec(rowId);
  return match?.[1] ?? null;
};

const parseSfggTable = (row: EoRowModel): EOInspektionDisplayTable | null => {
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
  rows: readonly EoRowModel[],
  employmentNamesById: ReadonlyMap<string, string>
): readonly EOInspektionGroupedSectionViewModel[] => {
  const grouped = new Map<string, EoRowModel[]>();
  const groupedTables = new Map<string, EOInspektionDisplayTable[]>();
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

export const buildEOInspektionPageViewModel = (
  view: EoInspektionViewReady,
  appSettings: AppSettings
): EOInspektionPageViewModel => {
  const { erstatningsopgoerelseValues, rowsBySection, regulationSections } = view;
  // 'Nej' og 'Skjul' har begge ingen beregning — kontrollaget viser kun emnet ved 'Ja'.
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
      resolveArbejdsstedDisplayName(af.navnPaaArbejdssted, index),
    ] as const)
  );

  const regulationSectionsByEmploymentId = new Map<string, RegulationInspektionSection>();
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

  const employmentSections: EOInspektionEmploymentSectionViewModel[] = viserTabtArbejdsfortjeneste
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
  const offentligeYdelserBaseRow: readonly EoRowModel[] =
    offentligeYdelserReguleringTableData && offentligeYdelserReguleringsBaseIso
      ? [{
          id: 'offentligeYdelser.regulering.anvendtReguleringsdato',
          label: 'Regulering foretages med afsæt i værdier den',
          displayValue: formatISOToDanish(offentligeYdelserReguleringsBaseIso) ?? offentligeYdelserReguleringsBaseIso,
          status: 'ok',
        }]
      : [];
  const offentligeYdelserTables: readonly EOInspektionDisplayTable[] =
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
