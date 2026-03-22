import {
  appSettingsSchema,
  DEFAULT_APP_SETTINGS,
  DEFAULT_BREVHOVED_INDSTILLINGER,
  brevhovedIndstillingerSchema,
  resolveDefaultOverenskomstFilter,
} from '../../settings/appSettingsSchema';
import { resolveAppSettings } from '../../settings/appSettingsParse';

describe('DEFAULT_APP_SETTINGS', () => {
  it('er gyldig iht. appSettingsSchema', () => {
    const result = appSettingsSchema.safeParse(DEFAULT_APP_SETTINGS);
    expect(result.success).toBe(true);
  });

  it('har alle forventede felter', () => {
    expect(typeof DEFAULT_APP_SETTINGS.showContentBoxReportButton).toBe('boolean');
    expect(typeof DEFAULT_APP_SETTINGS.showEODebugMenu).toBe('boolean');
    expect(typeof DEFAULT_APP_SETTINGS.defaultFuldLoenUnderFerie).toBe('boolean');
    expect(typeof DEFAULT_APP_SETTINGS.defaultLoenPaaHelligdage).toBe('string');
    expect(DEFAULT_APP_SETTINGS.defaultSvieSmerteDelvisSygemeldingSats).toBe('halv');
    expect(DEFAULT_APP_SETTINGS.erstatningsopgoerelseAfsluttesMed).toBe('Bekræftet godkendt');
    expect(DEFAULT_APP_SETTINGS.allowReguleringMedUdloebMedMaaneder).toBe(6);
    expect(DEFAULT_APP_SETTINGS.brevhovedIndstillinger).toBeDefined();
    expect(DEFAULT_APP_SETTINGS.defaultVisBilagsnumre).toBe(false);
  });

  it('defaultOverenskomstLoenmodtager = "ALLE"', () => {
    expect(DEFAULT_APP_SETTINGS.defaultOverenskomstLoenmodtager).toBe('ALLE');
  });

  it('defaultOverenskomstArbejdsgiver = "ALLE"', () => {
    expect(DEFAULT_APP_SETTINGS.defaultOverenskomstArbejdsgiver).toBe('ALLE');
  });
});

describe('DEFAULT_BREVHOVED_INDSTILLINGER', () => {
  it('er gyldig iht. brevhovedIndstillingerSchema', () => {
    const result = brevhovedIndstillingerSchema.safeParse(DEFAULT_BREVHOVED_INDSTILLINGER);
    expect(result.success).toBe(true);
  });

  it('korrekte PDF-defaults', () => {
    expect(DEFAULT_BREVHOVED_INDSTILLINGER.erstatningsopgoerelse).toBe(true);
    expect(DEFAULT_BREVHOVED_INDSTILLINGER.erhvervsevnetab).toBe(true);
    expect(DEFAULT_BREVHOVED_INDSTILLINGER.varigeMen).toBe(true);
    expect(DEFAULT_BREVHOVED_INDSTILLINGER.forsoergertab).toBe(true);
    expect(DEFAULT_BREVHOVED_INDSTILLINGER.aarsloensberegning).toBe(true);
    expect(DEFAULT_BREVHOVED_INDSTILLINGER.renteberegning).toBe(true);
    expect(DEFAULT_BREVHOVED_INDSTILLINGER.satser).toBe(false);
    expect(DEFAULT_BREVHOVED_INDSTILLINGER.shDage).toBe(false);
    expect(DEFAULT_BREVHOVED_INDSTILLINGER.regulering).toBe(false);
  });
});

describe('appSettingsSchema', () => {
  it('afviser ukendte felter (strict)', () => {
    const result = appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, ukendtFelt: true });
    expect(result.success).toBe(false);
  });

  it('afviser ugyldig erstatningsopgoerelseAfsluttesMed-enum', () => {
    const result = appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, erstatningsopgoerelseAfsluttesMed: 'Noget andet' });
    expect(result.success).toBe(false);
  });

  it('afviser negativt allowReguleringMedUdloebMedMaaneder', () => {
    const result = appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, allowReguleringMedUdloebMedMaaneder: -1 });
    expect(result.success).toBe(false);
  });

  it('afviser allowReguleringMedUdloebMedMaaneder > 12', () => {
    const result = appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, allowReguleringMedUdloebMedMaaneder: 13 });
    expect(result.success).toBe(false);
  });

  it('accepterer "Underskrift-linje" som enum-værdi', () => {
    const result = appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, erstatningsopgoerelseAfsluttesMed: 'Underskrift-linje' });
    expect(result.success).toBe(true);
  });

  it('accepterer defaultDirectoryHandleId som optional', () => {
    const withId = appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, defaultDirectoryHandleId: 'handle-abc' });
    expect(withId.success).toBe(true);

    const withoutId = appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, defaultDirectoryHandleId: undefined });
    expect(withoutId.success).toBe(true);
  });

  it('accepterer defaultSvieSmerteDelvisSygemeldingSats="fuld"', () => {
    const result = appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, defaultSvieSmerteDelvisSygemeldingSats: 'fuld' });
    expect(result.success).toBe(true);
  });
});

describe('resolveDefaultOverenskomstFilter', () => {
  it('DEFAULT_APP_SETTINGS → begge undefined (ALLE → undefined)', () => {
    const filter = resolveDefaultOverenskomstFilter(DEFAULT_APP_SETTINGS);
    expect(filter.loenmodtager).toBeUndefined();
    expect(filter.arbejdsgiver).toBeUndefined();
  });

  it('"ALLE" → undefined (normalisering fra UI-label til domæne-værdi)', () => {
    const filter = resolveDefaultOverenskomstFilter({
      ...DEFAULT_APP_SETTINGS,
      defaultOverenskomstLoenmodtager: 'ALLE',
      defaultOverenskomstArbejdsgiver: 'ALLE',
    });
    expect(filter.loenmodtager).toBeUndefined();
    expect(filter.arbejdsgiver).toBeUndefined();
  });

  it('konkret overenskomst → bevares', () => {
    const filter = resolveDefaultOverenskomstFilter({
      ...DEFAULT_APP_SETTINGS,
      defaultOverenskomstLoenmodtager: '3F Transport',
      defaultOverenskomstArbejdsgiver: 'DI',
    });
    expect(filter.loenmodtager).toBe('3F Transport');
    expect(filter.arbejdsgiver).toBe('DI');
  });

  it('ugyldig settings → falder tilbage til DEFAULT_APP_SETTINGS', () => {
    // @ts-expect-error – bevidst ugyldig settings
    const filter = resolveDefaultOverenskomstFilter(resolveAppSettings({ invalid: true }));
    // Default = ALLE → undefined
    expect(filter.loenmodtager).toBeUndefined();
    expect(filter.arbejdsgiver).toBeUndefined();
  });
});
