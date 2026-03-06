import * as React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import type { DebugRowModel, DebugStatus } from '../../../domain/debug/eoDebugTypes';
import type { RegulationDebugSection } from '../../../domain/debug/eoDebugRegulationViewModel';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import { Check, ErrorOutline, WarningAmber } from '@mui/icons-material';

const LABEL_WIDTH = '320px';

type EmploymentDebugSection = Readonly<{
  id: string;
  title: string;
  loenRows: readonly DebugRowModel[];
  regulationRows: readonly DebugRowModel[];
  regulationSection?: RegulationDebugSection;
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

const renderRows = (rows: readonly DebugRowModel[]) => rows.map((row) => (
  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
    <Typography className="row--text">{row.label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
      <Typography className="row--text">{row.displayValue}</Typography>
      {getStatusIcon(row.status)}
    </Box>
  </Box>
));

const renderRegulationRows = (rows: NonNullable<RegulationDebugSection['rows']>) => rows.map((row) => (
  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': '250px' }}>
    <Typography className="row--text">{row.label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
      <Typography className="row--text">
        {typeof row.value === 'string' ? row.value : row.value.displayValue}
      </Typography>
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

const REGULATION_LABEL_ORDER = [
  'Valgt regulering',
  'Navn på reguleringsform',
  'Reguleringsdato',
  'Alle reguleringsværdier udfyldt',
] as const;

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
          <Typography className="row--text">{part.displayValue}</Typography>
          {getStatusIcon(part.status)}
        </React.Fragment>
      ))}
    </Box>
  </Box>
);

const getRegulationTableColumns = (table: NonNullable<RegulationDebugSection['tables']>[number]) => {
  const isBeregnetTabel = table.columns.includes('Indeksberegning');
  return table.columns.map((header) => ({
    header,
    align: 'center' as const,
    width: isBeregnetTabel
      ? header === 'Indeksberegning'
        ? '52%'
        : header === 'Fra-dato' || header === 'Til-dato'
          ? '12%'
          : '12%'
      : undefined,
    cellSx: isBeregnetTabel && header === 'Indeksberegning'
      ? { whiteSpace: 'pre-line', verticalAlign: 'top' as const }
      : undefined,
    headerSx: isBeregnetTabel && header === 'Indeksberegning'
      ? { whiteSpace: 'normal' as const }
      : undefined,
  }));
};

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
                        <UnderlinedHoverRow text="Reguleringstabeller" />
                        {regulationTables.map((table, tableIndex) => (
                          <StandardDisplayTable
                            key={table.id}
                            useSmallFont
                            columns={getRegulationTableColumns(table)}
                            rows={table.rows.map((row, index): StandardDisplayTableRow => ({
                              key: `${table.id}-row-${index}`,
                              cells: row.cells.map((cell) => (typeof cell === 'string' ? cell : cell.displayValue)),
                            }))}
                            containerSx={{ mb: tableIndex === regulationTables.length - 1 ? 2 : 4, width: '100%' }}
                            tableSx={{
                              width: '100%',
                              tableLayout: 'fixed',
                              '& .MuiTableCell-root': {
                                whiteSpace: 'normal',
                                overflowWrap: 'anywhere',
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
