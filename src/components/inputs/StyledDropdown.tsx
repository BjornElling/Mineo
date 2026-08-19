import * as React from 'react';
import { Box, MenuItem, MenuList, OutlinedInput, Popover, Tooltip } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../utils/mergeSx';
import { CONTENT_SCALE_CSS_VARIABLE } from '../../utils/uiScale';
import { copyTextToClipboard, readClipboardText } from '../../utils/clipboardUtils';
import { createCommitEvent, type CommitEvent } from '../../types/fieldEvents';
import {
  findTypeaheadMatchIndex,
  isClearKey,
  isTypeaheadCharKey,
  normalizeDropdownLabel,
} from './dropdownInteractionCore';
import { resolveAccessibleName } from './accessibleName';
import { visuallyHiddenStyle } from '../shared/visuallyHiddenStyle';

/**
 * StyledDropdown (combobox-trigger + popover-listbox)
 *
 * Denne komponent er en del af en tværgående keyboard-navigations-kontrakt:
 * - Den renderer et `OutlinedInput` der bevidst er `readOnly` (ikke fri tekst), men som stadig skal indgå i Tab-rækkefølgen.
 * - Den eksponerer `role="combobox"` + `aria-controls`/`aria-expanded`, så app'ens Tab/Enter-navigation på Container-niveau kan:
 *   - inkludere kontrollen selvom den er readOnly
 *   - registrere når popup'en er åben og undgå at kapre Tab/Enter beregnet til widget'en
 * - Når popover'en er åben og brugeren trykker Tab, lukker vi popover'en UDEN at kalde `preventDefault()`;
 *   dette bevarer normal fokus-traversering (eller Tab-navigation på tabel-niveau) og undgår "Tab æder fokus"-regressioner.
 *
 * Hvis du ændrer noget af ovenstående, så gennemgå også:
 * - `src/components/layout/Container.tsx` (focusable selector + detektion af popup-widgets)
 * - `src/components/tables/tableKeyboardNavigation.ts` (key capture på tabel-niveau og widget-detektion)
 */
export type StyledDropdownValue = string | number;

export type StyledDropdownChangeEvent<TValue extends StyledDropdownValue | undefined = string> = CommitEvent<TValue> & {
  target: { name?: string; value: TValue };
};

type StyledDropdownCommonProps<TValue extends StyledDropdownValue> = Omit<
  React.ComponentProps<typeof OutlinedInput>,
  'value' | 'onChange' | 'onBlur' | 'placeholder' | 'sx' | 'error' | 'name' | 'id' | 'onClick' | 'onKeyDown' | 'disabled' | 'inputRef'
> & {
  placeholder?: string;
  width?: number | string;
  children?: React.ReactNode;
  name?: string;
  /** Tilgængeligt navn; rå dropdown-kald må ikke kunne være navnløse. */
  ariaLabel: string;
  error?: boolean;
  helperText?: string;
  /** Kortere hover-tekst end den fulde besked. Se `StyledTextFieldBaseProps.tooltipText`. */
  tooltipText?: string;
  /**
   * Valgfri styling-hooks for popover-listbox'en og dens options.
   *
   * Bemærk: denne komponent er ikke en MUI Select; den renderer en custom Popover + MenuItem-liste.
   */
  listboxSx?: SxProps<Theme>;
  optionSx?: SxProps<Theme>;
  iconSx?: SxProps<Theme>;
  /**
   * Valgfri single source of truth for hvordan den valgte værdi vises i den lukkede kontrol.
   *
   * Hvis udeladt, forventer komponenten at option-children er `string | number`.
   */
  getOptionLabel?: (value: TValue) => string;
  /**
   * Codecets kanoniske, endelige valgmængde. Børnene bestemmer rækkefølge, disabled-status og visuel markup,
   * men deres værdier skal matche denne mængde præcist. Udeladt for åbne katalogvalg.
   */
  expectedOptionValues?: readonly unknown[];
  /**
   * Undo/redo-fokusrestore-attributter (§3.7): sættes på det fokuserbare combobox-input, så fokus efter
   * undo/redo lander PRÆCIST på denne editorlokation (feltadresse + editorlokation), ikke via `name`.
   * `inputCore/react/fields/ChoiceField` og `GridChoiceCell` leverer dem.
   */
  restoreTargetAttributes?: Readonly<Record<string, string>>;
  returnFocusOnClose?: boolean;
  /**
   * Udløses når dropdown-popover'en lukker (interaktionen er slut).
   * Dette er bevidst adskilt fra `onBlur`, som er en fysisk blur.
   */
  onClose?: () => void;
  /**
   * Styling for wrapper-containeren (`Box`) omkring inputtet.
   */
  containerSx?: SxProps<Theme>;
  /**
   * Styling kun for `OutlinedInput`.
   */
  sx?: SxProps<Theme>;
  disabled?: boolean;
  id?: string;
};

type StyledDropdownPropsAllowEmpty<TValue extends StyledDropdownValue> = {
  allowEmpty?: true;
  value?: TValue | undefined;
  onChange?: (e: StyledDropdownChangeEvent<TValue | undefined>) => void;

  /**
   * Fysisk blur (fokus forlader kontrollen).
   *
   * Bemærk: dette er ikke et "commit"-callback; commit sker ved valg via `onChange`.
   */
  onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
};

type StyledDropdownPropsNoEmpty<TValue extends StyledDropdownValue> = {
  allowEmpty: false;
  value: TValue;
  onChange?: (e: StyledDropdownChangeEvent<TValue>) => void;

  /**
   * Fysisk blur (fokus forlader kontrollen).
   *
   * Bemærk: dette er ikke et "commit"-callback; commit sker ved valg via `onChange`.
   */
  onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
};

export type StyledDropdownProps<TValue extends StyledDropdownValue> = StyledDropdownCommonProps<TValue> &
  (StyledDropdownPropsAllowEmpty<TValue> | StyledDropdownPropsNoEmpty<TValue>);

type DropdownOptionChild<TValue extends StyledDropdownValue> = React.ReactElement<{
  value: TValue;
  disabled?: boolean;
  children?: React.ReactNode;
}>;

const StyledDropdownDivider = () => null;
StyledDropdownDivider.displayName = 'StyledDropdownDivider';

const DROPDOWN_RESERVED_ICON_WIDTH = '36px';

const isDividerNode = (child: React.ReactElement): boolean => {
  if (child.type === StyledDropdownDivider) return true;
  const childType = child.type as { displayName?: string };
  return childType.displayName === StyledDropdownDivider.displayName;
};

type DropdownVisualOption<TValue extends StyledDropdownValue> =
  | { kind: 'empty' }
  | { kind: 'divider'; key: React.Key }
  | { kind: 'value'; value: TValue; key: React.Key; children: React.ReactNode; disabled: boolean };

type CloseReason = 'select' | 'escapeKeyDown' | 'backdropClick' | 'tab' | 'blur';

/**
 * Hvad der tæller som «brugeren klikkede på en anden kontrol» ved klik uden for en åben menu.
 *
 * Bevidst bredt, men holdt til de NATIVE fokuserbare elementer: enhver fokuserbar kontrol skal kunne
 * overtage fokus i ét klik. Rammer klikket i stedet dødt område (baggrund, overskrift, tabelramme),
 * beholder dropdownen fokus, så tastaturbrugeren ikke efterlades på <body>.
 *
 * Selectoren gentager bevidst IKKE popup-ARIA'en (`role="combobox"`, `aria-haspopup`): den klassifikation
 * ejes af `popupWidgetSemantics`, og en kopi her kunne drifte fra den. En anden dropdown er alligevel
 * dækket, fordi dens trigger ER et `<input>`.
 */
const INTERACTIVE_TARGET_SELECTOR =
  'input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])';

const StyledDropdownInner = <TValue extends StyledDropdownValue>(
  {
    value,
    onChange,
    onBlur,
    onClose,
    placeholder = '',
    width = 200,
    children,
    name,
    ariaLabel,
    error = false,
    helperText = '',
    tooltipText,
    getOptionLabel,
    expectedOptionValues,
    allowEmpty = true,
    restoreTargetAttributes,
    returnFocusOnClose = true,
    containerSx,
    sx,
    listboxSx,
    optionSx,
    iconSx,
    id,
    disabled,
    ...otherProps
  }: StyledDropdownProps<TValue>,
  ref: React.ForwardedRef<HTMLDivElement>
) => {
  const [open, setOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  const inputElementRef = React.useRef<HTMLInputElement | null>(null);
  const listboxRef = React.useRef<HTMLDivElement | null>(null);
  const closedTypeaheadRef = React.useRef<Readonly<{ key: string; visualIndex: number }> | null>(null);

  const autoId = React.useId();
  const resolvedId = id ?? autoId;
  const listboxId = `${resolvedId}-listbox`;
  const resolvedAccessibleName = resolveAccessibleName(
    { ariaLabel },
    `StyledDropdown(${resolvedId})`
  );

  const childNodes = React.useMemo(() => React.Children.toArray(children), [children]);

  const resolvedValue = value as TValue | undefined;

  const hasEmptyOption = allowEmpty && placeholder.trim() !== '';

  const configErrorMessage = React.useMemo(() => {
    const counts = new Map<TValue, number>();
    const duplicates: TValue[] = [];
    const availableValues: TValue[] = [];
    const invalidChildIndices: number[] = [];

    childNodes.forEach((child, index) => {
      if (!React.isValidElement(child)) return;
      if (isDividerNode(child)) return;

      const candidate = child as DropdownOptionChild<TValue>;
      if (!('value' in candidate.props)) {
        invalidChildIndices.push(index);
        return;
      }

      const v = candidate.props.value;
      availableValues.push(v);
      const next = (counts.get(v) ?? 0) + 1;
      counts.set(v, next);
      if (next === 2) duplicates.push(v);
    });

    if (invalidChildIndices.length > 0) {
      return `Ugyldig konfiguration: option uden value i children (${invalidChildIndices.join(', ')})`;
    }

    if (duplicates.length > 0) {
      return `Ugyldig konfiguration: duplicate option values (${duplicates.join(', ')})`;
    }

    if (expectedOptionValues !== undefined) {
      const expected = new Set(expectedOptionValues);
      const actual = new Set<unknown>(availableValues);
      const missing = expectedOptionValues.filter((candidate) => !actual.has(candidate));
      const unexpected = availableValues.filter((candidate) => !expected.has(candidate));
      if (missing.length > 0 || unexpected.length > 0) {
        return 'Ugyldig konfiguration: children-options matcher ikke codecets valgmængde';
      }
    }

    if (availableValues.length === 0 && !hasEmptyOption) {
      return 'Ugyldig konfiguration: ingen valgbare options';
    }

    if (!allowEmpty && resolvedValue === undefined) {
      return 'Ugyldig konfiguration: value mangler (allowEmpty=false)';
    }

    if (!allowEmpty && resolvedValue !== undefined) {
      const exists = availableValues.some((candidateValue) => candidateValue === resolvedValue);
      if (!exists) {
        return 'Ugyldig konfiguration: value findes ikke blandt options (allowEmpty=false)';
      }
    }

    return '';
  }, [allowEmpty, childNodes, expectedOptionValues, hasEmptyOption, resolvedValue]);

  const hasConfigError = configErrorMessage.trim() !== '';

  if (import.meta.env.DEV && hasConfigError) {
    throw new Error(configErrorMessage);
  }

  // Samme invariant som `StyledTextFieldBase`: en rød ramme UDEN besked er en fejltilstand, brugeren
  // ikke kan handle på. Kontrollen manglede værnet, så `error` uden `helperText` gav en tavs rød ring.
  if (import.meta.env.DEV && error && helperText.trim() === '') {
    throw new Error('StyledDropdown: helperText er påkrævet, når error=true (undgå tavse fejltilstande)');
  }

  const { inputProps: userInputProps, ...outlinedInputProps } = otherProps;

  const visualOptions = React.useMemo<DropdownVisualOption<TValue>[]>(() => {
    if (hasConfigError) {
      return hasEmptyOption ? [{ kind: 'empty' }] : [];
    }

    const mapped: DropdownVisualOption<TValue>[] = [];

    childNodes.forEach((child, index) => {
      if (!React.isValidElement(child)) return;

      if (isDividerNode(child)) {
        mapped.push({ kind: 'divider', key: child.key ?? `${resolvedId}__divider__${index}` });
        return;
      }

      const optionChild = child as DropdownOptionChild<TValue>;
      if (!('value' in optionChild.props)) {
        return;
      }
      mapped.push({
        kind: 'value',
        value: optionChild.props.value,
        key: optionChild.key ?? index,
        children: optionChild.props.children,
        disabled: optionChild.props.disabled === true,
      });
    });

    return hasEmptyOption ? [{ kind: 'empty' }, ...mapped] : mapped;
  }, [childNodes, hasConfigError, hasEmptyOption, resolvedId]);

  const isSelectableVisualIndex = React.useCallback(
    (index: number) => {
      const opt = visualOptions[index];
      if (!opt) return false;
      return opt.kind === 'empty' || (opt.kind === 'value' && !opt.disabled);
    },
    [visualOptions]
  );

  const getValueAtVisualIndex = React.useCallback(
    (visualIndex: number): TValue | undefined => {
      const opt = visualOptions[visualIndex];
      if (!opt) return undefined;
      if (opt.kind === 'empty') return undefined;
      if (opt.kind === 'divider') return undefined;
      return opt.value;
    },
    [visualOptions]
  );

  const findSelectableIndex = React.useCallback(
    (fromIndex: number, direction: 1 | -1): number => {
      if (visualOptions.length === 0) return -1;

      const start = fromIndex < 0 ? (direction === 1 ? 0 : visualOptions.length - 1) : fromIndex + direction;
      for (let index = start; index >= 0 && index < visualOptions.length; index += direction) {
        if (isSelectableVisualIndex(index)) return index;
      }
      return -1;
    },
    [isSelectableVisualIndex, visualOptions.length]
  );

  const visualOptionLabels = React.useMemo(() => {
    return visualOptions.map((opt) => {
      if (opt.kind === 'empty') return '';
      if (opt.kind === 'divider') return '';
      if (opt.disabled) return '';
      if (getOptionLabel) return getOptionLabel(opt.value);
      const label = opt.children;
      if (typeof label === 'string' || typeof label === 'number') return String(label);
      return '';
    });
  }, [getOptionLabel, visualOptions]);

  const findNextMatchIndex = React.useCallback(
    (key: string, currentIndex: number) => findTypeaheadMatchIndex(visualOptionLabels, key, currentIndex),
    [visualOptionLabels]
  );

  const selectedIndex = React.useMemo(() => {
    if (resolvedValue === undefined) return hasEmptyOption ? 0 : -1;
    const index = visualOptions.findIndex((opt) => opt.kind === 'value' && opt.value === resolvedValue);
    if (index >= 0) return index;
    // En tolerant load kan efterlade en stale værdi, som ikke længere findes blandt options.
    // Den må ikke blive til et skjult valg af tom-rækken ved Enter; brugeren skal eksplicit vælge
    // en ny option eller rydde feltet. ArrowDown/ArrowUp starter stadig navigationen fra første valg.
    return -1;
  }, [hasEmptyOption, resolvedValue, visualOptions]);

  const selectedVisualOption = React.useMemo(() => {
    if (resolvedValue === undefined) return null;
    const found = visualOptions.find((opt) => opt.kind === 'value' && opt.value === resolvedValue);
    return found?.kind === 'value' ? found : null;
  }, [resolvedValue, visualOptions]);

  const selectedLabel = React.useMemo((): string => {
    if (resolvedValue === undefined) return '';
    if (getOptionLabel) return getOptionLabel(resolvedValue);
    // Et valgfrit felt kan kortvarigt eller efter tolerant load indeholde en værdi, som ikke længere findes
    // blandt options. Det skal vises som placeholder og kunne ryddes – ikke vælte hele React-træet i DEV.
    if (selectedVisualOption === null) return '';

    const label = selectedVisualOption.children;
    if (typeof label === 'string' || typeof label === 'number') return String(label);

    if (import.meta.env.DEV) {
      throw new Error('StyledDropdown: option label must be a string/number or provide getOptionLabel(value)');
    }
    return '';
  }, [getOptionLabel, resolvedValue, selectedVisualOption]);

  const handleOpen = React.useCallback(() => {
    if (disabled || hasConfigError) return;
    closedTypeaheadRef.current = null;
    // Sørg for at combobox-inputtet beholder fokus ved åbning; keyboard-navigation håndteres på inputtet.
    inputElementRef.current?.focus();
    setAnchorEl(anchorRef.current);
    setOpen(true);
    const initialHighlight = selectedIndex >= 0
      ? selectedIndex
      : resolvedValue === undefined
        ? findSelectableIndex(-1, 1)
        : -1;
    setHighlightedIndex(initialHighlight);
  }, [disabled, findSelectableIndex, hasConfigError, resolvedValue, selectedIndex]);

  const handleClose = React.useCallback(
    (reason: CloseReason) => {
      closedTypeaheadRef.current = null;
      if (!open) return;
      setOpen(false);
      setAnchorEl(null);
      setHighlightedIndex(-1);
      onClose?.();
      // VIGTIGT: gendan kun fokus ved keyboard-lukninger, hvor fokus skal blive på kontrollen.
      // Ved pointer-/blur-/tab-lukning lader vi browserens normale fokus-semantik fortsætte.
      if (returnFocusOnClose && (reason === 'escapeKeyDown' || reason === 'select')) {
        inputElementRef.current?.focus();
      }
      if (reason === 'backdropClick') {
        inputElementRef.current?.focus();
      }
    },
    [onClose, open, returnFocusOnClose]
  );

  React.useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const inAnchor = anchorRef.current?.contains(target) ?? false;
      const inListbox = listboxRef.current?.contains(target) ?? false;
      if (inAnchor || inListbox) return;
      // Klikkede brugeren på en anden KONTROL, skal den have fokus – som ved klik væk fra et hvilket
      // som helst andet felt. Handleren kaldte før altid `preventDefault()` og gav derefter fokus
      // tilbage til dropdownen, så det første klik kun lukkede menuen og det næste ramte feltet.
      // Kun et klik i dødt område beholder fokus på kontrollen, så tastaturet ikke havner på <body>.
      const clickedInteractive = target instanceof Element
        && target.closest(INTERACTIVE_TARGET_SELECTOR) !== null;
      if (!clickedInteractive) event.preventDefault();
      handleClose(clickedInteractive ? 'blur' : 'backdropClick');
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [handleClose, open]);

  const handleSelect = React.useCallback(
    (val: TValue | undefined) => {
      if (val === undefined && !allowEmpty) return;

      // Sikkert pga. `allowEmpty`-runtime-værnet:
      // - hvis `allowEmpty === false`, kan `val` ikke være `undefined` her
      // - hvis `allowEmpty === true`, forventer `onChange` `TValue | undefined`
      const commitEvent = createCommitEvent<TValue | undefined>(val);
      (onChange as ((e: StyledDropdownChangeEvent<TValue | undefined>) => void) | undefined)?.({
        ...commitEvent,
        target: { ...commitEvent.target, name },
      });
      handleClose('select');
    },
    [allowEmpty, handleClose, name, onChange]
  );

  const findValueByExactLabel = React.useCallback(
    (label: string): TValue | undefined | null => {
      const normalizedLabel = normalizeDropdownLabel(label);
      // En tom paste må aldrig vælge dropdownens tom-række. Delete/Backspace er den eneste eksplicitte
      // ryddehandling; paste af tom tekst er ifølge dropdown-kontrakten et stille no-op.
      if (normalizedLabel === '') return null;

      for (let index = 0; index < visualOptions.length; index += 1) {
        const opt = visualOptions[index];
        const optionLabel = visualOptionLabels[index] ?? '';
        if (normalizeDropdownLabel(optionLabel) !== normalizedLabel) continue;
        if (opt?.kind === 'empty') return undefined;
        if (opt?.kind === 'value' && !opt.disabled) return opt.value;
      }
      return null;
    },
    [visualOptionLabels, visualOptions]
  );

  const handleInputBlur = React.useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      closedTypeaheadRef.current = null;
      onBlur?.(e);
      if (!open) return;

      const next = e.relatedTarget;
      if (!(next instanceof Node)) {
        handleClose('blur');
        return;
      }

      const inAnchor = anchorRef.current?.contains(next) ?? false;
      const inListbox = listboxRef.current?.contains(next) ?? false;
      if (!inAnchor && !inListbox) {
        handleClose('blur');
      }
    },
    [handleClose, onBlur, open]
  );

  const handleTypeahead = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!isTypeaheadCharKey(event)) return false;

      const trimmedKey = event.key.trim();
      const normalizedKey = trimmedKey.toLocaleLowerCase('da-DK');
      const closedTypeahead = closedTypeaheadRef.current;
      // Første tast i en lukket sekvens starter altid fra menuens begyndelse. Kun en fortsat sekvens
      // med samme bogstav tager udgangspunkt i det seneste typeahead-match – aldrig i feltets oprindelige valg.
      const currentIndex = open
        ? (highlightedIndex >= 0 ? highlightedIndex : selectedIndex)
        : closedTypeahead?.key === normalizedKey
          ? closedTypeahead.visualIndex
          : -1;
      const nextIndex = findNextMatchIndex(trimmedKey, currentIndex);
      if (nextIndex < 0) {
        if (!open) closedTypeaheadRef.current = null;
        return false;
      }

      event.preventDefault();
      event.stopPropagation();

      if (open) {
        if (isSelectableVisualIndex(nextIndex)) {
          setHighlightedIndex(nextIndex);
          return true;
        }
        const fallbackNext = findSelectableIndex(nextIndex - 1, 1);
        if (fallbackNext >= 0) {
          setHighlightedIndex(fallbackNext);
          return true;
        }
        return false;
      }

      const nextValue = getValueAtVisualIndex(nextIndex);
      handleSelect(nextValue);
      closedTypeaheadRef.current = { key: normalizedKey, visualIndex: nextIndex };
      return true;
    },
    [
      findNextMatchIndex,
      findSelectableIndex,
      getValueAtVisualIndex,
      handleSelect,
      highlightedIndex,
      isSelectableVisualIndex,
      open,
      selectedIndex,
    ]
  );

  const containerSxBase: SxProps<Theme> = {
    position: 'relative',
    width: typeof width === 'number' ? `${width}px` : width,
  };

  const inputSxBase: SxProps<Theme> = {
    width: '100%',
    borderRadius: '10px',
    backgroundColor: 'var(--color-input-bg)',
    paddingRight: DROPDOWN_RESERVED_ICON_WIDTH,
    cursor: disabled || hasConfigError ? 'default' : 'pointer',
    '& input': {
      cursor: disabled || hasConfigError ? 'default' : 'pointer',
      paddingRight: 0,
    },
    '& .MuiInputAdornment-root': {
      cursor: disabled || hasConfigError ? 'default' : 'pointer',
    },
    '& .MuiInputAdornment-root *': {
      cursor: disabled || hasConfigError ? 'default' : 'pointer',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-input-border)',
      borderWidth: '1px',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-input-border-hover)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-input-border-focus)',
      borderWidth: '1px',
    },
    // En tabelcelle kan tilføje sin egen hover-farve senere i sx-kæden. Den må aldrig overdøve
    // en aktiv fokusramme, ellers forsvinder den blå ring netop mens musen er over feltet.
    '&.Mui-focused:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-input-border-focus)',
      borderWidth: '1px',
    },
    '&.Mui-error .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-input-border-error)',
      borderWidth: '1px',
    },
    '&.Mui-error:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-input-border-error)',
    },
    '&.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-input-border-focus)',
      borderWidth: '1px',
    },
    '&.Mui-error.Mui-focused:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--color-input-border-focus)',
      borderWidth: '1px',
    },
    '& input::placeholder': {
      color: 'var(--mineo-color-placeholder)',
      opacity: 1,
    },
  };

  const containerSxMerged = mergeSx(containerSxBase, containerSx);
  const inputSx = mergeSx(inputSxBase, sx);
  const listboxSxMerged = mergeSx({
    minWidth: typeof width === 'number' ? `${width}px` : width,
    outline: 'none',
    // Listen er portaleret uden for arbejdsfladens zoom-rod og skal følge dens skala, præcis som
    // tooltips og dialogvinduer. Zoom sættes på LISTEN og ikke på Popover-papiret: papiret bærer
    // MUI's inline `left`/`top`-forankring, som zoom ellers ville gange med, så menuen ville
    // vandre op mod vinduets øverste venstre hjørne. Papiret måler til gengæld listens zoomede
    // størrelse, så ankeret bliver rigtigt af sig selv.
    zoom: `var(${CONTENT_SCALE_CSS_VARIABLE}, 1)`,
    // Højdeloftet er udtrykt i listens EGNE (zoomede) px, så den synlige liste altid ender på
    // vinduets højde minus lidt luft – uanset skala. Uden divisionen ville loftet selv blive
    // skaleret, og listen kun kunne bruge 75 % af den plads, der faktisk er.
    maxHeight: `calc((100vh - 32px) / var(${CONTENT_SCALE_CSS_VARIABLE}, 1))`,
    overflowY: 'auto',
  }, listboxSx);

  const iconSxMerged = mergeSx({
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: 'var(--color-text-secondary)',
  }, iconSx);

  const showError = error && helperText.trim() !== '';
  const resolvedTooltipText = tooltipText ?? helperText;
  const errorTextId = `${resolvedId}-error`;

  return (
    <Tooltip
      title={showError ? resolvedTooltipText : ''}
      arrow
      placement="top"
      disableHoverListener={!showError}
      disableFocusListener={!showError}
      disableTouchListener={!showError}
    >
    <Box sx={containerSxMerged}>
      <OutlinedInput
        {...outlinedInputProps}
        ref={(node: HTMLDivElement | null) => {
          anchorRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        size="small"
        id={resolvedId}
        value={selectedLabel}
        inputRef={inputElementRef}
        // Bevidst `readOnly`: kontrollen er en combobox-trigger, ikke et fritekst-input.
        // Bemærk: `readOnly`-inputs er normalt udelukket fra app'ens tab/enter-navigation på Container-niveau.
        // Denne dropdown medtages via en eksplicit Container-undtagelse nøglet på combobox-rollen.
        readOnly
        name={name}
        error={error || hasConfigError}
        disabled={disabled || hasConfigError}
        onBlur={handleInputBlur}
        onClick={handleOpen}
        onCopy={(e) => {
          copyTextToClipboard(e, { value: selectedLabel });
        }}
        onPaste={(e) => {
          if (disabled || hasConfigError) return;
          const nextValue = findValueByExactLabel(readClipboardText(e));
          e.preventDefault();
          e.stopPropagation();
          if (nextValue === null) return;
          handleSelect(nextValue);
        }}
        placeholder={placeholder}
        inputProps={{
          ...userInputProps,
          'aria-label': resolvedAccessibleName,
          role: 'combobox',
          'aria-haspopup': 'listbox',
          'aria-expanded': open,
          'aria-controls': open ? listboxId : undefined,
          // Undo/redo-restore lokaliserer via feltadresse + editorlokation, ikke `name` (§3.2/§3.7).
          ...(restoreTargetAttributes ?? {}),
          'aria-activedescendant':
            open && highlightedIndex >= 0 && isSelectableVisualIndex(highlightedIndex)
              ? `${listboxId}-option-${highlightedIndex}`
              : undefined,
          // Fejlbeskeden skal også NÅ en skærmlæser. Kontrollen viste før udelukkende en rød ramme og
          // en hover-tooltip, mens tekstfelterne (`StyledTextFieldBase`) altid har haft både en
          // visuelt skjult besked og bindingen til den. Samme fejlmodel, samme formidling.
          ...(showError ? { 'aria-describedby': errorTextId } : {}),
          tabIndex: disabled || hasConfigError ? -1 : (userInputProps?.tabIndex ?? 0),
        }}
        onKeyDown={(e) => {
          if (disabled || hasConfigError) return;

          if (open) {
            if (e.key === 'Tab') {
              handleClose('tab');
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightedIndex((prev) => {
                if (prev < 0) {
                  return findSelectableIndex(-1, 1);
                }
                const next = findSelectableIndex(prev, 1);
                return next >= 0 ? next : prev;
              });
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightedIndex((prev) => {
                if (prev < 0) {
                  return findSelectableIndex(visualOptions.length, -1);
                }
                const next = findSelectableIndex(prev, -1);
                return next >= 0 ? next : prev;
              });
              return;
            }
            if (e.key === 'Enter') {
              if (highlightedIndex < 0) return;
              e.preventDefault();
              e.stopPropagation();
            handleSelect(getValueAtVisualIndex(highlightedIndex));
            return;
          }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              handleClose('escapeKeyDown');
              return;
            }

            if (isClearKey(e)) {
              // Med åben menu ejer menuen tastaturet; Escape er vejen ud. Tasten faldt før igennem til
              // ryddegrenen nedenfor, så Delete både ryddede valget OG lukkede menuen – i strid med
              // `gridUxSpec.ts`, der kun giver ryddetasten til en LUKKET kontrol.
              e.preventDefault();
              e.stopPropagation();
              return;
            }

            if (handleTypeahead(e)) {
              return;
            }
          }

          if (isClearKey(e)) {
            if (allowEmpty) {
              e.preventDefault();
              e.stopPropagation();
              // UNDTAGELSE TIL "INGEN LIVE PREVIEW": Commit øjeblikkeligt ved DELETE/Backspace
              handleSelect(undefined);
            }
            return;
          }

          if (handleTypeahead(e)) {
            return;
          }

          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleOpen();
            return;
          }

          // Escape på en LUKKET dropdown har intet at lukke. Tasten blev alligevel slugt med
          // `preventDefault()` + `stopPropagation()`, så en omgivende dialog eller et overlay aldrig
          // så den – `keyboard-navigation.md` kræver, at Escape når præcis én handling, og her var
          // handlingen ingenting. Lad den boble.
        }}
        sx={inputSx}
      />

      {showError ? (
        <span id={errorTextId} style={visuallyHiddenStyle}>{helperText}</span>
      ) : null}

      <ArrowDropDownIcon sx={iconSxMerged} />

      <Popover
        open={open}
        anchorEl={anchorEl}
        // Behold fokus på combobox-inputtet (focus ring + pil-navigation).
        // MUI Popover er Modal-baseret; default focus management kan stjæle fokus ind i popover'en.
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        // Slå modal-backdrop fra for at undgå aria-hidden-advarsel.
        // MUI Modal sætter aria-hidden="true" på root-elementet, hvilket er ugyldigt når inputtet beholder fokus.
        // hideBackdrop fjerner backdrop-overlay (kun visuel ændring, funktionalitet bevares).
        hideBackdrop
        // Slå modal scroll lock fra - vi bruger ikke backdrop, så scroll lock er unødvendigt.
        // Dette forhindrer aria-hidden manipulation på root-elementet.
        disableScrollLock
        slotProps={{
          paper: {
            // Papiret skaleres IKKE selv – det bærer forankringen. Loftet her er den visuelle
            // grænse, listens eget (zoomede) loft ovenfor svarer til.
            sx: { maxHeight: 'calc(100vh - 32px)', overflow: 'hidden' },
          },
        }}
        onClose={(_, reason) => {
          handleClose(reason === 'escapeKeyDown' ? 'escapeKeyDown' : 'backdropClick');
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MenuList
          component="div"
          id={listboxId}
          role="listbox"
          sx={listboxSxMerged}
          ref={listboxRef}
          disablePadding
          autoFocusItem={false}
        >
          {visualOptions.map((opt, index) => {
            if (opt.kind === 'divider') {
              return (
                <Box
                  key={opt.key}
                  role="presentation"
                  aria-hidden="true"
                  sx={{
                    mx: 2,
                    my: 0.5,
                    borderTop: '1px solid var(--color-surface-border)',
                    pointerEvents: 'none',
                  }}
                />
              );
            }

            const v = getValueAtVisualIndex(index);
            const isSelected = v === resolvedValue;
            const optionSxMerged = mergeSx({
              cursor: 'pointer',
              backgroundColor:
                highlightedIndex === index
                  ? 'var(--color-active-bg)'
                  : isSelected
                    ? 'var(--color-active-bg-hover)'
                    : 'transparent',
              '&:hover': { backgroundColor: 'var(--color-active-bg)' },
            }, optionSx);

            return (
              <MenuItem
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                key={opt.kind === 'empty' ? `${resolvedId}__empty__` : opt.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => handleSelect(v)}
                selected={isSelected}
                disabled={opt.kind === 'value' && opt.disabled}
                sx={optionSxMerged}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {opt.kind === 'empty'
                  ? <em style={{ color: 'var(--mineo-color-dropdown-option-placeholder)' }}>{placeholder}</em>
                  : getOptionLabel
                    ? visualOptionLabels[index]
                    : opt.children}
              </MenuItem>
            );
          })}
        </MenuList>
      </Popover>
    </Box>
    </Tooltip>
  );
};

type StyledDropdownComponent = {
  <TValue extends StyledDropdownValue>(
    props: StyledDropdownProps<TValue> & React.RefAttributes<HTMLDivElement>
  ): React.ReactElement;
  Divider: typeof StyledDropdownDivider;
  displayName?: string;
};

// `forwardRef` kan ikke bevare denne komponents generiske kaldesignatur.
// Assertionen er bevidst isoleret ved denne grænse.
const StyledDropdown = React.forwardRef(StyledDropdownInner) as unknown as StyledDropdownComponent;

StyledDropdown.Divider = StyledDropdownDivider;
StyledDropdown.displayName = 'StyledDropdown';

export { StyledDropdownDivider };
export default StyledDropdown;
