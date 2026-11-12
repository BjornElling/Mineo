// @vitest-environment jsdom
import { defineGeneratedCases, prepareSmokeEnvironment } from './helpers/runtimeInputSmokeHarness';

describe('Erstatningsopgørelse – alle faner monteres uden runtimefejl (tilfaeldig genererede sager)', () => {
  prepareSmokeEnvironment();
  defineGeneratedCases('tilfaeldig', [3, 11, 17, 29]);
});
