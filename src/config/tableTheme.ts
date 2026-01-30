import type { CSSProperties } from 'react';

/**
 * Central tabel-styling for MINEO
 *
 * Dette tema definerer det ensartede udseende for alle tabeller i applikationen.
 * Baseret på designet fra Rentesatser-tabellen.
 */

/**
 * CSS farver til tabel-styling
 * Centraliserede værdier der kan genbruges på tværs af MUI og almindelige HTML tabeller
 */
export const tableColors = {
  border: '#e5e7eb',
  headerBackground: '#f8fafc',
  oddRowBackground: '#f9fafb',
  evenRowBackground: '#ffffff',
};

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
  border: `1px solid ${tableColors.border}`,
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
    backgroundColor: tableColors.headerBackground,
    fontWeight: 500,
    borderBottom: `1px solid ${tableColors.border} !important`,
  },
  '& tbody tr:nth-of-type(odd)': {
    backgroundColor: tableColors.evenRowBackground, // CSS odd = første række (brug hvid)
  },
  '& tbody tr:nth-of-type(even)': {
    backgroundColor: tableColors.oddRowBackground, // CSS even = anden række (brug grå)
  },
});

/**
 * MUI Table styling objekt (default)
 * Baglænskompatibilitet - brug getMuiTableStyles() i stedet
 *
 * @deprecated Brug getMuiTableStyles() i stedet
 */
export const muiTableStyles = getMuiTableStyles();

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
  border: `1px solid ${tableColors.border}`,
  borderRadius: '16px',
  overflow: 'hidden',
  borderCollapse: 'collapse',
  fontFamily: tableFontFamily,
  fontVariantNumeric: tableFontVariant,
  fontSize: useSmallFont ? 'var(--font-size-text-table)' : 'var(--font-size-text)',
  color: 'var(--mineo-color-grid-table-text)',
});

/**
 * HTML Table styling objekt (default)
 * Baglænskompatibilitet - brug getHtmlTableStyles() i stedet
 *
 * @deprecated Brug getHtmlTableStyles() i stedet
 */
export const htmlTableStyles = getHtmlTableStyles();

/**
 * HTML Table header styling
 * Bruges til <th> elementer i almindelige HTML tabeller
 *
 * @example
 * <th style={htmlTableHeaderStyles}>Header</th>
 */
export const htmlTableHeaderStyles: CSSProperties = {
  backgroundColor: tableColors.headerBackground,
  fontWeight: 500, // Matcher theme.typography.subsectionTitle.fontWeight
  borderBottom: `1px solid ${tableColors.border}`,
};
