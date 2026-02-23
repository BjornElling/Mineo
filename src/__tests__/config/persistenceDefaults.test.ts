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

    it('fuldLoenUnderFerie = true (standard)', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.aarsloen?.fuldLoenUnderFerie).toBe(true);
    });

    it('retTilSjetteFerieuge = true (standard)', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.aarsloen?.retTilSjetteFerieuge).toBe(true);
    });

    it('loenPaaHelligdage = "Almindelig løn" (standard)', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.aarsloen?.loenPaaHelligdage).toBe('Almindelig løn');
    });
  });

  describe('renteberegning defaults', () => {
    it('rentekravRows = tom liste', () => {
      const defaults = buildPersistenceDefaults();
      expect(defaults.renteberegning?.rentekravRows).toEqual([]);
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
