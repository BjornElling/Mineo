import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import { persistenceSchemas } from '../../../config/persistenceRegistry';

// ─── Schema-validering ────────────────────────────────────────────────────────

describe('createErstatningsopgoerelseInitialValues – schema', () => {
  it('producerer data der er gyldigt iht. erstatningsopgoerelse-schema', () => {
    const values = createErstatningsopgoerelseInitialValues();
    const result = persistenceSchemas.erstatningsopgoerelse.safeParse(values);
    expect(result.success).toBe(true);
  });

  it('med eksplicitte settings → gyldigt schema', () => {
    const values = createErstatningsopgoerelseInitialValues(DEFAULT_APP_SETTINGS);
    const result = persistenceSchemas.erstatningsopgoerelse.safeParse(values);
    expect(result.success).toBe(true);
  });

  it('med undefined settings → gyldigt schema', () => {
    const values = createErstatningsopgoerelseInitialValues(undefined);
    const result = persistenceSchemas.erstatningsopgoerelse.safeParse(values);
    expect(result.success).toBe(true);
  });
});

// ─── Defaults ─────────────────────────────────────────────────────────────────

describe('createErstatningsopgoerelseInitialValues – defaults', () => {
  it('beregnesTabtArbejdsfortjeneste er "Ja"', () => {
    const values = createErstatningsopgoerelseInitialValues();
    expect(values.beregnesTabtArbejdsfortjeneste).toBe('Ja');
  });

  it('beregnesUdFra er "Beregningsperiode"', () => {
    const values = createErstatningsopgoerelseInitialValues();
    expect(values.beregnesUdFra).toBe('Beregningsperiode');
  });

  it('beregnesSvieSmerteGodtgoerelse er "Ja"', () => {
    const values = createErstatningsopgoerelseInitialValues();
    expect(values.beregnesSvieSmerteGodtgoerelse).toBe('Ja');
  });

  it('revideretOpgoerelse er "Nej"', () => {
    const values = createErstatningsopgoerelseInitialValues();
    expect(values.revideretOpgoerelse).toBe('Nej');
  });

  it('varigeMenAfgorelse er "Nej"', () => {
    const values = createErstatningsopgoerelseInitialValues();
    expect(values.varigeMenAfgorelse).toBe('Nej');
  });

  it('loenindkomstAnsaettelsesforhold har præcis ét ansættelsesforhold', () => {
    const values = createErstatningsopgoerelseInitialValues();
    expect(values.loenindkomstAnsaettelsesforhold).toHaveLength(1);
  });

  it('ansættelsesforhold er ansat på skadestidspunktet', () => {
    const values = createErstatningsopgoerelseInitialValues();
    expect(values.loenindkomstAnsaettelsesforhold[0].ansatPaaSkadestidspunktet).toBe(true);
  });

  it('ansættelsesforhold har harOverenskomst = true', () => {
    const values = createErstatningsopgoerelseInitialValues();
    expect(values.loenindkomstAnsaettelsesforhold[0].harOverenskomst).toBe(true);
  });

  it('opsagtFraStilling er "Nej"', () => {
    const values = createErstatningsopgoerelseInitialValues();
    expect(values.opsagtFraStilling).toBe('Nej');
  });
});

// ─── Settings-baserede defaults ───────────────────────────────────────────────

describe('createErstatningsopgoerelseInitialValues – settings-integration', () => {
  it('defaultIndsaetUdkastStempel=false → indsaetUdkastStempel="Nej"', () => {
    const settings = { ...DEFAULT_APP_SETTINGS, defaultIndsaetUdkastStempel: false };
    const values = createErstatningsopgoerelseInitialValues(settings);
    expect(values.indsaetUdkastStempel).toBe('Nej');
  });

  it('defaultIndsaetUdkastStempel=true → indsaetUdkastStempel="Ja"', () => {
    const settings = { ...DEFAULT_APP_SETTINGS, defaultIndsaetUdkastStempel: true };
    const values = createErstatningsopgoerelseInitialValues(settings);
    expect(values.indsaetUdkastStempel).toBe('Ja');
  });

  it('defaultFuldLoenUnderFerie=true → fuldLoenUnderFerie="Ja" i ansættelsesforhold', () => {
    const settings = { ...DEFAULT_APP_SETTINGS, defaultFuldLoenUnderFerie: true };
    const values = createErstatningsopgoerelseInitialValues(settings);
    expect(values.loenindkomstAnsaettelsesforhold[0].fuldLoenUnderFerie).toBe('Ja');
  });

  it('defaultFuldLoenUnderFerie=false → fuldLoenUnderFerie="Nej" i ansættelsesforhold', () => {
    const settings = { ...DEFAULT_APP_SETTINGS, defaultFuldLoenUnderFerie: false };
    const values = createErstatningsopgoerelseInitialValues(settings);
    expect(values.loenindkomstAnsaettelsesforhold[0].fuldLoenUnderFerie).toBe('Nej');
  });

  it('defaultSvieSmerteDelvisSygemeldingSats="fuld" → svieSmerteDelvisSygemeldingSats="fuld"', () => {
    const settings = { ...DEFAULT_APP_SETTINGS, defaultSvieSmerteDelvisSygemeldingSats: 'fuld' as const };
    const values = createErstatningsopgoerelseInitialValues(settings);
    expect(values.svieSmerteDelvisSygemeldingSats).toBe('fuld');
  });

  it('ugyldig settings → falder tilbage til defaults og returnerer gyldigt skema', () => {
    const values = createErstatningsopgoerelseInitialValues(
      { invalid: 'settings' } as unknown as Parameters<typeof createErstatningsopgoerelseInitialValues>[0]
    );
    const result = persistenceSchemas.erstatningsopgoerelse.safeParse(values);
    expect(result.success).toBe(true);
  });

  it('strukturelle felter er stabile (ikke ID-baserede felter)', () => {
    // Row-IDs genereres tilfældigt — verificer kun stabile felter
    const settings = { ...DEFAULT_APP_SETTINGS };
    const v1 = createErstatningsopgoerelseInitialValues(settings);
    const v2 = createErstatningsopgoerelseInitialValues(settings);
    // Strukturen (antal rækker, felter) skal være identisk
    expect(v1.beregnesTabtArbejdsfortjeneste).toBe(v2.beregnesTabtArbejdsfortjeneste);
    expect(v1.loenindkomstAnsaettelsesforhold.length).toBe(v2.loenindkomstAnsaettelsesforhold.length);
    expect(v1.svieSmertePerioder.length).toBe(v2.svieSmertePerioder.length);
    expect(v1.tafPerioder.length).toBe(v2.tafPerioder.length);
  });
});
