// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';

import {
  captureProductionEvaluationSource,
  useSettingsRevisionBridge,
} from '../../../inputCore/react';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../../../settings/appSettingsSchema';
import { SOURCE_SETTINGS_KEYS, projectSourceSettings } from '../../../settings/sourceSettings';

describe('production runtime — settingssnapshot', () => {
  it('publicerer det PROJEKTEREDE snapshot og revisionen som én frisk evalueringskilde', () => {
    const initial: AppSettings = { ...DEFAULT_APP_SETTINGS };
    const { rerender } = renderHook(
      ({ settings }: { settings: AppSettings }) => useSettingsRevisionBridge(settings),
      { initialProps: { settings: initial } }
    );
    const before = captureProductionEvaluationSource();
    // Testen sammenlignede tidligere med `toBe(initial)` — altså identitet med hele `AppSettings`.
    // Broen publicerer det projekterede snapshot, og DET er pointen: den brede værdi må
    // ikke nå evalueringen. Vi pinner derfor både at snapshottet svarer til det committede input, OG
    // at det ikke bærer nøgler uden for sættet.
    expect(before.settings).toEqual(projectSourceSettings(initial));
    expect(Object.keys(before.settings).sort()).toEqual([...SOURCE_SETTINGS_KEYS].sort());
    expect(before.evaluation.issues.sourceToken.settingsRevision).toBe(slimInputStore.getState().settingsRevision);

    const next: AppSettings = { ...initial, documentDownloadFormat: 'word' };
    rerender({ settings: next });
    const after = captureProductionEvaluationSource();

    expect(after.settings).toEqual(projectSourceSettings(next));
    expect(after.settings.documentDownloadFormat).toBe('word');
    expect(after.evaluation.issues.sourceToken.settingsRevision).toBe(slimInputStore.getState().settingsRevision);
    expect(after.evaluation.issues.sourceToken.settingsRevision).not.toBe(before.evaluation.issues.sourceToken.settingsRevision);

    // En ren UI-indstilling er uden for sættet: snapshottet er uændret, og revisionen står stille.
    const revisionBeforeUiOnlyChange = slimInputStore.getState().settingsRevision;
    const uiOnly: AppSettings = { ...next, themeMode: 'dark' };
    rerender({ settings: uiOnly });
    expect(captureProductionEvaluationSource().settings).toEqual(projectSourceSettings(next));
    expect(slimInputStore.getState().settingsRevision).toBe(revisionBeforeUiOnlyChange);
  });
});
