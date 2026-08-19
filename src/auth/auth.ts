import {
  AUTH_STORAGE_KEY,
  AUTH_STORAGE_VALUE,
  SHARED_PASSWORD_HASHES,
} from './authConfig';
import { getPersistentLocalStorage } from '../utils/safeLocalStorage';

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

// SHA-256 hex output er altid 64 tegn – length-tjekket er en invariant, ikke et timing-leak.
const hexEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
};

const hashPassword = async (password: string): Promise<string> => {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new Error('Denne browser understøtter ikke adgangskontrol.');
  }

  // Adgangskoder er case-neutrale OG blanktegns-neutrale i enderne: config-hashes er beregnet på
  // lowercased plaintext uden foran- og bagvedstående blanktegn.
  //
  // Trimmet hører PRÆCIS her, hvor case-neutraliseringen allerede bor, fordi det er det ene sted, der
  // afgør hvad adgangskoden ER. Login-siden trimmede i forvejen i sit «har du skrevet noget»-tjek, men
  // ikke i verifikationen; de to led var altså uenige om samme beslutning. Konsekvensen var, at en
  // adgangskode kopieret fra mailen – hvor markeringen næsten altid tager det afsluttende mellemrum
  // eller linjeskift med – blev afvist som «Forkert adgangskode», mens feltet viste prikker, så der var
  // intet at se. Brugeren kom slet ikke ind, og beskeden pegede ham i den forkerte retning.
  //
  // Der gives intet væk: en adgangskode kan ikke meningsfuldt begynde eller slutte med blanktegn, og
  // ingen af de aktive hashes i `authConfig.ts` er beregnet på en plaintext med sådanne ender.
  const encoded = new TextEncoder().encode(password.trim().toLocaleLowerCase('da-DK'));
  const digest = await cryptoObj.subtle.digest('SHA-256', encoded);
  return toHex(new Uint8Array(digest));
};

export const isAuthenticated = (): boolean => {
  const storage = getPersistentLocalStorage();
  if (!storage) return false;

  try {
    // localStorage-flagget er kun en svag UX-gate, ikke en sikkerhedsmekanisme.
    return storage.getItem(AUTH_STORAGE_KEY) === AUTH_STORAGE_VALUE;
  } catch {
    // Et ulæseligt bekvemmelighedsflag må aldrig åbne gaten eller vælte renderingen.
    return false;
  }
};

/**
 * Fejlen, når login-flaget ikke kan gemmes, fordi browseren blokerer for lagring.
 *
 * En egen klasse frem for en bar `Error`, fordi de to måder, et login kan mislykkes teknisk på, har
 * modsatte udfald for brugeren: DENNE kan han selv rette på et minut (tillad websitedata for
 * webstedet), mens et manglende `crypto.subtle` er uafhjælpeligt. `LoginPage` viste den samme
 * generiske sætning for begge, så beskeden kunne ikke handles på – og login er det ene sted, hvor en
 * fejl er en total blindgyde. Typen er det, der lader login-siden skelne dem uden at læse tekst.
 */
export class AuthStorageUnavailableError extends Error {
  constructor() {
    super(
      'Mineo kunne ikke gemme din login-status. Browseren blokerer for lagring på dette websted – '
      + 'tillad websitedata for minEO.dk og prøv igen.'
    );
    this.name = 'AuthStorageUnavailableError';
  }
}

export const setAuthenticated = (): void => {
  const storage = getPersistentLocalStorage();
  if (!storage) {
    throw new AuthStorageUnavailableError();
  }

  try {
    storage.setItem(AUTH_STORAGE_KEY, AUTH_STORAGE_VALUE);
    // Nogle storage-implementeringer kan ignorere en skrivning uden at kaste. Read-back gør
    // loginets persistenskrav observerbart og holder gaten fail-closed også i det tilfælde.
    if (storage.getItem(AUTH_STORAGE_KEY) !== AUTH_STORAGE_VALUE) {
      throw new AuthStorageUnavailableError();
    }
  } catch {
    throw new AuthStorageUnavailableError();
  }
};

export const verifySharedPassword = async (password: string): Promise<boolean> => {
  const passwordHash = await hashPassword(password);
  return SHARED_PASSWORD_HASHES.some((entry) => hexEqual(passwordHash, entry.hash.toLowerCase()));
};
