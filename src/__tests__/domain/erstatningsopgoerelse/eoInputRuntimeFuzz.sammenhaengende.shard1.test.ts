// @vitest-environment jsdom
import { defineFuzzShard } from './helpers/eoRuntimeFuzzShard';

describe('Erstatningsopgørelse – runtime-fuzzing af alle inputfelter (sammenhaengende, shard 1)', () => {
  defineFuzzShard('sammenhaengende', 0);
});
