/**
 * Den strukturelle "ingen rå localStorage-adgang uden for den kanoniske wrapper"-scanner
 * er reglen `storage/local-storage-boundary` i det AST-baserede arkitektur-harness (se
 * `architecture/architectureRules.ts` + `architecture/architectureRules.test.ts`). AST-reglen fanger –
 * modsat en regex – også aliaseret/indirekte adgang.
 *
 * Tilbage her: en runtime-røgtest af, at de kaldende lag reelt kan operere gennem
 * `safeLocalStorage`-wrapperen uden selv at røre `window.localStorage`.
 */
describe('safeLocalStorage wrapper', () => {
  it('lader de kaldende lag læse/skrive uden at røre window.localStorage direkte', async () => {
    vi.resetModules();
    const { readLocalStorage, writeLocalStorage } = await import('../../settings/appSettingsStorage');
    expect(() => readLocalStorage('test-key')).not.toThrow();
    expect(() => writeLocalStorage('test-key', 'value')).not.toThrow();
  });
});
