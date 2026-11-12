// @vitest-environment jsdom
import { defineGeneratedCases, prepareSmokeEnvironment } from './helpers/runtimeInputSmokeHarness';

describe('Erstatningsopgørelse – alle faner monteres uden runtimefejl (sammenhaengende genererede sager)', () => {
  prepareSmokeEnvironment();
  defineGeneratedCases('sammenhaengende', [2, 7, 13, 31]);
});
