type BuildInfo = {
  readonly version: string;
  readonly commit: string;
  readonly commitShort: string;
  readonly builtAt: string;
};

const readBuildEnv = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

export const BUILD_INFO: BuildInfo = {
  version: readBuildEnv(import.meta.env.VITE_APP_VERSION) ?? '0.0.0.dev',
  commit: readBuildEnv(import.meta.env.VITE_APP_COMMIT_HASH) ?? 'ukendt',
  commitShort: readBuildEnv(import.meta.env.VITE_APP_COMMIT_SHORT) ?? 'ukendt',
  builtAt: readBuildEnv(import.meta.env.VITE_APP_BUILT_AT) ?? 'ukendt',
};

export const VERSION = BUILD_INFO.version;
