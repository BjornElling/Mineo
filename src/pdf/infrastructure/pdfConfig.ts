/**
 * PDF Configuration og fælles styling
 *
 * Central konfiguration for alle PDF-dokumenter i MINEO
 */

export type PdfColor = [number, number, number];

// Farver
export const COLORS: Record<'lightBackground' | 'white' | 'black' | 'text' | 'muted' | 'footerText', PdfColor> = {
  lightBackground: [248, 248, 248], // RGB for #f8f9fa
  white: [255, 255, 255],
  black: [0, 0, 0],
  text: [51, 51, 51],
  muted: [150, 150, 150],
  footerText: [200, 200, 200],
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

export type PdfFontFamily = typeof PDF_FONT_FAMILY;
export type PdfFontStyle = (typeof PDF_FONT_STYLES)[keyof typeof PDF_FONT_STYLES];

// Font-størrelser
export const FONT_SIZES = {
  title: 16,
  header: 12,
  normal: 10,
};

// Tabel-styling
export const TABLE_STYLES = {
  fontSize: FONT_SIZES.normal,
  cellPadding: 1.5,
  headerBackgroundColor: COLORS.lightBackground,
  alternateRowBackgroundColor: COLORS.lightBackground,
};

// Fælles detail-konstanter for ensartet PDF-udtryk
export const PDF_MUTED_TEXT_COLOR: PdfColor = COLORS.muted;
export const PDF_TABLE_NARROW_COLUMN_WIDTH = 25;
export const PDF_FINAL_Y_FALLBACK_HEIGHT = 50;
// Bruges af addSectionHeading() i pdfHelpers (autotable-generatorer).
export const PDF_SECTION_HEADING_GAP = 3;

// Bruges af autotable-baserede generatorer (satserPdf, aarsloenPdf, shDagePdf m.fl.)
// og af resolvePdfSectionEndY. Writer-baserede generatorer bruger writer.addSpacer().
export const SECTION_SPACER = 10; // mm

// Standard linjeafstand for brødtekst i alle PDF'er
export const PDF_BASE_LINE_HEIGHT_MM = 4; // mm

// Afstand efter hver fritekst-linje (writeWrappedText, writeLeftRightText, writeUnderlinedLabel)
export const PDF_LINE_BOTTOM_SPACING_MM = 2; // mm

// Afstand over understreget label (writeUnderlinedLabel)
export const PDF_UNDERLINED_LABEL_TOP_SPACING_MM = 4; // mm

// Ekstra afstand under fed underoverskrift (writeSubheader)
export const PDF_SUBHEADER_BOTTOM_SPACING_MM = 1; // mm

// Afstand under dokumenttitel (writeTitle)
export const PDF_TITLE_BOTTOM_SPACING_MM = 15; // mm

// Brevhoved layout-konstanter
export const PDF_BREVHOVED_START_Y = 15; // mm fra øverste kant
export const PDF_BREVHOVED_LINE_HEIGHT = 5; // mm pr. linje
export const PDF_BREVHOVED_FONT_SIZE = 9; // pt

// Footer-konstanter
export const PDF_FOOTER_FONT_SIZE = 6; // pt
export const PDF_FOOTER_TEXT_COLOR: PdfColor = COLORS.footerText;
export const PDF_FOOTER_MARGIN_MM = 5; // mm fra sidens kant
