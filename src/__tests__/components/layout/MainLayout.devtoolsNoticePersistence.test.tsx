import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../contexts/FormPersistenceContext';
import type { DevtoolsIssue, DevtoolsIssueSnapshot } from '../../../utils/devtoolsMonitor';

type DevtoolsIssueListener = (snapshot: DevtoolsIssueSnapshot, issue: DevtoolsIssue) => void;

const devtoolsMocks = vi.hoisted(() => ({
  getDevtoolsIssueSnapshot: vi.fn(),
  setDevtoolsRoute: vi.fn(),
  startDevtoolsMonitor: vi.fn(() => vi.fn()),
  subscribeDevtoolsIssues: vi.fn((_listener: DevtoolsIssueListener) => vi.fn()),
}));

vi.mock('../../../utils/devtoolsMonitor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/devtoolsMonitor')>();
  return {
    ...actual,
    getDevtoolsIssueSnapshot: devtoolsMocks.getDevtoolsIssueSnapshot,
    setDevtoolsRoute: devtoolsMocks.setDevtoolsRoute,
    startDevtoolsMonitor: devtoolsMocks.startDevtoolsMonitor,
    subscribeDevtoolsIssues: devtoolsMocks.subscribeDevtoolsIssues,
  };
});

import MainLayout from '../../../components/layout/MainLayout';

const buildIssue = (id: number): DevtoolsIssue => ({
  id,
  correlationId: `DVT-C${id}`,
  category: 'runtime',
  level: 'warn',
  source: 'console',
  timestamp: '2026-02-15T13:43:10.711Z',
  message: `Test issue #${id}`,
  args: [`Test issue #${id}`],
});

const buildSnapshot = (issues: DevtoolsIssue[]): DevtoolsIssueSnapshot => ({
  issues,
  counts: {
    warn: issues.filter((issue) => issue.level === 'warn').length,
    error: issues.filter((issue) => issue.level === 'error').length,
  },
  lastIssue: issues.length > 0 ? issues[issues.length - 1] : null,
  timeline: [],
  runtime: {
    route: '/stamdata',
    visibility: 'visible',
    providers: {},
    testScenario: null,
  },
});

const renderLayout = () =>
  render(
    <AppSettingsProvider>
      <FormPersistenceProvider>
        <MemoryRouter initialEntries={['/stamdata']}>
          <MainLayout>
            <div />
          </MainLayout>
        </MemoryRouter>
      </FormPersistenceProvider>
    </AppSettingsProvider>,
  );

describe('MainLayout (devtools notice persistence)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    devtoolsMocks.getDevtoolsIssueSnapshot.mockReturnValue(buildSnapshot([]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('viser ikke notice for allerede sete issues fra initial snapshot', () => {
    sessionStorage.setItem('mineo_ui_devtools_lastSeenIssueId', '1');
    devtoolsMocks.getDevtoolsIssueSnapshot.mockReturnValue(buildSnapshot([buildIssue(1)]));

    renderLayout();

    expect(screen.queryByText('Teknisk advarsel registreret')).toBeNull();
  });

  it('viser notice når initial snapshot indeholder nyere issue-id', async () => {
    sessionStorage.setItem('mineo_ui_devtools_lastSeenIssueId', '1');
    devtoolsMocks.getDevtoolsIssueSnapshot.mockReturnValue(buildSnapshot([buildIssue(2)]));

    renderLayout();

    expect(await screen.findByText('Teknisk advarsel registreret')).toBeInTheDocument();
  });

  it('viser ny notice efter kort suppression-vindue, hvis ny issue kommer lige efter skjul', async () => {
    vi.useFakeTimers();
    let listener: ((snapshot: DevtoolsIssueSnapshot, issue: DevtoolsIssue) => void) | null = null;
    devtoolsMocks.subscribeDevtoolsIssues.mockImplementation((callback) => {
      listener = callback;
      return vi.fn();
    });

    renderLayout();

    const firstIssue = buildIssue(1);
    await act(async () => {
      listener?.(buildSnapshot([firstIssue]), firstIssue);
    });

    expect(screen.getByText('Teknisk advarsel registreret')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skjul' }));
    expect(screen.queryByText('Teknisk advarsel registreret')).toBeNull();

    const secondIssue = buildIssue(2);
    await act(async () => {
      listener?.(buildSnapshot([firstIssue, secondIssue]), secondIssue);
    });

    expect(screen.queryByText('Teknisk advarsel registreret')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Teknisk advarsel registreret')).toBeInTheDocument();
  });
});
