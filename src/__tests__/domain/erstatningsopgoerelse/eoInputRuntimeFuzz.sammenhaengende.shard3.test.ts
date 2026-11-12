// @vitest-environment jsdom
import { defineFuzzShard } from './helpers/eoRuntimeFuzzShard';

describe('Erstatningsopgørelse – runtime-fuzzing af alle inputfelter (sammenhaengende, shard 3)', () => {
  defineFuzzShard('sammenhaengende', 2);
});
