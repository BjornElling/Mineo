import {
  appSettingsSchema,
  DEFAULT_APP_SETTINGS,
  DEFAULT_BREVHOVED_INDSTILLINGER,
  brevhovedIndstillingerSchema,
  resolveDefaultOverenskomstFilter,
  APP_SETTINGS_AFSLUTTES_MED_OPTIONS,
  APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS,
  APP_SETTINGS_SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_OPTIONS,
} from '../../settings/appSettingsSchema';
import { DOCUMENT_DOWNLOAD_FORMAT_OPTIONS } from '../../document/documentFormat';
import { DOCUMENT_BREVHOVED_TYPES } from '../../document/layout/documentBrevhoved';
import { parseStoredSettings, resolveAppSettings } from '../../settings/appSettingsParse';
import {
  afsluttesMedEnum,
  loenPaaHelligdageEnum,
  svieSmerteDelvisSygemeldingSatsEnum,
} from '../../schemas/formSchemas';

// Konvergens-værn: AppSettings-option-listerne skal forblive identiske med de kanoniske
// domæne-enums, så defaults og .eo-sektionsfelter ikke kan komme ud af sync.
describe('AppSettings option-lister er afledt af de kanoniske enums', () => {
  it('afsluttesMed matcher afsluttesMedEnum', () => {
    expect(APP_SETTINGS_AFSLUTTES_MED_OPTIONS).toEqual(afsluttesMedEnum.options);
  });
  it('loenPaaHelligdage matcher loenPaaHelligdageEnum', () => {
    expect(APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS).toEqual(loenPaaHelligdageEnum.options);
  });
  it('svieSmerteDelvisSygemeldingSats matcher svieSmerteDelvisSygemeldingSatsEnum', () => {
    expect(APP_SETTINGS_SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_OPTIONS).toEqual(
      svieSmerteDelvisSygemeldingSatsEnum.options
    );
  });
});

// Selv-test for det compile-time `satisfies`-værn: brevhoved-schemaets nøgler skal matche
// dokument-lagets kanoniske DocumentBrevhovedType 1-til-1 (afhængigheds-pil: settings → dokument).
// Beviser at en drift mellem de to sider faktisk ville blive fanget (ikke vacuous).
describe('brevhovedIndstillinger-nøgler matcher dokument-lagets kanoniske typesæt', () => {
  it('schema-nøgler === DOCUMENT_BREVHOVED_TYPES (begge veje)', () => {
    const schemaKeys = Object.keys(brevhovedIndstillingerSchema.shape).sort();
    const documentTypes = [...DOCUMENT_BREVHOVED_TYPES].sort();
    expect(schemaKeys).toEqual(documentTypes);
  });
});

describe('DEFAULT_APP_SETTINGS', () => {
  it('er gyldig iht. appSettingsSchema', () => {
    const result = appSettingsSchema.safeParse(DEFAULT_APP_SETTINGS);
    expect(result.success).toBe(true);
  });

  it('har alle forventede felter', () => {
    // «Følg computeren» er standarden (BB-024): uden et aktivt valg følger Mineo maskinen – også
    // når den skifter midt i en session.
    expect(DEFAULT_APP_SETTINGS.themeMode).toBe('system');
    expect(typeof DEFAULT_APP_SETTINGS.defaultStartsideErStamdata).toBe('boolean');
    expect(typeof DEFAULT_APP_SETTINGS.showContentBoxReportButton).toBe('boolean');
    expect(typeof DEFAULT_APP_SETTINGS.showEOInspektionMenu).toBe('boolean');
    expect(typeof DEFAULT_APP_SETTINGS.defaultFuldLoenUnderFerie).toBe('boolean');
    expect(typeof DEFAULT_APP_SETTINGS.defaultLoenPaaHelligdage).toBe('string');
    expect(DEFAULT_APP_SETTINGS.defaultSvieSmerteDelvisSygemeldingSats).toBe('halv');
    expect(DEFAULT_APP_SETTINGS.erstatningsopgoerelseAfsluttesMed).toBe('Bekræftet godkendt');
    expect(DEFAULT_APP_SETTINGS.brevhovedIndstillinger).toBeDefined();
    expect(DEFAULT_APP_SETTINGS.defaultVisBilagsnumre).toBe(false);
    expect(DEFAULT_APP_SETTINGS.defaultStartsideErStamdata).toBe(false);
    expect(DEFAULT_APP_SETTINGS.documentDownloadFormat).toBe('pdf');
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

  it('har regulerings-tilladelser som device-local settings med konservative defaults', () => {
    expect(DEFAULT_APP_SETTINGS.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden).toBe(false);
    expect(DEFAULT_APP_SETTINGS.allowReguleringMedUdloebMedMaaneder).toBe(6);
  });

  it('afviser allowReguleringMedUdloebMedMaaneder uden for 0–12', () => {
    expect(appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, allowReguleringMedUdloebMedMaaneder: 13 }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, allowReguleringMedUdloebMedMaaneder: -1 }).success).toBe(false);
  });

  it('accepterer kun de kanoniske dokument-download-formater', () => {
    for (const option of DOCUMENT_DOWNLOAD_FORMAT_OPTIONS) {
      expect(appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, documentDownloadFormat: option }).success).toBe(true);
    }
    expect(appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, documentDownloadFormat: '' }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, documentDownloadFormat: 'doc' }).success).toBe(false);
  });
});

describe('parseStoredSettings', () => {
  it('bevarer gemte regulerings-settings sammen med øvrige gyldige indstillinger', () => {
    const settings = parseStoredSettings({
      ...DEFAULT_APP_SETTINGS,
      themeMode: 'dark',
      allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true,
      allowReguleringMedUdloebMedMaaneder: 9,
    });

    expect(settings.themeMode).toBe('dark');
    expect(settings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden).toBe(true);
    expect(settings.allowReguleringMedUdloebMedMaaneder).toBe(9);
  });

  it('bevarer gemt dokument-download-format', () => {
    const settings = parseStoredSettings({
      ...DEFAULT_APP_SETTINGS,
      documentDownloadFormat: 'word',
    });

    expect(settings.documentDownloadFormat).toBe('word');
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
    const filter = resolveDefaultOverenskomstFilter(resolveAppSettings({ invalid: true }));
    // Default = ALLE → undefined
    expect(filter.loenmodtager).toBeUndefined();
    expect(filter.arbejdsgiver).toBeUndefined();
  });
});
