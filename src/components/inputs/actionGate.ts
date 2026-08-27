/**
 * Den delte grammatik for en DEAKTIVERET HANDLING – programmets ene svar på «hvorfor er knappen grå?».
 *
 * **Hvorfor modulet findes.** Reglen fandtes i forvejen, men kun for ÉN knaptype: de deaktiverede
 * downloadknapper (`page-component-contract.md` §11.1). Den regel siger tre ting på én gang:
 *
 *  1. Knappen forsvinder ikke – den bliver stående som nedtonet og inaktiv.
 *  2. Årsagen har ÉN visningskanal: tooltippet, og kun ved hover.
 *  3. Et klik på en inaktiv knap er TAVST. Ingen besked, ingen tekstknude, intet visuelt svar.
 *
 * Udviklerbeslutning 2026-08-15: den regel er ikke download-specifik. Den er programmets mønster for
 * ENHVER grå knap, og en grå knap må derfor gerne nøjes med en generisk årsag frem for en
 * håndskrevet, handlingsanvisende sætning pr. knap. Det er en bevidst afvejning: forudsigelighed
 * (alle grå knapper svarer ens) over handlingsanvisning (hver knap forklarer sit eget særtilfælde).
 *
 * **Hvorfor teksterne genbruges frem for at blive opfundet.** `DOWNLOAD_BLOCKED_*`-konstanterne i
 * `document/layout/documentGateTypes.ts` bærer allerede præcis de to klasser, en almindelig knap har
 * brug for, og de er brugertestet ordlyd. En parallel konstant med samme betydning ville være to
 * sandheder om ét begreb – netop den drift, dette modul findes for at undgå. Modulet re-eksporterer
 * dem derfor under handlings-neutrale navne i stedet for at kopiere strengene.
 *
 * **Afgrænsning.** Dokument-download har sin egen rigere gate (`DocumentDownloadGateReason` med fire
 * klasser, herunder `page-errors` og ordret citerede `specific`-årsager). Den er IKKE erstattet af
 * dette modul; den er den mest udbyggede forbruger af samme idé. Dette modul dækker den simple
 * knap, der ikke har en dokumentgate bag sig – hjælpeknapper som «Indsæt» og handlingsknapper med
 * en maksimumgrænse.
 */
import {
  DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE,
  DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE,
} from '../../document/layout/documentGateTypes';

/**
 * Hvorfor en handling er spærret. Bevidst de SAMME to klasser, downloadgaten skelner mellem
 * (`missing-input` / `invalid-input`) – brugerkravet 2026-07-30: «der mangler noget» og «noget er
 * forkert» sender brugeren to forskellige steder hen.
 *
 * `limit` er den tredje klasse, en almindelig knap har brug for, og som en downloadgate ikke kender:
 * handlingen er umulig, fordi en grænse er nået (fx 10 ansættelsesforhold). Den er hverken et
 * manglende eller et ugyldigt input – brugeren har ikke gjort noget forkert, og der er intet felt at
 * rette. Derfor bærer den sin egen, konkrete tekst.
 */
export type ActionBlockedReason =
  | Readonly<{ kind: 'missing-input' }>
  | Readonly<{ kind: 'invalid-input' }>
  /** Grænsen er nået. `message` ER brugerteksten og skal navngive grænsen konkret. */
  | Readonly<{ kind: 'limit'; message: string }>;

/**
 * Den universelle tekst for «du mangler at indtaste noget». Samme streng som den deaktiverede
 * downloadknap viser, så to grå knapper ved siden af hinanden ikke taler hver sit sprog.
 */
export const ACTION_BLOCKED_MISSING_INPUT_MESSAGE = DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE;

/**
 * Den universelle tekst for «der er indtastet noget ugyldigt». Deler ordlyd med feltets eget
 * generiske tooltip (`FIELD_ISSUE_GENERIC_TOOLTIP`), så knappen og det felt, brugeren skal rette,
 * siger det samme.
 */
export const ACTION_BLOCKED_INVALID_INPUT_MESSAGE = DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE;

/**
 * Det ENE sted, en blokeringsårsag bliver til tooltiptekst.
 *
 * Ligger her og ikke i den enkelte knap af samme grund som `resolveDocumentGateTooltip`: valget er en
 * egenskab ved ÅRSAGEN, ikke ved den flade der tegner knappen. Vælger hver flade selv, er «universel
 * tekst» en konvention uden håndhævelse.
 */
export const resolveActionBlockedTooltip = (reason: ActionBlockedReason): string => {
  switch (reason.kind) {
    case 'missing-input':
      return ACTION_BLOCKED_MISSING_INPUT_MESSAGE;
    case 'invalid-input':
      return ACTION_BLOCKED_INVALID_INPUT_MESSAGE;
    case 'limit':
      return reason.message;
  }
};

/**
 * Vælger den årsag, brugeren skal læse, når flere gælder samtidig.
 *
 * Samme forrang som dokumentgatens (`documentGateTypes.ts`): `invalid-input` slår `missing-input`,
 * fordi noget FORKERT er mere akut end noget uudfyldt – det tomme felt udfyldes ofte i samme
 * arbejdsgang, mens en afvist værdi kræver, at brugeren opsøger og retter den.
 *
 * `limit` står først: er grænsen nået, er der ingen indtastning at rette, og en tekst om manglende
 * eller ugyldigt input ville sende brugeren efter et felt, der ikke findes.
 */
export const resolveActionBlockedReason = (
  reasons: readonly ActionBlockedReason[]
): ActionBlockedReason | undefined => {
  if (reasons.length === 0) return undefined;
  return reasons.find((reason) => reason.kind === 'limit')
    ?? reasons.find((reason) => reason.kind === 'invalid-input')
    ?? reasons.find((reason) => reason.kind === 'missing-input');
};

/**
 * Knappens samlede tilstand, udledt ét sted. En flade kalder denne frem for selv at parre et
 * `disabled`-flag med en tooltip-streng; dermed kan de to ikke komme ud af trit – fx en knap der er
 * grå uden årsag, eller en årsag der bliver hængende, efter blokeringen er væk.
 */
export type ActionGateState = Readonly<{
  disabled: boolean;
  /** Tooltip-teksten. `undefined` når handlingen er mulig, så fladen kan vise sin normale tooltip. */
  disabledReason: string | undefined;
}>;

export const resolveActionGate = (reasons: readonly ActionBlockedReason[]): ActionGateState => {
  const reason = resolveActionBlockedReason(reasons);
  return reason === undefined
    ? { disabled: false, disabledReason: undefined }
    : { disabled: true, disabledReason: resolveActionBlockedTooltip(reason) };
};
