import type { LoenindkomstAnsaettelsesforhold } from '../../../schemas/formSchemas';

/**
 * ÉN sandhed for "har dette ansættelsesforhold en aktiv overenskomst, og hvilken?".
 *
 * BAGGRUND: overenskomsten er repræsenteret ved TO felter – togglen `harOverenskomst` og
 * `overenskomstId`. Fordi hver forbruger selv kombinerede dem (`af.harOverenskomst &&
 * af.overenskomstId?.trim()`), kunne kombinationen staves forskelligt de steder, den blev læst,
 * og den modstridende tilstand «id sat, toggle slået fra» var usynlig: satsopslaget faldt
 * tilbage til UNLOCKED, så en overenskomstbunden SH/SO- og pensionssats simpelthen ikke blev
 * udledt – uden fejl, uden advarsel, og med et snapshot der meldte `ok`.
 *
 * Reglen er nu udtrykt ét sted: overenskomsten er aktiv, når togglen er slået til OG der er
 * valgt et ikke-tomt id. Alle forbrugere – satsopslag, SFGG-kilde, validator, dokumenter –
 * skal spørge her i stedet for at spejle prædikatet i hånden.
 *
 * Returtypen er bevidst diskrimineret: `aktiv: true` GARANTERER et trimmet, ikke-tomt
 * `overenskomstId`, så callsites ikke behøver et tillidsbaseret `!`-opslag bagefter.
 */
export type AktivOverenskomst =
  | Readonly<{ aktiv: true; overenskomstId: string }>
  | Readonly<{ aktiv: false; overenskomstId: undefined }>;

const INAKTIV: AktivOverenskomst = { aktiv: false, overenskomstId: undefined };

export const resolveAktivOverenskomst = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId'>
): AktivOverenskomst => {
  if (!af.harOverenskomst) return INAKTIV;
  const overenskomstId = af.overenskomstId?.trim();
  if (!overenskomstId) return INAKTIV;
  return { aktiv: true, overenskomstId };
};

/** Kortform, når kun ja/nej er interessant. */
export const harAktivOverenskomst = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId'>
): boolean => resolveAktivOverenskomst(af).aktiv;

/**
 * Er de to felter i indbyrdes modstrid? Sandt netop når et overenskomst-id er valgt, mens
 * togglen er slået fra. Tilstanden er ikke i sig selv ulovlig at persistere – brugeren kan slå
 * togglen fra uden at miste sit valg – men den må aldrig føde en beregning ubemærket, og
 * validatoren gør den derfor synlig, når reguleringsformen er "Overenskomst".
 */
export const harModstridendeOverenskomstValg = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId'>
): boolean => !af.harOverenskomst && Boolean(af.overenskomstId?.trim());
