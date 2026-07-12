import { createElementFocusTarget } from './focusTarget';

export type CriticalAction = 'save' | 'load' | 'navigate' | 'undo' | 'redo';

export type CriticalActionParticipantKind = 'form-field' | 'grid-editor' | 'commit-pipeline';

export type CriticalActionFocusTarget = Readonly<{
  focus: () => void;
}>;

export type CriticalActionParticipant = Readonly<{
  id: string;
  kind: CriticalActionParticipantKind;
  isEditing?: () => boolean;
  getFocusTarget?: () => CriticalActionFocusTarget | null;
  commit?: () => boolean | Promise<boolean>;
  awaitPendingCommit?: () => void | Promise<void>;
}>;

export type CriticalActionBlockedReason = 'editor-open' | 'commit-failed' | 'participant-error';

export type CriticalActionPreparationResult =
  | Readonly<{ status: 'committed'; focusTargetBeforeAction: CriticalActionFocusTarget | null }>
  | Readonly<{
      status: 'blocked';
      reason: CriticalActionBlockedReason;
      participantId: string;
      target: CriticalActionFocusTarget | null;
      focusTargetBeforeAction: CriticalActionFocusTarget | null;
    }>;

type EditingPolicy = 'commit' | 'block';

const EDITING_POLICY: Readonly<Record<CriticalAction, Readonly<Record<'form-field' | 'grid-editor', EditingPolicy>>>> = {
  save: { 'form-field': 'commit', 'grid-editor': 'commit' },
  load: { 'form-field': 'block', 'grid-editor': 'commit' },
  navigate: { 'form-field': 'block', 'grid-editor': 'commit' },
  undo: { 'form-field': 'block', 'grid-editor': 'block' },
  redo: { 'form-field': 'block', 'grid-editor': 'block' },
};

const participantPriority = (kind: CriticalActionParticipantKind): number => {
  if (kind === 'grid-editor') return 0;
  if (kind === 'form-field') return 1;
  return 2;
};

/**
 * Koordinerer alle handlinger, der kan aflæse, erstatte eller unmount'e committed state.
 * Deltagerne er eksplicit registrerede; korrekthed afhænger derfor hverken af DOM-scanning
 * eller af faste browser-/render-ticks.
 */
export class CriticalActionCoordinator {
  private readonly participants = new Map<string, CriticalActionParticipant>();
  private preparationTail: Promise<void> = Promise.resolve();

  register(participant: CriticalActionParticipant): () => void {
    if (this.participants.has(participant.id)) {
      throw new Error(`CriticalActionCoordinator: deltager-id er allerede registreret: ${participant.id}`);
    }
    this.participants.set(participant.id, participant);
    return () => {
      if (this.participants.get(participant.id) !== participant) {
        throw new Error(`CriticalActionCoordinator: deltageren er ikke registreret ved afmelding: ${participant.id}`);
      }
      this.participants.delete(participant.id);
    };
  }

  prepare(action: CriticalAction): Promise<CriticalActionPreparationResult> {
    // Preparationer serialiseres, så to samtidige kritiske handlinger aldrig committer
    // den samme åbne editor parallelt. Det efterfølgende I/O-flow ejes fortsat af use-casen.
    const preparation = this.preparationTail
      .catch(() => undefined)
      .then(() => this.prepareSerial(action));
    this.preparationTail = preparation.then(
      () => undefined,
      () => undefined,
    );
    return preparation;
  }

  private async prepareSerial(action: CriticalAction): Promise<CriticalActionPreparationResult> {
    const activeElement =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusTargetBeforeAction = activeElement
      ? createElementFocusTarget(() => activeElement)
      : null;
    try {
      return await this.prepareParticipants(action, focusTargetBeforeAction);
    } catch {
      return {
        status: 'blocked',
        reason: 'participant-error',
        participantId: 'critical-action-coordinator',
        target: null,
        focusTargetBeforeAction,
      };
    }
  }

  private async prepareParticipants(
    action: CriticalAction,
    focusTargetBeforeAction: CriticalActionFocusTarget | null,
  ): Promise<CriticalActionPreparationResult> {
    const participants = [...this.participants.values()].sort(
      (left, right) => participantPriority(left.kind) - participantPriority(right.kind),
    );

    for (const participant of participants) {
      if (participant.kind === 'commit-pipeline' || participant.isEditing?.() !== true) continue;
      const policy = EDITING_POLICY[action][participant.kind];
      if (policy === 'block') {
        return {
          status: 'blocked',
          reason: 'editor-open',
          participantId: participant.id,
          target: participant.getFocusTarget?.() ?? null,
          focusTargetBeforeAction,
        };
      }
    }

    for (const participant of participants) {
      if (participant.kind === 'commit-pipeline' || participant.isEditing?.() !== true) continue;
      try {
        const committed = await participant.commit?.();
        if (committed !== true) {
          return {
            status: 'blocked',
            reason: 'commit-failed',
            participantId: participant.id,
            target: participant.getFocusTarget?.() ?? null,
            focusTargetBeforeAction,
          };
        }
      } catch {
        return {
          status: 'blocked',
          reason: 'participant-error',
          participantId: participant.id,
          target: participant.getFocusTarget?.() ?? null,
          focusTargetBeforeAction,
        };
      }
    }

    for (const participant of participants) {
      if (participant.kind !== 'commit-pipeline') continue;
      try {
        await participant.awaitPendingCommit?.();
      } catch {
        return {
          status: 'blocked',
          reason: 'participant-error',
          participantId: participant.id,
          target: participant.getFocusTarget?.() ?? null,
          focusTargetBeforeAction,
        };
      }
    }

    return { status: 'committed', focusTargetBeforeAction };
  }
}
