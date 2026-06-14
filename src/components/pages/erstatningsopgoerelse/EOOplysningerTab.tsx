import React from 'react';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
  MenuItem,
} from '@mui/material';
import Download from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import StyledTextField from '../../inputs/StyledTextField';
import StyledDateField from '../../inputs/StyledDateField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import StyledDropdown, { type StyledDropdownChangeEvent } from '../../inputs/StyledDropdown';
import StyledIntegerField from '../../inputs/StyledIntegerField';
import StyledAmountField from '../../inputs/StyledAmountField';
import StyledPercentField from '../../inputs/StyledPercentField';
import StyledToggleSwitch from '../../inputs/StyledToggleSwitch';
import StyledFractionField from '../../inputs/StyledFractionField';
import StyledYearField from '../../inputs/StyledYearField';
import StyledRadioButton from '../../inputs/StyledRadioButton';
import ContentBox from '../../layout/ContentBox';
import InfoTooltipIcon from '../../common/InfoTooltipIcon';
import SvieSmerteTable from '../../tables/SvieSmerteTable';
import TAFPeriodeTable from '../../tables/TAFPeriodeTable';
import FerieperiodeTable from '../../tables/FerieperiodeTable';
import BeregningsperiodeFerieTable from '../../tables/BeregningsperiodeFerieTable';
import OevrigeKravTable from '../../tables/OevrigeKravTable';
import LoenudviklingManuelTable from '../../tables/LoenudviklingManuelTable';
import { CellInvalidDraftScopeProvider } from '../../../contexts/CellInvalidDraftScopeContext';
import { CELL_TABLE_IDS } from '../../../config/cellInvalidDraftScopes';
import useSvieSmerteRows from '../../tables/useSvieSmerteRows';
import useTafRows from '../../tables/useTafRows';
import useFerieRows from '../../tables/useFerieRows';
import useFravaerRows from '../../tables/useFravaerRows';
import useOevrigeKravRows from '../../tables/useOevrigeKravRows';
import type { CommitEvent, CommitHandler } from '../../../types/fieldEvents';
import { getReportableFieldErrorMessage, type ReportableFieldError } from '../../../types/fieldErrors';
import type { UsePersistedFormReturn } from '../../../hooks/usePersistedForm';
import {
  CURRENT_YEAR,
  MIN_SVIESMERTE_YEAR,
  computeSkadedatoMinRule,
  dateRanges_erstatningsopgoerelse
} from '../../../config/dateRanges';
import { resolveMidlertidigEetDatoHvisAktiv } from '../../../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';
import { useDynamicFormFieldErrorReporter, useFormFieldErrorReporter } from '../../../hooks/useFormFieldErrors';
import { usePersistedSectionSelector } from '../../../hooks/useFormPersistenceSelectors';
import {
  type ErstatningsopgoerelseValues,
  type EOAngivetLoenLoenudvikling,
  type JaNejSkjul,
  arbejdsstatusEnum,
  afsluttesMedEnum,
  beregningsmetodeEnum,
  helbredsstatusEnum,
  jaNejSkjulEnum,
  krlSatstabelEnum,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  offentligLoenTypeEnum,
} from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../types/branded';
import { coerceToISODateString, parseISODate } from '../../../types/branded';
import { isoDateToDate } from '../../../domain/dates/isoDate';
import { calculateFerieHverdageMinusSHDage } from '../../../domain/erstatningsopgoerelse/engines/ferieCalculations';
import { EO_ANGIVET_LOEN_ID } from '../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { buildBeregningsperiodeTafOverlap, buildTafDerived } from '../../../domain/erstatningsopgoerelse/helpers/tafRowDerived';
import { erDetteFoersteErstatningsopgoerelse } from '../../../domain/erstatningsopgoerelse/validation/eoNummerValidering';
import { erSvieSmerteTidligereTotalRelevant } from '../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import {
  hasExactDisplayedAmountMatch,
  normalizeOptionalFreeText,
} from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { MONTH_NAMES_DA } from '../../../utils/dateFormatting';
import { formatDanishDate } from '../../../utils/dateUtils';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import {
  getAlleArbejdsgiverOrg,
  getAlleLoenmodtagerOrg,
  getOffentligOverenskomstTypeById,
  getOverenskomsterByOrg,
  getOverenskomstMetaById,
  getReguleringsDatoIntervalForOverenskomst,
  isOffentligOverenskomstId,
} from '../../../data/overenskomstRates';
import { getOffentligLoenTabelForDato } from '../../../data/offentligLoenLookup';
import {
  ASL_AARSLOENSMAKSIMUM_MODEL_LABEL,
  getReguleringsDatoIntervalForStatistikModel,
} from '../../../data/statistiskeRates';
import { getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../../data/krlRates';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { downloadKrlDokument, downloadReguleringDokument, type ReguleringPdfInput } from '../../../pdf/infrastructure/pdfService';
import { formatCurrency } from '../../../utils/formatUtils';

type JaNej = 'Ja' | 'Nej';

type StringLikeKeys = {
  [K in keyof ErstatningsopgoerelseValues]-?: ErstatningsopgoerelseValues[K] extends string | undefined ? K : never;
}[keyof ErstatningsopgoerelseValues];

type NumberLikeKeys = {
  [K in keyof ErstatningsopgoerelseValues]-?: ErstatningsopgoerelseValues[K] extends number | undefined ? K : never;
}[keyof ErstatningsopgoerelseValues];

type AmountLikeKeys = {
  [K in keyof ErstatningsopgoerelseValues]-?: ErstatningsopgoerelseValues[K] extends AmountValue | undefined ? K : never;
}[keyof ErstatningsopgoerelseValues];

type ReguleringsDatoInterval = Readonly<{ fraDato: string; tilDato: string }>;
type LoentrinFinderErrors = Readonly<{ beloeb?: string; dato?: string }>;
type LoentrinFinderResult = Readonly<{
  loentrin: number | '55+';
  gruppe: 0 | 1 | 2 | 3 | 4;
  beloeb: number;
  diff: number;
}>;
const LOENGRUPPER = [0, 1, 2, 3, 4] as const;
// Tre-tilstands-valg for emner (svie/smerte, tabt arbejdsfortjeneste).
// 'Ja' = beregnes og vises; 'Nej' = beregnes ikke, vises som "Ingen" i dokumentet;
// 'Skjul' = beregnes ikke og udelades helt fra erstatningsopgørelsen.
const KRAV_JA_NEJ_SKJUL_OPTIONS = [
  { value: 'Ja', label: 'Ja' },
  { value: 'Nej', label: 'Nej' },
  { value: 'Skjul', label: 'Skjul' },
] as const;
const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';
const PERIODE_INFO_TOOLTIP =
  'Indsæt alle perioder. Tidligere indtastede perioder skal ikke slettes ved senere opgørelse.';
const DELVIS_SYGEMELDING_SATS_INFO_TOOLTIP =
  'Juridisk omtvistet, men nyere\nretspraksis hælder mod fuld sats';

const parseLoentrinSortValue = (loentrin: number | '55+'): number => (loentrin === '55+' ? 56 : loentrin);

const hasNonEmptyDateValue = (value: ISODateString | string | undefined | null): boolean => {
  if (value === undefined || value === null) return false;
  return String(value).trim() !== '';
};

const formatLabelDayAfterIsoDate = (defaultLabel: string, tilDato: ISODateString | undefined, prefix: string): string => {
  if (!tilDato) return defaultLabel;
  const dateObj = isoDateToDate(tilDato);

  const nextDay = new Date(dateObj);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const monthName = MONTH_NAMES_DA[nextDay.getUTCMonth()];
  return `${prefix} den ${nextDay.getUTCDate()}. ${monthName} ${nextDay.getUTCFullYear()}:`;
};


/**
 * EO oplysninger-fanen - sagsoplysninger og grunddata
 */
type ErstatningsopgoerelseFormApi = Pick<
  UsePersistedFormReturn<ErstatningsopgoerelseValues>,
  'values' | 'setValues' | 'setFieldValue' | 'formVersion'
>;

const EOOplysningerTab = React.memo(({ form }: { form: ErstatningsopgoerelseFormApi }) => {
  const { values, setValues, setFieldValue, formVersion } = form;

  const persistedStamdata = usePersistedSectionSelector('stamdata');
  const skadedatoISO = persistedStamdata?.skadedato;
  const skadestypeFromStamdata = persistedStamdata?.skadestype ?? '';
  const { settings } = useAppSettings();
  const reportDynamicFieldError = useDynamicFormFieldErrorReporter('erstatningsopgoerelse', { source: 'input' });

  // Beregn minDate for øvrige krav-tabel
  const oevrigeKravMinDate = React.useMemo(() => {
    return computeSkadedatoMinRule({
      skadedatoISO,
      erErhvervssygdom: skadestypeFromStamdata === 'Erhvervssygdom',
      fallbackMin: dateRanges_erstatningsopgoerelse.tabelOevrigeKravDato.fallbackMin,
    }).minDate;
  }, [skadedatoISO, skadestypeFromStamdata]);

  type ToggleFieldName = {
    [K in keyof ErstatningsopgoerelseValues]-?: ErstatningsopgoerelseValues[K] extends JaNej ? K : never
  }[keyof ErstatningsopgoerelseValues];

  const getChecked = React.useCallback((val: JaNej): boolean => val === 'Ja', []);
  const ensureEoLoenPaaHelligdage = React.useCallback(
    (value: EOAngivetLoenLoenudvikling['loenPaaHelligdage']) => value ?? settings.defaultLoenPaaHelligdage,
    [settings.defaultLoenPaaHelligdage]
  );

  const handleToggleChange = React.useCallback(
    (fieldName: ToggleFieldName): CommitHandler<boolean> =>
      (event: CommitEvent<boolean>) => {
        // Immediate-commit widget: send fieldPath, ellers gætter undo-origin via focus-trackeren,
        // som peger på det forrige (tekst)felt — derfor lander undo-fokus forkert (fejl B).
        setValues((prev) => ({ ...prev, [fieldName]: event.target.value ? 'Ja' : 'Nej' }), { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  type JaNejSkjulFieldName = {
    [K in keyof ErstatningsopgoerelseValues]-?: ErstatningsopgoerelseValues[K] extends JaNejSkjul ? K : never
  }[keyof ErstatningsopgoerelseValues];

  // Immediate-commit radio for tre-tilstands-emnevalg (Ja/Nej/Skjul). Sender fieldPath af samme
  // undo-origin-grund som handleToggleChange.
  const handleJaNejSkjulChange = React.useCallback(
    (fieldName: JaNejSkjulFieldName): CommitHandler<string | undefined> =>
      (event: CommitEvent<string | undefined>) => {
        const parsed = jaNejSkjulEnum.safeParse(event.target.value);
        if (!parsed.success) return;
        setValues((prev) => ({ ...prev, [fieldName]: parsed.data }), { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  /**
   * Handler til onBlur for string-felter (StyledTextField)
   * Trimmer og normaliserer til undefined hvis tom
   */
  const handleStringBlur = React.useCallback(
    <K extends StringLikeKeys>(fieldName: K) =>
      (event: CommitEvent<string | undefined>) => {
        const raw = event.target.value;
        const asString = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
        const trimmed = asString.trim();
        const nextValue = trimmed || undefined;
        setValues((prev) => ({ ...prev, [fieldName]: nextValue }), { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  /**
   * Handler til onBlur for integer-felter (StyledIntegerField)
   * Komponenten parser allerede til number | undefined
   */
  const handleIntegerBlur = React.useCallback(
    <K extends NumberLikeKeys>(fieldName: K) =>
      (event: CommitEvent<number | undefined>) => {
        setValues((prev) => ({ ...prev, [fieldName]: event.target.value }), { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  /**
   * Handler til onBlur for amount/percent/year-felter
   * Komponenten parser allerede til number | undefined
   */
  const handleNumberBlur = React.useCallback(
    <K extends NumberLikeKeys>(fieldName: K) =>
      (event: CommitEvent<number | undefined>) => {
        setValues((prev) => ({ ...prev, [fieldName]: event.target.value }), { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  /**
   * Handler til onBlur for amount-felter (expression-aware)
   */
  const handleAmountBlur = React.useCallback(
    <K extends AmountLikeKeys>(fieldName: K) =>
      (event: CommitEvent<AmountValue | undefined>) => {
        setValues((prev) => ({ ...prev, [fieldName]: event.target.value }), { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  const commitField = React.useCallback(
    <K extends keyof ErstatningsopgoerelseValues>(fieldName: K) =>
      (event: CommitEvent<ErstatningsopgoerelseValues[K]>) => {
        setFieldValue(fieldName, event.target.value);
      },
    [setFieldValue]
  );

  const handleHelbredsfoholdChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = helbredsstatusEnum.safeParse(event.target.value);
    setValues((prev) => ({ ...prev, svieSmerteHelbredsstatus: parsed.success ? parsed.data : undefined }), { fieldPath: 'svieSmerteHelbredsstatus' });
  }, [setValues]);

  const handleArbejdssituationChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = arbejdsstatusEnum.safeParse(event.target.value);
    setValues((prev) => ({ ...prev, tafArbejdsstatus: parsed.success ? parsed.data : undefined }), { fieldPath: 'tafArbejdsstatus' });
  }, [setValues]);

  const handleBeregnesUdFraChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = beregningsmetodeEnum.safeParse(event.target.value);
    if (!parsed.success) return;
    setValues((prev) => ({
      ...prev,
      beregnesUdFra: parsed.data,
      eoAngivetLoenLoenudvikling: {
        ...prev.eoAngivetLoenLoenudvikling,
        loenPaaHelligdage: ensureEoLoenPaaHelligdage(prev.eoAngivetLoenLoenudvikling.loenPaaHelligdage),
        anciennitetstillaegSatsAngivesPer:
          parsed.data === 'Angivet dagsløn'
            ? 'Time'
            : 'Måned',
      },
    }), { fieldPath: 'beregnesUdFra' });
  }, [ensureEoLoenPaaHelligdage, setValues]);

  const handleAfsluttesMedChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = afsluttesMedEnum.safeParse(event.target.value);
    if (!parsed.success) return;
    setValues((prev) => ({ ...prev, erstatningsopgoerelseAfsluttesMed: parsed.data }), { fieldPath: 'erstatningsopgoerelseAfsluttesMed' });
  }, [setValues]);

  const visLoenudviklingFraEO =
    values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn';
  const eoLoenudvikling = values.eoAngivetLoenLoenudvikling;
  const [loentrinFinderOpen, setLoentrinFinderOpen] = React.useState(false);
  const [loentrinFinderAnsaettelse, setLoentrinFinderAnsaettelse] = React.useState<'Månedsløn' | 'Timeløn'>('Månedsløn');
  const [loentrinFinderBeloeb, setLoentrinFinderBeloeb] = React.useState<EOAngivetLoenLoenudvikling['offentligLoenEkstraGrundloen']>(undefined);
  const [loentrinFinderDato, setLoentrinFinderDato] = React.useState<ISODateString | undefined>(undefined);
  const [loentrinFinderErrors, setLoentrinFinderErrors] = React.useState<LoentrinFinderErrors>({});
  const [loentrinFinderAmountFieldError, setLoentrinFinderAmountFieldError] = React.useState<string | undefined>(undefined);
  const [loentrinFinderDateFieldError, setLoentrinFinderDateFieldError] = React.useState<string | undefined>(undefined);
  const [loentrinFinderResults, setLoentrinFinderResults] = React.useState<ReadonlyArray<LoentrinFinderResult>>([]);
  const [loentrinFinderButtonShake, setLoentrinFinderButtonShake] = React.useState(false);
  const loentrinFinderDialogRef = React.useRef<HTMLDivElement>(null);
  const loentrinFinderAnsaettelseRef = React.useRef<HTMLDivElement>(null);
  const loentrinFinderBeloebRef = React.useRef<HTMLDivElement>(null);
  const loentrinFinderDatoRef = React.useRef<HTMLDivElement>(null);
  const loentrinFinderBeregnRef = React.useRef<HTMLButtonElement>(null);
  const loentrinFinderHeadingId = React.useId();

  const updateEoLoenudvikling = React.useCallback(
    (updater: (prev: EOAngivetLoenLoenudvikling) => EOAngivetLoenLoenudvikling, origin?: { fieldPath?: string }) => {
      setValues((prev) => ({ ...prev, eoAngivetLoenLoenudvikling: updater(prev.eoAngivetLoenLoenudvikling) }), origin);
    },
    [setValues]
  );

  const resetLoentrinFinderState = React.useCallback(() => {
    setLoentrinFinderBeloeb(undefined);
    setLoentrinFinderDato(undefined);
    setLoentrinFinderErrors({});
    setLoentrinFinderAmountFieldError(undefined);
    setLoentrinFinderDateFieldError(undefined);
    setLoentrinFinderResults([]);
    setLoentrinFinderButtonShake(false);
  }, []);

  const openLoentrinFinder = React.useCallback(() => {
    resetLoentrinFinderState();
    setLoentrinFinderAnsaettelse(eoLoenudvikling.offentligLoenType ?? 'Månedsløn');
    setLoentrinFinderOpen(true);
  }, [eoLoenudvikling.offentligLoenType, resetLoentrinFinderState]);

  const closeLoentrinFinder = React.useCallback(() => {
    setLoentrinFinderOpen(false);
    resetLoentrinFinderState();
  }, [resetLoentrinFinderState]);

  const triggerLoentrinFinderButtonError = React.useCallback(() => {
    setLoentrinFinderButtonShake(true);
    setTimeout(() => setLoentrinFinderButtonShake(false), 500);
  }, []);

  const validateLoentrinFinderInput = React.useCallback((): {
    errors: LoentrinFinderErrors;
    beloebNumber: number | undefined;
  } => {
    const errors: { beloeb?: string; dato?: string } = {};
    const beloebNumber = amountValueToNumber(loentrinFinderBeloeb);

    if (loentrinFinderAmountFieldError) {
      errors.beloeb = loentrinFinderAmountFieldError;
    } else if (beloebNumber === undefined) {
      errors.beloeb = 'Beløb skal udfyldes';
    } else if (beloebNumber <= 0) {
      errors.beloeb = 'Beløb skal være større end 0';
    }

    if (loentrinFinderDateFieldError) {
      errors.dato = loentrinFinderDateFieldError;
    } else if (!loentrinFinderDato) {
      errors.dato = 'Dato skal udfyldes';
    }

    return { errors, beloebNumber };
  }, [
    loentrinFinderAmountFieldError,
    loentrinFinderBeloeb,
    loentrinFinderDateFieldError,
    loentrinFinderDato,
  ]);

  const handleLoentrinFinderCalculate = React.useCallback(() => {
    const overenskomstId = eoLoenudvikling.overenskomstId ?? '';
    const offentligOverenskomstType = getOffentligOverenskomstTypeById(overenskomstId);
    const overenskomstLabel = getOverenskomstMetaById(overenskomstId)?.navn ?? overenskomstId;

    if (!offentligOverenskomstType) {
      setLoentrinFinderErrors({ dato: 'Offentlig overenskomst er ikke valgt' });
      setLoentrinFinderResults([]);
      triggerLoentrinFinderButtonError();
      return;
    }

    const validation = validateLoentrinFinderInput();
    const hasInputErrors = Boolean(validation.errors.beloeb) || Boolean(validation.errors.dato);
    if (hasInputErrors || validation.beloebNumber === undefined || !loentrinFinderDato) {
      setLoentrinFinderErrors(validation.errors);
      setLoentrinFinderResults([]);
      triggerLoentrinFinderButtonError();
      return;
    }

    const parsedDate = parseISODate(loentrinFinderDato);
    if (!parsedDate) {
      setLoentrinFinderErrors((prev) => ({ ...prev, dato: 'Dato skal udfyldes' }));
      setLoentrinFinderResults([]);
      triggerLoentrinFinderButtonError();
      return;
    }

    const danishDate = formatDanishDate(parsedDate);
    const loenTabel = getOffentligLoenTabelForDato(offentligOverenskomstType, danishDate);
    if (!loenTabel) {
      setLoentrinFinderErrors((prev) => ({
        ...prev,
        dato: `Der findes ingen satser for ${overenskomstLabel} på den valgte dato`,
      }));
      setLoentrinFinderResults([]);
      triggerLoentrinFinderButtonError();
      return;
    }

    const results: LoentrinFinderResult[] = [];
    for (const entry of loenTabel.entries) {
      for (const gruppe of LOENGRUPPER) {
        const beloeb =
          loentrinFinderAnsaettelse === 'Timeløn'
            ? entry.timeLoen[gruppe]
            : entry.maanedsLoen[gruppe];
        results.push({
          loentrin: entry.loentrin,
          gruppe,
          beloeb,
          diff: Math.abs(beloeb - validation.beloebNumber),
        });
      }
    }

    results.sort((a, b) => {
      if (a.diff !== b.diff) return a.diff - b.diff;
      const trinDiff = parseLoentrinSortValue(a.loentrin) - parseLoentrinSortValue(b.loentrin);
      if (trinDiff !== 0) return trinDiff;
      return a.gruppe - b.gruppe;
    });

    setLoentrinFinderErrors({});
    setLoentrinFinderResults(results.slice(0, 5));
  }, [
    eoLoenudvikling.overenskomstId,
    loentrinFinderAnsaettelse,
    loentrinFinderDato,
    triggerLoentrinFinderButtonError,
    validateLoentrinFinderInput,
  ]);

  const loentrinFinderInputAmountNumber = React.useMemo(
    () => amountValueToNumber(loentrinFinderBeloeb),
    [loentrinFinderBeloeb]
  );

  React.useEffect(() => {
    if (!loentrinFinderOpen) return;
    const input = loentrinFinderAnsaettelseRef.current?.querySelector<HTMLInputElement>('input');
    input?.focus();
  }, [loentrinFinderOpen]);

  const getLoentrinFinderTabOrder = React.useCallback((): HTMLElement[] => {
    const ansaettelseInput = loentrinFinderAnsaettelseRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const beloebInput = loentrinFinderBeloebRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const datoInput = loentrinFinderDatoRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const beregnButton = loentrinFinderBeregnRef.current;
    const orderedElements: Array<HTMLElement | null> = [ansaettelseInput, beloebInput, datoInput, beregnButton];
    return orderedElements.filter((item): item is HTMLElement => item !== null);
  }, []);

  React.useEffect(() => {
    if (!loentrinFinderOpen) return;

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      const dialog = loentrinFinderDialogRef.current;
      const activeElement = document.activeElement as HTMLElement | null;
      const isInsideOverlay = Boolean(dialog && activeElement && dialog.contains(activeElement));

      if (!isInsideOverlay) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeLoentrinFinder();
        return;
      }

      if (event.key === 'Enter') {
        const isDropdownCombobox = activeElement?.getAttribute('role') === 'combobox';
        if (isDropdownCombobox) {
          // StyledDropdown håndterer Enter selv (åbn/vælg). Undlad at overskrive den adfærd.
          return;
        }

        const isOpenTextEditor =
          activeElement instanceof HTMLInputElement &&
          !activeElement.readOnly;
        if (isOpenTextEditor) {
          // Overlay-regel: Enter i åben editor skal afslutte redigering (commit/close via blur),
          // men fokus skal blive i samme felt.
          const input = activeElement;
          event.preventDefault();
          event.stopPropagation();
          input.blur();
          requestAnimationFrame(() => {
            if (!loentrinFinderOpen) return;
            input.focus();
          });
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (activeElement === loentrinFinderBeregnRef.current) {
          handleLoentrinFinderCalculate();
        }
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const tabOrder = getLoentrinFinderTabOrder();
        if (tabOrder.length === 0) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        const isDropdownCombobox = activeElement?.getAttribute('role') === 'combobox';
        const isDropdownExpanded = activeElement?.getAttribute('aria-expanded') === 'true';
        if (isDropdownCombobox && isDropdownExpanded) {
          // Når dropdown-menuen er åben, skal pil-op/pil-ned navigere i menuen.
          return;
        }

        if (activeElement instanceof HTMLInputElement && !activeElement.readOnly) {
          // Når editor er åben, skal piletaster ikke kapres af overlay-navigationen.
          return;
        }

        const activeIndex = tabOrder.findIndex((element) => element === activeElement);
        event.preventDefault();
        event.stopPropagation();

        const step = event.key === 'ArrowDown' ? 1 : -1;
        if (activeIndex === -1) {
          tabOrder[0].focus();
          return;
        }

        const nextIndex = (activeIndex + step + tabOrder.length) % tabOrder.length;
        tabOrder[nextIndex].focus();
        return;
      }

      if (event.key !== 'Tab') return;

      const tabOrder = getLoentrinFinderTabOrder();
      if (tabOrder.length === 0) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const first = tabOrder[0];
      const last = tabOrder[tabOrder.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const activeIndex = tabOrder.findIndex((element) => element === active);

      // Bevidst hardcodet tab-sekvens:
      // Ansættelse -> Beløb -> Dato -> Beregn.
      // Vi tvinger denne rækkefølge, fordi generisk focus-trap-adfærd viste sig ustabil med StyledDropdowns popover-fokus
      // og forårsagede focus leaks til den underliggende side. Denne eksplicitte sekvens er bevidst og auditeret UX-adfærd.
      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey) {
        if (activeIndex === -1 || active === first) {
          last.focus();
          return;
        }
        tabOrder[activeIndex - 1].focus();
        return;
      }

      if (activeIndex === -1 || active === last) {
        first.focus();
        return;
      }
      tabOrder[activeIndex + 1].focus();
    };

    document.addEventListener('keydown', handleDocumentKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
    };
  }, [closeLoentrinFinder, getLoentrinFinderTabOrder, handleLoentrinFinderCalculate, loentrinFinderOpen]);

  const handleLoenudviklingBeregningsgrundlagChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = loenudviklingBeregningsgrundlagEnum.safeParse(event.target.value);
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingBeregningsgrundlag: parsed.success ? parsed.data : undefined,
    }), { fieldPath: 'loenudviklingBeregningsgrundlag' });
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingStatistikModelChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = loenudviklingStatistikModelEnum.safeParse(event.target.value);
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingStatistikModel: parsed.success ? parsed.data : undefined,
    }), { fieldPath: 'loenudviklingStatistikModel' });
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingKRLSatstabelChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = krlSatstabelEnum.safeParse(event.target.value);
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingKRLSatstabel: parsed.success ? parsed.data : undefined,
    }), { fieldPath: 'loenudviklingKRLSatstabel' });
  }, [updateEoLoenudvikling]);

  const handleEoOverenskomstFilterChange = React.useCallback(
    (filterType: 'loenmodtager' | 'arbejdsgiver', value: string | undefined) => {
      updateEoLoenudvikling((prev) => ({
        ...prev,
        overenskomstFilter: {
          ...prev.overenskomstFilter,
          [filterType]: value,
        },
      }), { fieldPath: `overenskomstFilter.${filterType}` });
    },
    [updateEoLoenudvikling]
  );

  const handleEoOverenskomstChange = React.useCallback(
    (event: StyledDropdownChangeEvent<string | undefined>) => {
      const nextOverenskomstId = normalizeOptionalFreeText(event.target.value);
      updateEoLoenudvikling((prev) => ({
        ...prev,
        overenskomstId: nextOverenskomstId,
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        offentligLoenType:
          nextOverenskomstId && isOffentligOverenskomstId(nextOverenskomstId)
            ? (prev.offentligLoenType ?? 'Månedsløn')
            : prev.offentligLoenType,
      }), { fieldPath: 'overenskomstId' });
    },
    [updateEoLoenudvikling]
  );

  const handleOffentligLoenTypeChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = offentligLoenTypeEnum.safeParse(event.target.value);
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenType: parsed.success ? parsed.data : prev.offentligLoenType,
    }), { fieldPath: 'offentligLoenType' });
  }, [updateEoLoenudvikling]);

  const handleOffentligLoenTrinCommit = React.useCallback((event: CommitEvent<number | undefined>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenTrin: event.target.value,
    }), { fieldPath: 'offentligLoenTrin' });
  }, [updateEoLoenudvikling]);

  const handleOffentligLoenGruppeCommit = React.useCallback((event: CommitEvent<number | undefined>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenGruppe: event.target.value,
    }), { fieldPath: 'offentligLoenGruppe' });
  }, [updateEoLoenudvikling]);

  const handleOffentligLoenEkstraGrundloenCommit = React.useCallback((event: CommitEvent<EOAngivetLoenLoenudvikling['offentligLoenEkstraGrundloen']>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenEkstraGrundloen: event.target.value,
    }), { fieldPath: 'offentligLoenEkstraGrundloen' });
  }, [updateEoLoenudvikling]);

  const handleEoAnciennitetstillaegToggleCommit = React.useCallback((event: CommitEvent<boolean>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      harAnciennitetstillaegEfterSkadedatoen: event.target.value,
    }), { fieldPath: 'harAnciennitetstillaegEfterSkadedatoen' });
  }, [updateEoLoenudvikling]);

  const handleEoAnciennitetstillaegDatoCommit = React.useCallback((event: CommitEvent<EOAngivetLoenLoenudvikling['anciennitetstillaegDato']>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      anciennitetstillaegDato: event.target.value,
    }), { fieldPath: 'anciennitetstillaegDato' });
  }, [updateEoLoenudvikling]);

  const handleEoAnciennitetstillaegSatsCommit = React.useCallback((event: CommitEvent<EOAngivetLoenLoenudvikling['anciennitetstillaegSats']>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      anciennitetstillaegSats: event.target.value,
    }), { fieldPath: 'anciennitetstillaegSats' });
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingManuelNavnCommit = React.useCallback((event: CommitEvent<string | undefined>) => {
    const trimmed = (event.target.value ?? '').trim();
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingManuelNavn: trimmed,
    }), { fieldPath: 'loenudviklingManuelNavn' });
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingManuelTableChange = React.useCallback((
    tableData: EOAngivetLoenLoenudvikling['loenudviklingManuelTableData'],
    origin?: { fieldPath?: string }
  ) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingManuelTableData: tableData,
    }), origin);
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingManuelInputErrorChange = React.useCallback((hasError: boolean) => {
    reportDynamicFieldError(
      `${EO_ANGIVET_LOEN_ID}${EO_LOENINDKOMST_INPUT_ERROR_SUFFIX}`,
      hasError ? 'Ugyldig manuel regulering' : undefined
    );
  }, [reportDynamicFieldError]);

  const alleLoenmodtagerOrg = React.useMemo(() => getAlleLoenmodtagerOrg(), []);
  const alleArbejdsgiverOrg = React.useMemo(() => getAlleArbejdsgiverOrg(), []);

  const filteredOverenskomster = React.useMemo(() => {
    return getOverenskomsterByOrg(
      eoLoenudvikling.overenskomstFilter?.loenmodtager,
      eoLoenudvikling.overenskomstFilter?.arbejdsgiver
    );
  }, [eoLoenudvikling.overenskomstFilter?.arbejdsgiver, eoLoenudvikling.overenskomstFilter?.loenmodtager]);
  const loentrinFinderOverenskomstLabel = React.useMemo(() => {
    const id = eoLoenudvikling.overenskomstId?.trim();
    if (!id) return 'Ingen overenskomst valgt';
    const meta = getOverenskomstMetaById(id);
    return meta?.navn ?? id;
  }, [eoLoenudvikling.overenskomstId]);

  type IsoDateFieldName =
    | 'vedroererPeriodeFra'
    | 'vedroererPeriodeTil'
    | 'opgørelseLavetDen'
    | 'forligDato'
    | 'menAfgoerelseDato'
    | 'midlertidigEETAfgoerelseDato'
    | 'midlertidigEETVirkningsdato'
    | 'endeligEETAfgoerelseDato'
    | 'endeligEETVirkningsdato'
    | 'differencekravDato'
    | 'sidsteDagAnsaettelsesforhold'
    | 'tafBeregningsperiodeFra'
    | 'tafBeregningsperiodeTil'
    | 'angivetMaanedsloenOpreguleresFraDato'
    | 'angivetDagsloenOpreguleresFraDato';

  const handleIsoDateBlur = React.useCallback(
    (fieldName: IsoDateFieldName) =>
      (event: CommitEvent<ISODateString | undefined>) => {
        const nextValue = coerceToISODateString(event.target.value ?? undefined);
        setValues((prev) => {
          const next: ErstatningsopgoerelseValues = { ...prev };
          next[fieldName] = nextValue;
          return next;
        }, { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  // Validering håndteres via:
  // - Lag 1: Input-lokal validering (onBlur i komponenter)
  // - Lag 2: Felt-specifik validering (kritiske felter onBlur)
  // - Lag 3: Fuld form-validering (endnu ikke implementeret)

  // Dato-input håndteres direkte af StyledDateField (intern draft-state + commit på blur)

  // Cross-field validering: Forlig ansvarsgrad (procent vs. brøk)
  const forligFejl = React.useMemo(() => {
    const harProcent = values.forligAnsvarsgradProcent !== undefined && values.forligAnsvarsgradProcent !== null;
    const harBroek = values.forligAnsvarsgradBroek !== undefined && values.forligAnsvarsgradBroek !== null && values.forligAnsvarsgradBroek.trim() !== '';
    const beggeUdfyldt = harProcent && harBroek;
    return {
      harFejl: beggeUdfyldt,
      fejlbesked: beggeUdfyldt ? 'Kan ikke udfylde både procent og brøk' : '',
    };
  }, [values.forligAnsvarsgradProcent, values.forligAnsvarsgradBroek]);

  // Fejlrapportering til debug/diagnostik (kun runtime).
  // Disse rapporteres bevidst til den centrale field-error-model, så EODebug kan afspejle aktuelle ugyldige inputs
  // selv når den committede, persisterede værdi forbliver uændret (draft ≠ committed).
  const reportVedroererPeriodeFraInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'vedroererPeriodeFra', {
    severity: 'error',
    source: 'input',
  });
  const reportVedroererPeriodeTilInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'vedroererPeriodeTil', {
    severity: 'error',
    source: 'input',
  });
  const reportOpgoerelseLavetDenInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'opgørelseLavetDen', {
    severity: 'error',
    source: 'input',
  });
  const reportForligDatoInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'forligDato', {
    severity: 'error',
    source: 'input',
  });
  const reportMenAfgoerelseDatoInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'menAfgoerelseDato', {
    severity: 'error',
    source: 'input',
  });
  const reportMidlertidigEETAfgoerelseDatoInputError = useFormFieldErrorReporter(
    'erstatningsopgoerelse',
    'midlertidigEETAfgoerelseDato',
    { severity: 'error', source: 'input' }
  );
  const reportMidlertidigEETVirkningsdatoInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'midlertidigEETVirkningsdato', {
    severity: 'error',
    source: 'input',
  });
  const reportEndeligEETAfgoerelseDatoInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'endeligEETAfgoerelseDato', {
    severity: 'error',
    source: 'input',
  });
  const reportEndeligEETVirkningsdatoInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'endeligEETVirkningsdato', {
    severity: 'error',
    source: 'input',
  });
  const reportDifferencekravDatoInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'differencekravDato', {
    severity: 'error',
    source: 'input',
  });
  const reportForligAnsvarsgradProcentInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'forligAnsvarsgradProcent', {
    severity: 'error',
    source: 'input',
  });
  const reportForligAnsvarsgradBroekInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'forligAnsvarsgradBroek', {
    severity: 'error',
    source: 'input',
  });
  const reportSvieSmerteSatserAarInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'svieSmerteSatserAar', {
    severity: 'error',
    source: 'input',
  });
  const reportSvieSmerteTidligereTotalInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'svieSmerteTidligereTotal', {
    severity: 'error',
    source: 'input',
  });
  const reportSvieSmerteAktuelPeriodeInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'svieSmerteAktuelPeriode', {
    severity: 'error',
    source: 'input',
  });
  const reportTidligereModtagetTafInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'tidligereModtagetTaf', {
    severity: 'error',
    source: 'input',
  });

  const reportForligAnsvarsgradProcentRuleError = useFormFieldErrorReporter(
    'erstatningsopgoerelse',
    'forligAnsvarsgradProcent',
    { severity: 'error', source: 'rule' }
  );
  const reportForligAnsvarsgradBroekRuleError = useFormFieldErrorReporter('erstatningsopgoerelse', 'forligAnsvarsgradBroek', {
    severity: 'error',
    source: 'rule',
  });
  const reportForligDatoRuleError = useFormFieldErrorReporter('erstatningsopgoerelse', 'forligDato', {
    severity: 'error',
    source: 'rule',
  });
  const reportForligDatoInputErrorSafe = React.useCallback((errorMsg: ReportableFieldError | undefined) => {
    if (!hasNonEmptyDateValue(values.forligDato)) {
      reportForligDatoInputError(undefined);
      return;
    }
    reportForligDatoInputError(errorMsg);
  }, [reportForligDatoInputError, values.forligDato]);
  React.useEffect(() => {
    const msg = forligFejl.harFejl ? forligFejl.fejlbesked : undefined;
    reportForligAnsvarsgradProcentRuleError(msg);
    reportForligAnsvarsgradBroekRuleError(msg);
  }, [
    forligFejl.fejlbesked,
    forligFejl.harFejl,
    reportForligAnsvarsgradBroekRuleError,
    reportForligAnsvarsgradProcentRuleError,
  ]);
  React.useEffect(() => {
    const hasForligDato = typeof values.forligDato === 'string' && values.forligDato.trim() !== '';
    const hasProcent = typeof values.forligAnsvarsgradProcent === 'number' && Number.isFinite(values.forligAnsvarsgradProcent);
    const hasBroek = typeof values.forligAnsvarsgradBroek === 'string' && values.forligAnsvarsgradBroek.trim() !== '';

    if (!hasForligDato || hasProcent || hasBroek) {
      reportForligDatoRuleError(undefined);
      return;
    }

    reportForligDatoRuleError('Dato for forlig kræver, at ansvarsgrad angives som procent eller brøk');
  }, [
    reportForligDatoRuleError,
    values.forligAnsvarsgradBroek,
    values.forligAnsvarsgradProcent,
    values.forligDato,
  ]);

  const svie = useSvieSmerteRows({ values, setValues, resyncToken: formVersion });
  const taf = useTafRows({ values, setValues, resyncToken: formVersion });

  const ferie = useFerieRows({ values, setValues, resyncToken: formVersion });
  const fravaer = useFravaerRows({ values, setValues, resyncToken: formVersion });
  const oevrigeKrav = useOevrigeKravRows({ values, setValues, resyncToken: formVersion });

  const tafDerived = React.useMemo(() => {
    return buildTafDerived({
      values,
      tafPerioder: taf.committedRowsEnsured,
      ferieperioder: ferie.committedRowsEnsured,
      skadedatoISO,
    });
  }, [ferie.committedRowsEnsured, skadedatoISO, taf.committedRowsEnsured, values]);

  const ferieFeriedageById = React.useMemo(() => {
    const derived: Record<string, number | null> = {};
    for (const row of ferie.committedRowsEnsured) {
      derived[row.id] = calculateFerieHverdageMinusSHDage(row.fra, row.til);
    }
    return derived;
  }, [ferie.committedRowsEnsured]);

  const fravaerFeriedageById = React.useMemo(() => {
    const derived: Record<string, number | null> = {};
    for (const row of fravaer.committedRowsEnsured) {
      derived[row.id] = calculateFerieHverdageMinusSHDage(row.fra, row.til);
    }
    return derived;
  }, [fravaer.committedRowsEnsured]);

  const beregningsperiodeTafOverlap = React.useMemo(() => {
    return buildBeregningsperiodeTafOverlap({ values, tafPerioder: taf.committedRowsEnsured });
  }, [taf.committedRowsEnsured, values]);

  const opgoerelseLavetDenInputRef = React.useRef<HTMLInputElement>(null);

  const erFoersteOpgoerelse = React.useMemo(
    () => erDetteFoersteErstatningsopgoerelse(values.eoNummer),
    [values.eoNummer]
  );

  const skalKomprimereIndtaegtFoerSkaden =
    !erFoersteOpgoerelse && getChecked(values.komprimerBeregningEfterFoersteOpgoerelse);

  const angivetLoenOpreguleringLabel = React.useMemo(() => {
    const loenLabel = values.beregnesUdFra === 'Angivet månedsløn' ? 'månedsløn' : 'dagsløn';
    return `Det angivne beløb afspejler ${loenLabel}en per dato (hvis forskellige fra skadedato)`;
  }, [values.beregnesUdFra]);

  const loenudviklingBasis = eoLoenudvikling.loenudviklingBeregningsgrundlag;
  const erOffentligOverenskomst = Boolean(
    eoLoenudvikling.overenskomstId &&
    isOffentligOverenskomstId(eoLoenudvikling.overenskomstId)
  );
  // I EO (angivet løn) er "Satsen angives per" bevidst implicit:
  // dagsløn => time, månedsløn => måned.
  const eoAnciennitetSatsPerTekst = values.beregnesUdFra === 'Angivet dagsløn' ? 'time' : 'måned';
  const showEoAnciennitetstillaegSection = visLoenudviklingFraEO
    && loenudviklingBasis === 'Overenskomst'
    && Boolean(eoLoenudvikling.overenskomstId?.trim());

  const aktivAngivetLoenOpreguleresFraDato =
    values.beregnesUdFra === 'Angivet månedsløn'
      ? values.angivetMaanedsloenOpreguleresFraDato
      : values.beregnesUdFra === 'Angivet dagsløn'
        ? values.angivetDagsloenOpreguleresFraDato
        : undefined;

  const loenudviklingBaseDateISO = React.useMemo(() => {
    const baseIso = aktivAngivetLoenOpreguleresFraDato || skadedatoISO;
    return baseIso && parseISODate(baseIso) ? baseIso : undefined;
  }, [aktivAngivetLoenOpreguleresFraDato, skadedatoISO]);

  const loenudviklingBaseDateDisplay = React.useMemo(() => {
    const parsed = loenudviklingBaseDateISO ? parseISODate(loenudviklingBaseDateISO) : null;
    if (!parsed) return '';
    return formatDanishDate(parsed);
  }, [loenudviklingBaseDateISO]);

  const shouldShowReguleringsDatoInterval = React.useMemo(() => {
    return loenudviklingBasis === 'Overenskomst'
      || (loenudviklingBasis === 'Statistik' && Boolean(eoLoenudvikling.loenudviklingStatistikModel))
      || (loenudviklingBasis === 'KRL satstabel' && Boolean(eoLoenudvikling.loenudviklingKRLSatstabel));
  }, [eoLoenudvikling.loenudviklingKRLSatstabel, eoLoenudvikling.loenudviklingStatistikModel, loenudviklingBasis]);
  const offentligLoenEkstraGrundloenSuffix = eoLoenudvikling.offentligLoenType === 'Timeløn' ? '/ time' : '/ måned';

  const reguleringsDatoIntervalData: ReguleringsDatoInterval | undefined = React.useMemo(() => {
    if (!shouldShowReguleringsDatoInterval) return undefined;
    if (loenudviklingBasis === 'Overenskomst') {
      return getReguleringsDatoIntervalForOverenskomst(eoLoenudvikling.overenskomstId ?? '');
    }
    if (loenudviklingBasis === 'Statistik') {
      return getReguleringsDatoIntervalForStatistikModel(eoLoenudvikling.loenudviklingStatistikModel ?? '');
    }
    if (loenudviklingBasis === 'KRL satstabel' && eoLoenudvikling.loenudviklingKRLSatstabel) {
      return getReguleringsDatoIntervalForKRL(eoLoenudvikling.loenudviklingKRLSatstabel as KRLSatstabelId);
    }
    return undefined;
  }, [eoLoenudvikling.loenudviklingKRLSatstabel, eoLoenudvikling.loenudviklingStatistikModel, eoLoenudvikling.overenskomstId, loenudviklingBasis, shouldShowReguleringsDatoInterval]);

  const reguleringsDatoIntervalDisplay =
    reguleringsDatoIntervalData ? `${reguleringsDatoIntervalData.fraDato} - ${reguleringsDatoIntervalData.tilDato}` : '';

  const handleDownloadReguleringPdf = React.useCallback(
    async (input: ReguleringPdfInput) => {
      await downloadReguleringDokument({
        input,
        settings,
        persistedStamdata,
      });
    },
    [persistedStamdata, settings]
  );

  const handleDownloadKRLPdf = React.useCallback(async () => {
    await downloadKrlDokument({
      settings,
      persistedStamdata,
    });
  }, [persistedStamdata, settings]);

  const statusSubheaderLabel = React.useMemo(() => {
    const label = formatLabelDayAfterIsoDate(
      'Status ved erstatningsperiodens udløb',
      values.vedroererPeriodeTil,
      'Status'
    );
    // Fjern kolon fra slutningen hvis den er der
    return label.endsWith(':') ? label.slice(0, -1) : label;
  }, [values.vedroererPeriodeTil]);

  // Beregn menAfgoerelseDato - kun hvis synlig
  const menAfgoerelseDatoForTabel = React.useMemo(() => {
    const varigeMenErSynlig = values.varigeMenAfgorelse === 'Ja';
    return varigeMenErSynlig ? values.menAfgoerelseDato : undefined;
  }, [values.varigeMenAfgorelse, values.menAfgoerelseDato]);

  // Beregn endelig EET startdato - kun hvis synlig
  const endeligEETBeregnetDato = React.useMemo(() => {
    const endeligEetErSynlig = values.endeligtEETAfgorelse === 'Ja';
    if (!endeligEetErSynlig) return undefined;

    // Hvis virkningsdato er udfyldt, brug den, ellers brug afgørelsesdato
    return values.endeligEETVirkningsdato || values.endeligEETAfgoerelseDato;
  }, [values.endeligtEETAfgorelse, values.endeligEETVirkningsdato, values.endeligEETAfgoerelseDato]);

  // Midlertidig EET-dato som TAF-afgrænsning — kun aktiv ved skadedato < 2011-06-16.
  const midlertidigEETBeregnetDato = React.useMemo(
    () => resolveMidlertidigEetDatoHvisAktiv({ ...values, skadedatoISO }),
    [values, skadedatoISO]
  );

  const erErhvervssygdom = skadestypeFromStamdata === 'Erhvervssygdom';

  const skadedatoMinRule = React.useMemo(
    () =>
      computeSkadedatoMinRule({
        skadedatoISO,
        erErhvervssygdom,
        fallbackMin: dateRanges_erstatningsopgoerelse.forligDato.fallbackMin,
      }),
    [erErhvervssygdom, skadedatoISO]
  );

  const opgoerelseLavetDenMinRule = React.useMemo(
    () =>
      computeSkadedatoMinRule({
        skadedatoISO,
        erErhvervssygdom,
        fallbackMin: dateRanges_erstatningsopgoerelse.opgoerelse.fallbackMin,
      }),
    [erErhvervssygdom, skadedatoISO]
  );

  // Tjek om der er verserende klagesager
  const verserendeKlageMen = values.verserendeKlageMen === 'Ja';
  const verserendeKlageEet = values.verserendeKlageEet === 'Ja';

  return (
    <Box>
      {/* Sektion 1: Erstatningsopgørelse info (øverst) */}
      <ContentBox className="content-box">
        <Typography className="section-header">Erstatningsopgørelse</Typography>

        <Box className="row--label-right-hover" sx={{ '--label-width': '250px' }}>
          <Typography className="row--text">Erstatningsopgørelse</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">Nummer</Typography>
              <StyledTextField
                name="eoNummer"
                width={80}
                value={values.eoNummer || ''}
                onCommit={handleStringBlur('eoNummer')}
                sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
              />
              <Typography className="row--text">+ evt. ledsagetekst</Typography>
              <StyledTextField
                name="eoLedsagetekst"
                width={200}
                value={values.eoLedsagetekst || ''}
                onCommit={handleStringBlur('eoLedsagetekst')}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Revideret opgørelse</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="revideretOpgoerelse"
              checked={getChecked(values.revideretOpgoerelse)}
              onCommit={handleToggleChange('revideretOpgoerelse')}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Vedrører perioden</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StyledDateField
                name="vedroererPeriodeFra"
                value={values.vedroererPeriodeFra}
                onCommit={handleIsoDateBlur('vedroererPeriodeFra')}
                onFieldError={reportVedroererPeriodeFraInputError}
                minDate={skadedatoMinRule.minDate}
                maxDate={values.vedroererPeriodeTil || dateRanges_erstatningsopgoerelse.periodeFra.fallbackMax}
                specialRangeErrors={{
                  fraTilRole: 'fra',
                  minBoundKind: skadedatoMinRule.minBoundKind,
                  minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                }}
              />
              <Typography className="row--text">til og med</Typography>
              <StyledDateField
                name="vedroererPeriodeTil"
                value={values.vedroererPeriodeTil}
                onCommit={handleIsoDateBlur('vedroererPeriodeTil')}
                onFieldError={reportVedroererPeriodeTilInputError}
                minDate={values.vedroererPeriodeFra || dateRanges_erstatningsopgoerelse.periodeTil.fallbackMin}
                maxDate={dateRanges_erstatningsopgoerelse.periodeTil.max}
                specialRangeErrors={{ fraTilRole: 'til' }}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Opgørelse lavet den</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StyledDateField
                name="opgørelseLavetDen"
                value={values.opgørelseLavetDen}
                onCommit={handleIsoDateBlur('opgørelseLavetDen')}
                onFieldError={reportOpgoerelseLavetDenInputError}
                inputRef={opgoerelseLavetDenInputRef}
                minDate={opgoerelseLavetDenMinRule.minDate}
                maxDate={dateRanges_erstatningsopgoerelse.opgoerelse.max}
                specialRangeErrors={{
                  minBoundKind: opgoerelseLavetDenMinRule.minBoundKind,
                  minBoundReferenceISO: opgoerelseLavetDenMinRule.minBoundReferenceISO,
                }}
              />
              <InsertTodayDateButton
                onCommit={(today) => {
                  setValues((prev) => ({ ...prev, opgørelseLavetDen: today }));
                }}
                focusRef={opgoerelseLavetDenInputRef}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Indsæt udkast-stempel</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="indsaetUdkastStempel"
              checked={getChecked(values.indsaetUdkastStempel)}
              onCommit={handleToggleChange('indsaetUdkastStempel')}
            />
          </Box>
        </Box>

        <Typography className="row--subheading">{statusSubheaderLabel}</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Helbredsforhold</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              name="svieSmerteHelbredsstatus"
              width={200}
              value={values.svieSmerteHelbredsstatus}
              onChange={handleHelbredsfoholdChange}
            >
              <MenuItem value="Sygemeldt">Sygemeldt</MenuItem>
              <MenuItem value="Delvist Sygemeldt">Delvist Sygemeldt</MenuItem>
              <MenuItem value="Raskmeldt">Raskmeldt</MenuItem>
            </StyledDropdown>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Arbejdssituation</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              name="tafArbejdsstatus"
              width={200}
              value={values.tafArbejdsstatus}
              onChange={handleArbejdssituationChange}
            >
              <MenuItem value="Uarbejdsdygtig">Uarbejdsdygtig</MenuItem>
              <MenuItem value="Delvist raskmeldt">Delvist raskmeldt</MenuItem>
              <MenuItem value="Fuldt arbejdsdygtig">Fuldt arbejdsdygtig</MenuItem>
              <StyledDropdown.Divider />
              <MenuItem value="Efterløn">Efterløn</MenuItem>
              <MenuItem value="Fleksjob">Fleksjob</MenuItem>
              <MenuItem value="Folkepension">Folkepension</MenuItem>
              <MenuItem value="Førtidspension">Førtidspension</MenuItem>
              <MenuItem value="Kontanthjælp">Kontanthjælp</MenuItem>
              <MenuItem value="Revalidering">Revalidering</MenuItem>
              <MenuItem value="Seniorpension">Seniorpension</MenuItem>
              <MenuItem value="Uddannelse">Uddannelse</MenuItem>
            </StyledDropdown>
          </Box>
        </Box>

        <Typography className="row--subheading">Bekræftelse</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Erstatningsopgørelse afsluttes med</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              name="erstatningsopgoerelseAfsluttesMed"
              allowEmpty={false}
              width={220}
              value={values.erstatningsopgoerelseAfsluttesMed}
              onChange={handleAfsluttesMedChange}
            >
              {afsluttesMedEnum.options.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </StyledDropdown>
          </Box>
        </Box>
      </ContentBox>

      {/* Sektion 2: Forlig */}
      <ContentBox className="content-box" data-section-id="forlig">
        <Typography className="section-header">Forlig</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Forlig om ansvarsgrad</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">Procent</Typography>
              <StyledPercentField
                name="forligAnsvarsgradProcent"
                width={100}
                value={values.forligAnsvarsgradProcent}
                onCommit={handleNumberBlur('forligAnsvarsgradProcent')}
                onFieldError={reportForligAnsvarsgradProcentInputError}
                useDefaultPercentRange
                error={forligFejl.harFejl}
                helperText={forligFejl.fejlbesked}
              />
              <Typography className="row--text">eller brøk</Typography>
              <StyledFractionField
                name="forligAnsvarsgradBroek"
                width={120}
                value={values.forligAnsvarsgradBroek}
                onCommit={handleStringBlur('forligAnsvarsgradBroek')}
                onFieldError={reportForligAnsvarsgradBroekInputError}
                error={forligFejl.harFejl}
                helperText={forligFejl.fejlbesked}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. dato for forlig</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField
              name="forligDato"
              value={values.forligDato}
              onCommit={handleIsoDateBlur('forligDato')}
              onFieldError={reportForligDatoInputErrorSafe}
              minDate={skadedatoMinRule.minDate}
              maxDate={dateRanges_erstatningsopgoerelse.forligDato.max}
              specialRangeErrors={{
                minBoundKind: skadedatoMinRule.minBoundKind,
                minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
              }}
            />
          </Box>
        </Box>
      </ContentBox>

      {/* Sektion 3: AES-afgørelser */}
      <ContentBox className="content-box" data-section-id="aes">
        <Typography className="section-header">AES-afgørelser</Typography>

        {/* Varige mén */}
        <Typography className="row--subheading">
          Varige mén
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Truffet afgørelse om varige mén på 5 % eller derover</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="varigeMenAfgorelse"
              checked={getChecked(values.varigeMenAfgorelse)}
              onCommit={handleToggleChange('varigeMenAfgorelse')}
            />
          </Box>
        </Box>

        {getChecked(values.varigeMenAfgorelse) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for første ménafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  name="menAfgoerelseDato"
                  value={values.menAfgoerelseDato}
                  onCommit={handleIsoDateBlur('menAfgoerelseDato')}
                  onFieldError={reportMenAfgoerelseDatoInputError}
                  minDate={skadedatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.menAfgoerelseDato.max}
                  specialRangeErrors={{
                    minBoundKind: skadedatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                  }}
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Verserende klagesag over ménafgørelse?</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch
                  name="verserendeKlageMen"
                  checked={getChecked(values.verserendeKlageMen)}
                  onCommit={handleToggleChange('verserendeKlageMen')}
                />
              </Box>
            </Box>
          </>
        )}

        {/* Erhvervsevnetab */}
        <Typography className="row--subheading">
          Midlertidigt erhvervsevnetab
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Truffet afgørelse om midlertidigt erhvervsevnetab på 15 % eller derover</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="midlertidigtEETAfgorelse"
              checked={getChecked(values.midlertidigtEETAfgorelse)}
              onCommit={handleToggleChange('midlertidigtEETAfgorelse')}
            />
          </Box>
        </Box>

        {getChecked(values.midlertidigtEETAfgorelse) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for første midlertidige erhvervsevnetabsafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  name="midlertidigEETAfgoerelseDato"
                  value={values.midlertidigEETAfgoerelseDato}
                  onCommit={handleIsoDateBlur('midlertidigEETAfgoerelseDato')}
                  onFieldError={reportMidlertidigEETAfgoerelseDatoInputError}
                  minDate={skadedatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.midlertidigEETAfgoerelseDato.max}
                  specialRangeErrors={{
                    minBoundKind: skadedatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                  }}
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Virkningsdato (hvis forskellig fra afgørelsesdatoen)</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  name="midlertidigEETVirkningsdato"
                  value={values.midlertidigEETVirkningsdato}
                  onCommit={handleIsoDateBlur('midlertidigEETVirkningsdato')}
                  onFieldError={reportMidlertidigEETVirkningsdatoInputError}
                  minDate={skadedatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.midlertidigEETVirkningsdato.max}
                  specialRangeErrors={{
                    minBoundKind: skadedatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                  }}
                />
              </Box>
            </Box>
          </>
        )}

        <Typography className="row--subheading">
          Endeligt erhvervsevnetab
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Truffet afgørelse om endeligt erhvervsevnetab på 15 % eller derover</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="endeligtEETAfgorelse"
              checked={getChecked(values.endeligtEETAfgorelse)}
              onCommit={handleToggleChange('endeligtEETAfgorelse')}
            />
          </Box>
        </Box>

        {getChecked(values.endeligtEETAfgorelse) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for endelig erhvervsevnetabsafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  name="endeligEETAfgoerelseDato"
                  value={values.endeligEETAfgoerelseDato}
                  onCommit={handleIsoDateBlur('endeligEETAfgoerelseDato')}
                  onFieldError={reportEndeligEETAfgoerelseDatoInputError}
                  minDate={skadedatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.endeligEETAfgoerelseDato.max}
                  specialRangeErrors={{
                    minBoundKind: skadedatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                  }}
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Virkningsdato (hvis forskellig fra afgørelsesdatoen)</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  name="endeligEETVirkningsdato"
                  value={values.endeligEETVirkningsdato}
                  onCommit={handleIsoDateBlur('endeligEETVirkningsdato')}
                  onFieldError={reportEndeligEETVirkningsdatoInputError}
                  minDate={skadedatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.endeligEETVirkningsdato.max}
                  specialRangeErrors={{
                    minBoundKind: skadedatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                  }}
                />
              </Box>
            </Box>
          </>
        )}

        <Typography className="row--subheading">
          Øvrigt
        </Typography>

        {(getChecked(values.midlertidigtEETAfgorelse) || getChecked(values.endeligtEETAfgorelse)) && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Verserende klagesag over EET-afgørelse?</Typography>
            <Box className="row--label-right-hover__content">
              <StyledToggleSwitch
                name="verserendeKlageEet"
                checked={getChecked(values.verserendeKlageEet)}
                onCommit={handleToggleChange('verserendeKlageEet')}
              />
            </Box>
          </Box>
        )}

        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. differencekrav opgjort per</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField
              name="differencekravDato"
              value={values.differencekravDato}
              onCommit={handleIsoDateBlur('differencekravDato')}
              onFieldError={reportDifferencekravDatoInputError}
              minDate={skadedatoMinRule.minDate}
              maxDate={dateRanges_erstatningsopgoerelse.differencekravDato.max}
              specialRangeErrors={{
                minBoundKind: skadedatoMinRule.minBoundKind,
                minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
              }}
            />
          </Box>
        </Box>
      </ContentBox>

      {/* Sektion 4: Svie- og smertegodtgørelse */}
      <ContentBox className="content-box" data-section-id="sviesmerte">
        <Typography className="section-header">Svie- og smertegodtgørelse</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Er der krav på svie- og smertegodtgørelse i erstatningsperioden</Typography>
          <Box className="row--label-right-hover__content">
            <StyledRadioButton
              name="kravPaaSvieSmerteGodtgoerelse"
              value={values.kravPaaSvieSmerteGodtgoerelse}
              onCommit={handleJaNejSkjulChange('kravPaaSvieSmerteGodtgoerelse')}
              row={true}
              options={[...KRAV_JA_NEJ_SKJUL_OPTIONS]}
            />
          </Box>
        </Box>

        {values.kravPaaSvieSmerteGodtgoerelse === 'Ja' && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Tidligere beregnet S/S til max.</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch
                  name="tidligereSsMax"
                  checked={getChecked(values.tidligereSsMax)}
                  onCommit={handleToggleChange('tidligereSsMax')}
                />
              </Box>
            </Box>

            {!getChecked(values.tidligereSsMax) && (
              <>
                <Typography className="row--subheading">
                  Periode:
                  <InfoTooltipIcon title={PERIODE_INFO_TOOLTIP} />
                </Typography>
                <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoSvieSmerte}>
                <SvieSmerteTable
                  rows={svie.draftRows}
                  committedById={svie.committedById}
                  derivedById={svie.derivedById}
                  overlappingIds={svie.overlappingIds}
                  skadedatoISO={skadedatoISO}
                  menAfgoerelseDato={menAfgoerelseDatoForTabel}
                  erErhvervssygdom={erErhvervssygdom}
                  verserendeKlageMen={verserendeKlageMen}
                  onFieldChange={svie.onFieldChange}
                  onRowBlur={svie.onRowBlur}
                  onRowsReorder={svie.reorderRows}
                  saveOrderPath="erstatningsopgoerelse.svieSmertePerioder"
                />
                </CellInvalidDraftScopeProvider>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Hvilket års svie/smerte-satser lægges til grund?</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledYearField
                      name="svieSmerteSatserAar"
                      width={100}
                      value={values.svieSmerteSatserAar}
                      onCommit={handleNumberBlur('svieSmerteSatserAar')}
                      onFieldError={reportSvieSmerteSatserAarInputError}
                      minYear={MIN_SVIESMERTE_YEAR}
                      maxYear={CURRENT_YEAR}
                    />
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    Svie/smerte-sats ved delvis sygemelding:
                    <InfoTooltipIcon title={DELVIS_SYGEMELDING_SATS_INFO_TOOLTIP} />
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledRadioButton
                      name="svieSmerteDelvisSygemeldingSats"
                      value={values.svieSmerteDelvisSygemeldingSats}
                      onCommit={(event) => {
                        const next = event.target.value;
                        if (next === 'fuld' || next === 'halv') {
                          setFieldValue('svieSmerteDelvisSygemeldingSats', next);
                        }
                      }}
                      row={true}
                      options={[
                        { value: 'fuld', label: 'Fuld sats' },
                        { value: 'halv', label: 'Halv sats' },
                      ]}
                    />
                  </Box>
                </Box>

                <Typography className="row--subheading">Tidligere svie- og smertegodtgørelse</Typography>

                {/* Synlighed deler samme predikat som beregningens neutralisering,
                    så feltet aldrig kan være skjult i UI'en men aktivt i beregningen. */}
                {erSvieSmerteTidligereTotalRelevant(values) && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Svie/smerte-krav i tidligere erstatningsopgørelser:</Typography>
                    <Box className="row--label-right-hover__content">
                      <StyledAmountField
                        name="svieSmerteTidligereTotal"
                        width={150}
                        value={values.svieSmerteTidligereTotal}
                        onCommit={handleAmountBlur('svieSmerteTidligereTotal')}
                        onFieldError={reportSvieSmerteTidligereTotalInputError}
                      />
                    </Box>
                  </Box>
                )}

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Evt. allerede modtaget svie/smerte for nuværende erstatningsperiode:</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledAmountField
                      name="svieSmerteAktuelPeriode"
                      width={150}
                      value={values.svieSmerteAktuelPeriode}
                      onCommit={handleAmountBlur('svieSmerteAktuelPeriode')}
                      onFieldError={reportSvieSmerteAktuelPeriodeInputError}
                    />
                  </Box>
                </Box>
              </>
            )}
          </>
        )}
      </ContentBox>

      {/* Sektion 6: Tabt arbejdsfortjeneste */}
      <ContentBox className="content-box" data-section-id="taf">
        <Typography className="section-header">Tabt arbejdsfortjeneste</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Er der krav på tabt arbejdsfortjeneste i erstatningsperioden</Typography>
          <Box className="row--label-right-hover__content">
            <StyledRadioButton
              name="kravPaaTabtArbejdsfortjeneste"
              value={values.kravPaaTabtArbejdsfortjeneste}
              onCommit={handleJaNejSkjulChange('kravPaaTabtArbejdsfortjeneste')}
              row={true}
              options={[...KRAV_JA_NEJ_SKJUL_OPTIONS]}
            />
          </Box>
        </Box>

        {values.kravPaaTabtArbejdsfortjeneste === 'Ja' && (
          <>
            <Typography className="row--subheading">
              Periode:
              <InfoTooltipIcon title={PERIODE_INFO_TOOLTIP} />
            </Typography>
            <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoTafPeriode}>
            <TAFPeriodeTable
              rows={taf.draftRows}
              committedById={taf.committedById}
              overlappingIds={taf.overlappingIds}
              onFieldChange={taf.onFieldChange}
              onRowBlur={taf.onRowBlur}
              onRowsReorder={taf.reorderRows}
              derivedById={tafDerived.derivedById}
              derivedColumnHeader={tafDerived.kolonneOverskrift}
              overlapWithBeregningsperiodeByRowId={beregningsperiodeTafOverlap.overlapMessageByRowId}
              skadedatoISO={skadedatoISO}
              endeligEETBeregnetDato={endeligEETBeregnetDato}
              midlertidigEETBeregnetDato={midlertidigEETBeregnetDato}
              differencekravDato={values.differencekravDato}
              erErhvervssygdom={erErhvervssygdom}
              verserendeKlageEet={verserendeKlageEet}
              saveOrderPath="erstatningsopgoerelse.tafPerioder"
            />
            </CellInvalidDraftScopeProvider>

            <Typography className="row--subheading">Evt. ferie i perioden:</Typography>
            <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoFerieperiode}>
            <FerieperiodeTable
              rows={ferie.draftRows}
              committedById={ferie.committedById}
              feriedageById={ferieFeriedageById}
              onFieldChange={ferie.onFieldChange}
              onRowBlur={ferie.onRowBlur}
              onRowsReorder={ferie.reorderRows}
              skadedatoISO={skadedatoISO}
              endeligEETBeregnetDato={endeligEETBeregnetDato}
              differencekravDato={values.differencekravDato}
              erErhvervssygdom={erErhvervssygdom}
              verserendeKlageEet={verserendeKlageEet}
              saveOrderPath="erstatningsopgoerelse.ferieperioder"
            />
            </CellInvalidDraftScopeProvider>

            <Typography className="row--subheading">Øvrigt</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Evt. allerede modtaget tabt arbejdsfortjeneste for nuværende erstatningsperiode:</Typography>
              <Box className="row--label-right-hover__content">
                <StyledAmountField
                  name="tidligereModtagetTaf"
                  width={150}
                  value={values.tidligereModtagetTaf}
                  onCommit={handleAmountBlur('tidligereModtagetTaf')}
                  onFieldError={reportTidligereModtagetTafInputError}
                />
              </Box>
            </Box>

          </>
        )}
      </ContentBox>

      {/* Sektion 5: Indtægt før skaden */}
      {values.kravPaaTabtArbejdsfortjeneste === 'Ja' && (
        <ContentBox className="content-box" data-section-id="taf-beregningsgrundlag">
        <Typography className="section-header">Indtægt før skaden</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Skjul beregning efter første opgørelse</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="komprimerBeregningEfterFoersteOpgoerelse"
              checked={getChecked(values.komprimerBeregningEfterFoersteOpgoerelse)}
              onCommit={handleToggleChange('komprimerBeregningEfterFoersteOpgoerelse')}
            />
          </Box>
        </Box>

        {!skalKomprimereIndtaegtFoerSkaden && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Beregnes ud fra</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDropdown
                  name="beregnesUdFra"
                  width={200}
                  value={values.beregnesUdFra}
                  onChange={handleBeregnesUdFraChange}
                  allowEmpty={false}
                >
                  <MenuItem value="Beregningsperiode">Beregningsperiode</MenuItem>
                  <MenuItem value="Angivet månedsløn">Angivet månedsløn</MenuItem>
                  <MenuItem value="Angivet dagsløn">Angivet dagsløn</MenuItem>
                </StyledDropdown>
              </Box>
            </Box>

            {values.beregnesUdFra === 'Beregningsperiode' && (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">Periode til beregning af før-løn:</Typography>
                  <Box className="row--label-right-hover__content">
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <StyledDateField
                        name="tafBeregningsperiodeFra"
                        value={values.tafBeregningsperiodeFra}
                        onCommit={handleIsoDateBlur('tafBeregningsperiodeFra')}
                        error={beregningsperiodeTafOverlap.firstOverlapMessage !== undefined}
                        helperText={beregningsperiodeTafOverlap.firstOverlapMessage ?? ''}
                      />
                      <Typography sx={{ minWidth: 'auto' }}>til:</Typography>
                      <StyledDateField
                        name="tafBeregningsperiodeTil"
                        value={values.tafBeregningsperiodeTil}
                        onCommit={handleIsoDateBlur('tafBeregningsperiodeTil')}
                        error={beregningsperiodeTafOverlap.firstOverlapMessage !== undefined}
                        helperText={beregningsperiodeTafOverlap.firstOverlapMessage ?? ''}
                      />
                    </Box>
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    Regulering af offentlige ydelser i EO
                    <InfoTooltipIcon title="Offentlige ydelser fremskrives efter statslig praksis med tilpasningsprocenten + 2 % per 1. januar" />
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledToggleSwitch
                      name="regulerOffentligeYdelser"
                      checked={getChecked(values.regulerOffentligeYdelser)}
                      onCommit={handleToggleChange('regulerOffentligeYdelser')}
                    />
                  </Box>
                </Box>

                <Typography className="row--subheading">Ferie i beregningsperioden:</Typography>
                <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoBeregningsperiodeFerie}>
                <BeregningsperiodeFerieTable
                  rows={fravaer.draftRows}
                  committedById={fravaer.committedById}
                  feriedageById={fravaerFeriedageById}
                  onFieldChange={fravaer.onFieldChange}
                  onRowBlur={fravaer.onRowBlur}
                  onRowsReorder={fravaer.reorderRows}
                  beregningsperiodeFra={values.tafBeregningsperiodeFra}
                  beregningsperiodeTil={values.tafBeregningsperiodeTil}
                  saveOrderPath="erstatningsopgoerelse.fravaerPerioder"
                />
                </CellInvalidDraftScopeProvider>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Uspecificerede ferie-/feriefridage</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledIntegerField
                      name="uspecificeredeFerieFridage"
                      width={80}
                      value={values.uspecificeredeFerieFridage}
                      onCommit={handleIntegerBlur('uspecificeredeFerieFridage')}
                      minValue={0}
                      maxValue={365}
                    />
                  </Box>
                </Box>

                <Typography className="row--subheading">Øvrigt fravær i beregningsperioden:</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Øvrigt fravær uden løn</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledToggleSwitch
                      name="oevrigtFravaerUdenLoen"
                      checked={getChecked(values.oevrigtFravaerUdenLoen)}
                      onCommit={handleToggleChange('oevrigtFravaerUdenLoen')}
                    />
                  </Box>
                </Box>

                {getChecked(values.oevrigtFravaerUdenLoen) && (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Antal fraværsdage (mandag-fredag)</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledIntegerField
                          name="oevrigeFravaersdage"
                          width={80}
                          value={values.oevrigeFravaersdage}
                          onCommit={handleIntegerBlur('oevrigeFravaersdage')}
                          minValue={0}
                          maxValue={365}
                        />
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Årsag til fravær</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledTextField
                          name="oevrigeFravaersdageBeskrivelse"
                          width={300}
                          value={values.oevrigeFravaersdageBeskrivelse || ''}
                          onCommit={commitField('oevrigeFravaersdageBeskrivelse')}
                          sx={{
                            '& .MuiInputBase-input': {
                              textAlign: 'right',
                            },
                          }}
                        />
                      </Box>
                    </Box>
                  </>
                )}
              </>
            )}

            {values.beregnesUdFra === 'Angivet månedsløn' && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">Månedslønnen udgør</Typography>
                <Box className="row--label-right-hover__content">
                <StyledAmountField
                  name="maanedsloenenUdgoer"
                  width={150}
                  value={values.maanedsloenenUdgoer}
                  onCommit={handleAmountBlur('maanedsloenenUdgoer')}
                />
                </Box>
              </Box>
            )}

            {values.beregnesUdFra === 'Angivet dagsløn' && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">Dagslønnen udgør</Typography>
                <Box className="row--label-right-hover__content">
                <StyledAmountField
                  name="dagsloenenUdgoer"
                  width={150}
                  value={values.dagsloenenUdgoer}
                  onCommit={handleAmountBlur('dagsloenenUdgoer')}
                />
                </Box>
              </Box>
            )}

            {(values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn') && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">- baseret på</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledTextField
                    name={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? 'angivetMaanedsloenBaseretPaa'
                        : 'angivetDagsloenBaseretPaa'
                    }
                    width={300}
                    value={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? (values.angivetMaanedsloenBaseretPaa || '')
                        : (values.angivetDagsloenBaseretPaa || '')
                    }
                    onCommit={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? commitField('angivetMaanedsloenBaseretPaa')
                        : commitField('angivetDagsloenBaseretPaa')
                    }
                  />
                </Box>
              </Box>
            )}

            {(values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn') && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">{angivetLoenOpreguleringLabel}</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledDateField
                    name={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? 'angivetMaanedsloenOpreguleresFraDato'
                        : 'angivetDagsloenOpreguleresFraDato'
                    }
                    value={aktivAngivetLoenOpreguleresFraDato}
                    onCommit={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? handleIsoDateBlur('angivetMaanedsloenOpreguleresFraDato')
                        : handleIsoDateBlur('angivetDagsloenOpreguleresFraDato')
                    }
                  />
                </Box>
              </Box>
            )}

            {visLoenudviklingFraEO && (
              <>
                <Typography className="row--subheading">Lønudvikling</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Lønudvikling beregnes ud fra</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledDropdown
                      name="loenudviklingBeregningsgrundlag"
                      width={220}
                      value={loenudviklingBasis}
                      onChange={handleLoenudviklingBeregningsgrundlagChange}
                      allowEmpty={true}
                      placeholder="Vælg..."
                    >
                      <MenuItem value="Overenskomst">Overenskomst</MenuItem>
                      <MenuItem value="Statistik">Statistik</MenuItem>
                      <MenuItem value="KRL satstabel">KRL satstabel</MenuItem>
                      <MenuItem value="Manuelt angivet">Manuelt angivet</MenuItem>
                      <MenuItem value="Ingen">Ingen</MenuItem>
                    </StyledDropdown>
                  </Box>
                </Box>

                {loenudviklingBasis === 'Overenskomst' ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Vælg overenskomst</Typography>
                    <Box className="row--label-right-hover__content">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {/* Lønmodtager filter dropdown - UI viser 'ALLE', domæne bruger undefined */}
                        <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>L:</Typography>
                        <StyledDropdown
                          name="overenskomstFilter.loenmodtager"
                          value={eoLoenudvikling.overenskomstFilter?.loenmodtager ?? 'ALLE'}
                          onChange={(e: StyledDropdownChangeEvent<string>) => {
                            const uiValue = e.target.value;
                            handleEoOverenskomstFilterChange('loenmodtager', uiValue === 'ALLE' ? undefined : uiValue);
                          }}
                          width={120}
                          allowEmpty={false}
                          sx={{
                            '& .MuiInputBase-root': {
                              height: '24px !important',
                              minHeight: '24px !important',
                              paddingRight: '20px !important',
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '11px !important',
                              padding: '0 4px 0 8px !important',
                              lineHeight: '24px',
                            },
                            '& .MuiSvgIcon-root': {
                              fontSize: '12px !important',
                            },
                          }}
                          iconSx={{
                            fontSize: '16px',
                            right: 2,
                          }}
                          optionSx={{
                            fontSize: '11px',
                            minHeight: '24px',
                            padding: '3px 8px',
                          }}
                        >
                          <MenuItem value="ALLE">Alle</MenuItem>
                          {alleLoenmodtagerOrg.map((org) => (
                            <MenuItem key={org} value={org}>
                              {org}
                            </MenuItem>
                          ))}
                        </StyledDropdown>

                        {/* Arbejdsgiver filter dropdown - UI viser 'ALLE', domæne bruger undefined */}
                        <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>A:</Typography>
                        <StyledDropdown
                          name="overenskomstFilter.arbejdsgiver"
                          value={eoLoenudvikling.overenskomstFilter?.arbejdsgiver ?? 'ALLE'}
                          onChange={(e: StyledDropdownChangeEvent<string>) => {
                            const uiValue = e.target.value;
                            handleEoOverenskomstFilterChange('arbejdsgiver', uiValue === 'ALLE' ? undefined : uiValue);
                          }}
                          width={120}
                          allowEmpty={false}
                          sx={{
                            '& .MuiInputBase-root': {
                              height: '24px !important',
                              minHeight: '24px !important',
                              paddingRight: '20px !important',
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '11px !important',
                              padding: '0 4px 0 8px !important',
                              lineHeight: '24px',
                            },
                            '& .MuiSvgIcon-root': {
                              fontSize: '12px !important',
                            },
                          }}
                          iconSx={{
                            fontSize: '16px',
                            right: 2,
                          }}
                          optionSx={{
                            fontSize: '11px',
                            minHeight: '24px',
                            padding: '3px 8px',
                          }}
                        >
                          <MenuItem value="ALLE">Alle</MenuItem>
                          {alleArbejdsgiverOrg.map((org) => (
                            <MenuItem key={org} value={org}>
                              {org}
                            </MenuItem>
                          ))}
                        </StyledDropdown>

                        <StyledDropdown
                          name="overenskomstId"
                          value={eoLoenudvikling.overenskomstId || undefined}
                          onChange={handleEoOverenskomstChange}
                          width={460}
                          placeholder="Vælg overenskomst..."
                          allowEmpty={true}
                          getOptionLabel={(id) => {
                            const asString = typeof id === 'string' ? id : String(id);
                            const meta = getOverenskomstMetaById(asString);
                            if (!meta) return asString;
                            const loenPart = meta.loenmodtagerOrg[0] || '';
                            const arbPart = meta.arbejdsgiverOrg[0] || '';
                            return `${meta.navn} (${loenPart} / ${arbPart})`;
                          }}
                        >
                          {filteredOverenskomster.map((meta) => {
                            const loenPart = meta.loenmodtagerOrg[0] || '';
                            const arbPart = meta.arbejdsgiverOrg[0] || '';
                            return (
                              <MenuItem key={meta.id} value={meta.id}>
                                {meta.navn} ({loenPart} / {arbPart})
                              </MenuItem>
                            );
                          })}
                        </StyledDropdown>
                      </Box>
                    </Box>
                  </Box>
                ) : null}

                {loenudviklingBasis === 'Overenskomst' && erOffentligOverenskomst ? (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Lønoplysninger</Typography>
                      <Box className="row--label-right-hover__content">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography className="row--text">Ansættelse</Typography>
                          <StyledDropdown
                            name="offentligLoenType"
                            width={160}
                            value={eoLoenudvikling.offentligLoenType ?? 'Månedsløn'}
                            onChange={handleOffentligLoenTypeChange}
                            allowEmpty={false}
                          >
                            {offentligLoenTypeEnum.options.map((option) => (
                              <MenuItem key={option} value={option}>
                                {option}
                              </MenuItem>
                            ))}
                          </StyledDropdown>
                          <Typography className="row--text">Løntrin</Typography>
                          <StyledIntegerField
                            name="offentligLoenTrin"
                            value={eoLoenudvikling.offentligLoenTrin}
                            onCommit={handleOffentligLoenTrinCommit}
                            minValue={1}
                            maxValue={55}
                            maxDigits={2}
                            width={80}
                          />
                          <Typography className="row--text">Gruppe</Typography>
                          <StyledIntegerField
                            name="offentligLoenGruppe"
                            value={eoLoenudvikling.offentligLoenGruppe}
                            onCommit={handleOffentligLoenGruppeCommit}
                            minValue={0}
                            maxValue={4}
                            maxDigits={1}
                            width={70}
                          />
                          <Tooltip title="Find løntrin" arrow>
                            <IconButton
                              onClick={openLoentrinFinder}
                              tabIndex={-1}
                              aria-label="Find løntrin"
                              sx={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                transition: 'background-color 0.2s',
                                '&:hover': {
                                  backgroundColor: 'var(--color-icon-action-hover)',
                                },
                                '&:active': {
                                  backgroundColor: 'var(--color-icon-action-active)',
                                },
                              }}
                            >
                              <SearchIcon
                                sx={{
                                  fontSize: '24px',
                                  color: 'primary.main',
                                }}
                              />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </Box>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Evt. forhøjet grundløn udover løntrin</Typography>
                      <Box className="row--label-right-hover__content">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <StyledAmountField
                            name="offentligLoenEkstraGrundloen"
                            width={160}
                            value={eoLoenudvikling.offentligLoenEkstraGrundloen}
                            allowNegative={false}
                            onCommit={handleOffentligLoenEkstraGrundloenCommit}
                          />
                          <Typography className="row--text">{offentligLoenEkstraGrundloenSuffix}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </>
                ) : null}

                {loenudviklingBasis === 'Statistik' ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Statistisk beregningsmodel</Typography>
                    <Box className="row--label-right-hover__content">
                      <StyledDropdown
                        name="loenudviklingStatistikModel"
                        width={270}
                        value={eoLoenudvikling.loenudviklingStatistikModel}
                        onChange={handleLoenudviklingStatistikModelChange}
                        allowEmpty={true}
                        placeholder="Vælg..."
                      >
                        <MenuItem value={ASL_AARSLOENSMAKSIMUM_MODEL_LABEL}>{ASL_AARSLOENSMAKSIMUM_MODEL_LABEL}</MenuItem>
                        <MenuItem value="ILON12 (Danmarks Statistik)">ILON12 (Danmarks Statistik)</MenuItem>
                        <MenuItem value="SBLON2 (Danmarks Statistik)">SBLON2 (Danmarks Statistik)</MenuItem>
                      </StyledDropdown>
                    </Box>
                  </Box>
                ) : null}

                {loenudviklingBasis === 'KRL satstabel' ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Satstabel</Typography>
                    <Box className="row--label-right-hover__content">
                      <StyledDropdown
                        name="loenudviklingKRLSatstabel"
                        width={270}
                        value={eoLoenudvikling.loenudviklingKRLSatstabel}
                        onChange={handleLoenudviklingKRLSatstabelChange}
                        allowEmpty={true}
                        placeholder="Vælg..."
                      >
                        {krlSatstabelEnum.options.map((satstabel) => (
                          <MenuItem key={satstabel} value={satstabel}>
                            {satstabel}
                          </MenuItem>
                        ))}
                      </StyledDropdown>
                    </Box>
                  </Box>
                ) : null}

                {loenudviklingBasis === 'Manuelt angivet' ? (
                  <Box sx={{ mt: 1 }}>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Navn på reguleringsform</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledTextField
                          name="loenudviklingManuelNavn"
                          width={300}
                          value={eoLoenudvikling.loenudviklingManuelNavn || ''}
                          onCommit={handleLoenudviklingManuelNavnCommit}
                        />
                      </Box>
                    </Box>
                    <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoAngivetLoenudvikling}>
                    <LoenudviklingManuelTable
                      tableData={eoLoenudvikling.loenudviklingManuelTableData}
                      onTableDataChange={handleLoenudviklingManuelTableChange}
                      onInputErrorChange={handleLoenudviklingManuelInputErrorChange}
                      baseDateDisplay={loenudviklingBaseDateDisplay}
                      baseDateISO={loenudviklingBaseDateISO}
                      baseDateErrorMessage={loenudviklingBaseDateDisplay === '' ? 'Skadedato er ikke udfyldt' : undefined}
                      useSmallFont={true}
                    />
                    </CellInvalidDraftScopeProvider>
                  </Box>
                ) : null}

                {shouldShowReguleringsDatoInterval ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Tilgængelige reguleringssatser</Typography>
                    <Box className="row--label-right-hover__content">
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'flex-end', gap: 1 }}>
                        {(() => {
                          const hasReguleringsDatoInterval =
                            Boolean(reguleringsDatoIntervalData?.fraDato) && Boolean(reguleringsDatoIntervalData?.tilDato);
                          const offentligReady =
                            !erOffentligOverenskomst
                            || (
                              typeof eoLoenudvikling.offentligLoenTrin === 'number'
                              && typeof eoLoenudvikling.offentligLoenGruppe === 'number'
                            );
                          const canDownload =
                            hasReguleringsDatoInterval &&
                            (loenudviklingBasis !== 'Overenskomst' || offentligReady);
                          return (
                            <>
                              <Typography className="row--text" sx={{ textAlign: 'right' }}>
                                {reguleringsDatoIntervalDisplay || '-'}
                              </Typography>
                              <Box>
                                <Box
                                  onClick={() => {
                                    if (!canDownload) return;
                                    if (!reguleringsDatoIntervalData) return;
                                    if (loenudviklingBasis === 'KRL satstabel') {
                                      void handleDownloadKRLPdf();
                                      return;
                                    }
                                    if (loenudviklingBasis !== 'Overenskomst' && loenudviklingBasis !== 'Statistik') {
                                      return;
                                    }
                                    void handleDownloadReguleringPdf({
                                      overenskomstLabel: (() => {
                                        const id = eoLoenudvikling.overenskomstId;
                                        if (!id) return '-';
                                        const meta = getOverenskomstMetaById(id);
                                        return meta?.navn ?? id;
                                      })(),
                                      loenudviklingBasis,
                                      overenskomstId: eoLoenudvikling.overenskomstId,
                                      statistikModelLabel: eoLoenudvikling.loenudviklingStatistikModel,
                                      interval: reguleringsDatoIntervalData,
                                      applyAlmindeligLoenPaaShDageRegel: eoLoenudvikling.loenPaaHelligdage === 'Almindelig løn',
                                      offentligLoenType: eoLoenudvikling.offentligLoenType,
                                      offentligLoenTrin: eoLoenudvikling.offentligLoenTrin,
                                      offentligLoenGruppe: eoLoenudvikling.offentligLoenGruppe,
                                      offentligLoenEkstraGrundloen: amountValueToNumber(eoLoenudvikling.offentligLoenEkstraGrundloen),
                                    });
                                  }}
                                  tabIndex={-1}
                                  sx={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: canDownload ? 'pointer' : 'default',
                                    transition: 'background-color 0.2s',
                                    ...(canDownload && {
                                      '&:hover': {
                                        backgroundColor: 'var(--color-icon-action-hover)',
                                      },
                                      '&:active': {
                                        backgroundColor: 'var(--color-icon-action-active)',
                                      },
                                    }),
                                  }}
                                >
                                  <Download
                                    sx={{
                                      fontSize: '24px',
                                      color: canDownload ? 'primary.main' : 'grey.500',
                                    }}
                                  />
                                </Box>
                              </Box>
                            </>
                          );
                        })()}
                      </Box>
                    </Box>
                  </Box>
                ) : null}
              </>
            )}

            {showEoAnciennitetstillaegSection ? (
              <>
                <Typography className="row--subheading">Anciennitetstillæg</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Ville skadelidte have opnået anciennitetstillæg efter skadedatoen</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledToggleSwitch
                      name="harAnciennitetstillaegEfterSkadedatoen"
                      checked={eoLoenudvikling.harAnciennitetstillaegEfterSkadedatoen}
                      onCommit={handleEoAnciennitetstillaegToggleCommit}
                    />
                  </Box>
                </Box>

                {eoLoenudvikling.harAnciennitetstillaegEfterSkadedatoen ? (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Dato for opnået anciennitetstillæg</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledDateField
                          name="anciennitetstillaegDato"
                          value={eoLoenudvikling.anciennitetstillaegDato}
                          minDate={skadedatoISO}
                          specialRangeErrors={{
                            minBoundKind: skadedatoISO ? 'skadedato' : undefined,
                            minBoundReferenceISO: skadedatoISO,
                          }}
                          onCommit={handleEoAnciennitetstillaegDatoCommit}
                        />
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">{`Sats per ${eoAnciennitetSatsPerTekst}`}</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledAmountField
                          name="anciennitetstillaegSats"
                          width={160}
                          value={eoLoenudvikling.anciennitetstillaegSats}
                          allowNegative={false}
                          onCommit={handleEoAnciennitetstillaegSatsCommit}
                        />
                      </Box>
                    </Box>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </ContentBox>
      )}

      {loentrinFinderOpen ? (
        <>
          <Box
            onClick={closeLoentrinFinder}
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'var(--color-shadow)',
              zIndex: (theme) => theme.zIndex.modal - 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          />
          <Box
            role="dialog"
            aria-modal="true"
            aria-labelledby={loentrinFinderHeadingId}
            ref={loentrinFinderDialogRef}
            sx={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '700px',
              maxHeight: '85vh',
              backgroundColor: 'var(--color-background-white)',
              borderRadius: '20px',
              boxShadow: '0 8px 32px var(--color-shadow)',
              border: '1px solid var(--color-border)',
              zIndex: (theme) => theme.zIndex.modal,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '24px 32px',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <Typography id={loentrinFinderHeadingId} variant="h5" sx={{ fontWeight: 500, color: 'text.primary' }}>
                Find løntrin
              </Typography>
              <IconButton
                onClick={closeLoentrinFinder}
                aria-label="Luk"
                tabIndex={-1}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'var(--color-hover)',
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
              <Box className="row--label-right-hover">
                <Typography className="row--text">Overenskomst</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{loentrinFinderOverenskomstLabel}</Typography>
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">Ansættelse</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledDropdown
                    ref={loentrinFinderAnsaettelseRef}
                    width={180}
                    value={loentrinFinderAnsaettelse}
                    allowEmpty={false}
                    onChange={(event: StyledDropdownChangeEvent<string>) => {
                      const parsed = offentligLoenTypeEnum.safeParse(event.target.value ?? 'Månedsløn');
                      const nextValue: 'Månedsløn' | 'Timeløn' = parsed.success ? parsed.data : 'Månedsløn';
                      setLoentrinFinderAnsaettelse(nextValue);
                    }}
                  >
                    <MenuItem value="Månedsløn">Månedsløn</MenuItem>
                    <MenuItem value="Timeløn">Timeløn</MenuItem>
                  </StyledDropdown>
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">{loentrinFinderAnsaettelse}</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledAmountField
                    ref={loentrinFinderBeloebRef}
                    width={180}
                    value={loentrinFinderBeloeb}
                    allowNegative={false}
                    onCommit={(event) => {
                      setLoentrinFinderBeloeb(event.target.value);
                      setLoentrinFinderErrors((prev) => ({ ...prev, beloeb: undefined }));
                    }}
                    onFieldError={(errorMsg) => setLoentrinFinderAmountFieldError(getReportableFieldErrorMessage(errorMsg))}
                    error={Boolean(loentrinFinderErrors.beloeb)}
                    helperText={loentrinFinderErrors.beloeb ?? ''}
                  />
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">Dato</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledDateField
                    ref={loentrinFinderDatoRef}
                    value={loentrinFinderDato}
                    onCommit={(event) => {
                      setLoentrinFinderDato(event.target.value);
                      setLoentrinFinderErrors((prev) => ({ ...prev, dato: undefined }));
                    }}
                    onFieldError={(errorMsg) => setLoentrinFinderDateFieldError(getReportableFieldErrorMessage(errorMsg))}
                    error={Boolean(loentrinFinderErrors.dato)}
                    helperText={loentrinFinderErrors.dato ?? ''}
                  />
                </Box>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, mb: 1 }}>
                <Button
                  ref={loentrinFinderBeregnRef}
                  variant="contained"
                  onClick={handleLoentrinFinderCalculate}
                  sx={{
                    borderRadius: '10px',
                    px: 3,
                    py: 1,
                    animation: loentrinFinderButtonShake ? 'shake 0.5s ease' : 'none',
                    '@keyframes shake': {
                      '0%, 100%': { transform: 'translateX(0)' },
                      '25%': { transform: 'translateX(-4px)' },
                      '75%': { transform: 'translateX(4px)' },
                    },
                  }}
                >
                  Beregn
                </Button>
              </Box>

              {loentrinFinderResults.length > 0 ? (
                <Box sx={{ mt: 2 }}>
                  <Typography className="row--text" sx={{ mb: 1 }}>
                    Nærmeste lønsatser
                  </Typography>
                  {loentrinFinderResults.map((result) => {
                    const isExactMatch = loentrinFinderInputAmountNumber === undefined
                      ? false
                      : hasExactDisplayedAmountMatch(loentrinFinderInputAmountNumber, result.beloeb);
                    return (
                      <Box
                        key={`${String(result.loentrin)}-${result.gruppe}`}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--color-active-bg)',
                          mb: 0.75,
                        }}
                      >
                        <Typography className={`row--text${isExactMatch ? ' text-bold' : ''}`}>
                          {`Løntrin ${String(result.loentrin)}, gruppe ${result.gruppe}`}
                        </Typography>
                        <Typography className={`row--text${isExactMatch ? ' text-bold' : ''}`}>
                          {`${formatCurrency(result.beloeb)} kr.`}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              ) : null}
            </Box>
          </Box>
        </>
      ) : null}

      {/* Sektion 7: Øvrige erstatningskrav */}
      <ContentBox className="content-box" data-section-id="oevrige-krav">
        <Typography className="section-header">Øvrige erstatningskrav</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Er der øvrige krav i erstatningsperioden</Typography>
          <Box className="row--label-right-hover__content">
            <StyledRadioButton
              name="kravPaaOevrigeErstatningskrav"
              value={values.kravPaaOevrigeErstatningskrav}
              onCommit={handleJaNejSkjulChange('kravPaaOevrigeErstatningskrav')}
              row={true}
              options={[...KRAV_JA_NEJ_SKJUL_OPTIONS]}
            />
          </Box>
        </Box>

        {values.kravPaaOevrigeErstatningskrav === 'Ja' && (
          <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoOevrigeKrav}>
          <OevrigeKravTable
            rows={oevrigeKrav.draftRows}
            committedById={oevrigeKrav.committedById}
            onFieldChange={oevrigeKrav.onFieldChange}
            onRowBlur={oevrigeKrav.onRowBlur}
            onRowsReorder={oevrigeKrav.reorderRows}
            minDate={oevrigeKravMinDate}
            maxDate={dateRanges_erstatningsopgoerelse.tabelOevrigeKravDato.max}
            specialRangeErrors={{
              minBoundKind: skadedatoMinRule.minBoundKind,
              minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
            }}
            saveOrderPath="erstatningsopgoerelse.oevrigeKravPerioder"
          />
          </CellInvalidDraftScopeProvider>
        )}
      </ContentBox>

      {/* Sektion 8: Eventuelle særlige kommentarer */}
      <ContentBox className="content-box" data-section-id="saerlige-kommentarer">
        <Typography className="section-header">Eventuelle særlige kommentarer</Typography>

        <StyledTextField
          name="saerligeKommentarer"
          width={800}
          value={values.saerligeKommentarer || ''}
          onCommit={commitField('saerligeKommentarer')}
          multiline
          rows={4}
          placeholder="Indtast eventuelle kommentarer her..."
        />
      </ContentBox>

      {/* Sektion 9: Bilagsnumre */}
      <ContentBox className="content-box" data-section-id="bilagsnumre">
        <Typography className="section-header">Bilagsnumre</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Indsæt bilagsnumre i erstatningsopgørelsen</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="visBilagsnumre"
              checked={getChecked(values.visBilagsnumre)}
              onCommit={handleToggleChange('visBilagsnumre')}
            />
          </Box>
        </Box>

        {getChecked(values.visBilagsnumre) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Ménafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreMenAfgoerelse || ''}
                    name="bilagsnumreMenAfgoerelse"
                    onCommit={handleStringBlur('bilagsnumreMenAfgoerelse')}
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">EET-afgørelser</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreEetAfgoerelser || ''}
                    name="bilagsnumreEetAfgoerelser"
                    onCommit={handleStringBlur('bilagsnumreEetAfgoerelser')}
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Svie/smerte-dokumentation</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreSvieSmerteDokumentation || ''}
                    name="bilagsnumreSvieSmerteDokumentation"
                    onCommit={handleStringBlur('bilagsnumreSvieSmerteDokumentation')}
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Beregningsgrundlag for TAF</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreBeregningsgrundlagTaf || ''}
                    name="bilagsnumreBeregningsgrundlagTaf"
                    onCommit={handleStringBlur('bilagsnumreBeregningsgrundlagTaf')}
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Løn i sygeperioden</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreLoenISygeperioden || ''}
                    name="bilagsnumreLoenISygeperioden"
                    onCommit={handleStringBlur('bilagsnumreLoenISygeperioden')}
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Offentlige ydelser</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreOffentligeYdelser || ''}
                    name="bilagsnumreOffentligeYdelser"
                    onCommit={handleStringBlur('bilagsnumreOffentligeYdelser')}
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Øvrige erstatningskrav</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreOevrigeErstatningskrav || ''}
                    name="bilagsnumreOevrigeErstatningskrav"
                    onCommit={handleStringBlur('bilagsnumreOevrigeErstatningskrav')}
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>
          </>
        )}
      </ContentBox>
    </Box>
  );
});

EOOplysningerTab.displayName = 'EOOplysningerTab';

export default EOOplysningerTab;
