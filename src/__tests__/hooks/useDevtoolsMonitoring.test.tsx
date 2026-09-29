// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Location } from 'react-router-dom';

import { persistenceSchemas, type PersistedSectionKey } from '../../config/persistenceRegistry';
import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import type { DevtoolsIssue, DevtoolsIssueSnapshot } from '../../utils/devtoolsMonitor';

const devtoolsMocks = vi.hoisted(() => ({
  getDevtoolsIssueSnapshot: vi.fn(),
  setDevtoolsRoute: vi.fn(),
  startDevtoolsMonitor: vi.fn(),
  subscribeDevtoolsIssues: vi.fn(),
  stop: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../../utils/devtoolsMonitor', () => ({
  getDevtoolsIssueSnapshot: devtoolsMocks.getDevtoolsIssueSnapshot,
  setDevtoolsRoute: devtoolsMocks.setDevtoolsRoute,
  startDevtoolsMonitor: devtoolsMocks.startDevtoolsMonitor,
  subscribeDevtoolsIssues: devtoolsMocks.subscribeDevtoolsIssues,
}));

import { useDevtoolsMonitoring } from '../../hooks/useDevtoolsMonitoring';

type DevtoolsIssueListener = (snapshot: DevtoolsIssueSnapshot, issue: DevtoolsIssue) => void;

const buildIssue = (id: number): DevtoolsIssue => ({
  id,
  correlationId: `DVT-C${id}`,
  category: 'runtime',
  level: 'warn',
  source: 'console',
  timestamp: '2026-09-29T08:00:00.000Z',
  message: `Test issue #${id}`,
  args: [`Test issue #${id}`],
});

const buildSnapshot = (issues: DevtoolsIssue[]): DevtoolsIssueSnapshot => ({
  issues,
  counts: {
    warn: issues.filter((issue) => issue.level === 'warn').length,
    error: issues.filter((issue) => issue.level === 'error').length,
  },
  lastIssue: issues.at(-1) ?? null,
  timeline: [],
  runtime: {
    route: '/stamdata',
    visibility: 'visible',
    providers: {},
    testScenario: null,
  },
});

const location = (pathname = '/stamdata', search = '?side=1', hash = '#top'): Location => ({
  pathname,
  search,
  hash,
  state: null,
  key: 'default',
});

let listener: DevtoolsIssueListener | null = null;

const renderMonitoring = (
  args: {
    readPersistedSection?: <K extends PersistedSectionKey>(pageKey: K) => unknown;
    getSectionFieldIssues?: <K extends PersistedSectionKey>(pageKey: K) => unknown;
    currentLocation?: Location;
  } = {},
) => {
  const readPersistedSection = args.readPersistedSection ?? (() => null);
  const getSectionFieldIssues = args.getSectionFieldIssues ?? (() => null);
  const currentLocation = args.currentLocation ?? location();

  return renderHook(() => useDevtoolsMonitoring({
    readPersistedSection,
    getSectionFieldIssues,
    location: currentLocation,
  }));
};

describe('useDevtoolsMonitoring', () => {
  beforeEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    listener = null;
    devtoolsMocks.getDevtoolsIssueSnapshot.mockReset();
    devtoolsMocks.getDevtoolsIssueSnapshot.mockReturnValue(buildSnapshot([]));
    devtoolsMocks.setDevtoolsRoute.mockReset();
    devtoolsMocks.startDevtoolsMonitor.mockReset();
    devtoolsMocks.startDevtoolsMonitor.mockReturnValue(devtoolsMocks.stop);
    devtoolsMocks.subscribeDevtoolsIssues.mockReset();
    devtoolsMocks.subscribeDevtoolsIssues.mockImplementation((callback: DevtoolsIssueListener) => {
      listener = callback;
      return devtoolsMocks.unsubscribe;
    });
    devtoolsMocks.stop.mockReset();
    devtoolsMocks.unsubscribe.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starter monitoren, afviser ugyldig dismissal-id og synkroniserer route', () => {
    sessionStorage.setItem(UI_STORAGE_KEYS.devtoolsLastSeenIssueId, 'ikke-et-tal');
    devtoolsMocks.getDevtoolsIssueSnapshot.mockReturnValue(buildSnapshot([buildIssue(0)]));

    const { result, unmount } = renderMonitoring();

    expect(result.current.devtoolsNoticeVisible).toBe(true);
    expect(devtoolsMocks.startDevtoolsMonitor).toHaveBeenCalledOnce();
    expect(devtoolsMocks.subscribeDevtoolsIssues).toHaveBeenCalledOnce();
    expect(devtoolsMocks.setDevtoolsRoute).toHaveBeenCalledWith('/stamdata?side=1#top');

    unmount();
    expect(devtoolsMocks.unsubscribe).toHaveBeenCalledOnce();
    expect(devtoolsMocks.stop).toHaveBeenCalledOnce();
  });

  it('coalescer queued issues og skjuler snapshot uden nyere issues efter dismissal', async () => {
    vi.useFakeTimers();
    const { result } = renderMonitoring();
    const firstIssue = buildIssue(1);

    await act(async () => {
      listener?.(buildSnapshot([firstIssue]), firstIssue);
      listener?.(buildSnapshot([firstIssue]), firstIssue);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.devtoolsNoticeVisible).toBe(true);

    act(() => {
      result.current.dismissDevtools();
    });
    expect(result.current.devtoolsNoticeVisible).toBe(false);
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.devtoolsLastSeenIssueId)).toBe('1');

    await act(async () => {
      listener?.(buildSnapshot([firstIssue]), firstIssue);
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.devtoolsNoticeVisible).toBe(false);
    expect(result.current.devtoolsSnapshot?.lastIssue?.id).toBe(1);
  });

  it('dismissal uden snapshot ændrer ikke sessionStorage', () => {
    const { result } = renderMonitoring();

    act(() => {
      result.current.dismissDevtools();
    });

    expect(sessionStorage.getItem(UI_STORAGE_KEYS.devtoolsLastSeenIssueId)).toBeNull();
    expect(result.current.devtoolsNoticeVisible).toBe(false);
  });

  it('samler schema-sektioner, feltissues og UI-metadata til fejlrapporten', () => {
    const readPersistedSection = vi.fn((pageKey: PersistedSectionKey) =>
      pageKey === 'stamdata' ? { kilde: 'test' } : null,
    );
    const getSectionFieldIssues = vi.fn((pageKey: PersistedSectionKey) => ({ pageKey, issues: [] }));
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilename, 'sag.eo');

    const { result } = renderMonitoring({ readPersistedSection, getSectionFieldIssues });
    expect(result.current.getExtraSections().find((section) => section.title === 'UI metadata')?.data).toMatchObject({
      lastSavedFilenameBasis: null,
    });
    readPersistedSection.mockClear();
    getSectionFieldIssues.mockClear();
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, JSON.stringify({ revision: 7 }));

    const sections = result.current.getExtraSections();
    const persisted = sections.find((section) => section.title === 'Persisted brugerinput (schema-valideret)');
    const fieldIssues = sections.find((section) => section.title === 'Feltissues');
    const uiMeta = sections.find((section) => section.title === 'UI metadata');

    expect(readPersistedSection).toHaveBeenCalledTimes(Object.keys(persistenceSchemas).length);
    expect(getSectionFieldIssues).toHaveBeenCalledTimes(Object.keys(persistenceSchemas).length);
    expect(persisted?.data).toMatchObject({ stamdata: { kilde: 'test' }, satser: null });
    expect(fieldIssues?.data).toMatchObject({ stamdata: { pageKey: 'stamdata', issues: [] } });
    expect(uiMeta?.data).toEqual({
      lastSavedFilename: 'sag.eo',
      lastSavedFilenameBasis: { revision: 7 },
      route: { pathname: '/stamdata', search: '?side=1', hash: '#top' },
    });

    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{ikke-json');
    expect(result.current.getExtraSections().find((section) => section.title === 'UI metadata')?.data).toMatchObject({
      lastSavedFilenameBasis: '{ikke-json',
    });
  });

  it('fjerner en ventende timer ved unmount og opdaterer route ved ændring', () => {
    vi.useFakeTimers();
    const initialLocation = location();
    const nextLocation = location('/satser', '', '#rates');
    const readPersistedSection = vi.fn(() => null);
    const getSectionFieldIssues = vi.fn(() => null);
    const { rerender, unmount } = renderHook(
      ({ currentLocation }: { currentLocation: Location }) => useDevtoolsMonitoring({
        readPersistedSection,
        getSectionFieldIssues,
        location: currentLocation,
      }),
      { initialProps: { currentLocation: initialLocation } },
    );

    const issue = buildIssue(2);
    act(() => {
      listener?.(buildSnapshot([issue]), issue);
    });
    rerender({ currentLocation: nextLocation });
    expect(devtoolsMocks.setDevtoolsRoute).toHaveBeenLastCalledWith('/satser#rates');

    unmount();
    expect(devtoolsMocks.unsubscribe).toHaveBeenCalledOnce();
    expect(devtoolsMocks.stop).toHaveBeenCalledOnce();
    act(() => {
      vi.advanceTimersByTime(0);
    });
  });
});
