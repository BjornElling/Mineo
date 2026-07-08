import * as React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import type { EoRowModel } from '../../../domain/eoRowEvaluation/eoRowTypes';
import type { RegulationInspektionSection } from '../../../domain/eoInspektion/eoInspektionRegulationViewModel';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import { isSfggComputedTotalRowId, isSfggPostTableRowId } from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';
import { getRegulationTableColumns } from './regulationTableColumns';
import { renderRegulationTableCellContent } from './regulationTableCellContent';
import {
  INSPEKTION_REGULATION_ROW_LABEL_WIDTH,
  INSPEKTION_ROW_LABEL_WIDTH as LABEL_WIDTH,
  getDisplayValueSx,
  getStatusIcon,
} from './eoInspektionRowRendering';

type EmploymentInspektionSection = Readonly<{
  id: string;
  title: string;
  ansatPaaSkadestidspunktet?: boolean;
  ansatPaaSkadestidspunktetLabel: string;
  loenRows: readonly EoRowModel[];
  regulationRows: readonly EoRowModel[];
  regulationSection?: RegulationInspektionSection;
  sfggRows?: readonly EoRowModel[];
  sfggTables?: readonly Readonly<{
    id: string;
    title: string;
    columns: readonly string[];
    rows: readonly Readonly<{
      id: string;
      cells: readonly string[];
    }>[];
  }>[];
}>;

type EmploymentRegulationDisplayRow =
  | Readonly<{ kind: 'row'; row: EoRowModel }>
  | Readonly<{ kind: 'regulation'; row: NonNullable<RegulationInspektionSection['rows']>[number] }>
  | Readonly<{
      kind: 'combined-taf-values';
      id: string;
      label: string;
      parts: readonly EoRowModel[];
    }>;

const renderRows = (rows: readonly EoRowModel[]) => rows.map((row) => (
  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
    <Typography className="row--text">{row.label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
      <Typography className="row--text" sx={getDisplayValueSx(row.displayValue)}>{row.displayValue}</Typography>
      {getStatusIcon(row.status)}
    </Box>
  </Box>
));

const renderRegulationRows = (rows: NonNullable<RegulationInspektionSection['rows']>) => rows.map((row) => (
  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': INSPEKTION_REGULATION_ROW_LABEL_WIDTH }}>
    <Typography className="row--text">{row.label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
      <Typography className="row--text" sx={getDisplayValueSx(typeof row.value === 'string' ? row.value : row.value.displayValue)}>
        {typeof row.value === 'string' ? row.value : row.value.displayValue}
      </Typography>
      {getStatusIcon('ok')}
    </Box>
  </Box>
));

const getRowDisplayValue = (row: EoRowModel): string => row.displayValue;

const getRegulationDisplayValue = (row: NonNullable<RegulationInspektionSection['rows']>[number]): string =>
  typeof row.value === 'string' ? row.value : row.value.displayValue;

const dedupeMergedRegulationRows = (
  loenRegulationRows: readonly EoRowModel[],
  regulationRows: NonNullable<RegulationInspektionSection['rows']>
): NonNullable<RegulationInspektionSection['rows']> => {
  const existingKeys = new Set(
    loenRegulationRows.map((row) => `${row.label}__${getRowDisplayValue(row)}`)
  );

  return regulationRows.filter((row) => !existingKeys.has(`${row.label}__${getRegulationDisplayValue(row)}`));
};

const TAF_REGULATION_VALUE_LABELS = [
  'Reguleringsværdi på anvendt reguleringsdato for TAF',
  'Reguleringsværdi på start-dato for TAF',
  'Reguleringsværdi på slut-dato for TAF',
] as const;

const isReguleringsdatoLabel = (label: string): boolean =>
  label === 'Anvendt reguleringsdato' || label.startsWith('Anvendt reguleringsdato (');

const isSuppressedRegulationSectionLabel = (label: string): boolean =>
  label === 'Basisværdi (indeks 100)' || label === 'Seneste indeks';

const stripFirstAvailableDateFromRegulationDisplayValue = (displayValue: string): string =>
  displayValue.replace(/\s*\(først fra .*?\)$/, '');

const renderCombinedTafRegulationValueRow = (
  id: string,
  label: string,
  parts: readonly EoRowModel[]
) => (
  <Box key={id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
    <Typography className="row--text">{label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ gap: 1, flexWrap: 'wrap' }}>
      {parts.map((part, index) => (
        <React.Fragment key={part.id}>
          {index > 0 ? <Typography className="row--text">/</Typography> : null}
          <Typography
            className="row--text"
            sx={getDisplayValueSx(stripFirstAvailableDateFromRegulationDisplayValue(part.displayValue))}
          >
            {stripFirstAvailableDateFromRegulationDisplayValue(part.displayValue)}
          </Typography>
          {getStatusIcon(part.status)}
        </React.Fragment>
      ))}
    </Box>
  </Box>
);

const buildEmploymentRegulationDisplayRows = (
  regulationRows: readonly EoRowModel[],
  regulationSectionRows: NonNullable<RegulationInspektionSection['rows']>
): readonly EmploymentRegulationDisplayRow[] => {
  const tafValueRows = regulationRows.filter((row) => TAF_REGULATION_VALUE_LABELS.includes(row.label as typeof TAF_REGULATION_VALUE_LABELS[number]));
  const tafValueRowByLabel = new Map(tafValueRows.map((row) => [row.label, row]));

  const baseInspektionRows = regulationRows.filter((row) => !TAF_REGULATION_VALUE_LABELS.includes(row.label as typeof TAF_REGULATION_VALUE_LABELS[number]));
  const baseSectionRows = regulationSectionRows.filter((row) => !isSuppressedRegulationSectionLabel(row.label));

  const prioritised: EmploymentRegulationDisplayRow[] = [];
  const consumedInspektionIds = new Set<string>();
  const consumedSectionIds = new Set<string>();

  const pushInspektionByLabel = (label: string) => {
    const row = baseInspektionRows.find((candidate) => candidate.label === label);
    if (!row) return;
    consumedInspektionIds.add(row.id);
    prioritised.push({ kind: 'row', row });
  };

  const pushSectionByPredicate = (predicate: (row: NonNullable<RegulationInspektionSection['rows']>[number]) => boolean) => {
    const row = baseSectionRows.find((candidate) => predicate(candidate));
    if (!row) return;
    consumedSectionIds.add(row.id);
    prioritised.push({ kind: 'regulation', row });
  };

  pushSectionByPredicate((row) => isReguleringsdatoLabel(row.label));
  pushInspektionByLabel('Valgt regulering');
  pushInspektionByLabel('Navn på reguleringsform');
  pushInspektionByLabel('Alle reguleringsværdier udfyldt');

  const orderedTafParts = TAF_REGULATION_VALUE_LABELS.flatMap((label) => {
    const row = tafValueRowByLabel.get(label);
    return row ? [row] : [];
  });
  orderedTafParts.forEach((row) => consumedInspektionIds.add(row.id));
  if (orderedTafParts.length > 0) {
    prioritised.push({
      kind: 'combined-taf-values',
      id: `${orderedTafParts[0]?.id ?? 'taf-reguleringsvaerdier'}-combined`,
      label: 'Reguleringsværdi på: Anvendt reguleringsdato / start-dato for TAF / slut-dato for TAF',
      parts: orderedTafParts,
    });
  }

  const remainingInspektionRows = baseInspektionRows
    .filter((row) => !consumedInspektionIds.has(row.id))
    .map((row): EmploymentRegulationDisplayRow => ({ kind: 'row', row }));
  const remainingSectionRows = baseSectionRows
    .filter((row) => !consumedSectionIds.has(row.id))
    .map((row): EmploymentRegulationDisplayRow => ({ kind: 'regulation', row }));

  return [...prioritised, ...remainingInspektionRows, ...remainingSectionRows];
};

const UnderlinedHoverRow = ({ text }: Readonly<{ text: string }>) => (
  <Box className="row--label-right-hover">
    <Typography className="row--subheading-underlined" sx={{ pl: 2 }}>
      {text}
    </Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);

const renderSfggRow = (row: EoRowModel) => (
  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
    <Typography className="row--text">{row.label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
      <Typography
        className={`row--text${isSfggComputedTotalRowId(row.id) ? ' text-bold' : ''}`}
        sx={getDisplayValueSx(row.displayValue)}
      >
        {row.displayValue}
      </Typography>
      {getStatusIcon(row.status)}
    </Box>
  </Box>
);

const EOInspektionEmploymentSections = React.memo<{
  sections: readonly EmploymentInspektionSection[];
}>(({ sections }) => {
  if (sections.length === 0) return null;

  return (
    <Box>
      {sections.map((section) => (
        <ContentBox key={section.id} className="content-box">
          <Typography className="section-header">{section.title}</Typography>
          {(() => {
            const visibleRegulationSectionRows = section.regulationSection
              ? dedupeMergedRegulationRows(section.regulationRows, section.regulationSection.rows)
              : [];
            const regulationDisplayRows = buildEmploymentRegulationDisplayRows(
              section.regulationRows,
              visibleRegulationSectionRows
            );
            const regulationTables = section.regulationSection?.tables ?? [];
            const sfggRows = section.sfggRows ?? [];
            const sfggTables = section.sfggTables ?? [];
            const sfggFooterTables = sfggTables.filter((table) => table.id.startsWith('sfgg.aarsfordeling.'));
            const sfggPrimaryTables = sfggTables.filter((table) => !table.id.startsWith('sfgg.aarsfordeling.'));
            const sfggPostTableRows = sfggRows.filter((row) => isSfggPostTableRowId(row.id));
            const sfggPrimaryRows = sfggRows.filter((row) => !isSfggPostTableRowId(row.id));

            return (
              <>

                {section.loenRows.length > 0 ? (
                  <>
                    <UnderlinedHoverRow text="Lønindkomst" />
                    {renderRows(section.loenRows)}
                  </>
                ) : null}

                {section.regulationSection ? (
                  <>
                    <UnderlinedHoverRow text="Regulering" />
                    {regulationDisplayRows.map((entry) => {
                      switch (entry.kind) {
                        case 'row':
                          return renderRows([entry.row])[0];
                        case 'regulation':
                          return renderRegulationRows([entry.row])[0];
                        case 'combined-taf-values':
                          return renderCombinedTafRegulationValueRow(entry.id, entry.label, entry.parts);
                      }
                    })}

                    {regulationTables.length > 0 ? (
                      <>
                        <UnderlinedHoverRow text="Beregnet regulering" />
                        {regulationTables.map((table) => (
                          <StandardDisplayTable
                            key={table.id}
                            useSmallFont
                            columns={getRegulationTableColumns(table)}
                        rows={table.rows.map((row, index): StandardDisplayTableRow => ({
                          key: `${table.id}-row-${index}`,
                          cells: row.cells.map((cell) =>
                            typeof cell === 'string'
                              ? renderRegulationTableCellContent(cell)
                              : renderRegulationTableCellContent(cell.displayValue)
                          ),
                        }))}
                        tableSx={{
                          tableLayout: 'fixed',
                          '& .MuiTableCell-root': {
                            whiteSpace: 'normal',
                            overflowWrap: 'break-word',
                          },
                        }}
                      />
                        ))}
                      </>
                    ) : null}
                  </>
                ) : section.regulationRows.length > 0 ? (
                  <>
                    <UnderlinedHoverRow text="Regulering" />
                    {buildEmploymentRegulationDisplayRows(section.regulationRows, []).map((entry) => {
                      switch (entry.kind) {
                        case 'row':
                          return renderRows([entry.row])[0];
                        case 'regulation':
                          return renderRegulationRows([entry.row])[0];
                        case 'combined-taf-values':
                          return renderCombinedTafRegulationValueRow(entry.id, entry.label, entry.parts);
                      }
                    })}
                  </>
                ) : null}

                {section.ansatPaaSkadestidspunktet === false ? (
                  <>
                    <UnderlinedHoverRow text="Sygeferiegodtgørelse" />
                    <Box className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                      <Typography className="row--text">
                        {section.ansatPaaSkadestidspunktetLabel}
                      </Typography>
                      <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                        <Typography className="row--text">Nej</Typography>
                      </Box>
                    </Box>
                  </>
                ) : sfggRows.length > 0 || sfggTables.length > 0 ? (
                  <>
                    <UnderlinedHoverRow text="Sygeferiegodtgørelse" />
                    {sfggPrimaryRows.map(renderSfggRow)}
                    {sfggPrimaryTables.map((table) => (
                      <StandardDisplayTable
                        key={table.id}
                        useSmallFont
                        columns={table.columns.map((header) => {
                          const isDateColumn = header === 'Fra-dato' || header === 'Til-dato';
                          const isIndentedColumn = header === 'Feriepenge-sats' || header === 'AG-pension' || header === 'Antal arbejdsdage' || header === 'Antal kalenderdage';
                          return {
                            header,
                            align: isDateColumn ? 'center' as const : 'right' as const,
                            headerSx: isIndentedColumn ? { textAlign: 'center' as const } : undefined,
                            cellStyle: isIndentedColumn ? { paddingRight: '60px' } : undefined,
                          };
                        })}
                        rows={table.rows.map((row): StandardDisplayTableRow => ({
                          key: row.id,
                          cells: row.cells.map((cell, index) => {
                            const isTotalRow = row.cells[0] === 'I alt';
                            const isLastCell = index === row.cells.length - 1;
                            return isTotalRow && isLastCell
                              ? <Box key={`${row.id}-${index}`} component="span" sx={{ fontWeight: 700 }}>{cell}</Box>
                              : cell;
                          }),
                        }))}
                        tableSx={{
                          tableLayout: 'fixed',
                        }}
                      />
                    ))}
                    {sfggPostTableRows.map(renderSfggRow)}
                    {sfggFooterTables.map((table) => (
                      <StandardDisplayTable
                        key={table.id}
                        useSmallFont
                        columns={table.columns.map((header, index) => ({
                          header,
                          align:
                            index === 0
                              ? 'left' as const
                              : header === 'År'
                                ? 'center' as const
                                : 'right' as const,
                          width: index === 0 ? '65%' : '17.5%',
                          cellSx: index === 0 ? { textAlign: 'left' } : undefined,
                        }))}
                        rows={table.rows.map((row): StandardDisplayTableRow => ({
                          key: row.id,
                          cells: row.cells,
                        }))}
                        tableSx={{
                          tableLayout: 'fixed',
                        }}
                      />
                    ))}
                  </>
                ) : null}
              </>
            );
          })()}
        </ContentBox>
      ))}
    </Box>
  );
});

EOInspektionEmploymentSections.displayName = 'EOInspektionEmploymentSections';

export default EOInspektionEmploymentSections;
