/**
 * PDF Configuration og fælles styling
 *
 * Central konfiguration for alle PDF-dokumenter i Mineo
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
  cellPadding: 1.5,
  headerBackgroundColor: COLORS.lightBackground,
  alternateRowBackgroundColor: COLORS.lightBackground,
};

// Fælles detail-konstanter for ensartet PDF-udtryk
export const PDF_MUTED_TEXT_COLOR: PdfColor = COLORS.muted;
export const PDF_TABLE_NARROW_COLUMN_WIDTH = 25;
// Fælles minimumsbredde for højrekolonnen i beløbsopstillinger (label/værdi-linjer + sum-streger)
// på tværs af EO-opgørelse, EO-bilag og TAF-dokumenterne, så beløbskolonnen flugter ens.
export const PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM = 33.125;
export const PDF_TABLE_TOTAL_VALUE_LINE_WIDTH_MM = 22;
export const PDF_TABLE_TOTAL_VALUE_LINE_WIDTH_PT = 0.2;
export const PDF_FINAL_Y_FALLBACK_HEIGHT = 50;
// Bruges af addSectionHeading() i pdfHelpers (autotable-generatorer).
export const PDF_SECTION_HEADING_GAP = 3;

// Bruges af autotable-baserede generatorer (satserPdf, aarsloenPdf, shDagePdf m.fl.)
// og er standard-spacer i resolveDocumentSectionEndY. Writer-baserede generatorer bruger writer.addSpacer().
export const SECTION_SPACER = 10; // mm

// Standard linjeafstand for brødtekst i alle PDF'er
export const PDF_BASE_LINE_HEIGHT_MM = 4.2; // mm

// Afstand efter hver fritekst-linje (writeWrappedText, writeLeftRightText, writeUnderlinedSubheader)
export const PDF_LINE_BOTTOM_SPACING_MM = 1.3; // mm

// Ekstra afstand under fed underoverskrift (writeBoldSubheader)
export const PDF_SUBHEADER_BOTTOM_SPACING_MM = 1; // mm

// Afstand over sektionsoverskrift (writeSectionHeader), fx "Svie- og smertegodtgørelse"
export const PDF_SECTION_HEADER_TOP_SPACING_MM = 9; // mm

// Afstand under sektionsoverskrift (writeSectionHeader), fx "Svie- og smertegodtgørelse"
export const PDF_SECTION_HEADER_BOTTOM_SPACING_MM = 5; // mm

// Afstand over fed underoverskrift (writeBoldSubheader), fx "Status" / "Beregnet krav på …"
export const PDF_SUBHEADER_TOP_SPACING_MM = 5; // mm

// Afstand under dokumenttitel (writeTitle)
export const PDF_TITLE_BOTTOM_SPACING_MM = 12; // mm

// Brevhoved layout-konstanter
export const PDF_BREVHOVED_START_Y = 15; // mm fra øverste kant
export const PDF_BREVHOVED_LINE_HEIGHT = 5; // mm pr. linje
export const PDF_BREVHOVED_FONT_SIZE = 9; // pt

// Footer-konstanter
export const PDF_FOOTER_FONT_SIZE = 6; // pt
export const PDF_FOOTER_TEXT_COLOR: PdfColor = COLORS.footerText;
export const PDF_FOOTER_MARGIN_MM = 5; // mm fra sidens bund
// Versionsmærket er et smalt, roteret billede. Horisontalt forankres det helt mod
// højre kant, så billedets venstre/startkant ligger cirka 5 mm fra sidekanten.
export const PDF_FOOTER_RIGHT_MARGIN_MM = 0;
