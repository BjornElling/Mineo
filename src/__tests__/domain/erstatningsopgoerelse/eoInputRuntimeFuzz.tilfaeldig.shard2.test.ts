// @vitest-environment jsdom
import { defineFuzzShard } from './helpers/eoRuntimeFuzzShard';

describe('Erstatningsopgørelse – runtime-fuzzing af alle inputfelter (tilfaeldig, shard 2)', () => {
  defineFuzzShard('tilfaeldig', 1);
});
