describe('BUILD_INFO', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('bruger build-env når den findes', async () => {
    vi.stubEnv('VITE_APP_RELEASE', '1.0.0');
    vi.stubEnv('VITE_APP_VERSION', '2026.06.736.a1b2c3d');
    vi.stubEnv('VITE_APP_COMMIT_HASH', 'a1b2c3d4e5f678901234567890abcdef12345678');
    vi.stubEnv('VITE_APP_COMMIT_SHORT', 'a1b2c3d');
    vi.stubEnv('VITE_APP_BUILT_AT', '2026-06-07T10:11:12.000Z');

    const { BUILD_INFO, VERSION, DISPLAY_VERSION } = await import('../../config/buildInfo');

    expect(VERSION).toBe('2026.06.736.a1b2c3d');
    expect(DISPLAY_VERSION).toBe('1.0 (2026.06.736.a1b2c3d)');
    expect(BUILD_INFO).toEqual({
      release: '1.0.0',
      version: '2026.06.736.a1b2c3d',
      commit: 'a1b2c3d4e5f678901234567890abcdef12345678',
      commitShort: 'a1b2c3d',
      builtAt: '2026-06-07T10:11:12.000Z',
    });
  });

  it('falder lukket tilbage når build-env mangler', async () => {
    vi.stubEnv('VITE_APP_RELEASE', '');
    vi.stubEnv('VITE_APP_VERSION', '');
    vi.stubEnv('VITE_APP_COMMIT_HASH', '');
    vi.stubEnv('VITE_APP_COMMIT_SHORT', '');
    vi.stubEnv('VITE_APP_BUILT_AT', '');

    const { BUILD_INFO, VERSION, DISPLAY_VERSION } = await import('../../config/buildInfo');

    expect(VERSION).toBe('0.0.0.dev');
    expect(DISPLAY_VERSION).toBe('0.0.0.dev');
    expect(BUILD_INFO).toEqual({
      release: '',
      version: '0.0.0.dev',
      commit: 'ukendt',
      commitShort: 'ukendt',
      builtAt: 'ukendt',
    });
  });
});

describe('formatReleaseVersion', () => {
  it('udelader en patch på 0 og viser andre former uændret', async () => {
    const { formatReleaseVersion } = await import('../../config/buildInfo');

    expect(formatReleaseVersion('1.0.0')).toBe('1.0');
    expect(formatReleaseVersion('1.2.0')).toBe('1.2');
    expect(formatReleaseVersion('1.0.3')).toBe('1.0.3');
    expect(formatReleaseVersion('2.0.0-beta')).toBe('2.0.0-beta');
  });
});
