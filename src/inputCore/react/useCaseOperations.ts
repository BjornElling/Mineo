import * as React from 'react';
import {
  createCaseFileOperations,
  type CaseFileOperations,
} from '../../persistence/caseFileOperations';
import {
  createCaseResetOperations,
  type CaseResetOperations,
} from '../../persistence/caseResetOperations';
import { createProductionNewCaseSeed } from '../../domain/newCaseSeed';
import type { AppSettings } from '../../settings/appSettingsSchema';
import { clearCase, replaceCase } from '../inputReducer';
import { createNewCaseInput } from '../runtime/newCaseInput';
import { useCaseRuntimeAccess } from './inputRuntimeContext';

// React-laget (§3.10): den tynde bro, der binder de framework-frie case-porte til produktions-runtime.
// Shell-use-casen (`useFileSaveLoad`) forbruger portene herfra.
// Broen eksponerer hverken rå sektioner eller skrivbare hel-sektionshooks – kun de to porte, hvis grænseflader
// selv er rene (`CaseRuntimeAccess`/`CaseResetRuntimeAccess`). `replaceCase`/`clearCase` udstedes gennem
// bindingens system-command-port (`system.replaceCase`), aldrig gennem surface-`dispatch`.

export type CaseOperations = Readonly<{
  file: CaseFileOperations;
  reset: CaseResetOperations;
}>;

/**
 * Samler `CaseFileOperations` og `CaseResetOperations` mod produktions-runtime. Alt er memoiseret pr.
 * binding, så portene er referentielt stabile mellem renders (de rører kun de levende singletons ved kald).
 *
 * `settings` gives ind, fordi begge porte har brug for at kunne bygge en HELT NY sag: `Slet alt` genopretter
 * den, og overwrite-gaten måler brugerdata imod den (§1.12). Indstillingerne gives som parameter frem for at
 * blive læst fra en context her, så broen forbliver bundet til præcis den settings-værdi, shellen render'er
 * med – og så porten ikke får en skjult afhængighed til AppSettings-contexten.
 */
export const useCaseOperations = (settings: AppSettings): CaseOperations => {
  const runtime = useCaseRuntimeAccess();
  const seedNewCase = React.useMemo(() => createProductionNewCaseSeed(settings), [settings]);

  return React.useMemo(() => {
    const file = createCaseFileOperations({
      catalog: runtime.catalog,
      // Læs gennem BINDINGENS read-only kildeport, ikke produktions-singletonen: porten skal se præcis den
      // runtime, React-træet viser. Ellers kunne en alternativ/testbinding vise én sag, mens save læste en anden.
      getSettledInput: () => runtime.captureStableSource().input,
      getNewCaseInput: () => createNewCaseInput(runtime.catalog, seedNewCase),
      // Frisk, stabilt {input, token}-snapshot til save-projektionen (§3.9 pkt. 2).
      captureSaveSource: () => runtime.captureStableSource(),
      applyReplaceCase: (candidate) => {
        runtime.replaceCase(replaceCase(candidate));
      },
    });

    const reset = createCaseResetOperations({
      coordinator: runtime.criticalActions,
      dispatchClearCase: () => runtime.replaceCase(clearCase(seedNewCase)),
    });

    return Object.freeze({ file, reset });
  }, [runtime, seedNewCase]);
};
