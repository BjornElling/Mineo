import type { ReadyInputRevision } from '../../domain/inputIntegrity/inputBlocker';
import { getCommittedChangeCounterSnapshot } from '../../stores/formPersistenceReadModel';

/**
 * Servicegrænsens fail-closed revisionskontrol. Dokumentinput er bygget fra samme ready-projektion;
 * hvis inputaggregaten siden har ændret sig, må generatoren ikke starte på den forældede model.
 */
export const isReadyInputRevisionCurrent = (revision: ReadyInputRevision): boolean =>
  getCommittedChangeCounterSnapshot() === revision;
