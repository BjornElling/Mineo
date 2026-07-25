import React from 'react';
import type { EetImportSource } from '../domain/erhvervsevnetab/eetImportPort';
import { buildMidlertidigtEetInsertSource } from '../domain/erhvervsevnetab/midlertidigtEetInsertSource';
import { useInputEvaluation } from '../inputCore/react';

/**
 * React-adapteren til `buildMidlertidigtEetInsertSource`. Builderen selv ligger i domænelaget
 * (`domain/erhvervsevnetab/midlertidigtEetInsertSource.ts`), så ikke-React-konsumenter — fx EO's
 * dokumentdefinition — kan bruge den uden at trække React ind.
 */
export const useMidlertidigtEetInsertSource = (): EetImportSource => {
  const evaluation = useInputEvaluation();
  return React.useMemo(() => buildMidlertidigtEetInsertSource(evaluation), [evaluation]);
};

export { buildMidlertidigtEetInsertSource };
