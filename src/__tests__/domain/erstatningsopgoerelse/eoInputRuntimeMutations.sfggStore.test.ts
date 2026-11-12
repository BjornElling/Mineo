// @vitest-environment jsdom
import { assertSfggCombinations } from './helpers/eoRuntimeMutationCase';

// Del af `eoInputRuntimeMutations`: fordelt på to filer, så hver tunge kombinationsblok kører parallelt.
describe('EO-input – SFGG og reguleringskilder ved lønbeløb 1, 30000', () => {
  it.each([1, 30000])('tåler små lønbeløb og alle reguleringskilder med SFGG: %s', (value) => {
    assertSfggCombinations(value);
  }, 60000);
});
