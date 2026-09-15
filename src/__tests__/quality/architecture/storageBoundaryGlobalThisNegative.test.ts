import { localStorageBoundary } from './rules/storageRules';
import { makeSyntheticEntry } from './sourceGraph';

describe('ARCH-002 – localStorage-grænsens modprøver', () => {
  it('afviser rå localStorage-adgang gennem globalThis', () => {
    const entry = makeSyntheticEntry(
      'src/components/pages/X.tsx',
      'const storage = globalThis.localStorage;',
    );

    const findings = localStorageBoundary.evaluate([entry]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('globalThis.localStorage');
  });

  it.each([
    ['globalThis["localStorage"]', 'const storage = globalThis["localStorage"];'],
    ['window["localStorage"]', 'const storage = window["localStorage"];'],
    ['localStorage[storageKey]', 'const value = localStorage[storageKey];'],
  ])('afviser rå bracket-adgang gennem %s', (expression, code) => {
    const entry = makeSyntheticEntry('src/components/pages/X.tsx', code);

    const findings = localStorageBoundary.evaluate([entry]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(expression);
  });
});
