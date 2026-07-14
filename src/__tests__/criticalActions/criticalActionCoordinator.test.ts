// @vitest-environment jsdom
import {
  CriticalActionCoordinator,
  type CriticalAction,
  type CriticalActionParticipant,
} from '../../criticalActions/criticalActionCoordinator';

const registerEditingParticipant = (
  coordinator: CriticalActionCoordinator,
  overrides: Partial<CriticalActionParticipant> = {},
) => coordinator.register({
  id: 'participant',
  kind: 'form-field',
  isEditing: () => true,
  commit: () => true,
  ...overrides,
});

describe('CriticalActionCoordinator', () => {
  it.each<CriticalAction>(['save', 'load', 'navigate', 'undo', 'redo', 'download'])(
    'godkender %s uden deltagere uden browser-ticks',
    async (action) => {
      const coordinator = new CriticalActionCoordinator();

      await expect(coordinator.prepare(action)).resolves.toMatchObject({ status: 'committed' });
    },
  );

  it.each([
    ['load', 'form-field'],
    ['navigate', 'form-field'],
    ['undo', 'form-field'],
    ['redo', 'form-field'],
    ['undo', 'grid-editor'],
    ['redo', 'grid-editor'],
  ] as const)('blokerer %s ved en åben %s uden at committe', async (action, kind) => {
    const coordinator = new CriticalActionCoordinator();
    const commit = vi.fn(() => true);
    registerEditingParticipant(coordinator, { kind, commit });

    await expect(coordinator.prepare(action)).resolves.toMatchObject({
      status: 'blocked',
      reason: 'editor-open',
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it.each([
    ['save', 'form-field'],
    ['save', 'grid-editor'],
    ['load', 'grid-editor'],
    ['navigate', 'grid-editor'],
    ['download', 'form-field'],
    ['download', 'grid-editor'],
  ] as const)('committer en åben %s-deltager før %s fortsætter', async (action, kind) => {
    const coordinator = new CriticalActionCoordinator();
    const commit = vi.fn(() => true);
    registerEditingParticipant(coordinator, { kind, commit });

    await expect(coordinator.prepare(action)).resolves.toMatchObject({ status: 'committed' });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('afventer eksplicit commit og pipeline-kvittering i deterministisk rækkefølge', async () => {
    const coordinator = new CriticalActionCoordinator();
    const events: string[] = [];
    let resolveCommit: (value: boolean) => void = () => undefined;
    let resolvePipeline: () => void = () => undefined;
    const commitPromise = new Promise<boolean>((resolve) => { resolveCommit = resolve; });
    const pipelinePromise = new Promise<void>((resolve) => { resolvePipeline = resolve; });

    registerEditingParticipant(coordinator, {
      commit: async () => {
        events.push('commit-start');
        const result = await commitPromise;
        events.push('commit-slut');
        return result;
      },
    });
    coordinator.register({
      id: 'pipeline',
      kind: 'commit-pipeline',
      awaitPendingCommit: async () => {
        events.push('pipeline-start');
        await pipelinePromise;
        events.push('pipeline-slut');
      },
    });

    const preparation = coordinator.prepare('save');
    await vi.waitFor(() => expect(events).toEqual(['commit-start']));
    resolveCommit(true);
    await vi.waitFor(() => expect(events).toEqual(['commit-start', 'commit-slut', 'pipeline-start']));
    resolvePipeline();

    await expect(preparation).resolves.toMatchObject({ status: 'committed' });
    expect(events).toEqual(['commit-start', 'commit-slut', 'pipeline-start', 'pipeline-slut']);
  });

  it.each([
    ['false-resultat', (): boolean => false, 'commit-failed'],
    ['exception', (): boolean => { throw new Error('fejl'); }, 'participant-error'],
    ['afvist promise', async (): Promise<boolean> => { throw new Error('fejl'); }, 'participant-error'],
  ] as const)('fejler lukket ved %s', async (_label, commit, reason) => {
    const coordinator = new CriticalActionCoordinator();
    registerEditingParticipant(coordinator, { commit });

    await expect(coordinator.prepare('save')).resolves.toMatchObject({ status: 'blocked', reason });
  });

  it('fejler lukket når en persistence-kvittering afvises', async () => {
    const coordinator = new CriticalActionCoordinator();
    coordinator.register({
      id: 'pipeline',
      kind: 'commit-pipeline',
      awaitPendingCommit: async () => { throw new Error('persistensfejl'); },
    });

    await expect(coordinator.prepare('save')).resolves.toMatchObject({
      status: 'blocked',
      reason: 'participant-error',
      participantId: 'pipeline',
    });
  });

  it('håndhæver unik registrering og symmetrisk lifecycle', () => {
    const coordinator = new CriticalActionCoordinator();
    const participant: CriticalActionParticipant = { id: 'samme', kind: 'commit-pipeline' };
    const unregister = coordinator.register(participant);

    expect(() => coordinator.register(participant)).toThrow(/allerede registreret/);
    unregister();
    expect(() => coordinator.register(participant)).not.toThrow();
  });

  it('serialiserer samtidige preparationer', async () => {
    const coordinator = new CriticalActionCoordinator();
    let releaseFirst: () => void = () => undefined;
    const firstCommit = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const commit = vi.fn()
      .mockImplementationOnce(async () => {
        await firstCommit;
        return true;
      })
      .mockResolvedValueOnce(true);
    registerEditingParticipant(coordinator, { commit });

    const first = coordinator.prepare('save');
    const second = coordinator.prepare('save');
    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    releaseFirst();

    await expect(first).resolves.toMatchObject({ status: 'committed' });
    await expect(second).resolves.toMatchObject({ status: 'committed' });
    expect(commit).toHaveBeenCalledTimes(2);
  });
});
