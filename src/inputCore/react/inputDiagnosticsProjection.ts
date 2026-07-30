import * as React from 'react';
import type { PersistedSectionKey } from '../../config/persistenceRegistry';
import type { FieldIssue } from '../inputIssue';
import {
  useInputReadPort,
  useInternalSettledSnapshot,
} from './inputRuntimeContext';

// Input-diagnostik: devtools-/bugrapport-fladen har et LEGITIMT behov for at se den
// rå persisterede sektionsform — det er hele pointen med en fejlrapport. Men behovet er en NAVNGIVET
// projektion, ikke en generel undtagelse fra §3.4's læsegrænse.
//
// Tidligere greb shellen selv ned i `getSettled().input.sections[pageKey]`. Det var det eneste rå
// sektionsopslag uden for inputinfrastrukturen, og det gjorde grænsen til en aftale frem for en konstruktion.
// Nu ejer dette modul opslaget, og `domain/raw-section-access-boundary` håndhæver, at ingen anden fil uden for
// `src/inputCore/` gør det samme.

/**
 * Én sides diagnostiske øjebliksbillede: den persisterede sektionsform og de feltissues, der hører til
 * sektionen. Bevidst `unknown` for sektionen — en fejlrapport skal vise formen SOM DEN ER, ikke en type,
 * rapporten selv har fortolket.
 */
export type SectionDiagnostics = Readonly<{
  section: unknown;
  issues: readonly FieldIssue[];
}>;

export type InputDiagnosticsProjection = Readonly<{
  /** Den persisterede sektionsform for én side, eller `null` hvis siden intet har persisteret. */
  readSection: (pageKey: PersistedSectionKey) => unknown;
  /** De aktuelle feltissues, hvis feltadresse hører til sektionen. */
  readSectionIssues: (pageKey: PersistedSectionKey) => readonly FieldIssue[];
}>;

/**
 * Diagnostikprojektionen bundet til den runtime, React-træet faktisk viser.
 *
 * Bevidst bundet til bindingen frem for produktions-singletonen: en fejlrapport, der viser en anden sag end
 * den, brugeren ser, er værre end ingen rapport. Ren læsning — der er ingen skrivevej herfra.
 */
export const useInputDiagnostics = (): InputDiagnosticsProjection => {
  const read = useInputReadPort();
  const { input } = useInternalSettledSnapshot();
  // Memoiseret pr. binding: consumeren pakker opslagene i egne `useCallback`s, og en ny projektion pr. render
  // ville gøre dem ustabile og genregistrere devtools-abonnementet ved hver render.
  return React.useMemo(
    () => Object.freeze({
      readSection: (pageKey: PersistedSectionKey): unknown => input.sections[pageKey] ?? null,
      readSectionIssues: (pageKey: PersistedSectionKey): readonly FieldIssue[] =>
        Object.freeze(read.getEvaluation().issues.all.filter(
          (issue) => issue.field.address.section === pageKey
        )),
    }),
    [input, read]
  );
};
