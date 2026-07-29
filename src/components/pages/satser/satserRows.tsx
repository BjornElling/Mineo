import React from 'react';
import { Box, Typography } from '@mui/material';

import { formatAsAmount, formatKr, formatPercent } from '../../../utils/formatUtils';
import type { RetsinfoLink } from '../../../data/retsinfoLinks';

/**
 * Satser-sidens delte rækkeprimitiver og formatkompositioner.
 *
 * Samlet ét sted, så de fire sats-sektioner deler præcis samme række- og talformat. Alle talformater bygger på de
 * kanoniske `formatKr`/`formatAsAmount`/`formatPercent`; sidens egne kompositioner tilføjer kun enhed/adskiller.
 */

/**
 * Formaterer et enkelt kronebeløb til dansk format via den kanoniske `formatKr`.
 * Null/undefined giver tom streng, så `DataRow` skjuler rækken.
 */
export const formatKroner = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : formatKr(value, 0);

/**
 * To kronebeløb adskilt af "/". Bruger den kanoniske `formatAsAmount` til talformatet og sætter selv den
 * fælles "kr."-enhed til sidst.
 */
export const formatKronerPair = (
  first: number | null | undefined,
  second: number | null | undefined
): string => {
  if (first === null || first === undefined || second === null || second === undefined) return '';
  return `${formatAsAmount(first, 0)} / ${formatAsAmount(second, 0)} kr.`;
};

/** Kronebeløb pr. enhed (fx "kr./sygedag"). Bygger på den kanoniske `formatKr` og tilføjer enhedssuffikset. */
export const formatKronerPerEnhed = (value: number | null | undefined, enhed: string): string => {
  if (value === null || value === undefined) return '';
  return `${formatKr(value, 0)}/${enhed}`;
};

export const formatOptionalPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return formatPercent(value);
};

interface DataRowProps {
  label: string;
  value: React.ReactNode;
  rightAlign?: boolean;
}

/** Række-komponent for label-værdi-par. Skjuler hele rækken, når der ikke er nogen værdi. */
export const DataRow = ({ label, value, rightAlign = true }: DataRowProps) => {
  if (!value) return null;

  return (
    <Box className="row--label-right-hover">
      <Typography className="row--text">{label}:</Typography>
      <Box
        className="row--label-right-hover__content"
        sx={{
          justifyContent: rightAlign ? 'flex-end' : 'flex-start',
          textAlign: rightAlign ? 'right' : 'left',
        }}
      >
        {typeof value === 'string' ? (
          <Typography className="row--text">{value}</Typography>
        ) : (
          value
        )}
      </Box>
    </Box>
  );
};

interface MultiLineDataRowProps {
  rows: ReadonlyArray<Readonly<{ key: string; label: React.ReactNode; value: string | null | undefined }>>;
}

export const MultiLineDataRow = ({ rows }: MultiLineDataRowProps) => {
  const visibleRows = rows.filter((row) => row.value);
  if (visibleRows.length === 0) return null;

  return (
    <Box className="row--label-right-hover">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {visibleRows.map((row) => (
          <Typography key={row.key} className="row--text">{row.label}</Typography>
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, alignItems: 'flex-end', textAlign: 'right' }}>
        {visibleRows.map((row) => (
          <Typography key={row.key} className="row--text">{row.value}</Typography>
        ))}
      </Box>
    </Box>
  );
};

/** Retsinfo-henvisninger som links, sammensat med " og " mellem flere. Tom liste giver tom streng. */
export const renderReferenceValue = (links: readonly RetsinfoLink[]): React.ReactNode => {
  if (links.length === 0) return '';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', width: '100%' }}>
      {links.map((link, index) => (
        <React.Fragment key={`${link.label}-${link.url}`}>
          {index > 0 ? (
            <Typography component="span" className="row--text" sx={{ whiteSpace: 'pre' }}>
              {' og '}
            </Typography>
          ) : null}
          <Typography
            component="a"
            className="row--text icon-text-link"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label}
          </Typography>
        </React.Fragment>
      ))}
    </Box>
  );
};
