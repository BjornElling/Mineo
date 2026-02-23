// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { createActiveTabStorageKey } from '../../config/storageManifest';

// ─── Harness ──────────────────────────────────────────────────────────────────

type Tab = 'tab-a' | 'tab-b' | 'tab-c';

const ALLOWED: readonly Tab[] = ['tab-a', 'tab-b', 'tab-c'];
const PAGE_ID = 'test-page';

type HarnessResult = {
  activeTab: Tab;
  setActiveTab: (next: Tab) => void;
  isAllowedTab: (v: unknown) => v is Tab;
};

let lastResult: HarnessResult | null = null;

const Harness = ({
  pageId = PAGE_ID,
  allowedTabs = ALLOWED,
  defaultTab = 'tab-a' as Tab,
  legacySource,
}: Partial<React.ComponentProps<typeof HarnessImpl>>) => (
  <HarnessImpl
    pageId={pageId}
    allowedTabs={allowedTabs}
    defaultTab={defaultTab}
    legacySource={legacySource}
  />
);

type HarnessImplProps = {
  pageId: string;
  allowedTabs: readonly Tab[];
  defaultTab: Tab;
  legacySource?: Parameters<typeof usePersistedActiveTab<Tab>>[0]['legacySource'];
};

const HarnessImpl = ({ pageId, allowedTabs, defaultTab, legacySource }: HarnessImplProps) => {
  const result = usePersistedActiveTab<Tab>({ pageId, allowedTabs, defaultTab, legacySource });
  lastResult = result;
  return null;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePersistedActiveTab', () => {
  beforeEach(() => {
    sessionStorage.clear();
    lastResult = null;
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('returns defaultTab when sessionStorage is empty', () => {
    render(<Harness defaultTab="tab-b" />);
    expect(lastResult!.activeTab).toBe('tab-b');
  });

  it('restores persisted tab from sessionStorage on mount', () => {
    const key = createActiveTabStorageKey(PAGE_ID);
    sessionStorage.setItem(key, 'tab-c');

    render(<Harness />);
    expect(lastResult!.activeTab).toBe('tab-c');
  });

  it('falls back to defaultTab when sessionStorage contains an unknown tab value', () => {
    const key = createActiveTabStorageKey(PAGE_ID);
    sessionStorage.setItem(key, 'tab-unknown');

    render(<Harness defaultTab="tab-a" />);
    expect(lastResult!.activeTab).toBe('tab-a');
  });

  // ── setActiveTab ───────────────────────────────────────────────────────────

  it('setActiveTab updates activeTab to an allowed value', async () => {
    render(<Harness />);
    expect(lastResult!.activeTab).toBe('tab-a');

    await act(async () => {
      lastResult!.setActiveTab('tab-b');
    });

    expect(lastResult!.activeTab).toBe('tab-b');
  });

  it('setActiveTab is a no-op for a value not in allowedTabs', async () => {
    render(<Harness defaultTab="tab-a" />);

    await act(async () => {
      lastResult!.setActiveTab('tab-z' as Tab);
    });

    expect(lastResult!.activeTab).toBe('tab-a');
  });

  // ── sessionStorage persistence ─────────────────────────────────────────────

  it('persists activeTab to sessionStorage after setActiveTab', async () => {
    render(<Harness pageId="persist-test" />);

    await act(async () => {
      lastResult!.setActiveTab('tab-c');
    });

    const key = createActiveTabStorageKey('persist-test');
    expect(sessionStorage.getItem(key)).toBe('tab-c');
  });

  it('persists defaultTab to sessionStorage on initial render', async () => {
    render(<Harness pageId="default-persist" defaultTab="tab-b" />);

    // The useEffect that writes to sessionStorage fires after render.
    await act(async () => {});

    const key = createActiveTabStorageKey('default-persist');
    expect(sessionStorage.getItem(key)).toBe('tab-b');
  });

  // ── isAllowedTab ───────────────────────────────────────────────────────────

  it('isAllowedTab returns true for each allowed tab', () => {
    render(<Harness />);
    expect(lastResult!.isAllowedTab('tab-a')).toBe(true);
    expect(lastResult!.isAllowedTab('tab-b')).toBe(true);
    expect(lastResult!.isAllowedTab('tab-c')).toBe(true);
  });

  it('isAllowedTab returns false for non-string and unknown values', () => {
    render(<Harness />);
    expect(lastResult!.isAllowedTab('tab-z')).toBe(false);
    expect(lastResult!.isAllowedTab(42)).toBe(false);
    expect(lastResult!.isAllowedTab(null)).toBe(false);
    expect(lastResult!.isAllowedTab(undefined)).toBe(false);
  });

  // ── Legacy migration ───────────────────────────────────────────────────────

  it('reads legacy tab from a persisted section when UI key is absent', () => {
    // Simulate a legacy persisted page that embeds activeTab in its .data blob.
    sessionStorage.setItem(
      'mineo_renteberegning',
      JSON.stringify({
        version: '1',
        timestamp: Date.now(),
        data: { legacyActiveTab: 'tab-c' },
      })
    );

    render(
      <Harness
        pageId="legacy-test"
        legacySource={{ persistedPageKey: 'renteberegning', fieldName: 'legacyActiveTab' }}
      />
    );

    expect(lastResult!.activeTab).toBe('tab-c');
  });

  it('ignores legacy value when UI key is already set', () => {
    const uiKey = createActiveTabStorageKey('legacy-override-test');
    sessionStorage.setItem(uiKey, 'tab-b');
    sessionStorage.setItem(
      'mineo_renteberegning',
      JSON.stringify({
        version: '1',
        timestamp: Date.now(),
        data: { legacyActiveTab: 'tab-c' },
      })
    );

    render(
      <Harness
        pageId="legacy-override-test"
        legacySource={{ persistedPageKey: 'renteberegning', fieldName: 'legacyActiveTab' }}
      />
    );

    // UI key wins over legacy
    expect(lastResult!.activeTab).toBe('tab-b');
  });

  it('ignores legacy value when it is not in allowedTabs', () => {
    sessionStorage.setItem(
      'mineo_renteberegning',
      JSON.stringify({
        version: '1',
        timestamp: Date.now(),
        data: { legacyActiveTab: 'not-a-real-tab' },
      })
    );

    render(
      <Harness
        pageId="legacy-invalid-test"
        defaultTab="tab-a"
        legacySource={{ persistedPageKey: 'renteberegning', fieldName: 'legacyActiveTab' }}
      />
    );

    expect(lastResult!.activeTab).toBe('tab-a');
  });

  it('ignores legacy source when the raw sessionStorage value is not valid JSON', () => {
    sessionStorage.setItem('mineo_renteberegning', 'not-json!!!');

    render(
      <Harness
        pageId="legacy-bad-json"
        defaultTab="tab-a"
        legacySource={{ persistedPageKey: 'renteberegning', fieldName: 'legacyActiveTab' }}
      />
    );

    expect(lastResult!.activeTab).toBe('tab-a');
  });
});
