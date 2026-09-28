import {
  DEFAULT_APP_SETTINGS,
  appSettingsSchema,
} from '../../../settings/appSettingsSchema';
import {
  createAarsloenNewCaseSeed,
  resolveAarsloenNewCaseDefaults,
} from '../../../domain/aarsloen/aarsloenNewCaseSeed';

describe('aarsloenNewCaseSeed (§1.12)', () => {
  it('bruger app-settings-defaults til Årsløn på en ny sag', () => {
    expect(resolveAarsloenNewCaseDefaults()).toEqual({
      loenperiode: DEFAULT_APP_SETTINGS.defaultLoenIndtastesSom,
      fuldLoenUnderFerie: DEFAULT_APP_SETTINGS.defaultFuldLoenUnderFerie,
      loenPaaHelligdage: DEFAULT_APP_SETTINGS.defaultLoenPaaHelligdage,
    });
  });

  it('fører brugerens tre Årsløn-defaults ind sammen med en tom løntabel', () => {
    const settings = appSettingsSchema.parse({
      ...DEFAULT_APP_SETTINGS,
      defaultLoenIndtastesSom: 'dag',
      defaultFuldLoenUnderFerie: false,
      defaultLoenPaaHelligdage: 'Ingen',
    });

    expect(createAarsloenNewCaseSeed(settings)()).toEqual({
      aarsloen: {
        tableData: [],
        loenperiode: 'dag',
        fuldLoenUnderFerie: false,
        loenPaaHelligdage: 'Ingen',
      },
    });
  });
});
