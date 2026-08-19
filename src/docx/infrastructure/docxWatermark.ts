import { ImportedXmlComponent, Paragraph, type ParagraphChild } from 'docx';

// `ImportedXmlComponent.fromXmlString` parser fragmentet med xml-js og pakker
// resultatet i et rod-element UDEN navn (xml-js' dokument-rod har ingen `name`).
// docx serialiserer derfor wrapperen som <undefined>…</undefined>, hvilket er
// ugyldig WordprocessingML – Word afviser/reparerer filen (LibreOffice er mere
// tolerant). Vi henter derfor det reelle (navngivne) barn ud af wrapperen, så
// fragmentet indsættes direkte som fx <w:r>…</w:r> uden <undefined>-wrapper.
//
// `.rootKey`/`.root` er interne docx-felter; værn-testen i docxWriter.test.ts
// fanger det, hvis fremtidige docx-versioner ændrer denne struktur.
const importXmlFragmentChild = (xml: string): ParagraphChild => {
  const wrapper = ImportedXmlComponent.fromXmlString(xml) as unknown as {
    rootKey?: string;
    root?: readonly unknown[];
  };
  const child = wrapper.root?.[0];
  // Forventet tilfælde: navnløs wrapper med præcis ét navngivet barn (vores <w:r>).
  if (wrapper.rootKey === undefined && wrapper.root?.length === 1 && child) {
    return child as ParagraphChild;
  }
  // Hvis docx en dag returnerer et korrekt navngivet rod-element, bruger vi det
  // direkte (fail-open mod en fremtidig API-rettelse), men aldrig en undefined-rod.
  if (wrapper.rootKey !== undefined) {
    return wrapper as unknown as ParagraphChild;
  }
  throw new Error('CRITICAL: VML-vandmærkets XML kunne ikke importeres uden undefined-wrapper');
};

// Diagonalt "UDKAST"-vandmærke til Word-dokumenter.
//
// `docx` har ingen indbygget vandmærke-API, så vi bygger det som rå VML inde i et
// `<w:pict>` – præcis samme konstruktion Microsoft Word selv genererer, når man
// indsætter et tekst-vandmærke (Design → Vandmærke → Brugerdefineret). Det gør
// outputtet bredt kompatibelt med Word og LibreOffice frem for en skrøbelig
// hjemmestrikket variant.
//
// Vandmærket lægges i sidens header, så det gentages på hver side og ligger bag
// brødteksten (`o:allowincell="t"` + `style="position:absolute"`). 100 % lokalt:
// ingen eksterne relationer, billeder eller fontlinks – kun ren VML-tekst.

// Word's eget tekst-vandmærke (Design → Vandmærke → Brugerdefineret) genereres som en
// VML text-path-figur i et <w:pict>. Vi gengiver Words native output 1:1, så vandmærket
// renderes pænt og ufordrejet i Word (og bredt kompatibelt i LibreOffice):
//   - fillcolor="silver" + <v:fill opacity=".5"/> (samme halvgennemsigtige grå som Word)
//   - størrelses-forhold ~2,5:1 (bredde:højde) som Words standard – et for bredt forhold
//     (tidligere 4,5:1) strakte teksten tynd og forvrænget
//   - o:allowincell="f", rotation 315° og margin-centrering, præcis som Words native shape
const WATERMARK_FILL_COLOR = 'silver';
const WATERMARK_FILL_OPACITY = '.5';
const WATERMARK_ROTATION_DEG = 315; // -45°, diagonal nederst-venstre → øverst-højre
// Bredde/højde i points (1 pt = 1/72"). Forhold ~2,5:1 som Words native vandmærke, så
// teksten fylder figuren proportionalt uden at blive strakt.
const WATERMARK_WIDTH_PT = 415.3;
const WATERMARK_HEIGHT_PT = 166.1;

const escapeXmlAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const buildWatermarkPictXml = (text: string): string => {
  const safeText = escapeXmlAttr(text);
  const style = [
    'position:absolute',
    'margin-left:0',
    'margin-top:0',
    `width:${WATERMARK_WIDTH_PT}pt`,
    `height:${WATERMARK_HEIGHT_PT}pt`,
    `rotation:${WATERMARK_ROTATION_DEG}`,
    'z-index:-251656192',
    'mso-position-horizontal:center',
    'mso-position-horizontal-relative:margin',
    'mso-position-vertical:center',
    'mso-position-vertical-relative:margin',
  ].join(';');

  // shapetype #_x0000_t136 = VML "tekst-på-bane" (text-path), standard til vandmærker.
  // textpath uden fitshape: teksten følger figurens størrelsesforhold som Words native.
  return [
    '<w:r>',
    '<w:pict>',
    '<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800"',
    ' path="m@7,l@8,m@5,21600l@6,21600e">',
    '<v:formulas>',
    '<v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/>',
    '<v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/>',
    '<v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/>',
    '<v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/>',
    '<v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/>',
    '</v:formulas>',
    '<v:path textpathok="t" o:connecttype="custom"',
    ' o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/>',
    '<v:textpath on="t" fitshape="t"/>',
    '</v:shapetype>',
    `<v:shape id="PowerPlusWaterMarkObject" o:spid="_x0000_s2049" type="#_x0000_t136" style="${style}"`,
    ` o:allowincell="f" fillcolor="${WATERMARK_FILL_COLOR}" stroked="f">`,
    `<v:fill opacity="${WATERMARK_FILL_OPACITY}"/>`,
    `<v:textpath style="font-family:&quot;Calibri&quot;;font-size:1pt" string="${safeText}"/>`,
    '</v:shape>',
    '</w:pict>',
    '</w:r>',
  ].join('');
};

/**
 * Bygger et tomt afsnit, der bærer det diagonale "UDKAST"-vandmærke. Afsnittet
 * placeres i sidens header, så vandmærket gentages på hver side.
 */
export const createUdkastWatermarkParagraph = (text = 'UDKAST'): Paragraph =>
  new Paragraph({
    children: [importXmlFragmentChild(buildWatermarkPictXml(text))],
  });
