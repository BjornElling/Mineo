import * as React from 'react';
import {
  CriticalActionCoordinator,
  type CriticalActionParticipant,
} from './criticalActionCoordinator';

const CriticalActionContext = React.createContext<CriticalActionCoordinator | null>(null);

export const CriticalActionProvider = ({ children }: React.PropsWithChildren) => {
  const [coordinator] = React.useState(() => new CriticalActionCoordinator());
  return (
    <CriticalActionContext.Provider value={coordinator}>
      {children}
    </CriticalActionContext.Provider>
  );
};

export const useCriticalActionCoordinator = (): CriticalActionCoordinator => {
  const coordinator = React.useContext(CriticalActionContext);
  if (!coordinator) {
    throw new Error('useCriticalActionCoordinator skal bruges under CriticalActionProvider.');
  }
  return coordinator;
};

/** Isolerede komponenttests kan mangle app-shell; produktions-apps leverer altid coordinatoren. */
export const useOptionalCriticalActionCoordinator = (): CriticalActionCoordinator | null =>
  React.useContext(CriticalActionContext);

export const useCriticalActionParticipant = (participant: CriticalActionParticipant): void => {
  const coordinator = React.useContext(CriticalActionContext);
  const latestParticipantRef = React.useRef(participant);
  React.useLayoutEffect(() => {
    latestParticipantRef.current = participant;
  });

  const participantId = participant.id;
  React.useLayoutEffect(() => {
    // Isolerede komponenttests og design-preview kan rendere et felt uden app-shell.
    // I de to runtime-apps er provideren obligatorisk og ligger over alle input-surfaces.
    if (!coordinator) return;
    const proxy: CriticalActionParticipant = {
      id: participantId,
      kind: participant.kind,
      isEditing: () => latestParticipantRef.current.isEditing?.() ?? false,
      getFocusTarget: () => latestParticipantRef.current.getFocusTarget?.() ?? null,
      commit: () => latestParticipantRef.current.commit?.() ?? false,
      awaitPendingCommit: () => latestParticipantRef.current.awaitPendingCommit?.(),
    };
    return coordinator.register(proxy);
  }, [coordinator, participant.kind, participantId]);
};
