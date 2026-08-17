import * as React from 'react';
import { serializeFieldAddress } from '../fieldAddress';
import type { FieldIssue } from '../inputIssue';
import { useInputReadPort } from './inputRuntimeContext';
import {
  EDITOR_LOCATION_ATTR,
  EDITOR_ROUTE_ATTR,
  EDITOR_TAB_ATTR,
  FIELD_ADDRESS_ATTR,
} from './historyRestoreTarget';

// Automatiserings-introspektion: en maskinlæsbar UDLÆSNING af den afsluttede evaluerings issue-tilstand,
// til brug for e2e-tests og den eksterne interaktionsaudit.
//
// Baggrunden er konkret. Auditworkerens driftslog viste, at næsten al spildt tid gik med at GÆTTE
// tilstanden gennem DOM'en: accessible names kolliderer (`Årsløn` findes to steder, `Regulering` matcher
// også `Tillad regulering`), snapshot-refs invalideres af enhver re-render, og en rød feltkant kan i
// DOM'en ikke skelne rejected råtekst fra en canonical bounds-fejl — netop den skelnen, save-gaten
// afhænger af (§1.6). Den viden FINDES i evalueringen; den var bare ikke tilgængelig udefra.
//
// Broen er derfor bevidst afgrænset:
//
//   - Ingen skrivevej. Der eksporteres ingen setter, ingen commit og ingen edit-port. En automatisering
//     skal fremkalde en ændring gennem den samme brugerflade som mennesket, ellers ville testen bevise
//     noget om broen frem for om programmet.
//   - Ingen ny læsegrænse. Alt hentes gennem den eksisterende `InputReadPort` (§3.4) og de attributter,
//     `historyRestoreTarget` allerede ejer. Broen tilføjer ikke en parallel feltidentitet — den eksponerer
//     den ENE, `input/single-field-identity-in-dom` allerede håndhæver.
//   - Ingen canonical værdiudlæsning. `InputReader.read` er bevidst `FieldRef`-baseret og kan ikke drives
//     af en løs adressestreng; en adresse→værdi-vej her ville være præcis det parallelle opslag, kernen
//     undgår. Broen eksponerer derfor issue- og rejected-tilstanden — det, orakelarbejdet mangler — og
//     lader værdien blive aflæst i feltet, hvor brugeren også ser den.
//   - Kun DEV/test. Se `bridgeIsAllowed`.

/** Ét felts maskinlæsbare issue-tilstand, nøglet på samme adresse som DOM-attributten. */
export type AutomationFieldState = Readonly<{
  /** Den serialiserede feltadresse — samme streng som DOM-attributten, så udlæsning og målretning matcher. */
  address: string;
  /** Feltets stabile descriptor-id. */
  fieldId: string;
  /** Feltets brugervendte navn, kontekstuelt opløst — det navn, brugeren faktisk ser. */
  label: string;
  /**
   * `true` når feltets aktuelle repræsentation er rejected råtekst. Det er DENNE tilstand, der blokerer
   * `.eo`-save (§1.6) — ikke issuets farve. En canonical bounds-/rule-fejl er `false` og kan gemmes.
   */
  rejected: boolean;
  /** Det aktive røde issue. */
  issue: Readonly<{ code: string; reason: FieldIssue['reason']; message: string }>;
}>;

/**
 * Den samlede udlæsning. `revision` gør ventetid deterministisk: en automatisering kan vente på, at
 * revisionen ændrer sig, i stedet for at sove et gæt på antal millisekunder — den hyppigste kilde til
 * flaksende e2e-tests.
 */
export type AutomationIntrospectionSnapshot = Readonly<{
  revision: number;
  /** Alle felter med et aktivt rødt issue. */
  fields: readonly AutomationFieldState[];
  /**
   * Adresserne på felter, hvis repræsentation er rejected råtekst — præcis den mængde, save-gaten læser
   * strukturelt. Eksponeret, så en test kan hævde gaten frem for at aflæse en farve.
   */
  rejectedAddresses: readonly string[];
}>;

/** DOM-attributnavnene, så en automatisering kan bygge selectors uden at hardkode dem. */
export const AUTOMATION_FIELD_ATTRIBUTES = Object.freeze({
  fieldAddress: FIELD_ADDRESS_ATTR,
  editorLocationId: EDITOR_LOCATION_ATTR,
  route: EDITOR_ROUTE_ATTR,
  tab: EDITOR_TAB_ATTR,
});

export type AutomationIntrospectionApi = Readonly<{
  /** Hele den afsluttede issue-tilstand. */
  readSnapshot: () => AutomationIntrospectionSnapshot;
  /** Ét felt slået op på sin serialiserede adresse, eller `null` når feltet ikke har et aktivt issue. */
  readField: (serializedAddress: string) => AutomationFieldState | null;
  attributes: typeof AUTOMATION_FIELD_ATTRIBUTES;
}>;

/**
 * Global nøgle. Bevidst ét navn: en automatisering, der skal lede efter flere mulige indgange, ender med
 * samme gætteri, broen skal fjerne.
 */
export const AUTOMATION_BRIDGE_KEY = '__mineoAutomation' as const;

/**
 * Broen må KUN findes i DEV, test og det isolerede E2E-build.
 *
 * `import.meta.env.DEV`/`MODE` er compile-time-konstanter i Vite, så udtrykket foldes til `false` i et
 * produktionsbuild, og installationen bliver unåelig. Det er altså ikke en runtime-flag, en bruger kan slå
 * til. `MODE === 'test'` er med, fordi vitest kører uden `DEV`; `MODE === 'e2e'` er det særskilte,
 * ikke-udrullede preview, som Playwright bygger for stabil browserkontrol.
 *
 * **Verificeret, ikke antaget:** et faktisk `build:mineo` viste, at minifieren folder gaten til `()=>!1`,
 * men BEHOLDER den uåbnelige krop i bundtet. Broen kan altså ikke installere sig i produktion, men
 * `__mineoAutomation` ville stadig optræde som død streng. Derfor er hele effekten pakket i en eksplicit
 * `import.meta.env.PROD`-tidlig-retur i hooken nedenfor OGSÅ — så fraværet er en struktur, ikke en tillid
 * til et bestemt minifier-heuristik. `automationBridge.test.ts` hævder begge dele.
 */
const bridgeIsAllowed = (): boolean =>
  import.meta.env.DEV || import.meta.env.MODE === 'test' || import.meta.env.MODE === 'e2e';

/**
 * Installerer broen på `window`, så længe komponenten er mountet.
 *
 * Getterne læser ved KALDSTID frem for at kopiere en værdi ind i en closure: en automatisering kalder
 * `readSnapshot()` på et vilkårligt tidspunkt og skal se tilstanden NU, ikke den ved seneste render.
 */
export const useAutomationIntrospectionBridge = (): void => {
  const read = useInputReadPort();

  React.useEffect(() => {
    // To lag: det normale produktionsbuild folder dette tidlige return bort, mens E2E-previewet er
    // den eksplicitte undtagelse. Uden det første lag beholdt minifieren den døde krop (se ovenfor).
    if (import.meta.env.PROD && import.meta.env.MODE !== 'e2e') return undefined;
    if (!bridgeIsAllowed()) return undefined;

    const readSnapshot = (): AutomationIntrospectionSnapshot => {
      const { issues } = read.getEvaluation();
      const fields = issues.all.map((issue): AutomationFieldState => Object.freeze({
        address: serializeFieldAddress(issue.field.address),
        fieldId: issue.field.descriptor.id,
        label: issue.field.descriptor.label,
        // Rejected råtekst giver altid `format` (§1.6); bounds/rule er canonical og forbliver gembar.
        rejected: issue.reason === 'format',
        issue: Object.freeze({ code: issue.code, reason: issue.reason, message: issue.message }),
      }));

      return Object.freeze({
        // `InputRevision` er en brandet `number`; broen udlæser den som almindeligt tal, fordi modtageren
        // er en test/automatisering uden for typesystemet.
        revision: Number(read.getRevisionSnapshot().revision),
        fields: Object.freeze(fields),
        rejectedAddresses: Object.freeze(
          fields.filter((field) => field.rejected).map((field) => field.address),
        ),
      });
    };

    const api: AutomationIntrospectionApi = Object.freeze({
      readSnapshot,
      readField: (serializedAddress: string): AutomationFieldState | null =>
        readSnapshot().fields.find((field) => field.address === serializedAddress) ?? null,
      attributes: AUTOMATION_FIELD_ATTRIBUTES,
    });

    (window as unknown as Record<string, unknown>)[AUTOMATION_BRIDGE_KEY] = api;
    return () => {
      delete (window as unknown as Record<string, unknown>)[AUTOMATION_BRIDGE_KEY];
    };
  }, [read]);
};
