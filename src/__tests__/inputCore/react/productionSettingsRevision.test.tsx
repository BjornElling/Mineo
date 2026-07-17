// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';

import {
  captureProductionEvaluationSource,
  useSettingsRevisionBridge,
} from '../../../inputCore/react/productionInputRuntime';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../../../settings/appSettingsSchema';

describe('production runtime — settingssnapshot', () => {
  it('publicerer settingsobjekt og revision som én frisk evalueringskilde', () => {
    const initial: AppSettings = { ...DEFAULT_APP_SETTINGS };
    const { rerender } = renderHook(
      ({ settings }: { settings: AppSettings }) => useSettingsRevisionBridge(settings),
      { initialProps: { settings: initial } }
    );
    const before = captureProductionEvaluationSource();
    expect(before.settings).toBe(initial);
    expect(before.evaluation.issues.sourceToken.settingsRevision).toBe(slimInputStore.getState().settingsRevision);

    const next: AppSettings = { ...initial, documentDownloadFormat: 'word' };
    rerender({ settings: next });
    const after = captureProductionEvaluationSource();

    expect(after.settings).toBe(next);
    expect(after.evaluation.issues.sourceToken.settingsRevision).toBe(slimInputStore.getState().settingsRevision);
    expect(after.evaluation.issues.sourceToken.settingsRevision).not.toBe(before.evaluation.issues.sourceToken.settingsRevision);
    expect(before.isSourceCurrent()).toBe(false);
    expect(after.isSourceCurrent()).toBe(true);

    const revisionBeforeUiOnlyChange = slimInputStore.getState().settingsRevision;
    const uiOnly: AppSettings = { ...next, themeMode: 'dark' };
    rerender({ settings: uiOnly });
    expect(captureProductionEvaluationSource().settings).toBe(uiOnly);
    expect(slimInputStore.getState().settingsRevision).toBe(revisionBeforeUiOnlyChange);
  });
});
