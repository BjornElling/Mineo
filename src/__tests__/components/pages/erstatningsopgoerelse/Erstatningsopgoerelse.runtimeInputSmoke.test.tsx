// @vitest-environment jsdom
import {
  offentligOverenskomstUdenAnsaettelse,
  prepareSmokeEnvironment,
  renderAllTabs,
  stamdata,
  ukendtOrganisationIFilteret,
} from './helpers/runtimeInputSmokeHarness';

// De genererede sager ligger i `Erstatningsopgoerelse.runtimeInputSmoke.<tilstand>.test.tsx`.
describe('Erstatningsopgørelse – alle faner monteres uden runtimefejl', () => {
  prepareSmokeEnvironment();

  it('tåler en offentlig overenskomst uden valgt ansættelsestype (ældre .eo)', async () => {
    expect(await renderAllTabs(stamdata, offentligOverenskomstUdenAnsaettelse())).toEqual([]);
  }, 60_000);

  it('tåler en organisation i overenskomstfilteret, som ikke længere findes i overenskomstdataene', async () => {
    expect(await renderAllTabs(stamdata, ukendtOrganisationIFilteret())).toEqual([]);
  }, 60_000);

  it('tåler et gemt organisationsfilter med UI-sentinellen Alle', async () => {
    expect(await renderAllTabs(stamdata, ukendtOrganisationIFilteret('ALLE', 'ALLE'))).toEqual([]);
  }, 60_000);
});
