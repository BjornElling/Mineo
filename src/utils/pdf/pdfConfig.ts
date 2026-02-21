/**
 * PDF Configuration og fælles styling
 *
 * Central konfiguration for alle PDF-dokumenter i MINEO
 */

export type PdfColor = [number, number, number];

// Farver
export const COLORS: Record<'lightBackground' | 'white' | 'black' | 'text', PdfColor> = {
  lightBackground: [248, 248, 248], // RGB for #f8f9fa
  white: [255, 255, 255],
  black: [0, 0, 0],
  text: [51, 51, 51],
};

// Margener (i mm)
export const MARGINS = {
  left: 20,
  right: 20,
  top: 40,  // Ekstra plads til brevhoved
  bottom: 20,
};

export const A4_PAGE_WIDTH_MM = 210;
export const PDF_CONTENT_WIDTH_MM = A4_PAGE_WIDTH_MM - MARGINS.left - MARGINS.right;

// Fælles fontvalg for alle PDF'er
export const PDF_FONT_FAMILY = 'helvetica' as const;
export const PDF_FONT_STYLES = {
  normal: 'normal',
  bold: 'bold',
} as const;

// Font-størrelser
export const FONT_SIZES = {
  title: 16,
  header: 12,
  normal: 10,
};

// Tabel-styling
export const TABLE_STYLES = {
  fontSize: FONT_SIZES.normal,
  cellPadding: 2,
  headerBackgroundColor: COLORS.lightBackground,
  alternateRowBackgroundColor: COLORS.lightBackground,
};

// Fælles detail-konstanter for ensartet PDF-udtryk
export const PDF_MUTED_TEXT_COLOR: PdfColor = [150, 150, 150];
export const PDF_TABLE_NARROW_COLUMN_WIDTH = 25;
export const PDF_FINAL_Y_FALLBACK_HEIGHT = 50;
export const PDF_SECTION_HEADING_GAP = 3;

// Mellemrum mellem sektioner
export const SECTION_SPACER = 10; // mm
