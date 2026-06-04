import { ImportedXmlComponent, Paragraph, type ParagraphChild } from 'docx';

// Diagonalt "UDKAST"-vandmærke til Word-dokumenter.
//
// `docx` har ingen indbygget vandmærke-API, så vi bygger det som rå VML inde i et
// `<w:pict>` — præcis samme konstruktion Microsoft Word selv genererer, når man
// indsætter et tekst-vandmærke (Design → Vandmærke → Brugerdefineret). Det gør
// outputtet bredt kompatibelt med Word og LibreOffice frem for en skrøbelig
// hjemmestrikket variant.
//
// Vandmærket lægges i sidens header, så det gentages på hver side og ligger bag
// brødteksten (`o:allowincell="t"` + `style="position:absolute"`). 100 % lokalt:
// ingen eksterne relationer, billeder eller fontlinks — kun ren VML-tekst.

const WATERMARK_FILL_COLOR = '#D9D9D9'; // lys grå, så teksten anes uden at sløre indholdet
const WATERMARK_ROTATION_DEG = 315; // -45°, diagonal nederst-venstre → øverst-højre
// Bredde/højde i points (1 pt = 1/72"). Dimensioneret til at spænde tværs over en
// A4-side uden at løbe ud over margenerne.
const WATERMARK_WIDTH_PT = 500;
const WATERMARK_HEIGHT_PT = 110;

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
    'z-index:-251654144',
    'mso-position-horizontal:center',
    'mso-position-horizontal-relative:margin',
    'mso-position-vertical:center',
    'mso-position-vertical-relative:margin',
  ].join(';');

  // shapetype #_x0000_t136 = VML "tekst-på-bane" (text-path), standard til vandmærker.
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
    `<v:shape id="UdkastVandmaerke" type="#_x0000_t136" style="${style}"`,
    ` fillcolor="${WATERMARK_FILL_COLOR}" stroked="f">`,
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
    children: [ImportedXmlComponent.fromXmlString(buildWatermarkPictXml(text)) as unknown as ParagraphChild],
  });
