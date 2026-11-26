type BuildInfo = {
  /** Udgivelsesversionen fra `package.json` (fx `1.0.0`); tom, hvis build-info mangler. */
  readonly release: string;
  /** Byggenummeret `år.måned.commitantal.hash7`; identificerer det konkrete build. */
  readonly version: string;
  readonly commit: string;
  readonly commitShort: string;
  readonly builtAt: string;
};

const readBuildEnv = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

export const BUILD_INFO: BuildInfo = {
  release: readBuildEnv(import.meta.env.VITE_APP_RELEASE) ?? '',
  version: readBuildEnv(import.meta.env.VITE_APP_VERSION) ?? '0.0.0.dev',
  commit: readBuildEnv(import.meta.env.VITE_APP_COMMIT_HASH) ?? 'ukendt',
  commitShort: readBuildEnv(import.meta.env.VITE_APP_COMMIT_SHORT) ?? 'ukendt',
  builtAt: readBuildEnv(import.meta.env.VITE_APP_BUILT_AT) ?? 'ukendt',
};

/** Byggenummeret. Bruges til fejlrapport, `.eo`-metadata og opdateringskontrol. */
export const VERSION = BUILD_INFO.version;

/**
 * Udgivelsesversionen i den form, brugeren ser: en patch på 0 udelades (`1.0.0` → `1.0`).
 * Andre former vises uændret.
 */
export const formatReleaseVersion = (release: string): string => {
  const match = /^(\d+)\.(\d+)\.0$/.exec(release);
  return match ? `${match[1]}.${match[2]}` : release;
};

/** Brugervendt versionstekst: `1.0 (2026.11.1234.9c0b359)`, eller kun byggenummeret uden udgivelsesversion. */
export const DISPLAY_VERSION = BUILD_INFO.release === ''
  ? VERSION
  : `${formatReleaseVersion(BUILD_INFO.release)} (${VERSION})`;
