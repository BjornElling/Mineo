/**
 * Grid UX Spec (normativ)
 *
 * Denne fil indeholder bevidst ingen runtime-logik.
 * Den er den frosne UX-kontrakt som alle Mineos grid-tabeller SKAL følge.
 *
 * Scope (aktuelt): HTML-grid-tabeller der bruger `StandardGridTable` + `Table*Input`-komponenter,
 * herunder (mindst):
 * - Årsløn/Lønindkomst (`src/components/tables/StandardLoenTable.tsx`)
 * - Offentlige ydelser (`src/components/tables/OffentligeYdelserTable.tsx`)
 */

export const GRID_UX_SPEC = {
  navigation: {
    /**
     * Global model: alle Mineos grid-tabeller deler den samme keyboard-semantik.
     *
     * - Enter / Shift+Enter: vertikal traversering inden for tabellen (Excel-lignende; wrapper/cykler).
     * - ArrowUp/ArrowDown: vertikal flytning inden for tabellen; frigives ved top-/bundkant så Container
     *   kan fortsætte navigation uden for tabellen.
     * - ArrowLeft/ArrowRight: horisontal flytning i samme række med wrap ved rækkekanter.
     * - Tab / Shift+Tab: ejes IKKE af grid-kernen. Den naturlige fokus-rækkefølge (Container-niveau) bærer
     *   Tab på tværs af tabel-celler OG videre ud af tabellen til de øvrige felter — fokus er bevidst IKKE
     *   trapped. Grid-kernen aflæser kun den startcelle (anchor), Enter-vertikal-navigation tager udgangspunkt i.
     *
     * (Tidligere blev Tab trappet og brugt til horisontal traversering; "ny samlet tabel-navigation"
     * konsoliderede Tab til Container-niveau for et ensartet flow på tværs af tabeller og felter.)
     */
    traversalModel: 'excel-like' as const,

    /**
     * Tab-anchor-regel (universel):
     * Efter en Tab-sekvens bruger Enter/Shift+Enter den celle hvor sekvensen startede (anchor-cellen),
     * ikke den celle hvor fokus aktuelt er.
     *
     * Reset:
     * - Anchor ryddes efter at Enter/Shift+Enter-navigation er udført.
     * - Anchor ryddes ved Escape-cancel.
     *
     * BEMÆRK: Ankeret vedrører både række og kolonne (og evt. sub-control-indeks).
     */
    tabAnchor: 'cell' as const,

    /**
     * Piletaster:
     * - ArrowUp/ArrowDown deltager i vertikal traversering og rydder Tab-ankeret.
     *   Ved top-/bundkanten frigives eventet, så navigation på container-niveau kan fortsætte uden for tabellen.
     * - ArrowLeft/ArrowRight navigerer horisontalt i samme række med wrap ved rækkekanter.
     */
    arrowKeySemantics: {
      upDown: 'vertical-navigation' as const,
      leftRight: 'horizontal-navigation-wrap-row' as const,
    },

    /**
     * Popup-widgets:
     * Når en popup-widget er expanded/åben, MÅ GridCore IKKE blande sig i dens interne keyboard-håndtering.
     */
    expandedWidgetBypass: true,

    /**
     * Popup-celler (fx `GridChoiceCell`):
     * - Tab kan fokusere kontrollen
     * - Enter åbner menuen (må IKKE udløse grid Enter-navigation)
     * - Valg committer øjeblikkeligt
     * - Delete/Backspace rydder (kun når allowEmpty=true og menuen er lukket)
     * - Printbare taster åbner INGEN tekst-editor (kontrollen har ingen fritekst)
     *
     * Kontrakten klassificerer kontrollen på dens ARIA-semantik gennem `popupWidgetSemantics`
     * (`role="combobox"` / `aria-haspopup`) — ikke på et komponentnavn eller en privat
     * markør-attribut. Samme klassifikation bruges af Container og af grid'ets pointer-veje.
     */
    dropdownContract: true,
  },

  editing: {
    /**
     * To-trins redigeringsmodel:
     * - Celle-fokus (readOnly): navigations-mode
     * - Editor åben: typing-mode
     *
     * Aktivering:
     * - Første klik på en ufokuseret celle: kun fokus (readOnly)
     * - Klik på en allerede fokuseret celle: åbn editor, behold caret-position
     * - Dobbeltklik: åbn editor, markér alt
     * - Første printbare tast: åbn editor og erstat alt indhold med den første tast
     */
    twoStageActivation: true,

    /**
     * Commit-timing:
     * Commit udløses når editoren lukker (typisk via blur ved fokus-flytning).
     *
     * Enter-semantik:
     * - Når Enter/Shift+Enter trykkes (selv mens editoren er åben), sker der grid-navigation.
     *   Fokus-flytningen forårsager blur, hvilket udløser commit-pipelinen.
     */
    commitOnEditorClose: true,

    /**
     * Valideringsfejl:
     * Navigation MÅ IKKE blokeres af ugyldigt input.
     * Den rå draft kan forblive synlig i cellen med rød kant + tooltip.
     */
    allowLeavingInvalidDraft: true,

    /**
     * Escape:
     * Hvis editoren er åben, ruller Escape cellen tilbage til dens oprindelige værdi (på editor-åbnings-tidspunktet)
     * og lukker editoren.
     */
    escapeRevertsAndCloses: true,

    /**
     * Delete/Backspace (editor lukket / celle-fokus):
     * Rydder cellen og committer øjeblikkeligt uden at åbne editoren.
     * Fokus forbliver i cellen i readOnly-mode.
     */
    deleteClearsAndCommitsImmediately: true,
  },

  rows: {
    /**
     * Rækkers livscyklus (universel for Mineos grid-tabeller):
     * - Der findes til enhver tid mindst 2 rækker.
     * - Der findes til enhver tid mindst 1 efterfølgende tom input-række.
     * - Tomme mellem-rækker kan slettes ved hvert commit/blur (aggressiv oprydning).
     * - "Blur er blur": der er ingen special-case for "intern navigation" vs. at forlade tabellen.
     */
    minRows: 2,
    trailingEmptyRow: true,
    cleanupOnEveryCommitOrBlur: true,
    blurIsBlur: true,
  },

  sorting: {
    /**
     * Sortering (delt model):
     * - Alle header-celler er klikbare.
     * - Intet ikon vises indledningsvist.
     * - Klik på en header sorterer efter den kolonne; klik igen vender retningen.
     * - Sortering er stabil og memory-baseret:
     *   - Primær sortering: aktivt (blåt) ikon
     *   - Sekundær sortering: tidligere primær (gråt) ikon
     *   - Uafgjorte i primær afgøres af sekundær, derefter oprindelig insertion-rækkefølge.
     * - Sortering er permanent når den først er aktiveret (ingen "ryd sortering"-tilstand).
     */
    headersAlwaysClickable: true,
    defaultDirection: 'asc' as const,
    permanentOnceActivated: true,
    stableWithSecondaryMemory: true,
  },
} as const;
