import type { CSSProperties } from 'react';

/**
 * Central tabel-styling for Mineo
 *
 * Dette tema definerer det ensartede udseende for alle tabeller i applikationen.
 * Baseret på designet fra Rentesatser-tabellen.
 */

// Ensartet tabel-typografi (match inputfelterne)
const tableFontFamily = "'Montserrat', sans-serif";
const tableFontVariant = 'tabular-nums';

const getTableTypographySignature = (useSmallFont: boolean) => ({
  '--mineo-color-active-grid-text': useSmallFont
    ? 'var(--mineo-color-grid-table-text-small)'
    : 'var(--mineo-color-grid-table-text-regular)',
  '--mineo-color-active-grid-header': useSmallFont
    ? 'var(--mineo-color-grid-header-small)'
    : 'var(--mineo-color-grid-header-regular)',
  '--mineo-color-active-grid-placeholder': useSmallFont
    ? 'var(--mineo-color-grid-placeholder-small)'
    : 'var(--mineo-color-grid-placeholder-regular)',
  '--mineo-color-active-grid-derived': useSmallFont
    ? 'var(--mineo-color-grid-derived-small)'
    : 'var(--mineo-color-grid-derived-regular)',
});

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
  ...getTableTypographySignature(useSmallFont),
  border: '1px solid var(--color-table-border)',
  borderRadius: '16px',
  overflow: 'clip',
  fontFamily: tableFontFamily,
  fontVariantNumeric: tableFontVariant,
  fontSize: useSmallFont ? 'var(--font-size-text-table)' : 'var(--font-size-text)',
  fontWeight: 400,
  lineHeight: 'normal',
  color: 'var(--mineo-color-active-grid-text)',
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
    color: 'var(--mineo-color-active-grid-header)',
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
  ...getTableTypographySignature(useSmallFont),
  border: '1px solid var(--color-table-border)',
  borderRadius: '16px',
  overflow: 'hidden',
  borderCollapse: 'collapse',
  fontFamily: tableFontFamily,
  fontVariantNumeric: tableFontVariant,
  fontSize: useSmallFont ? 'var(--font-size-text-table)' : 'var(--font-size-text)',
  fontWeight: 400,
  lineHeight: 'normal',
  color: 'var(--mineo-color-active-grid-text)',
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
