/**
 * Accessible name for interaktive kontroller – én kanonisk kilde.
 *
 * **Problemet reglen lukker.** Kontroller uden accessible name er usynlige for skærmlæsere og for
 * enhver rolle-/navn-baseret navigation: kontrollen kan fokuseres og aktiveres, men brugeren får
 * aldrig at vide, HVAD den gør. Problemet viste sig på flere indbyrdes uafhængige flader –
 * sidemenuen, Indstillinger, Om-siden og EET – men havde overalt samme rod: `StyledToggleSwitch`
 * gjorde både `label` og `ariaLabel` valgfrie uden fallback, mens `StyledCheckbox` altid krævede
 * `label`. Af 35 toggle-callsites var 34 navnløse, og den eneste navngivne var en tilfældig
 * undtagelse.
 *
 * At rette de enkelte observerede steder ville have efterladt alle de øvrige – og intet ville have
 * forhindret det næste. Derfor er navnet flyttet fra «noget man kan huske at sætte» til en
 * **strukturel forudsætning**, håndhævet i tre uafhængige lag:
 *
 * 1. **Typesystemet** – {@link AccessibleNameProps} er et union, hvor mindst ét navnegivende felt
 *    SKAL angives. En navnløs kontrol kan ikke type-checke; det er ikke en advarsel man kan overse.
 * 2. **Arkitekturreglen** `a11y/interactive-control-has-accessible-name` – fanger de rå
 *    DOM-/MUI-kontroller (`<button>`, `IconButton`, `Fab`), som typesystemet ikke kan nå, fordi de
 *    ikke går gennem vores egne komponenter.
 * 3. **Runtime-invarianten** {@link resolveAccessibleName} – kaster i udvikling og test, hvis et navn
 *    alligevel ender tomt (fx en ReactNode-label, der viser sig kun at indeholde et ikon). I
 *    produktion degraderer den tavst, så en manglende label aldrig kan tage programmet ned for en
 *    bruger midt i en sag.
 *
 * **Hvorfor `visibleLabel` er den normale vej.** Den synlige tekst står i forvejen ved kontrollen som
 * et søskende-element (`<Typography className="row--text">`). Ved at binde NAVNET til præcis den
 * tekst kan de to ikke glide fra hinanden: retter man den viste tekst, følger skærmlæserens
 * oplæsning automatisk med. Et frit `ariaLabel` ville have været en andenudgave af samme tekst, som
 * ingen opdaterer sammen med den første – jf. konvergensprincippet om ikke at løse samme problem to
 * gange.
 */
import * as React from 'react';

/**
 * Navnegivende props for en interaktiv kontrol. Mindst ét felt er obligatorisk.
 *
 * Unionen – ikke to valgfrie felter – er hele pointen: TypeScript afviser en kontrol uden navn ved
 * callsitet, i stedet for at lade den slippe igennem til brugerfladen.
 */
export type AccessibleNameProps =
  /**
   * Den synlige tekst ved kontrollen. Normalvejen: teksten renderes AF kontrollen som en rigtig
   * `<label>`, så navnet og det viste er samme streng, og klik på teksten aktiverer kontrollen.
   */
  | Readonly<{ visibleLabel: React.ReactNode; ariaLabel?: never; labelledBy?: never }>
  /**
   * Navn uden synlig tekst. Kun til kontroller, hvis betydning ellers kun ligger i et ikon
   * (hamburger-menu, «Vælg mappe»), eller hvor den synlige tekst af layouthensyn ikke kan være
   * kontrollens egen label.
   */
  | Readonly<{ ariaLabel: string; visibleLabel?: never; labelledBy?: never }>
  /**
   * `id` på et element, der allerede bærer teksten. Til de tilfælde, hvor teksten er rig markup
   * (interpolation, info-ikon), som skal blive liggende hvor den er.
   */
  | Readonly<{ labelledBy: string; visibleLabel?: never; ariaLabel?: never }>;

/**
 * Plukker præcis de navnegivende props ud, så en wrapper kan videresende dem uden at tabe unionen.
 *
 * En naiv `{...props}`-spread ville tage alt med (inkl. `field`, `location`, `commit`), og en manuel
 * `label ?? ariaLabel`-sammenstykning ville kollapse de tre gensidigt udelukkende former til én. Her
 * bevares nøjagtig den variant, callsitet valgte, hvilket er det typesystemet håndhæver på.
 */
export const selectAccessibleNameProps = (props: AccessibleNameProps): AccessibleNameProps => {
  if (props.labelledBy !== undefined) return { labelledBy: props.labelledBy };
  if (props.ariaLabel !== undefined) return { ariaLabel: props.ariaLabel };
  return { visibleLabel: props.visibleLabel };
};

/**
 * Trækker den rene tekst ud af en ReactNode-label.
 *
 * Rekursionen findes, fordi labels i praksis er sammensatte: `<>{`${summary.label}:`}<InfoTooltipIcon/></>`.
 * Vi vil have brugerens ord – ikke ikonet og ikke dets tooltip-tekst, som er en uddybning og ikke
 * kontrollens navn. Elementer springes derfor over frem for at blive læst rekursivt: et ikon har
 * ingen tekstbørn, og et `InfoTooltipIcon` bærer sin forklaring i en prop, ikke som barn.
 */
const extractText = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    const { children } = node.props as { children?: React.ReactNode };
    return extractText(children);
  }
  return '';
};

/**
 * Normaliserer en synlig label til det, en skærmlæser skal sige.
 *
 * Afsluttende kolon fjernes: den er en visuel adskiller mellem label og værdi i rækkelayoutet
 * («Omregning til fuldt år:»), ikke en del af navnet. Uden normaliseringen ville oplæsningen blive
 * «Omregning til fuldt år kolon», og navnet ville desuden afvige fra de rækker, der ikke har kolon.
 */
export const normalizeAccessibleName = (raw: string): string =>
  raw.replace(/\s+/g, ' ').trim().replace(/:$/, '').trim();

/**
 * Den effektive accessible name for en kontrol, som den vil fremstå i accessibility-træet.
 *
 * Returnerer `undefined` for `labelledBy`, hvor navnet ejes af det refererede element og derfor ikke
 * kan afgøres her – bindingen kontrolleres i stedet af arkitekturreglen og af komponenttesten.
 */
export const resolveAccessibleName = (props: AccessibleNameProps, controlHint: string): string | undefined => {
  if (props.labelledBy !== undefined) return undefined;

  const raw = props.ariaLabel !== undefined ? props.ariaLabel : extractText(props.visibleLabel);
  const name = normalizeAccessibleName(raw);

  if (name === '') {
    // Typesystemet garanterer, at et navnefelt ER angivet – ikke at det har tekstindhold. En
    // ReactNode-label kan fx vise sig kun at rumme et ikon. Fail-closed i udvikling/test, hvor det
    // skal opdages; tavs degradering i produktion, hvor et kast ville koste brugeren sin sag.
    if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
      throw new Error(
        `Kontrollen «${controlHint}» fik et tomt tilgængeligt navn. En interaktiv kontrol skal kunne ` +
        'identificeres af skærmlæsere og rolle-/navn-navigation. Angiv visibleLabel med tekstindhold, ' +
        'ariaLabel eller labelledBy. Se src/components/inputs/accessibleName.ts.'
      );
    }
    return undefined;
  }

  return name;
};

/**
 * De ARIA-attributter, navnet giver anledning til på selve input-elementet.
 *
 * `visibleLabel` sætter bevidst INGEN attribut: navnet kommer der fra den rigtige `<label>`-binding,
 * som MUI's `FormControlLabel` laver via `htmlFor`/`id`. Et `aria-label` oveni ville overskrive den
 * synlige tekst og genindføre præcis den dobbelthed, konstruktionen skal fjerne.
 */
export const accessibleNameAttributes = (
  props: AccessibleNameProps,
  controlHint: string
): Readonly<{ 'aria-label'?: string; 'aria-labelledby'?: string }> => {
  if (props.labelledBy !== undefined) return { 'aria-labelledby': props.labelledBy };
  if (props.ariaLabel !== undefined) {
    const name = resolveAccessibleName(props, controlHint);
    return name === undefined ? {} : { 'aria-label': name };
  }
  // visibleLabel: navnet bæres af <label>-bindingen. Valideres for tomhed her.
  resolveAccessibleName(props, controlHint);
  return {};
};
