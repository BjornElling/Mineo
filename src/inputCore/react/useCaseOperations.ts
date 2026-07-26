import * as React from 'react';
import {
  createCaseFileOperations,
  type CaseFileOperations,
} from '../../persistence/caseFileOperations';
import {
  createCaseResetOperations,
  type CaseResetOperations,
} from '../../persistence/caseResetOperations';
import { clearCase, replaceCase } from '../inputReducer';
import { useCaseRuntimeAccess } from './inputRuntimeContext';

// Greenfield-React (§3.10): den tynde bro, der binder de framework-frie case-porte til produktions-runtime.
// Shell-use-casen (`useFileSaveLoad`) forbruger portene HERFRA i stedet for den legacy `FormPersistenceContext`.
// Broen eksponerer hverken rå sektioner eller skrivbare hel-sektionshooks — kun de to porte, hvis grænseflader
// selv er rene (`CaseRuntimeAccess`/`CaseResetRuntimeAccess`). `replaceCase`/`clearCase` udstedes gennem
// bindingens system-command-port (`system.replaceCase`), aldrig gennem surface-`dispatch`.

export type CaseOperations = Readonly<{
  file: CaseFileOperations;
  reset: CaseResetOperations;
}>;

/**
 * Samler `CaseFileOperations` og `CaseResetOperations` mod produktions-runtime. Alt er memoiseret pr.
 * binding, så portene er referentielt stabile mellem renders (de rører kun de levende singletons ved kald).
 */
export const useCaseOperations = (): CaseOperations => {
  const runtime = useCaseRuntimeAccess();

  return React.useMemo(() => {
    const file = createCaseFileOperations({
      catalog: runtime.catalog,
      // Læs gennem BINDINGENS read-only kildeport, ikke produktions-singletonen: porten skal se præcis den
      // runtime, React-træet viser. Ellers kunne en alternativ/testbinding vise én sag, mens save læste en anden.
      getSettledInput: () => runtime.captureStableSource().input,
      // Frisk, stabilt {input, token}-snapshot til save-projektionen (§3.9 pkt. 2).
      captureSaveSource: () => runtime.captureStableSource(),
      applyReplaceCase: (candidate) => {
        runtime.replaceCase(replaceCase(candidate));
      },
    });

    const reset = createCaseResetOperations({
      coordinator: runtime.criticalActions,
      dispatchClearCase: () => runtime.replaceCase(clearCase()),
    });

    return Object.freeze({ file, reset });
  }, [runtime]);
};
