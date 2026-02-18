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

// Fonte (PDF'er bruger Helvetica som er standard i jsPDF)
export const FONTS = {
  regular: 'helvetica',
  bold: 'helvetica',
};

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

// Mellemrum mellem sektioner
export const SECTION_SPACER = 10; // mm
