/// <reference types="vitest/globals" />

import { getVisBrevhoved } from '../../../pdf/shared/pdfBrevhoved';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../../../settings/appSettingsSchema';

describe('getVisBrevhoved', () => {
  it('returnerer true når brevhoved er aktiveret for PDF-typen', () => {
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      brevhovedIndstillinger: {
        ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger,
        renteberegning: true,
      },
    };

    const result = getVisBrevhoved(settings, 'renteberegning');

    expect(result).toBe(true);
  });

  it('returnerer false når brevhoved er deaktiveret for PDF-typen', () => {
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      brevhovedIndstillinger: {
        ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger,
        satser: false,
      },
    };

    const result = getVisBrevhoved(settings, 'satser');

    expect(result).toBe(false);
  });

  it('mapper korrekt for alle PDF-typer', () => {
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      brevhovedIndstillinger: {
        ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger,
        erstatningsopgoerelse: true,
        shDage: false,
        renteberegning: true,
        regulering: false,
        varigeMen: true,
        satser: false,
        aarsloensberegning: true,
      },
    };

    expect(getVisBrevhoved(settings, 'erstatningsopgoerelse')).toBe(true);
    expect(getVisBrevhoved(settings, 'shDage')).toBe(false);
    expect(getVisBrevhoved(settings, 'renteberegning')).toBe(true);
    expect(getVisBrevhoved(settings, 'regulering')).toBe(false);
    expect(getVisBrevhoved(settings, 'varigeMen')).toBe(true);
    expect(getVisBrevhoved(settings, 'satser')).toBe(false);
    expect(getVisBrevhoved(settings, 'aarsloensberegning')).toBe(true);
  });

  it('er en ren funktion - samme input giver samme output', () => {
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      brevhovedIndstillinger: {
        ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger,
        varigeMen: true,
      },
    };

    const result1 = getVisBrevhoved(settings, 'varigeMen');
    const result2 = getVisBrevhoved(settings, 'varigeMen');
    const result3 = getVisBrevhoved(settings, 'varigeMen');

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
    expect(result1).toBe(true);
  });

  it('bruger DEFAULT_APP_SETTINGS korrekt - korrekte PDF-defaults', () => {
    expect(getVisBrevhoved(DEFAULT_APP_SETTINGS, 'erstatningsopgoerelse')).toBe(true);
    expect(getVisBrevhoved(DEFAULT_APP_SETTINGS, 'erhvervsevnetab')).toBe(true);
    expect(getVisBrevhoved(DEFAULT_APP_SETTINGS, 'varigeMen')).toBe(true);
    expect(getVisBrevhoved(DEFAULT_APP_SETTINGS, 'forsoergertab')).toBe(true);
    expect(getVisBrevhoved(DEFAULT_APP_SETTINGS, 'aarsloensberegning')).toBe(true);
    expect(getVisBrevhoved(DEFAULT_APP_SETTINGS, 'renteberegning')).toBe(true);
    expect(getVisBrevhoved(DEFAULT_APP_SETTINGS, 'satser')).toBe(false);
    expect(getVisBrevhoved(DEFAULT_APP_SETTINGS, 'shDage')).toBe(false);
    expect(getVisBrevhoved(DEFAULT_APP_SETTINGS, 'regulering')).toBe(false);
  });
});
