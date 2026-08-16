import type { DraftAdmission } from '../../components/inputs/draftAdmission';
import type { FieldCodecFamily } from '../fieldCodec';
import { normalizeClipboardText } from '../../utils/inputPasteNormalization';

type PasteCodec = Readonly<{
  family: FieldCodecFamily;
  normalizePaste?: (raw: string) => string;
  preservesLineBreaks?: boolean;
}>;

/**
 * Vælger paste-normalisering efter editorens tilstand.
 *
 * En paste i et lukket felt erstatter hele værdien og kan derfor med fordel bruge feltets
 * normalisering fra en tom draft (fx `01012024` → `01-01-2024`). I en åben draft skal teksten
 * derimod splices ind i den eksisterende kontekst; normalisering fra tom draft kan ellers fjerne
 * et fortegn eller flytte en separator, før det fælles admission-prædikat får lov at vurdere den
 * faktiske kandidat.
 */
export const normalizePasteForDraft = (
  raw: string,
  codec: PasteCodec,
  existingDraft: string,
): string => {
  const genericNormalized = codec.family === 'text' || codec.family === 'optionalText'
    ? normalizeClipboardText(raw, { preservesLineBreaks: codec.preservesLineBreaks })
    : raw;
  return existingDraft === ''
    ? (codec.normalizePaste?.(genericNormalized) ?? genericNormalized)
    : genericNormalized;
};

/**
 * Indsættelse af paste-tekst i en ÅBEN draft — den ene implementering, formular- og grid-surfacen deler.
 *
 * **Hvorfor længden skal håndhæves her.** Feltets rå længdeloft er i dag udtrykt som `maxLength` på
 * `<input>`-elementet, og det virker kun for TASTNING: `onPaste` kalder `e.preventDefault()`, før den
 * selv skriver draften, så browseren aldrig får lov at anvende sit eget loft. Splicen kunne derfor
 * skubbe draften vilkårligt langt forbi den grænse, feltet erklærede — også når hvert enkelt tastetryk
 * ville være blevet afvist. Det er præcis det, `input-field-behavior-contract.md` §1.2a forbyder:
 * paste skal behandles som om brugeren havde tastet den indsatte tekst ét tegn ad gangen.
 *
 * Afkortningen er derfor det FORVENTEDE resultat og ikke et datatab (§1.2a): de samme tegn ville være
 * blevet afvist ved tastning. Den er tavs — der opstår ingen fejltilstand, fordi tegnene aldrig blev
 * en del af værdien.
 */
export const spliceDraftWithPaste = (
  draft: string,
  pasted: string,
  selectionStart: number,
  selectionEnd: number,
  maxLength?: number,
  admission?: DraftAdmission
): Readonly<{ draft: string; caret: number; acceptedLength: number }> => {
  const start = Math.max(0, Math.min(selectionStart, draft.length));
  const end = Math.max(start, Math.min(selectionEnd, draft.length));
  const prefix = draft.slice(0, start);
  const suffix = draft.slice(end);

  if (admission === undefined && (typeof maxLength !== 'number' || !Number.isFinite(maxLength) || maxLength <= 0)) {
    return Object.freeze({ draft: prefix + pasted + suffix, caret: start + pasted.length, acceptedLength: pasted.length });
  }

  // Præfiks og suffiks er brugerens EGEN eksisterende værdi og afkortes ikke: kun det indsatte
  // beskæres til den plads, der faktisk er tilbage. Ellers kunne et paste slette tegn, brugeren
  // allerede havde stående — og §1.2a forbyder, at paste ændrer en værdi inden for feltets grænser.
  let accepted = '';
  for (const character of pasted) {
    const candidate = prefix + accepted + character + suffix;
    if (
      typeof maxLength === 'number'
      && Number.isFinite(maxLength)
      && maxLength > 0
      && candidate.length > maxLength
    ) {
      continue;
    }
    if (admission !== undefined && !admission(candidate)) continue;
    accepted += character;
  }
  return Object.freeze({ draft: prefix + accepted + suffix, caret: start + accepted.length, acceptedLength: accepted.length });
};
