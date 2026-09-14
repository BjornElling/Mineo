import { localStorageBoundary } from './rules/storageRules';
import { makeSyntheticEntry } from './sourceGraph';

describe('ARCH-002 – localStorage-grænsens globalThis-modprøve', () => {
  it('afviser rå localStorage-adgang gennem globalThis', () => {
    const entry = makeSyntheticEntry(
      'src/components/pages/X.tsx',
      'const storage = globalThis.localStorage;',
    );

    const findings = localStorageBoundary.evaluate([entry]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('globalThis.localStorage');
  });
});
