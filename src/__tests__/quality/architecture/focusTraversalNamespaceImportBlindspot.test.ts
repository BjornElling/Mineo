import { focusTraversalOwnershipRule } from './rules/focusNavigationRules';
import { makeSyntheticEntry } from './sourceGraph';

describe('ARCH-002 – fokusgrænsens namespace-import modprøve', () => {
  it('afviser traversal-primitive hentet gennem namespace-import', () => {
    const entry = makeSyntheticEntry(
      'src/components/pages/Aarsloen.tsx',
      [
        "import * as tableFocusHelpers from '../tables/gridCore/tableFocusHelpers';",
        'const selector = tableFocusHelpers.CONTAINER_FOCUSABLE_SELECTOR;',
      ].join('\n'),
    );

    expect(focusTraversalOwnershipRule.evaluate([entry])).toHaveLength(1);
  });
});
