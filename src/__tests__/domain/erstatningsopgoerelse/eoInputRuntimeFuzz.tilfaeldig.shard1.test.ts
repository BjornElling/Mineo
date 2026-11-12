// @vitest-environment jsdom
import { defineFuzzShard } from './helpers/eoRuntimeFuzzShard';

describe('Erstatningsopgørelse – runtime-fuzzing af alle inputfelter (tilfaeldig, shard 1)', () => {
  defineFuzzShard('tilfaeldig', 0);
});
