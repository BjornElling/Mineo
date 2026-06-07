describe('BUILD_INFO', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('bruger build-env når den findes', async () => {
    vi.stubEnv('VITE_APP_VERSION', '2026.06.736.a1b2c3');
    vi.stubEnv('VITE_APP_COMMIT_HASH', 'a1b2c3d4e5f678901234567890abcdef12345678');
    vi.stubEnv('VITE_APP_COMMIT_SHORT', 'a1b2c3');
    vi.stubEnv('VITE_APP_BUILT_AT', '2026-06-07T10:11:12.000Z');

    const { BUILD_INFO, VERSION } = await import('../../config/buildInfo');

    expect(VERSION).toBe('2026.06.736.a1b2c3');
    expect(BUILD_INFO).toEqual({
      version: '2026.06.736.a1b2c3',
      commit: 'a1b2c3d4e5f678901234567890abcdef12345678',
      commitShort: 'a1b2c3',
      builtAt: '2026-06-07T10:11:12.000Z',
    });
  });

  it('falder lukket tilbage når build-env mangler', async () => {
    vi.stubEnv('VITE_APP_VERSION', '');
    vi.stubEnv('VITE_APP_COMMIT_HASH', '');
    vi.stubEnv('VITE_APP_COMMIT_SHORT', '');
    vi.stubEnv('VITE_APP_BUILT_AT', '');

    const { BUILD_INFO, VERSION } = await import('../../config/buildInfo');

    expect(VERSION).toBe('0.0.0.dev');
    expect(BUILD_INFO).toEqual({
      version: '0.0.0.dev',
      commit: 'ukendt',
      commitShort: 'ukendt',
      builtAt: 'ukendt',
    });
  });
});
