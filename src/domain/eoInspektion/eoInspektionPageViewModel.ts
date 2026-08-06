import type { AppSettings } from '../../settings/appSettingsSchema';
import { isLoenindkomstAnsaettelsesforholdEffectivelyEmpty } from '../eoRowEvaluation/eoRowIndkomstModel';
import type { RegulationInspektionSection } from './eoInspektionRegulationViewModel';
import type { EoRowModel } from '../eoRowEvaluation/eoRowTypes';
import type { EoInspektionViewReady } from '../erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView';
import { buildOffentligeYdelserReguleringTableData } from '../erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning';
import { resolveArbejdsstedDisplayName } from '../erstatningsopgoerelse/helpers/indtaegtPerioder';
import { resolveSkadeEllerAnmeldelsesdatoReference } from '../erstatningsopgoerelse/helpers/eoDateReferenceText';
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
  ansatPaaSkadestidspunktetLabel: string;
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

// Tilhørsforholdet læses nu fra rækkens EGET `employmentId`-felt (sat af builderen), ikke ved
// at regex-parse id-navnekonventionen. Reguleringsrækker genkendes fortsat på id-segmentet
// `.regulering.`, fordi det er en rækkeKATEGORI og ikke et tilhørsforhold — se noten nedenfor.
const isLoenindkomstRegulationRow = (row: EoRowModel): boolean => row.id.includes('.regulering.');

const buildLoenindkomstSections = (rows: readonly EoRowModel[]) => {
  const grouped = new Map<string, EoRowModel[]>();
  const order: string[] = [];

  rows.forEach((row) => {
    const ansaettelsesforholdId = row.employmentId ?? null;
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

/**
 * Reguleringssektionens ansættelsesforhold-id.
 *
 * Denne er bevaret som id-parsing, fordi kilden er en `RegulationInspektionSection` (en
 * SEKTION med et konstrueret `regulation.<id>`-navn) og ikke en `EoRowModel`. Sektionen har
 * ikke et rækkefelt at bære id'et i, og præfikset er ét fast led — modsat de tidligere
 * række-regexes, hvor id-formen varierede pr. rækketype. Får sektionsmodellen på et tidspunkt
 * sit eget `employmentId`, hører denne helper også væk.
 */
const getRegulationEmploymentId = (section: RegulationInspektionSection): string | null => {
  const match = /^regulation\.(.+)$/.exec(section.id);
  return match?.[1] ?? null;
};

/**
 * Projicerer rækkens strukturerede tabel til visningsmodellen.
 *
 * Tidligere PARSEDE denne funktion rækkens formatterede `displayValue`: split på `\n` og `|`,
 * kolonneantal udledt af indholdet, og totalrækken genkendt ved at strengmatche celleteksten
 * «I alt». Det var en skjult serialiseringsaftale mellem row-builderen og præsentationen —
 * builderen kunne ændre et mellemrum eller en etiket og lydløst ødelægge tabellen her.
 * Nu bærer `EoRowModel.table` strukturen, og builderen serialiserer TIL `displayValue` i
 * stedet for at være dens eneste kilde.
 */
const projectSfggTable = (row: EoRowModel): EOInspektionDisplayTable | null => {
  if (!row.table || row.table.columns.length === 0) return null;

  return {
    id: row.id,
    title: row.label,
    columns: row.table.columns,
    rows: row.table.rows.map((tableRow, index) => ({
      id: `${row.id}.row.${index + 1}`,
      cells: tableRow.cells,
    })),
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
    const employmentId = row.employmentId ?? null;
    if (!employmentId) return;
    if (!grouped.has(employmentId)) {
      grouped.set(employmentId, []);
      groupedTables.set(employmentId, []);
      order.push(employmentId);
    }
    // Rækker der BÆRER en tabel projiceres som tabel; øvrige rækker vises som label/værdi.
    // Betingelsen er nu rækkens egen struktur — ikke et id-præfiks-gæt.
    if (row.table) {
      const projected = projectSfggTable(row);
      if (projected) {
        groupedTables.get(employmentId)?.push(projected);
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
  const { erstatningsopgoerelseValues, rowsBySection, regulationSections, stamdataValues } = view;
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
    ? (rowsBySection.get('loenindkomst') ?? []).filter((row) =>
        // En række uden `employmentId` er ikke per-ansættelsesforhold og vises altid.
        row.employmentId === undefined || visibleEmploymentIds.has(row.employmentId)
      )
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
  const ansatPaaSkadestidspunktetLabel =
    `Ansat på ${resolveSkadeEllerAnmeldelsesdatoReference(stamdataValues.skadestype).labelLower}`;

  const employmentSections: EOInspektionEmploymentSectionViewModel[] = viserTabtArbejdsfortjeneste
    ? loenindkomstSections.map((section) => {
        const sfggSection = sfggSectionsByEmploymentId.get(section.id);
        const ansatPaaSkadestidspunktet = ansatPaaSkadestidspunktetById.get(section.id) ?? true;
        return {
          id: section.id,
          title: section.title,
          ansatPaaSkadestidspunktet,
          ansatPaaSkadestidspunktetLabel,
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
