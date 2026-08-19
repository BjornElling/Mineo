import type { DraftAdmission } from '../../components/inputs/draftAdmission';
import type { FieldCodecFamily } from '../fieldCodec';
import { normalizeClipboardText } from '../../utils/inputPasteNormalization';

type PasteCodec = Readonly<{
  family: FieldCodecFamily;
  normalizePaste?: (raw: string) => string;
  preservesLineBreaks?: boolean;
}>;

/**
 * Draftkonteksten, en paste skal normaliseres imod.
 *
 * **Hvad der afgør den.** Ikke om editoren er åben, men om paste'en efterlader noget af brugerens
 * eksisterende tekst. Erstatter den ALT – et lukket felt, eller en åben draft hvor markeringen dækker
 * hele teksten (Ctrl+A) – er der ingen kontekst at splice ind i, og feltets egen normalisering fra tom
 * draft er den rigtige. Efterlader den noget, skal teksten splices ind i det, der bliver stående.
 *
 * **Hvorfor helperen findes.** Konteksten blev før udtrykt som `ctl.isOpen ? ctl.displayText : ''` på
 * hvert kaldssted, altså kun på editorens tilstand. «Markér alt og indsæt» – den naturlige måde at
 * rette en dato på – faldt derfor i splice-grenen: samme tekst `010623` blev `01-06-2023` i et tomt
 * felt og `01` med rød ring i et udfyldt. Samme udklipsholder, samme håndbevægelse, to udfald
 * (BB-042), i strid med `input-field-behavior-contract.md` §1.2a punkt 7, som kræver, at et pastes
 * resultat er uafhængigt af, om feltet var tomt.
 *
 * Beslutningen bor her frem for i de to surfaces, fordi det ER én regel: to kaldssteder med hver sin
 * betingelse er præcis den drift, fundet bestod i.
 */
export const resolvePasteContextDraft = (
  isOpen: boolean,
  draft: string,
  selectionStart: number,
  selectionEnd: number
): string => {
  if (!isOpen) return '';
  const start = Math.max(0, Math.min(selectionStart, draft.length));
  const end = Math.max(start, Math.min(selectionEnd, draft.length));
  // Markeringen dækker hele draften ⇒ intet af brugerens tekst bliver stående ⇒ samme situation som
  // et lukket felt. En tom draft rammer også her, uanset markering.
  return start === 0 && end === draft.length ? '' : draft;
};

/**
 * Vælger paste-normalisering efter, om paste'en har en eksisterende tekst at splice ind i.
 *
 * En paste, der erstatter hele værdien, kan med fordel bruge feltets normalisering fra en tom draft
 * (fx `01012024` → `01-01-2024`). Bliver noget af teksten derimod stående, skal det indsatte splices
 * ind i den eksisterende kontekst; normalisering fra tom draft kan ellers fjerne et fortegn eller
 * flytte en separator, før det fælles admission-prædikat får lov at vurdere den faktiske kandidat.
 *
 * `existingDraft` skal komme fra {@link resolvePasteContextDraft}, som ejer afgørelsen af de to.
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
 * Indsættelse af paste-tekst i en ÅBEN draft – den ene implementering, formular- og grid-surfacen deler.
 *
 * **Hvorfor længden skal håndhæves her.** Feltets rå længdeloft er i dag udtrykt som `maxLength` på
 * `<input>`-elementet, og det virker kun for TASTNING: `onPaste` kalder `e.preventDefault()`, før den
 * selv skriver draften, så browseren aldrig får lov at anvende sit eget loft. Splicen kunne derfor
 * skubbe draften vilkårligt langt forbi den grænse, feltet erklærede – også når hvert enkelt tastetryk
 * ville være blevet afvist. Det er præcis det, `input-field-behavior-contract.md` §1.2a forbyder:
 * paste skal behandles som om brugeren havde tastet den indsatte tekst ét tegn ad gangen.
 *
 * Afkortningen er derfor det FORVENTEDE resultat og ikke et datatab (§1.2a): de samme tegn ville være
 * blevet afvist ved tastning. Den er tavs – der opstår ingen fejltilstand, fordi tegnene aldrig blev
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
  // allerede havde stående – og §1.2a forbyder, at paste ændrer en værdi inden for feltets grænser.
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
