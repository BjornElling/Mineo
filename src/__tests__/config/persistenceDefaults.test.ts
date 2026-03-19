import { describe, expect, it } from 'vitest';
import { buildPersistenceDefaults } from '../../config/persistenceDefaults';
import { DEFAULT_APP_SETTINGS } from '../../settings/appSettingsSchema';

describe('buildPersistenceDefaults', () => {
  describe('stamdata defaults', () => {
    it('indeholder grundlæggende stamdata-felter som tomme strenge', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.stamdata?.journalnr).toBe('');
      expect(defaults.stamdata?.advokat).toBe('');
      expect(defaults.stamdata?.sagsbehandler).toBe('');
      expect(defaults.stamdata?.skadelidte).toBe('');
    });
  });

  describe('aarsloen defaults', () => {
    it('loenperiode = "maaned"', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.aarsloen?.loenperiode).toBe('maaned');
    });

    it('tableData = tom liste', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.aarsloen?.tableData).toEqual([]);
    });

    it('fuldLoenUnderFerie følger settings', () => {
      const defaults = buildPersistenceDefaults({
        ...DEFAULT_APP_SETTINGS,
        defaultFuldLoenUnderFerie: false,
      });
      expect(defaults.aarsloen?.fuldLoenUnderFerie).toBe(false);
    });

    it('retTilSjetteFerieuge = true (standard)', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.aarsloen?.retTilSjetteFerieuge).toBe(true);
    });

    it('loenPaaHelligdage følger settings', () => {
      const defaults = buildPersistenceDefaults({
        ...DEFAULT_APP_SETTINGS,
        defaultLoenPaaHelligdage: 'SH-udbetaling',
      });
      expect(defaults.aarsloen?.loenPaaHelligdage).toBe('SH-udbetaling');
    });
  });

  describe('satser defaults', () => {
    it('inkluderer aargang i defaults-output', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.satser).toHaveProperty('aargang');
      expect(defaults.satser?.aargang).toBeUndefined();
    });
  });

  describe('renteberegning defaults', () => {
    it('rentekravRows = tom liste', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.renteberegning?.rentekravRows).toEqual([]);
    });

    it('inkluderer ikke kommentarer-feltet i defaults-output', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.renteberegning).not.toHaveProperty('kommentarer');
    });
  });

  describe('varigemen defaults', () => {
    it('inkluderer centrale felter i defaults-output', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.varigemen).toEqual({
        mengrad: undefined,
        beregningsdato: undefined,
      });
    });
  });

  describe('erhvervsevnetab defaults', () => {
    it('aslAfgoerelser = tom liste', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.erhvervsevnetab?.aslAfgoerelser).toEqual([]);
    });
  });

  describe('erstatningsopgoerelse defaults', () => {
    it('indsaetUdkastStempel følger settings.defaultIndsaetUdkastStempel', () => {
      const withStempel = buildPersistenceDefaults({ ...DEFAULT_APP_SETTINGS, defaultIndsaetUdkastStempel: true });
      expect(withStempel.erstatningsopgoerelse?.indsaetUdkastStempel).toBe('Ja');

      const withoutStempel = buildPersistenceDefaults({ ...DEFAULT_APP_SETTINGS, defaultIndsaetUdkastStempel: false });
      expect(withoutStempel.erstatningsopgoerelse?.indsaetUdkastStempel).toBe('Nej');
    });

    it('erstatningsopgoerelseAfsluttesMed følger settings', () => {
      const defaults = buildPersistenceDefaults({
        ...DEFAULT_APP_SETTINGS,
        erstatningsopgoerelseAfsluttesMed: 'Underskrift-linje',
      });
      expect(defaults.erstatningsopgoerelse?.erstatningsopgoerelseAfsluttesMed).toBe('Underskrift-linje');
    });

    it('svieSmerteDelvisSygemeldingSats følger settings', () => {
      const defaults = buildPersistenceDefaults({
        ...DEFAULT_APP_SETTINGS,
        defaultSvieSmerteDelvisSygemeldingSats: 'fuld',
      });
      expect(defaults.erstatningsopgoerelse?.svieSmerteDelvisSygemeldingSats).toBe('fuld');
    });
  });

  describe('settings-fallback', () => {
    it('undefined settings → bruger DEFAULT_APP_SETTINGS', () => {
      const defaults = buildPersistenceDefaults(undefined);
      expect(defaults).toBeDefined();
      expect(defaults.stamdata).toBeDefined();
      expect(defaults.aarsloen).toBeDefined();
    });

    it('ugyldig settings → falder tilbage til DEFAULT_APP_SETTINGS', () => {
      // @ts-expect-error – bevidst ugyldig settings
      const defaults = buildPersistenceDefaults({ invalid: true });
      expect(defaults.aarsloen?.loenperiode).toBe('maaned');
    });
  });

  describe('determinisme', () => {
    it('to kald med samme settings giver identiske resultater', () => {
      const a = buildPersistenceDefaults(DEFAULT_APP_SETTINGS);
      const b = buildPersistenceDefaults(DEFAULT_APP_SETTINGS);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });
});
