// @vitest-environment jsdom
import { installFileOperationLocks } from '../fixtures/fileOperationLocks';
import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';

type ClientModule = typeof import('../../utils/fileOperationClientSession');

describe('fileOperationClientSession – kopierede faner og dokumentlivscyklus', () => {
  let restoreLocks: () => void;
  let modules: ClientModule[];
  const loadClient = async (): Promise<ClientModule> => {
    vi.resetModules();
    const client = await import('../../utils/fileOperationClientSession');
    modules.push(client);
    return client;
  };

  beforeEach(() => {
    modules = [];
    sessionStorage.clear();
    restoreLocks = installFileOperationLocks();
  });

  afterEach(() => {
    for (const client of modules) client.__resetFileOperationClientSessionForTests();
    restoreLocks();
    sessionStorage.clear();
  });

  it('giver en kopieret klient nyt scope mens det oprindelige dokument beholder sit eget', async () => {
    const first = await loadClient();
    const original = await first.ensureFileOperationClientSession();
    const copied = await loadClient();
    const duplicate = await copied.ensureFileOperationClientSession();

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.reloadStable).toBe(true);
    expect(first.getFileOperationClientSessionId()).toBe(original.id);
    expect(copied.getFileOperationClientSessionId()).toBe(duplicate.id);
  });

  it('bevarer scope gennem reload når forgængeren har frigivet sit ejerskab', async () => {
    const first = await loadClient();
    const original = await first.ensureFileOperationClientSession();
    first.__resetFileOperationClientSessionForTests();
    const reloaded = await loadClient();

    expect(await reloaded.ensureFileOperationClientSession()).toMatchObject({ id: original.id, reloadStable: true });
  });

  it('deler én initiering mellem samtidige filoperationer', async () => {
    const client = await loadClient();
    const sessions = await Promise.all(Array.from({ length: 6 }, () => client.ensureFileOperationClientSession()));

    expect(new Set(sessions.map((session) => session.id)).size).toBe(1);
    expect(sessions.every((session) => session.reloadStable)).toBe(true);
  });

  it('bruger altid nyt scope efter pagehide uden en pageshow-lytter', async () => {
    const client = await loadClient();
    const original = await client.ensureFileOperationClientSession();
    window.dispatchEvent(new Event('pagehide'));
    const resumed = await client.ensureFileOperationClientSession();

    expect(resumed.id).not.toBe(original.id);
    expect(resumed.resumedAfterPageHide).toBe(true);
    expect(resumed.reloadStable).toBe(true);
  });

  it('genbruger ikke et scope når pagehide kommer under den asynkrone lock-anmodning', async () => {
    const originalId = 'owned:client-navigation-during-acquisition';
    sessionStorage.setItem(getFileOperationClientSessionStorageKey(), originalId);
    const client = await loadClient();
    const initializing = client.ensureFileOperationClientSession();
    window.dispatchEvent(new Event('pagehide'));

    const session = await initializing;

    expect(session.id).not.toBe(originalId);
    expect(session.resumedAfterPageHide).toBe(true);
    let originalReleased = false;
    await navigator.locks.request(`mineo-file-client:${originalId}`, { ifAvailable: true }, async (lock) => {
      originalReleased = lock !== null;
    });
    expect(originalReleased).toBe(true);
  });

  it('frigiver først gammelt scope når en allerede startet storage-operation er afsluttet', async () => {
    const first = await loadClient();
    let enteredScope: string | null = null;
    let complete: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { complete = resolve; });
    const operation = first.withFileOperationClientSession(async ({ id }) => {
      enteredScope = id;
      await blocked;
      return id;
    });
    await vi.waitFor(() => expect(enteredScope).not.toBeNull());
    window.dispatchEvent(new Event('pagehide'));
    const copied = await loadClient();
    const duplicate = await copied.ensureFileOperationClientSession();

    expect(duplicate.id).not.toBe(enteredScope);
    complete?.();
    expect(await operation).toBe(enteredScope);
    let released = false;
    await navigator.locks.request(`mineo-file-client:${enteredScope}`, { ifAvailable: true }, async (lock) => {
      released = lock !== null;
    });
    expect(released).toBe(true);
  });

  it.each(['missing', 'rejected'] as const)('genbruger ikke lagret scope når Web Locks er %s', async (failure) => {
    const key = getFileOperationClientSessionStorageKey();
    sessionStorage.setItem(key, 'client-old-persisted-session');
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: failure === 'missing' ? undefined : { request: vi.fn().mockRejectedValue(new Error('Ingen Web Locks-adgang')) },
    });
    const client = await loadClient();
    const session = await client.ensureFileOperationClientSession();

    expect(session.id).toMatch(/^runtime-/);
    expect(session.reloadStable).toBe(false);
    client.__resetFileOperationClientSessionForTests();
    const reloaded = await loadClient();
    expect((await reloaded.ensureFileOperationClientSession()).id).not.toBe(session.id);
  });
});
