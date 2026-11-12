// @vitest-environment jsdom
import { assertSfggCombinations } from './helpers/eoRuntimeMutationCase';

// Del af `eoInputRuntimeMutations`: fordelt på to filer, så hver tunge kombinationsblok kører parallelt.
describe('EO-input – SFGG og reguleringskilder ved lønbeløb 0, 0.01, 0.07', () => {
  it.each([0, 0.01, 0.07])('tåler små lønbeløb og alle reguleringskilder med SFGG: %s', (value) => {
    assertSfggCombinations(value);
  }, 60000);
});
