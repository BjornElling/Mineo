import type { CSSProperties } from 'react';

/**
 * Central tabel-styling for MINEO
 *
 * Dette tema definerer det ensartede udseende for alle tabeller i applikationen.
 * Baseret på designet fra Rentesatser-tabellen.
 */

// Ensartet tabel-typografi (match inputfelterne)
const tableFontFamily = "'Montserrat', sans-serif";
const tableFontVariant = 'tabular-nums';

/**
 * MUI Table styling generator
 * Bruges til Material-UI Table komponenter
 *
 * @param {boolean} useSmallFont - Brug tabel font (13px) i stedet for normal tekst (14px)
 * @returns {object} MUI sx styling objekt
 *
 * @example
 * <Table sx={getMuiTableStyles()}>...</Table>
 * <Table sx={getMuiTableStyles(true)}>...</Table>
 */
export const getMuiTableStyles = (useSmallFont = false) => ({
  border: '1px solid var(--color-table-border)',
  borderRadius: '16px',
  overflow: 'clip',
  fontFamily: tableFontFamily,
  fontVariantNumeric: tableFontVariant,
  fontSize: useSmallFont ? 'var(--font-size-text-table)' : 'var(--font-size-text)',
  color: 'var(--mineo-color-grid-table-text)',
  '& .MuiTableCell-root': {
    border: 'none',
    fontSize: 'inherit', // Arver fra table
    fontFamily: 'inherit',
    fontVariantNumeric: 'inherit',
    color: 'inherit',
  },
  '& thead th': {
    backgroundColor: 'var(--color-table-header-bg)',
    fontWeight: 500,
    borderBottom: '1px solid var(--color-table-border) !important',
  },
  '& tbody tr:nth-of-type(odd)': {
    backgroundColor: 'var(--color-table-row-even)', // CSS odd = første række (brug hvid)
  },
  '& tbody tr:nth-of-type(even)': {
    backgroundColor: 'var(--color-table-row-odd)', // CSS even = anden række (brug grå)
  },
});

/**
 * HTML Table styling generator
 * Bruges til almindelige HTML table elementer
 *
 * @param {boolean} useSmallFont - Brug tabel font (13px) i stedet for normal tekst (14px)
 * @returns {object} Styling objekt til HTML table
 *
 * @example
 * <table style={getHtmlTableStyles()}>...</table>
 * <table style={getHtmlTableStyles(true)}>...</table>
 */
export const getHtmlTableStyles = (useSmallFont = false): CSSProperties => ({
  border: '1px solid var(--color-table-border)',
  borderRadius: '16px',
  overflow: 'hidden',
  borderCollapse: 'collapse',
  fontFamily: tableFontFamily,
  fontVariantNumeric: tableFontVariant,
  fontSize: useSmallFont ? 'var(--font-size-text-table)' : 'var(--font-size-text)',
  color: 'var(--mineo-color-grid-table-text)',
});

/**
 * HTML Table header styling
 * Bruges til <th> elementer i almindelige HTML tabeller
 *
 * @example
 * <th style={htmlTableHeaderStyles}>Header</th>
 */
export const htmlTableHeaderStyles: CSSProperties = {
  backgroundColor: 'var(--color-table-header-bg)',
  fontWeight: 500, // Matcher theme.typography.subsectionTitle.fontWeight
  borderBottom: '1px solid var(--color-table-border)',
};
