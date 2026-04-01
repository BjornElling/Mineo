/// <reference types="vitest/globals" />

import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

describe('erstatningsopgoerelse initial values - udkaststempel defaults', () => {
  it('sætter indsaetUdkastStempel til Nej når defaultIndsaetUdkastStempel=false', () => {
    const settings = { ...DEFAULT_APP_SETTINGS, defaultIndsaetUdkastStempel: false };
    const values = createErstatningsopgoerelseInitialValues(settings);
    expect(values.indsaetUdkastStempel).toBe('Nej');
  });

  it('settings-ændringer påvirker ikke eksisterende data ved merge', () => {
    const settingsYes = { ...DEFAULT_APP_SETTINGS, defaultIndsaetUdkastStempel: true };
    const settingsNo = { ...DEFAULT_APP_SETTINGS, defaultIndsaetUdkastStempel: false };

    const initialYes = createErstatningsopgoerelseInitialValues(settingsYes);
    const persisted = { ...initialYes, indsaetUdkastStempel: 'Nej' as const };

    const initialNo = createErstatningsopgoerelseInitialValues(settingsNo);
    const merged = { ...initialNo, ...persisted };

    expect(merged.indsaetUdkastStempel).toBe('Nej');
  });
});
