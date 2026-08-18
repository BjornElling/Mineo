/**
 * Identiteten på Mineos E2E-buildserver. Delt af serveren selv (`serve-e2e-builds.mjs`) og af
 * oprydningen (`free-e2e-port.mjs`), så de to aldrig kan komme til at spørge og svare forskelligt.
 */

/** Stien serveren svarer på. Bevidst usandsynlig som app-route, så den aldrig skygger for en side. */
export const IDENTITY_PATH = '/__mineo-e2e-server';

/** Markøren i svaret. Kun en proces, der siger præcis dette, må ryddes op automatisk. */
export const SERVER_IDENTITY = 'mineo-e2e-builds';
