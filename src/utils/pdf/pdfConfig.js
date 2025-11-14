/**
 * PDF Configuration og fælles styling
 *
 * Central konfiguration for alle PDF-dokumenter i MINEO
 */

// Farver
export const COLORS = {
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

// Fonte
export const FONTS = {
  regular: 'Ubuntu-Regular',
  bold: 'Ubuntu-Bold',
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
