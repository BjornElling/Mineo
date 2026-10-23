import React from 'react';
import { z } from 'zod';
import { offentligLoenTypeEnum, type OffentligLoenTypeLabel } from '../../../../schemas/formSchemas';
import { optionalAmountValueSchema, type AmountValue } from '../../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../../types/branded';
import { isISODateString } from '../../../../types/branded';
import { amountValueToNumber } from '../../../../utils/expressionAmount';
import { UI_STORAGE_KEYS } from '../../../../config/storageManifest';
import {
  readOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../../../../utils/safeSessionStorage';
import { useInputEditPort } from '../../../../inputCore/react/inputRuntimeContext';
import { inputTransaction, inputTransactionStep, settleField } from '../../../../inputCore/inputReducer';
import { buildFieldHistoryOrigin } from '../../../../inputCore/editor/fieldEditorEngine';
import type { BoundField } from '../loenudvikling/loenudviklingBinding';
import {
  calculateLoentrinFinderResults,
  resolveLoentrinFinderOverenskomstLabel,
  type LoentrinFinderErrors,
  type LoentrinFinderResult,
} from './loentrinFinderCore';

export type { LoentrinFinderErrors, LoentrinFinderResult } from './loentrinFinderCore';

const loentrinFinderSessionEntrySchema = z.object({
  ansaettelse: offentligLoenTypeEnum,
  beloeb: optionalAmountValueSchema,
  dato: z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === '') return undefined;
      return value;
    },
    z.string().refine((value) => isISODateString(value), 'Skal være gyldig ISO dato').optional()
  ),
}).strict();

const loentrinFinderSessionStateSchema = z.record(z.string(), loentrinFinderSessionEntrySchema);
type LoentrinFinderSessionState = z.infer<typeof loentrinFinderSessionStateSchema>;

/**
 * Det, brugeren åbner finderen FOR. Begge flader har præcis ét overenskomst-id og én
 * ansættelsestype som udgangspunkt; `sessionKey` er til stede, når fladen også skal huske
 * indtastningen på tværs af åbninger.
 */
export type LoentrinFinderTarget = Readonly<{
  overenskomstId: string | undefined;
  offentligLoenType: OffentligLoenTypeLabel | undefined;
  /**
   * Nøglen, indtastningen huskes under i sessionStorage. Udelades den, huskes intet.
   *
   * Lønindkomst husker per ansættelsesforhold (`af.id`), fordi samme side kan have flere kort med hver
   * sin løn – dét gør genåbning til en reel bekvemmelighed. EO-oplysninger har kun ét sæt felter, og
   * fladen huskede bevidst ikke; forskellen er UX, ikke teknik, og er derfor et argument, ikke to hooks.
   */
  sessionKey?: string;
  /** Reguleringsdatoen – den dato, løntrinnet skal passe til. Datofeltet starter på den (BB-310). */
  reguleringsdato?: ISODateString;
  /**
   * Hvor et valgt resultat sættes ind: kortets løntrin og gruppe, og gruppefeltets input, som fokus lander på
   * bagefter (udviklerens ønske 2026-10-23, BB-310).
   */
  insert?: Readonly<{
    loentrin: BoundField<number | undefined>;
    gruppe: BoundField<number | undefined>;
    gruppeInputRef: React.RefObject<HTMLInputElement | null>;
  }>;
}>;

export type UseLoentrinFinderResult = Readonly<{
  open: boolean;
  /** Id'et finderen er åben for, eller `null`. Kun relevant for flader med flere åbnende kontroller. */
  openForKey: string | null;
  ansaettelse: OffentligLoenTypeLabel;
  setAnsaettelse: React.Dispatch<React.SetStateAction<OffentligLoenTypeLabel>>;
  beloeb: AmountValue | undefined;
  setBeloeb: React.Dispatch<React.SetStateAction<AmountValue | undefined>>;
  dato: ISODateString | undefined;
  setDato: React.Dispatch<React.SetStateAction<ISODateString | undefined>>;
  errors: LoentrinFinderErrors;
  setErrors: React.Dispatch<React.SetStateAction<LoentrinFinderErrors>>;
  handleAmountFieldError: (errorMsg: string | undefined) => void;
  handleDateFieldError: (errorMsg: string | undefined) => void;
  results: ReadonlyArray<LoentrinFinderResult>;
  /** Datoen for satstabellen bag resultaterne, og om den er programmets nyeste (BB-310). */
  satsDato: ISODateString | undefined;
  erNyesteSatser: boolean;
  /** Kan et resultat sættes ind i fladen (er finderen åbnet med et indsætningsmål)? */
  kanIndsaette: boolean;
  /** Sætter løntrin – og gruppen, når resultatet kun har én – ind og peger fokus-restoren på gruppefeltet. */
  insertResult: (result: LoentrinFinderResult) => boolean;
  headingId: string;
  overenskomstLabel: string;
  inputAmountNumber: number | undefined;
  /**
   * Åbner finderen. `registerTrigger` skal have været kaldt for den åbnende knap, ellers har lukningen
   * intet fokusmål (jf. `keyboard-navigation.md` §Popup-fokus-restore).
   */
  openFinder: (target: LoentrinFinderTarget) => void;
  closeFinder: () => void;
  handleCalculate: () => void;
  /**
   * Den knap, overlayet skal returnere fokus til ved lukning – sat ved åbning til NETOP den trigger,
   * brugeren brugte. Gives til `LoentrinFinderOverlay`, der ejer restoren gennem `useDialogFocusRestore`
   * (§Popup-fokus-restore kræver én implementering, og den ligger dér, hvor popupen bor).
   */
  activeTriggerRef: React.RefObject<HTMLElement | null>;
  /**
   * Ref til den `Find løntrin`-knap, der hører til `key`. Hver knap får sin EGEN ref, og den aktive
   * udpeges ved åbning. Én delt ref var en fejl på Lønindkomst-fladen: alle kort bandt samme ref, så
   * React efterlod den på det SIDST monterede kort, og fokus vendte derfor tilbage til det forkerte
   * ansættelsesforholds knap, når finderen blev åbnet fra et andet kort end det nederste.
   */
  registerTrigger: (key: string) => React.RefObject<HTMLButtonElement | null>;
}>;

const DEFAULT_ANSAETTELSE: OffentligLoenTypeLabel = 'Månedsløn';

/** Fladens identitet, når den kun har én åbnende kontrol og derfor ikke behøver en nøgle. */
const SINGLE_TARGET_KEY = 'single';

/**
 * Løntrin-finder-overlayets state machine. ÉN hook for begge flader (Lønindkomst pr.
 * ansættelsesforhold, EO-oplysninger med ét sæt felter).
 *
 * De to flader havde tidligere hver sin hook, ~95 % ordret identiske, med kun `open`-udtrykket og
 * sessionStorage-roundtrippet til forskel. Duplikeringen var reel: den samme keyboard-effekt og de
 * samme seks state-felter stod to steder og skulle rettes to steder – fx blev fokus-restoren
 * (§Popup-fokus-restore) tilføjet i begge, mens fejlen med den delte trigger-ref kun fandtes i den ene.
 * Forskellene er nu argumenter (`sessionKey`, åbne-nøgle), ikke kopier.
 *
 * Bevidst page-lokal og transient: overlayet skriver aldrig til persisteret sagsdata (jf.
 * `mineo-field-pattern` §3 «Transiente felter deltager ikke» i undo/redo). `sessionKey`-persistensen er
 * ren UX-bekvemmelighed og ligger under en `caseScoped` nøgle, så `Slet alt` rydder den.
 *
 * Al FOKUSADFÆRD ejes af `LoentrinFinderOverlay`: både tastaturnavigationen inde i popupen og
 * restoren ved lukning (`useDialogFocusRestore`), som `keyboard-navigation.md` foreskriver. Denne hook
 * ejer state og beregning og bærer kun `activeTriggerRef` – pegepinden til det restore-mål, overlayet
 * skal bruge.
 */
export const useLoentrinFinder = (): UseLoentrinFinderResult => {
  const [openForKey, setOpenForKey] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<LoentrinFinderTarget | null>(null);
  const [ansaettelse, setAnsaettelse] = React.useState<OffentligLoenTypeLabel>(DEFAULT_ANSAETTELSE);
  const [beloeb, setBeloeb] = React.useState<AmountValue | undefined>(undefined);
  const [dato, setDato] = React.useState<ISODateString | undefined>(undefined);
  const [errors, setErrors] = React.useState<LoentrinFinderErrors>({});
  const [amountFieldError, setAmountFieldError] = React.useState<string | undefined>(undefined);
  const [dateFieldError, setDateFieldError] = React.useState<string | undefined>(undefined);
  const [results, setResults] = React.useState<ReadonlyArray<LoentrinFinderResult>>([]);
  const [satsDato, setSatsDato] = React.useState<ISODateString | undefined>(undefined);
  const [erNyesteSatser, setErNyesteSatser] = React.useState(false);
  const edit = useInputEditPort();

  const headingId = React.useId();

  const open = openForKey !== null;

  // Én ref pr. åbnende knap. `activeTriggerRef` peger på den, finderen faktisk blev åbnet fra, og gives
  // videre til overlayet, som ejer fokus-restoren gennem `useDialogFocusRestore`.
  const triggerRefs = React.useRef(new Map<string, React.RefObject<HTMLButtonElement | null>>());
  const activeTriggerRef = React.useRef<HTMLElement | null>(null);

  const registerTrigger = React.useCallback((key: string): React.RefObject<HTMLButtonElement | null> => {
    const existing = triggerRefs.current.get(key);
    if (existing) return existing;
    const created = React.createRef<HTMLButtonElement>();
    triggerRefs.current.set(key, created);
    return created;
  }, []);

  const resetTransientState = React.useCallback(() => {
    setBeloeb(undefined);
    setDato(undefined);
    setErrors({});
    setAmountFieldError(undefined);
    setDateFieldError(undefined);
    setResults([]);
    setSatsDato(undefined);
    setErNyesteSatser(false);
  }, []);

  const readSessionState = React.useCallback((): LoentrinFinderSessionState => {
    try {
      const raw = readOptionalSessionStorageValue(UI_STORAGE_KEYS.loentrinFinderOverlay);
      if (!raw) return {};
      const parsedJson: unknown = JSON.parse(raw);
      const parsed = loentrinFinderSessionStateSchema.safeParse(parsedJson);
      return parsed.success ? parsed.data : {};
    } catch {
      return {};
    }
  }, []);

  const writeSessionState = React.useCallback((nextState: LoentrinFinderSessionState): void => {
    writeOptionalSessionStorageValue(UI_STORAGE_KEYS.loentrinFinderOverlay, JSON.stringify(nextState));
  }, []);

  const openFinder = React.useCallback((nextTarget: LoentrinFinderTarget) => {
    resetTransientState();
    const key = nextTarget.sessionKey ?? SINGLE_TARGET_KEY;
    // Peg restore-målet på den knap, der åbnede – FØR overlayet monterer og flytter fokus.
    activeTriggerRef.current = triggerRefs.current.get(key)?.current ?? null;

    const persistedEntry = nextTarget.sessionKey === undefined
      ? undefined
      : readSessionState()[nextTarget.sessionKey];

    setTarget(nextTarget);
    setAnsaettelse(persistedEntry?.ansaettelse ?? nextTarget.offentligLoenType ?? DEFAULT_ANSAETTELSE);
    setBeloeb(persistedEntry?.beloeb);
    // Den gemte indtastning vinder; ellers reguleringsdatoen, som svaret skal passe til (BB-310).
    setDato((persistedEntry?.dato as ISODateString | undefined) ?? nextTarget.reguleringsdato);
    setOpenForKey(key);
  }, [readSessionState, resetTransientState]);

  const closeFinder = React.useCallback(() => {
    setOpenForKey(null);
    setTarget(null);
    resetTransientState();
  }, [resetTransientState]);

  const handleAmountFieldError = React.useCallback((errorMsg: string | undefined) => {
    setAmountFieldError(errorMsg);
  }, []);

  const handleDateFieldError = React.useCallback((errorMsg: string | undefined) => {
    setDateFieldError(errorMsg);
  }, []);

  const handleCalculate = React.useCallback(() => {
    const outcome = calculateLoentrinFinderResults({
      overenskomstId: target?.overenskomstId,
      ansaettelse,
      beloeb,
      dato,
      amountFieldError,
      dateFieldError,
    });

    if (!outcome.ok) {
      // Rystelsen er fjernet. `outcome.errors` sætter i forvejen en konkret fejl på det felt,
      // der er årsagen – den forklarer, hvad rystelsen kun antydede.
      setErrors(outcome.errors);
      setResults([]);
      setSatsDato(undefined);
      setErNyesteSatser(false);
      return;
    }

    setErrors({});
    setResults(outcome.results);
    setSatsDato(outcome.satsDato);
    setErNyesteSatser(outcome.erNyesteSatser);
  }, [target?.overenskomstId, ansaettelse, beloeb, dato, amountFieldError, dateFieldError]);

  const insertTarget = target?.insert;
  const insertResult = React.useCallback((result: LoentrinFinderResult): boolean => {
    // «55+» har intet tal i løntrinsfeltet (1–55) og kan ikke sættes ind.
    if (insertTarget === undefined || result.loentrin === '55+') return false;
    const eneGruppe = result.grupper.length === 1 ? result.grupper[0] : undefined;
    // Én handling og ét fortryd-trin. Er grupperne samlet («alle grupper»), sættes kun løntrinnet ind: gruppen er
    // brugerens valg, og fokus lander netop på gruppefeltet.
    edit.dispatch(
      inputTransaction([
        inputTransactionStep(settleField(insertTarget.loentrin.field, String(result.loentrin))),
        ...(eneGruppe === undefined ? [] : [inputTransactionStep(settleField(insertTarget.gruppe.field, String(eneGruppe)))]),
      ]),
      buildFieldHistoryOrigin(insertTarget.gruppe.location, insertTarget.gruppe.field),
    );
    // Restoren ved lukningen sender fokus hertil i stedet for til «Find løntrin»-knappen.
    if (insertTarget.gruppeInputRef.current !== null) activeTriggerRef.current = insertTarget.gruppeInputRef.current;
    return true;
  }, [edit, insertTarget]);

  const inputAmountNumber = React.useMemo(() => amountValueToNumber(beloeb), [beloeb]);

  const overenskomstLabel = React.useMemo(
    () => resolveLoentrinFinderOverenskomstLabel(target?.overenskomstId),
    [target?.overenskomstId]
  );

  // Husk indtastningen, så en genåbning på samme nøgle starter der, brugeren slap. Kun for flader der
  // har bedt om det (`sessionKey`).
  const sessionKey = target?.sessionKey;
  React.useEffect(() => {
    if (!open || sessionKey === undefined) return;

    writeSessionState({
      ...readSessionState(),
      [sessionKey]: { ansaettelse, beloeb, dato },
    });
  }, [open, sessionKey, ansaettelse, beloeb, dato, readSessionState, writeSessionState]);

  return {
    open,
    openForKey,
    ansaettelse,
    setAnsaettelse,
    beloeb,
    setBeloeb,
    dato,
    setDato,
    errors,
    setErrors,
    handleAmountFieldError,
    handleDateFieldError,
    results,
    satsDato,
    erNyesteSatser,
    kanIndsaette: insertTarget !== undefined,
    insertResult,
    headingId,
    overenskomstLabel,
    inputAmountNumber,
    openFinder,
    closeFinder,
    handleCalculate,
    activeTriggerRef,
    registerTrigger,
  };
};
