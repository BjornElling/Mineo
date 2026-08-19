import { AlignmentType, LineRuleType, XmlAttributeComponent, XmlComponent, type IStylesOptions } from 'docx';

/**
 * Centralt typografi-modul for Word-output (.docx).
 *
 * ENESTE sted hvor Word-dokumenternes udseende defineres. Generatoren
 * (`docxWriter.ts`) må IKKE sætte inline font/størrelse/spacing på de enkelte
 * afsnit og runs – den refererer udelukkende til de navngivne typografier herfra
 * via `DOCX_STYLE`. Det betyder:
 *
 *  1. Al tekst arver et navngivet Word-typografi (Normal, Overskrift osv.), så
 *     dokumentet kan redigeres centralt i Word og slå igennem overalt.
 *  2. Enhver fremtidig justering af udseendet sker HER (eller i Words egne
 *     typografi-definitioner) – bevidst, ét sted, aldrig spredt inline i koden.
 *
 * Enheder (OOXML-konvention):
 *  - `run.size`            : halve points (22 = 11 pt)
 *  - `run.font`            : skrifttype-navn
 *  - `paragraph.spacing.*` : tyvendedele af et point / dxa (120 = 6 pt)
 *
 * Hurtigtypografi-galleriet (båndets typografi-felter): styres via `quickFormat`
 * + `uiPriority` på de typografier der SKAL vises, og `semiHidden` på dem der ikke
 * skal. For at galleriet ikke også fyldes med Words indbyggede latente typografier
 * (Stærk, Citat, Overskrift 4-9 osv.) injicerer vi et `<w:latentStyles>`-element der
 * som udgangspunkt skjuler og fjerner qFormat fra alle latente typografier (se
 * `buildDocxStyles`). Derfor bygger vi IKKE typografierne via `default.document`,
 * som ellers ville trække Words fulde fabriks-typografisæt med ind.
 */

export const DOCX_FONT = 'Calibri';

/** Basis-skriftstørrelse i halve points (11 pt brødtekst). */
const BODY_SIZE = 22;
/** Mindste linjeafstand i dxa (14 pt). */
const MIN_LINE_SPACING_DXA = 280;
const MIN_LINE_SPACING = { line: MIN_LINE_SPACING_DXA, lineRule: LineRuleType.AT_LEAST } as const;
const NORMAL_PARAGRAPH_AFTER_DXA = 40; // 2 pt

/**
 * Rækkefølge i hurtigtypografi-galleriet. Lavere `uiPriority` står først. Kun
 * disse typografier får `quickFormat` og indgår dermed i galleriet – i præcis
 * denne rækkefølge. Word oversætter de indbyggede navne til dansk (Normal →
 * "Normal", Title → "Titel", Heading 1 → "Overskrift 1", No Spacing →
 * "Ingen linjeafstand").
 */
const GALLERY_UI_PRIORITY = {
  normal: 0,
  title: 1,
  heading1: 2,
  heading2: 3,
  heading3: 4,
  noSpacing: 5,
} as const;

/**
 * Navngivne typografi-id'er. Generatoren refererer KUN til disse – aldrig til
 * rå font/størrelse/spacing-værdier.
 */
export const DOCX_STYLE = {
  /** Brødtekst – Words indbyggede "Normal". Alt andet er baseret på denne. */
  normal: 'Normal',
  /** Dokumenttitel (øverst). */
  title: 'Title',
  /** Sektionsoverskrift (Overskrift 1). */
  sectionHeader: 'Heading1',
  /** Fed PDF-underoverskrift – Word-typografien "Overskrift 2". */
  subheaderBold: 'Heading2',
  /** Understreget PDF-underoverskrift – Word-typografien "Overskrift 3". */
  subheaderUnderlined: 'Heading3',
  /** Datatabel – Words indbyggede "Table Paragraph". */
  tableCell: 'TableParagraph',
  /** Kantfri layout-tabel og tomme afstands-afsnit – Words indbyggede "No Spacing". */
  noSpacing: 'NoSpacing',
  /** Sidefod – Words indbyggede "Footer". */
  footer: 'Footer',
  /** Brevhoved – Words indbyggede "Header". */
  header: 'Header',
} as const;

export type DocxStyleId = (typeof DOCX_STYLE)[keyof typeof DOCX_STYLE];

// Rå OOXML-element-builder. docDefaults og latentStyles findes ikke som typede
// docx-byggeklodser, og `ImportedXmlComponent.fromXmlString` er upålidelig (kræver
// en runtime-XML-parser og indpakker indholdet i et ugyldigt <undefined>-element).
// Vi bygger derfor elementerne direkte oven på docx' egne XmlComponent-primitiver.
type RawXmlAttributeMap = Readonly<Record<string, string>>;

// Attributnøglerne er allerede de fulde OOXML-navne (fx `w:val`), så `xmlKeys`
// mapper hver nøgle 1:1 til sig selv, og attributterne serialiseres uændret.
class RawXmlAttributes extends XmlAttributeComponent<RawXmlAttributeMap> {
  protected readonly xmlKeys: Readonly<Record<string, string>>;
  constructor(attributes: RawXmlAttributeMap) {
    super(attributes);
    this.xmlKeys = Object.fromEntries(Object.keys(attributes).map((key) => [key, key]));
  }
}

class RawXmlElement extends XmlComponent {
  constructor(
    name: string,
    attributes: RawXmlAttributeMap | null,
    children: readonly XmlComponent[] = []
  ) {
    super(name);
    if (attributes && Object.keys(attributes).length > 0) {
      this.root.push(new RawXmlAttributes(attributes));
    }
    for (const child of children) {
      this.root.push(child);
    }
  }
}

const rawXmlElement = (
  name: string,
  attributes: RawXmlAttributeMap | null,
  children: readonly XmlComponent[] = []
): XmlComponent => new RawXmlElement(name, attributes, children);

// Dokumentets standard-formatering (docDefaults). Matcher den tidligere
// `default.document`, men bygges som rå OOXML, så vi IKKE udløser Words
// fabriks-typografisæt (DefaultStylesFactory), der ellers ville fylde
// hurtigtypografi-galleriet med uønskede indbyggede typografier.
const buildDocDefaults = (): XmlComponent =>
  rawXmlElement('w:docDefaults', null, [
    rawXmlElement('w:rPrDefault', null, [
      rawXmlElement('w:rPr', null, [
        rawXmlElement('w:rFonts', { 'w:ascii': DOCX_FONT, 'w:hAnsi': DOCX_FONT, 'w:cs': DOCX_FONT }),
        rawXmlElement('w:sz', { 'w:val': String(BODY_SIZE) }),
      ]),
    ]),
    rawXmlElement('w:pPrDefault', null, [
      rawXmlElement('w:pPr', null, [
        rawXmlElement('w:spacing', { 'w:after': String(NORMAL_PARAGRAPH_AFTER_DXA), 'w:line': String(MIN_LINE_SPACING_DXA), 'w:lineRule': 'atLeast' }),
      ]),
    ]),
  ]);

// Latente typografier: gør alle Words indbyggede latente typografier semiHidden
// uden qFormat, så de ikke dukker op i hurtigtypografi-galleriet. Kun de
// typografier vi eksplicit markerer med `quickFormat` nedenfor vises i galleriet.
const buildLatentStyles = (): XmlComponent =>
  rawXmlElement('w:latentStyles', {
    'w:defLockedState': '0',
    'w:defUIPriority': '99',
    'w:defSemiHidden': '1',
    'w:defUnhideWhenUsed': '1',
    'w:defQFormat': '0',
    'w:count': '0',
  });

/**
 * Bygger dokumentets typografi-definitioner. docDefaults (basisfont/-størrelse/
 * -afstand) og latentStyles injiceres som rå OOXML via `importedStyles`, og hver
 * navngiven typografi defineres eksplicit via `paragraphStyles` (`basedOn: Normal`,
 * overskriver kun det der adskiller den). Vi bruger bevidst IKKE `default.document`,
 * da det ville trække Words fulde fabriks-typografisæt med ind i galleriet.
 *
 * Galleri-typografierne (Normal, Titel, Overskrift 1-3, Ingen linjeafstand) får
 * `quickFormat` + stigende `uiPriority` (rækkefølgen i galleriet). De rent
 * tekniske typografier (tabelceller, sidefod, brevhoved) markeres `semiHidden`
 * uden `quickFormat`, så de er fuldt brugbare men ikke fylder galleriet.
 */
export const buildDocxStyles = (): IStylesOptions => ({
  importedStyles: [buildDocDefaults(), buildLatentStyles()],
  paragraphStyles: [
    {
      id: DOCX_STYLE.normal,
      name: 'Normal',
      quickFormat: true,
      uiPriority: GALLERY_UI_PRIORITY.normal,
      run: { font: DOCX_FONT, size: BODY_SIZE },
      paragraph: { spacing: { after: NORMAL_PARAGRAPH_AFTER_DXA, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.title,
      name: 'Title',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.normal,
      quickFormat: true,
      uiPriority: GALLERY_UI_PRIORITY.title,
      run: { bold: true, size: 36 },
      paragraph: { spacing: { before: 480, after: 120, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.sectionHeader,
      name: 'Heading 1',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.normal,
      quickFormat: true,
      uiPriority: GALLERY_UI_PRIORITY.heading1,
      run: { bold: true, size: 28 },
      // Outline-niveau 0 = Overskrift 1 (giver korrekt navigation/dispositionsvisning i Word).
      // keepNext ("Hold sammen med næste") holder overskriften på samme side som det
      // efterfølgende indhold, så en overskrift aldrig står alene nederst på en side.
      paragraph: { outlineLevel: 0, keepNext: true, spacing: { before: 480, after: 240, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.subheaderBold,
      name: 'Heading 2',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.normal,
      quickFormat: true,
      uiPriority: GALLERY_UI_PRIORITY.heading2,
      run: { font: DOCX_FONT, size: BODY_SIZE, bold: true },
      paragraph: { outlineLevel: 1, keepNext: true, spacing: { before: 240, after: 120, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.subheaderUnderlined,
      name: 'Heading 3',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.normal,
      quickFormat: true,
      uiPriority: GALLERY_UI_PRIORITY.heading3,
      run: { font: DOCX_FONT, size: BODY_SIZE, underline: {} },
      paragraph: { outlineLevel: 2, keepNext: true, spacing: { before: 240, after: 120, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.noSpacing,
      name: 'No Spacing',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.noSpacing,
      quickFormat: true,
      uiPriority: GALLERY_UI_PRIORITY.noSpacing,
      run: { font: DOCX_FONT, size: BODY_SIZE },
      paragraph: { spacing: { after: 0, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.tableCell,
      name: 'Table Paragraph',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.tableCell,
      // Teknisk typografi: brugbar, men holdes ude af hurtigtypografi-galleriet.
      semiHidden: true,
      unhideWhenUsed: false,
      run: { font: DOCX_FONT, size: 16 },
      paragraph: { spacing: { after: 0, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.footer,
      name: 'Footer',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.footer,
      semiHidden: true,
      unhideWhenUsed: false,
      run: { font: DOCX_FONT, size: 16 },
      paragraph: { alignment: AlignmentType.RIGHT, spacing: { after: 0, ...MIN_LINE_SPACING } },
    },
    {
      id: DOCX_STYLE.header,
      name: 'Header',
      basedOn: DOCX_STYLE.normal,
      next: DOCX_STYLE.header,
      semiHidden: true,
      unhideWhenUsed: false,
      run: { font: DOCX_FONT, size: 20 },
      paragraph: { alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0, ...MIN_LINE_SPACING } },
    },
  ],
});
