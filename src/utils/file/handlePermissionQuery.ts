/**
 * Tidsbegrænset `queryPermission` på et File System Access-handle.
 *
 * `queryPermission` er en ren tilstandsforespørgsel uden brugerdialog og svarer normalt med det
 * samme. Edge er dog set lade løftet stå ubesvaret for et persisteret mappe-handle – på tværs af
 * oprindelser (web, localhost, PWA) og uden fejl. Da forespørgslen ligger mellem brugerens klik og
 * filvælgeren, hang Hent/Gem derefter med filoperationslåsen holdt: ingen dialog, og næste klik fik
 * «En filhandling er allerede i gang».
 *
 * Grænsen er kort med vilje: filvælgeren kræver browserens transiente brugeraktivering, som udløber
 * få sekunder efter klikket, så et udløbet svar skal efterlade tid til, at pickeren stadig må åbne.
 * `requestPermission` tidsbegrænses IKKE – den venter legitimt på et svar i browserens prompt.
 */
export const PERMISSION_QUERY_TIMEOUT_MS = 1000;

export type PermissionQueryResult = PermissionState | 'unanswered';

type PermissionQueryableHandle = Readonly<{
  queryPermission: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}>;

export const queryHandlePermission = (
  handle: PermissionQueryableHandle,
  mode: 'read' | 'readwrite',
  timeoutMs: number = PERMISSION_QUERY_TIMEOUT_MS,
): Promise<PermissionQueryResult> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'unanswered'>((resolve) => {
    timer = setTimeout(() => resolve('unanswered'), timeoutMs);
  });
  return Promise.race([handle.queryPermission({ mode }), timeout]).finally(() => clearTimeout(timer));
};
