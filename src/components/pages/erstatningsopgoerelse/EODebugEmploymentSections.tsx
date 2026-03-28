import * as React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import type { DebugRowModel, DebugStatus } from '../../../domain/debug/eoDebugTypes';
import type { RegulationDebugSection } from '../../../domain/debug/eoDebugRegulationViewModel';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import { Check, ErrorOutline, WarningAmber } from '@mui/icons-material';
import { getRegulationTableColumns } from './regulationTableColumns';
import { renderRegulationTableCellContent } from './regulationTableCellContent';

const LABEL_WIDTH = '320px';

type EmploymentDebugSection = Readonly<{
  id: string;
  title: string;
  loenRows: readonly DebugRowModel[];
  regulationRows: readonly DebugRowModel[];
  regulationSection?: RegulationDebugSection;
  sfggRows?: readonly DebugRowModel[];
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
  | Readonly<{ kind: 'debug'; row: DebugRowModel }>
  | Readonly<{ kind: 'regulation'; row: NonNullable<RegulationDebugSection['rows']>[number] }>
  | Readonly<{
      kind: 'combined-taf-values';
      id: string;
      label: string;
      parts: readonly DebugRowModel[];
    }>;

const getStatusIcon = (status: DebugStatus): React.ReactElement => {
  switch (status) {
    case 'error':
      return <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />;
    case 'warning':
      return <WarningAmber sx={{ color: 'orange', fontSize: 20 }} />;
    case 'ok':
      return <Check sx={{ color: 'green', fontSize: 20 }} />;
  }
};

const getDisplayValueSx = (displayValue: string) => ({
  whiteSpace: 'pre-line' as const,
  textAlign: displayValue.includes('\n') ? 'right' as const : 'inherit',
});

const renderRows = (rows: readonly DebugRowModel[]) => rows.map((row) => (
  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
    <Typography className="row--text">{row.label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
      <Typography className="row--text" sx={getDisplayValueSx(row.displayValue)}>{row.displayValue}</Typography>
      {getStatusIcon(row.status)}
    </Box>
  </Box>
));

const renderRegulationRows = (rows: NonNullable<RegulationDebugSection['rows']>) => rows.map((row) => (
  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': '250px' }}>
    <Typography className="row--text">{row.label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
      <Typography className="row--text" sx={getDisplayValueSx(typeof row.value === 'string' ? row.value : row.value.displayValue)}>
        {typeof row.value === 'string' ? row.value : row.value.displayValue}
      </Typography>
      {getStatusIcon('ok')}
    </Box>
  </Box>
));

const getRowDisplayValue = (row: DebugRowModel): string => row.displayValue;

const getRegulationDisplayValue = (row: NonNullable<RegulationDebugSection['rows']>[number]): string =>
  typeof row.value === 'string' ? row.value : row.value.displayValue;

const dedupeMergedRegulationRows = (
  loenRegulationRows: readonly DebugRowModel[],
  regulationRows: NonNullable<RegulationDebugSection['rows']>
): NonNullable<RegulationDebugSection['rows']> => {
  const existingKeys = new Set(
    loenRegulationRows.map((row) => `${row.label}__${getRowDisplayValue(row)}`)
  );

  return regulationRows.filter((row) => !existingKeys.has(`${row.label}__${getRegulationDisplayValue(row)}`));
};

const TAF_REGULATION_VALUE_LABELS = [
  'Reguleringsværdi på reguleringsdato for TAF',
  'Reguleringsværdi på start-dato for TAF',
  'Reguleringsværdi på slut-dato for TAF',
] as const;

const isReguleringsdatoLabel = (label: string): boolean => label.startsWith('Reguleringsdato (');

const isSuppressedRegulationSectionLabel = (label: string): boolean =>
  label === 'Basisværdi (indeks 100)' || label === 'Seneste indeks';

const renderCombinedTafRegulationValueRow = (
  id: string,
  label: string,
  parts: readonly DebugRowModel[]
) => (
  <Box key={id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
    <Typography className="row--text">{label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ gap: 1, flexWrap: 'wrap' }}>
      {parts.map((part, index) => (
        <React.Fragment key={part.id}>
          {index > 0 ? <Typography className="row--text">/</Typography> : null}
          <Typography className="row--text" sx={getDisplayValueSx(part.displayValue)}>{part.displayValue}</Typography>
          {getStatusIcon(part.status)}
        </React.Fragment>
      ))}
    </Box>
  </Box>
);

const buildEmploymentRegulationDisplayRows = (
  regulationRows: readonly DebugRowModel[],
  regulationSectionRows: NonNullable<RegulationDebugSection['rows']>
): readonly EmploymentRegulationDisplayRow[] => {
  const tafValueRows = regulationRows.filter((row) => TAF_REGULATION_VALUE_LABELS.includes(row.label as typeof TAF_REGULATION_VALUE_LABELS[number]));
  const tafValueRowByLabel = new Map(tafValueRows.map((row) => [row.label, row]));

  const baseDebugRows = regulationRows.filter((row) => !TAF_REGULATION_VALUE_LABELS.includes(row.label as typeof TAF_REGULATION_VALUE_LABELS[number]));
  const baseSectionRows = regulationSectionRows.filter((row) => !isSuppressedRegulationSectionLabel(row.label));

  const prioritised: EmploymentRegulationDisplayRow[] = [];
  const consumedDebugIds = new Set<string>();
  const consumedSectionIds = new Set<string>();

  const pushDebugByLabel = (label: string) => {
    const row = baseDebugRows.find((candidate) => candidate.label === label);
    if (!row) return;
    consumedDebugIds.add(row.id);
    prioritised.push({ kind: 'debug', row });
  };

  const pushSectionByPredicate = (predicate: (row: NonNullable<RegulationDebugSection['rows']>[number]) => boolean) => {
    const row = baseSectionRows.find((candidate) => predicate(candidate));
    if (!row) return;
    consumedSectionIds.add(row.id);
    prioritised.push({ kind: 'regulation', row });
  };

  pushSectionByPredicate((row) => isReguleringsdatoLabel(row.label));
  pushDebugByLabel('Valgt regulering');
  pushDebugByLabel('Navn på reguleringsform');
  pushDebugByLabel('Alle reguleringsværdier udfyldt');

  const orderedTafParts = TAF_REGULATION_VALUE_LABELS.flatMap((label) => {
    const row = tafValueRowByLabel.get(label);
    return row ? [row] : [];
  });
  orderedTafParts.forEach((row) => consumedDebugIds.add(row.id));
  if (orderedTafParts.length > 0) {
    prioritised.push({
      kind: 'combined-taf-values',
      id: `${orderedTafParts[0]?.id ?? 'taf-reguleringsvaerdier'}-combined`,
      label: 'Reguleringsværdi på: Reguleringsdato / start-dato for TAF / slut-dato for TAF',
      parts: orderedTafParts,
    });
  }

  const remainingDebugRows = baseDebugRows
    .filter((row) => !consumedDebugIds.has(row.id))
    .map((row): EmploymentRegulationDisplayRow => ({ kind: 'debug', row }));
  const remainingSectionRows = baseSectionRows
    .filter((row) => !consumedSectionIds.has(row.id))
    .map((row): EmploymentRegulationDisplayRow => ({ kind: 'regulation', row }));

  return [...prioritised, ...remainingDebugRows, ...remainingSectionRows];
};

const UnderlinedHoverRow = ({ text }: Readonly<{ text: string }>) => (
  <Box className="row--label-right-hover">
    <Typography className="row--subheading-underlined" sx={{ pl: 2 }}>
      {text}
    </Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);

const isSfggPostTableRow = (row: DebugRowModel): boolean => row.id.startsWith('sfgg.eftertabel.');
const isSfggComputedTotalRow = (row: DebugRowModel): boolean => row.id.startsWith('sfgg.eftertabel.beregnet.');

const renderSfggRow = (row: DebugRowModel) => (
  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
    <Typography className="row--text">{row.label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
      <Typography
        className={`row--text${isSfggComputedTotalRow(row) ? ' text-bold' : ''}`}
        sx={getDisplayValueSx(row.displayValue)}
      >
        {row.displayValue}
      </Typography>
      {getStatusIcon(row.status)}
    </Box>
  </Box>
);

const renderSfggPostTableGroup = (rows: readonly DebugRowModel[]) => {
  if (rows.length === 0) return null;
  const combinedStatus: DebugStatus = rows.some((row) => row.status === 'error')
    ? 'error'
    : rows.some((row) => row.status === 'warning')
      ? 'warning'
      : 'ok';

  return (
    <Box
      key={rows.map((row) => row.id).join('|')}
      className="row--label-right-hover"
      sx={{ alignItems: 'stretch' }}
    >
      <Box sx={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column', justifyContent: 'center', pr: 2 }}>
        {rows.map((row) => (
          <Typography
            key={row.id}
            className="row--text"
            sx={{ minHeight: 0, display: 'block', py: 0 }}
          >
            {row.label}
          </Typography>
        ))}
      </Box>

      <Box className="row--label-right-hover__content" sx={{ gap: 2, alignItems: 'stretch' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end' }}>
          {rows.map((row) => (
            <Typography
              key={row.id}
              className={`row--text${isSfggComputedTotalRow(row) ? ' text-bold' : ''}`}
              sx={{ ...getDisplayValueSx(row.displayValue), minHeight: 0, display: 'block', py: 0 }}
            >
              {row.displayValue}
            </Typography>
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {getStatusIcon(combinedStatus)}
        </Box>
      </Box>
    </Box>
  );
};

const EODebugEmploymentSections = React.memo<{
  sections: readonly EmploymentDebugSection[];
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
            const sfggPostTableRows = sfggRows.filter(isSfggPostTableRow);
            const sfggPrimaryRows = sfggRows.filter((row) => !isSfggPostTableRow(row));

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
                        case 'debug':
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
                        {regulationTables.map((table, tableIndex) => (
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
                        containerSx={{ mb: tableIndex === regulationTables.length - 1 ? 2 : 4, width: '100%' }}
                        tableSx={{
                          width: '100%',
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
                        case 'debug':
                          return renderRows([entry.row])[0];
                        case 'regulation':
                          return renderRegulationRows([entry.row])[0];
                        case 'combined-taf-values':
                          return renderCombinedTafRegulationValueRow(entry.id, entry.label, entry.parts);
                      }
                    })}
                  </>
                ) : null}

                {sfggRows.length > 0 || sfggTables.length > 0 ? (
                  <>
                    <UnderlinedHoverRow text="Sygeferiegodtgørelse" />
                    {sfggPrimaryRows.map(renderSfggRow)}
                    {sfggTables.map((table) => (
                      <StandardDisplayTable
                        key={table.id}
                        useSmallFont
                        columns={table.columns.map((header) => ({
                          header,
                          align: header === 'Fra-dato' || header === 'Til-dato' ? 'center' as const : 'right' as const,
                        }))}
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
                        containerSx={{ mb: 2, width: '100%' }}
                        tableSx={{
                          width: '100%',
                          tableLayout: 'fixed',
                        }}
                      />
                    ))}
                    {renderSfggPostTableGroup(sfggPostTableRows)}
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

EODebugEmploymentSections.displayName = 'EODebugEmploymentSections';

export default EODebugEmploymentSections;
