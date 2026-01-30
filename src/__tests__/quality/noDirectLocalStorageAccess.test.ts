describe('safeLocalStorage enforcement', () => {
  beforeEach(() => {
    // Ensure fresh module evaluation so storage resolution
    // happens under the localStorage guard.
    vi.resetModules();
  });

  it('allows appSettingsStorage to operate without touching window.localStorage', async () => {
    const { readLocalStorage, writeLocalStorage } = await import(
      '../../settings/appSettingsStorage'
    );

    expect(() => readLocalStorage('test-key')).not.toThrow();
    expect(() => writeLocalStorage('test-key', 'value')).not.toThrow();
  });
});
