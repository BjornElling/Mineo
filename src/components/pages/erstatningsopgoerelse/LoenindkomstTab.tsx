import React from 'react';
import { Box, Button, IconButton, MenuItem, Tooltip, Typography } from '@mui/material';
import { z } from 'zod';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import Download from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import StyledTextField from '../../inputs/StyledTextField';
import StyledDateField from '../../inputs/StyledDateField';
import StyledDropdown, { type StyledDropdownChangeEvent } from '../../inputs/StyledDropdown';
import StyledAmountField from '../../inputs/StyledAmountField';
import StyledPercentField from '../../inputs/StyledPercentField';
import StyledRadioButton from '../../inputs/StyledRadioButton';
import StyledToggleSwitch from '../../inputs/StyledToggleSwitch';
import StyledIntegerField from '../../inputs/StyledIntegerField';
import type { CommitEvent, CommitHandler } from '../../../types/fieldEvents';
import { getReportableFieldErrorMessage, type ReportableFieldError } from '../../../types/fieldErrors';
import StandardLoenTable, { type StandardLoenTableSatser } from '../../tables/StandardLoenTable';
import LoenudviklingManuelTable from '../../tables/LoenudviklingManuelTable';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ContentBox from '../../layout/ContentBox';
import InfoTooltipIcon from '../../common/InfoTooltipIcon';
import {
  loenPaaHelligdageEnum,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  krlSatstabelEnum,
  anciennitetSatsPerEnum,
  offentligLoenTypeEnum,
  type OffentligLoenTypeLabel,
  type ErstatningsopgoerelseValues,
} from '../../../schemas/formSchemas';
import { optionalAmountValueSchema } from '../../../schemas/amountExpressionSchema';
import { DAY_COUNT_MAX } from '../../../schemas/formSchemas/baseSchemas';
import { LOENPERIODE } from '../../../types/loen';
import type { ISODateString } from '../../../types/branded';
import { isISODateString, parseISODate } from '../../../types/branded';
import { formatDanishDate } from '../../../utils/dateUtils';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { isLoenperiodeValue } from '../../../utils/zodTypeGuards';
import { generateAnsaettelsesforholdId, generateLoenudviklingRowId, initialLoenudviklingManuelRow } from '../../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { scrollTargetIntoView } from '../../../utils/scrollTargetIntoView';
import type { StandardLoenTableValidationSummary } from '../../../types/table';
import { UI_STORAGE_KEYS } from '../../../config/storageManifest';
import {
  getAlleLoenmodtagerOrg,
  getAlleArbejdsgiverOrg,
  getOverenskomsterByOrg,
  getOverenskomstMetaById,
  getOverenskomstSfggPolicy,
  getOffentligOverenskomstTypeById,
  getReguleringsDatoIntervalForOverenskomst,
  isOffentligOverenskomstId,
} from '../../../data/overenskomstRates';
import { toLoentrin } from '../../../data/offentligLoenTypes';
import { getOffentligLoenTabelForDato } from '../../../data/offentligLoenLookup';
import {
  ASL_AARSLOENSMAKSIMUM_MODEL_LABEL,
  getReguleringsDatoIntervalForStatistikModel,
} from '../../../data/statistiskeRates';
import { getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../../data/krlRates';
import { getPersistedSectionSnapshot, usePersistedSectionSelector } from '../../../hooks/useFormPersistenceSelectors';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { appSettingsSchema, DEFAULT_APP_SETTINGS, resolveDefaultOverenskomstFilter, type AppSettings } from '../../../settings/appSettingsSchema';
import { downloadKrlPdf, downloadReguleringPdf, type ReguleringPdfInput } from '../../../pdf/infrastructure/pdfService';
import { formatAsAmount, formatCurrency } from '../../../utils/formatUtils';
import { hasIndtastetLoenoplysninger } from '../../../domain/erstatningsopgoerelse/helpers/loenoplysningerInput';
import { DEFAULT_ANCIENNITET_FIELDS } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  applyAnsaettelsesforholdToggleCleanup,
  applyLoenudviklingBeregningsgrundlagChange,
  applySfggBeregningskildeChange,
} from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstStateCleanup';
import {
  applyAutoSatsFields,
  isOverenskomstSatsFieldLocked,
  resolveOverenskomstSatsBindings,
} from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { getAngivetLoenOpreguleresFraDato } from '../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import {
  hasExactDisplayedAmountMatch,
  normalizeOptionalFreeText,
  resolveAnvendtReguleringsdato,
} from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import {
  hasSfggSelectedOverenskomst,
  resolveSfggSource,
  resolveSfggReferenceperiodeDayCount,
  resolveSfggReferenceperiodeMaxDate,
} from '../../../domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelse';
import {
  buildStandardLoenZeroArbejdsdageCellErrorMessages,
  type AarsloenZeroArbejdsdageValidationInput,
} from '../../../domain/erstatningsopgoerelse/validation/indkomstRowValidation';
import {
  validateLoenudviklingManualBaseRowSatser,
  type ManualBaseRowCellErrors,
} from '../../../domain/erstatningsopgoerelse/validation/loenudviklingManuelBaseRowValidation';
import { useDynamicFormFieldErrorReporter } from '../../../hooks/useFormFieldErrors';
import { updateValidationFlagById } from '../../../utils/validationFlagMap';
import { type SetValuesUpdater } from '../../../hooks/usePersistedForm';
import { calculateLoenindkomstRowDerived } from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstRowDerived';
import {
  readOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../../../utils/safeSessionStorage';

type AnsaettelsesforholdList = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'];

const EMPTY_CELL_ERROR_MESSAGES: Readonly<Record<string, string>> = {};

type Props = {
  loenindkomstAnsaettelsesforhold: AnsaettelsesforholdList;
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
  tafBeregningsperiodeFra: ErstatningsopgoerelseValues['tafBeregningsperiodeFra'];
  tafBeregningsperiodeTil: ErstatningsopgoerelseValues['tafBeregningsperiodeTil'];
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder'];
  fravaerPerioder: ErstatningsopgoerelseValues['fravaerPerioder'];
  eoValues: ErstatningsopgoerelseValues;
  setEOValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
  onAnsaettelsesforholdChange: (updater: (prev: AnsaettelsesforholdList) => AnsaettelsesforholdList, origin?: { fieldPath?: string }) => void;
  onNavigateToTabtArbejdsfortjeneste: () => void;
};

type Ansaettelsesforhold =
  ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
const MAX_ANSAETTELSESFORHOLD = 10;
const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';

const getCheckedJaNej = (value: 'Ja' | 'Nej'): boolean => value === 'Ja';

const updateSfggAnsaettelsesforholdRow = (
  prev: ErstatningsopgoerelseValues,
  ansaettelsesforholdId: string,
  updater: (
    current: ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number]
  ) => ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number]
): ErstatningsopgoerelseValues => {
  const existing = prev.sfggAnsaettelsesforhold.find((row) => row.ansaettelsesforholdId === ansaettelsesforholdId);
  const baseRow = existing ?? {
    ansaettelsesforholdId,
    sfggBeregningskilde: undefined,
    sfggReferenceperiodeFra: undefined,
    sfggReferenceperiodeTil: undefined,
    sfggReferenceperiodeFravaersdageUdenLoen: undefined,
    sfggManuelDagssats: undefined,
    sfggManuelBeloebIHenholdTil: undefined,
    sfggManuelFoerstEfterSygeloen: 'Nej' as const,
    sfggSatsvalg: undefined,
    sfggAlleredeBetaltBeloeb: undefined,
  };
  const nextRow = updater(baseRow);
  const nextRows = prev.sfggAnsaettelsesforhold.some((row) => row.ansaettelsesforholdId === ansaettelsesforholdId)
    ? prev.sfggAnsaettelsesforhold.map((row) => row.ansaettelsesforholdId === ansaettelsesforholdId ? nextRow : row)
    : [...prev.sfggAnsaettelsesforhold, nextRow];
  return { ...prev, sfggAnsaettelsesforhold: nextRows };
};

const formatReguleringsDatoInterval = (interval?: { fraDato: string; tilDato: string }): string => {
  if (!interval) return '';
  return `${interval.fraDato} - ${interval.tilDato}`;
};

const formatIsoDateShortLabel = (value: ISODateString | undefined): string | undefined => {
  if (!value) return undefined;
  const parsed = parseISODate(value);
  if (!parsed) return undefined;
  return formatDanishDate(parsed);
};

const resolveSatserHeading = (params: Readonly<{
  anvendtReguleringsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  skadestype: string | undefined;
  beregningsperiodeTil: ISODateString | undefined;
}>): string => {
  const { anvendtReguleringsdato, skadedato, skadestype, beregningsperiodeTil } = params;
  if (!anvendtReguleringsdato) return 'Satser';

  const shortDate = formatIsoDateShortLabel(anvendtReguleringsdato);
  const longDate = formatIsoDateLong(anvendtReguleringsdato);

  if (skadedato && anvendtReguleringsdato === skadedato && shortDate) {
    return skadestype === 'Erhvervssygdom'
      ? `Satser på anmeldelsesdatoen (${shortDate})`
      : `Satser på skadedatoen (${shortDate})`;
  }

  if (beregningsperiodeTil && anvendtReguleringsdato === beregningsperiodeTil && shortDate) {
    return `Satser ved beregningsperiodens udløb (${shortDate})`;
  }

  if (longDate) {
    return `Satser den ${longDate}`;
  }

  return 'Satser';
};

const getOffentligLoenEkstraGrundloenSuffix = (
  offentligLoenType: Ansaettelsesforhold['offentligLoenType']
): string => (offentligLoenType === 'Timeløn' ? '/ time' : '/ måned');

const formatManualBaseRowPercent = (value: number | undefined): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
};

const LOCKED_SATS_FIELD_SX = { width: '100px' } as const;

const syncManualBaseRowSatser = (af: Ansaettelsesforhold): Ansaettelsesforhold => {
  if (af.loenudviklingBeregningsgrundlag !== 'Manuelt angivet') return af;

  const currentRows = af.loenudviklingManuelTableData ?? [];
  const currentBaseRow = currentRows[0]
    ?? { ...initialLoenudviklingManuelRow, id: generateLoenudviklingRowId() };

  const nextBaseRow = {
    ...currentBaseRow,
    feriepenge: formatManualBaseRowPercent(af.feriePct),
    shSoSats: formatManualBaseRowPercent(af.shSoPct),
    fritvalg: formatManualBaseRowPercent(af.fritvalgPct),
    agPension: formatManualBaseRowPercent(af.pensionPct),
  };

  const hasBaseRowChanged =
    currentBaseRow.feriepenge !== nextBaseRow.feriepenge ||
    currentBaseRow.shSoSats !== nextBaseRow.shSoSats ||
    currentBaseRow.fritvalg !== nextBaseRow.fritvalg ||
    currentBaseRow.agPension !== nextBaseRow.agPension;

  if (!hasBaseRowChanged && currentRows.length > 0) return af;

  return {
    ...af,
    loenudviklingManuelTableData: [nextBaseRow, ...currentRows.slice(1)],
  };
};

/**
 * Opretter et nyt tomt Ansættelsesforhold med standardværdier fra settings
 *
 * Validering:
 * - AppSettings valideres via safeParse ved grænsefladen til sagsdata
 * - Ved invalid settings bruges DEFAULT_APP_SETTINGS som fallback
 * - Dette sikrer at ugyldige device-lokale settings aldrig påvirker sagsdata
 *
 * @param settings AppSettings med standardværdier
 * @returns Nyt Ansættelsesforhold objekt
 */
const createBlankAnsaettelsesforhold = (settings: AppSettings): Ansaettelsesforhold => {
  // Valider settings én gang ved grænsefladen til sagsdata
  const parsed = appSettingsSchema.safeParse(settings);
  const safeSettings = parsed.success ? parsed.data : DEFAULT_APP_SETTINGS;

  return {
    id: generateAnsaettelsesforholdId(),
    navnPaaArbejdssted: undefined,
    harOverenskomst: true,
    overenskomstId: undefined,
    ansatPaaSkadestidspunktet: true,
    ansaettelsesforholdOphoert: false,
    sidsteArbejdsdag: undefined,
    ...DEFAULT_ANCIENNITET_FIELDS,
    feriePct: undefined,
    fritvalgPct: undefined,
    shSoPct: undefined,
    storeBededagPct: undefined,
    pensionPct: undefined,
    loenperiode: LOENPERIODE.MAANED,
    fuldLoenUnderFerie: safeSettings.defaultFuldLoenUnderFerie ? 'Ja' : 'Nej',
    loenPaaHelligdage: safeSettings.defaultLoenPaaHelligdage,

    saerligFraDatoRegulering: undefined,
    indtaegtsoplysningerTableData: [],
    loenudviklingBeregningsgrundlag: undefined,
    loenudviklingStatistikModel: undefined,
    loenudviklingKRLSatstabel: undefined,
    loenudviklingManuelNavn: '',
    loenudviklingManuelTableData: [],
    offentligLoenType: 'Månedsløn',
    offentligLoenTrin: undefined,
    offentligLoenGruppe: undefined,
    offentligLoenEkstraGrundloen: undefined,
    // Overenskomst-filter: initialiseres fra settings ved oprettelse (centraliseret mapping)
    overenskomstFilter: resolveDefaultOverenskomstFilter(settings),
  };
};

type SatsErrorState = {
  feriePct?: string;
  fritvalgPct?: string;
  shSoPct?: string;
  storeBededagPct?: string;
  pensionPct?: string;
};

type OverenskomstSatsField = 'fritvalgPct' | 'shSoPct' | 'pensionPct';

type ReguleringsDatoInterval = Readonly<{ fraDato: string; tilDato: string }>;

type LoentrinFinderErrors = Readonly<{
  beloeb?: string;
  dato?: string;
}>;

type LoentrinFinderResult = Readonly<{
  loentrin: number | '55+';
  gruppe: 0 | 1 | 2 | 3 | 4;
  beloeb: number;
  diff: number;
}>;

const LOENGRUPPER = [0, 1, 2, 3, 4] as const;

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

const parseLoentrinSortValue = (loentrin: number | '55+'): number => {
  return loentrin === '55+' ? 56 : loentrin;
};

const LoenindkomstTab = React.memo(({
  loenindkomstAnsaettelsesforhold,
  beregnesUdFra,
  tafBeregningsperiodeFra,
  tafBeregningsperiodeTil,
  ferieperioder,
  fravaerPerioder,
  eoValues,
  setEOValues,
  onAnsaettelsesforholdChange,
  onNavigateToTabtArbejdsfortjeneste,
}: Props) => {
  const reportDynamicFieldError = useDynamicFormFieldErrorReporter('erstatningsopgoerelse', { source: 'input' });
  const stamdataValues = usePersistedSectionSelector('stamdata');
  const { settings } = useAppSettings();

  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [scrollTargetId, setScrollTargetId] = React.useState<string | null>(null);
  const deleteTargetName = React.useMemo(() => {
    if (!deleteTargetId) return '';
    const target = loenindkomstAnsaettelsesforhold.find((af) => af.id === deleteTargetId);
    return target?.navnPaaArbejdssted?.trim() ?? '';
  }, [deleteTargetId, loenindkomstAnsaettelsesforhold]);

  // State til fejlmeddelelser per Ansættelsesforhold
  const [satsErrors, setSatsErrors] = React.useState<Record<string, SatsErrorState>>({});
  const [standardLoenTableHasErrorsByAfId, setStandardLoenTableHasErrorsByAfId] = React.useState<Record<string, true>>({});
  const [manuelReguleringHasErrorsByAfId, setManuelReguleringHasErrorsByAfId] = React.useState<Record<string, true>>({});
  const [loentrinFinderOpenForAfId, setLoentrinFinderOpenForAfId] = React.useState<string | null>(null);
  const [loentrinFinderAnsaettelse, setLoentrinFinderAnsaettelse] = React.useState<OffentligLoenTypeLabel>('Månedsløn');
  const [loentrinFinderBeloeb, setLoentrinFinderBeloeb] = React.useState<Ansaettelsesforhold['offentligLoenEkstraGrundloen']>(undefined);
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
  const manualBaseRowErrorsByAfId = React.useMemo<Record<string, ManualBaseRowCellErrors>>(() => {
    const result: Record<string, ManualBaseRowCellErrors> = {};
    for (const af of loenindkomstAnsaettelsesforhold) {
      if (af.loenudviklingBeregningsgrundlag !== 'Manuelt angivet') continue;
      result[af.id] = validateLoenudviklingManualBaseRowSatser(
        af.loenudviklingManuelTableData?.[0],
        {
          feriePct: af.feriePct,
          fritvalgPct: af.fritvalgPct,
          shSoPct: af.shSoPct,
          pensionPct: af.pensionPct,
        }
      );
    }
    return result;
  }, [loenindkomstAnsaettelsesforhold]);
  const aarsloenZeroArbejdsdageValidationInput = React.useMemo<AarsloenZeroArbejdsdageValidationInput>(() => ({
    beregnesUdFra: beregnesUdFra,
    tafBeregningsperiodeFra: tafBeregningsperiodeFra,
    tafBeregningsperiodeTil: tafBeregningsperiodeTil,
    loenindkomstAnsaettelsesforhold: loenindkomstAnsaettelsesforhold,
    ferieperioder: ferieperioder,
    fravaerPerioder: fravaerPerioder,
  }), [
    beregnesUdFra,
    ferieperioder,
    fravaerPerioder,
    loenindkomstAnsaettelsesforhold,
    tafBeregningsperiodeFra,
    tafBeregningsperiodeTil,
  ]);
  const aarsloenExternalCellErrorMessagesByAfId = React.useMemo<Record<string, Readonly<Record<string, string>>>>(() => {
    const result: Record<string, Readonly<Record<string, string>>> = {};
    for (const af of loenindkomstAnsaettelsesforhold) {
      const messages = buildStandardLoenZeroArbejdsdageCellErrorMessages(aarsloenZeroArbejdsdageValidationInput, af.id);
      if (Object.keys(messages).length > 0) {
        result[af.id] = messages;
      }
    }
    return result;
  // loenindkomstAnsaettelsesforhold medtages eksplicit som forsvar mod fremtidige ændringer
  // i aarsloenZeroArbejdsdageValidationInput's dep-chain: memo'et itererer selv over listen
  // for at bygge map'et per af.id, så listen er en direkte dep uanset om validationInput
  // invalideriseres først.
  }, [aarsloenZeroArbejdsdageValidationInput, loenindkomstAnsaettelsesforhold]);
  const syncedLoenindkomstErrorIdsRef = React.useRef<ReadonlySet<string>>(new Set());


  /**
   * Valider Feriegodtgørelse/-tillæg (min. 12 %)
   */
  const validateFeriePct = React.useCallback(
    (
      fuldLoenUnderFerie: Ansaettelsesforhold['fuldLoenUnderFerie'],
      inputValue: number | undefined,
      kræverFeriePct: boolean
    ): string | undefined => {
      if (inputValue === undefined) {
        return kræverFeriePct ? 'Feriegodtgørelse/-tillæg skal udfyldes' : undefined;
      }
      if (inputValue >= 12) return undefined;

      if (fuldLoenUnderFerie === 'Ja') {
        return 'Løn under ferie beregnes som feriegodtgørelse (12,5 % eller 15 % ved ret til 6. ferieuge)';
      }

      return 'Feriegodtgørelse udgør typisk 12,5 %, men 15 % ved ret til 6. ferieuge';
    },
    []
  );

  const getAnvendtReguleringsdatoForAnsaettelsesforhold = React.useCallback(
    (af: Pick<Ansaettelsesforhold, 'saerligFraDatoRegulering'>): ISODateString | undefined =>
      resolveAnvendtReguleringsdato({
        beregnesUdFra,
        angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
        saerligFraDatoRegulering: af.saerligFraDatoRegulering,
        beregningsperiodeTil: tafBeregningsperiodeTil,
        skadedato: stamdataValues?.skadedato,
      }),
    [beregnesUdFra, eoValues, tafBeregningsperiodeTil, stamdataValues?.skadedato]
  );
  const validateSats = React.useCallback(
    (
      af: Pick<Ansaettelsesforhold, 'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage'>,
      fieldName: OverenskomstSatsField,
      inputValue: number | undefined,
      anvendtReguleringsdato: ISODateString | undefined
    ): string | undefined => {
      const overenskomstId = af.overenskomstId?.trim();
      if (!overenskomstId) return undefined;
      if (!anvendtReguleringsdato) return undefined;
      const expectedBinding = resolveOverenskomstSatsBindings(af, anvendtReguleringsdato)[fieldName];
      if (!expectedBinding.locked || expectedBinding.value === undefined) return undefined;

      const overenskomstMeta = getOverenskomstMetaById(overenskomstId);
      const overenskomstNavn = overenskomstMeta?.navn || 'Overenskomsten';

      const dateObj2 = parseISODate(anvendtReguleringsdato);
      if (!dateObj2) return undefined;

      const danishDateShort = formatDanishDate(dateObj2);

      const expectedPct = expectedBinding.value;
      const actualValue = inputValue ?? 0;
      const diff = Math.abs(actualValue - expectedPct);
      if (diff > 0.01) {
        return `${overenskomstNavn}s sats per ${danishDateShort} udgør ${formatAsAmount(expectedPct, 2)} %`;
      }

      return undefined;
    },
    []
  );

  /**
   * Valider alle satser for et Ansættelsesforhold
   */
  const validateAllSatserForAnsaettelsesforhold = React.useCallback(
    (af: Ansaettelsesforhold) => {
      const errors: SatsErrorState = {};
      const anvendtReguleringsdato = getAnvendtReguleringsdatoForAnsaettelsesforhold(af);
      const kræverFeriePct = beregnesUdFra === 'Beregningsperiode'
        && hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []);

      // Valider Feriegodtgørelse/-tillæg
      const ferieError = validateFeriePct(af.fuldLoenUnderFerie, af.feriePct, kræverFeriePct);
      if (ferieError) errors.feriePct = ferieError;

      // Valider Fritvalg
      const fritvalgError = validateSats(
        af,
        'fritvalgPct',
        af.fritvalgPct,
        anvendtReguleringsdato
      );
      if (fritvalgError) errors.fritvalgPct = fritvalgError;

      // Valider SH/SO-sats
      const shError = validateSats(
        af,
        'shSoPct',
        af.shSoPct,
        anvendtReguleringsdato
      );
      if (shError) errors.shSoPct = shError;

      // Valider Arbejdsgivers pensionsbidrag
      const pensionError = validateSats(
        af,
        'pensionPct',
        af.pensionPct,
        anvendtReguleringsdato
      );
      if (pensionError) errors.pensionPct = pensionError;

      return errors;
    },
    [getAnvendtReguleringsdatoForAnsaettelsesforhold, validateFeriePct, validateSats, beregnesUdFra]
  );

  // Valider alle Ansættelsesforhold ved ændringer i datagrundlaget
  React.useEffect(() => {
    const allErrors: Record<string, SatsErrorState> = {};

    loenindkomstAnsaettelsesforhold.forEach((af) => {
      const errors = validateAllSatserForAnsaettelsesforhold(af);
      if (Object.keys(errors).length > 0) {
        allErrors[af.id] = errors;
      }
    });

    setSatsErrors(allErrors);
  }, [loenindkomstAnsaettelsesforhold, validateAllSatserForAnsaettelsesforhold]);

  React.useEffect(() => {
    // Cross-tab sikkerhedsnet: når skadedato ændres i Stamdata, skal allerede committede
    // auto-satser resynkroniseres. Event-handlere dækker lokale EO-edits; denne effekt
    // dækker kun eksterne committed ændringer.
    // Decision note: dette er en bevidst kontrakt-undtagelse.
    // Reason: auto-satsernes betydning er bundet til committet skadedato og må derfor resynkroniseres,
    // også når ændringen kommer fra et andet domæne-tab end Loenindkomst selv.
    // Risk: effekten må aldrig overskrive manuelt valgte satser eller andre brugerindtastede felter.
    // Re-evaluate when: auto-satserne får eksplicit manual-override-model eller cross-tab sync flyttes
    // til en autoritativ domæne-pipeline uden React-effect.
    let changed = false;
    const next = loenindkomstAnsaettelsesforhold.map((af) => {
      const updated = applyAutoSatsFields(af, getAnvendtReguleringsdatoForAnsaettelsesforhold(af));
      if (
        updated.storeBededagPct !== af.storeBededagPct ||
        updated.fritvalgPct !== af.fritvalgPct ||
        updated.shSoPct !== af.shSoPct ||
        updated.pensionPct !== af.pensionPct
      ) {
        changed = true;
        return syncManualBaseRowSatser(updated);
      }
      return af;
    });
    if (!changed) return;
    onAnsaettelsesforholdChange(() => next);
  }, [getAnvendtReguleringsdatoForAnsaettelsesforhold, onAnsaettelsesforholdChange, loenindkomstAnsaettelsesforhold]);

  React.useEffect(() => {
    const currentIds = new Set(loenindkomstAnsaettelsesforhold.map((af) => af.id));
    for (const id of syncedLoenindkomstErrorIdsRef.current) {
      if (!currentIds.has(id)) {
        reportDynamicFieldError(`${id}${EO_LOENINDKOMST_INPUT_ERROR_SUFFIX}`, undefined);
      }
    }
    for (const id of currentIds) {
      const hasError = Boolean(standardLoenTableHasErrorsByAfId[id] || manuelReguleringHasErrorsByAfId[id]);
      reportDynamicFieldError(
        `${id}${EO_LOENINDKOMST_INPUT_ERROR_SUFFIX}`,
        hasError ? 'Ugyldig manuel regulering' : undefined
      );
    }
    syncedLoenindkomstErrorIdsRef.current = currentIds;
  }, [
    standardLoenTableHasErrorsByAfId,
    manuelReguleringHasErrorsByAfId,
    reportDynamicFieldError,
    loenindkomstAnsaettelsesforhold,
  ]);

  const updateSfggAnsaettelsesforhold = React.useCallback((
    ansaettelsesforholdId: string,
    updater: (
      current: ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number]
    ) => ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number],
    origin?: { fieldPath?: string }
  ) => {
    setEOValues((prev) => updateSfggAnsaettelsesforholdRow(prev, ansaettelsesforholdId, updater), origin);
  }, [setEOValues]);

  const getSfggReferenceperiodeAvailability = React.useCallback((
    employment: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number],
    row: ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number] | undefined
  ): Readonly<{
    maxFravaersdage: number | undefined;
    hasNoRelevantDaysError: boolean;
    dayLabel: 'kalenderdage' | 'arbejdsdage' | null;
  }> => {
    const source = resolveSfggSource(row, employment);
    const referenceDayCount = resolveSfggReferenceperiodeDayCount(eoValues, row, source);
    if (!referenceDayCount) {
      return { maxFravaersdage: undefined, hasNoRelevantDaysError: false, dayLabel: null };
    }
    const maxFravaersdage = referenceDayCount.divisorLabel === 'kalenderdage'
      ? referenceDayCount.kalenderdage
      : referenceDayCount.divisorDage;
    return {
      maxFravaersdage,
      hasNoRelevantDaysError: maxFravaersdage <= 0,
      dayLabel: referenceDayCount.divisorLabel,
    };
  }, [eoValues]);

  const getLoenudviklingBaseDate = React.useCallback(
    (af: Ansaettelsesforhold) => {
      const iso = getAnvendtReguleringsdatoForAnsaettelsesforhold(af);
      if (!iso) {
        return { display: '', errorMessage: 'Skadedato er ikke udfyldt' };
      }
      const parsed = parseISODate(iso);
      if (!parsed) {
        return { display: '', errorMessage: 'Skadedato er ikke udfyldt' };
      }
      return { display: formatDanishDate(parsed), errorMessage: undefined };
    },
    [getAnvendtReguleringsdatoForAnsaettelsesforhold]
  );

  const isOffentligLoenSelectionReady = React.useCallback((af: Ansaettelsesforhold): boolean => {
    const overenskomstId = af.overenskomstId?.trim();
    if (!overenskomstId || !isOffentligOverenskomstId(overenskomstId)) return true;

    const loenTypeParsed = offentligLoenTypeEnum.safeParse(af.offentligLoenType ?? 'Månedsløn');
    if (!loenTypeParsed.success) return false;

    const trinValue = af.offentligLoenTrin;
    if (typeof trinValue !== 'number') return false;
    try {
      toLoentrin(trinValue);
    } catch {
      return false;
    }

    const gruppeValue = af.offentligLoenGruppe;
    if (typeof gruppeValue !== 'number') return false;
    if (gruppeValue < 0 || gruppeValue > 4) return false;

    return true;
  }, []);

  const resetLoentrinFinderState = React.useCallback(() => {
    setLoentrinFinderBeloeb(undefined);
    setLoentrinFinderDato(undefined);
    setLoentrinFinderErrors({});
    setLoentrinFinderAmountFieldError(undefined);
    setLoentrinFinderDateFieldError(undefined);
    setLoentrinFinderResults([]);
    setLoentrinFinderButtonShake(false);
  }, []);

  const readLoentrinFinderSessionState = React.useCallback((): LoentrinFinderSessionState => {
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

  const writeLoentrinFinderSessionState = React.useCallback((nextState: LoentrinFinderSessionState): void => {
    writeOptionalSessionStorageValue(UI_STORAGE_KEYS.loentrinFinderOverlay, JSON.stringify(nextState));
  }, []);

  const openLoentrinFinder = React.useCallback((af: Ansaettelsesforhold) => {
    resetLoentrinFinderState();
    const persistedState = readLoentrinFinderSessionState();
    const persistedEntry = persistedState[af.id];
    const fallbackAnsaettelse = af.offentligLoenType ?? 'Månedsløn';

    setLoentrinFinderAnsaettelse(persistedEntry?.ansaettelse ?? fallbackAnsaettelse);
    setLoentrinFinderOpenForAfId(af.id);
    setLoentrinFinderBeloeb(persistedEntry?.beloeb);
    setLoentrinFinderDato((persistedEntry?.dato as ISODateString | undefined) ?? undefined);
  }, [readLoentrinFinderSessionState, resetLoentrinFinderState]);

  const closeLoentrinFinder = React.useCallback(() => {
    setLoentrinFinderOpenForAfId(null);
    resetLoentrinFinderState();
  }, [resetLoentrinFinderState]);

  const loentrinFinderCurrentAf = React.useMemo(
    () => loenindkomstAnsaettelsesforhold.find((item) => item.id === loentrinFinderOpenForAfId),
    [loentrinFinderOpenForAfId, loenindkomstAnsaettelsesforhold]
  );
  const loentrinFinderOverenskomstLabel = React.useMemo(() => {
    const id = loentrinFinderCurrentAf?.overenskomstId?.trim();
    if (!id) return 'Ingen overenskomst valgt';
    const meta = getOverenskomstMetaById(id);
    return meta?.navn ?? id;
  }, [loentrinFinderCurrentAf?.overenskomstId]);

  const triggerLoentrinFinderButtonError = React.useCallback(() => {
    setLoentrinFinderButtonShake(true);
    setTimeout(() => setLoentrinFinderButtonShake(false), 500);
  }, []);

  const handleLoentrinFinderAmountFieldError = React.useCallback((errorMsg: ReportableFieldError | undefined) => {
    setLoentrinFinderAmountFieldError(getReportableFieldErrorMessage(errorMsg));
  }, []);

  const handleLoentrinFinderDateFieldError = React.useCallback((errorMsg: ReportableFieldError | undefined) => {
    setLoentrinFinderDateFieldError(getReportableFieldErrorMessage(errorMsg));
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
    const currentAf = loentrinFinderCurrentAf;
    const offentligOverenskomstType = getOffentligOverenskomstTypeById(currentAf?.overenskomstId ?? '');
    const overenskomstLabel = loentrinFinderOverenskomstLabel;

    if (!currentAf || !offentligOverenskomstType) {
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
    loentrinFinderCurrentAf,
    loentrinFinderAnsaettelse,
    loentrinFinderDato,
    loentrinFinderOverenskomstLabel,
    triggerLoentrinFinderButtonError,
    validateLoentrinFinderInput,
  ]);

  const loentrinFinderInputAmountNumber = React.useMemo(
    () => amountValueToNumber(loentrinFinderBeloeb),
    [loentrinFinderBeloeb]
  );

  React.useEffect(() => {
    if (!loentrinFinderOpenForAfId) return;
    const input = loentrinFinderAnsaettelseRef.current?.querySelector<HTMLInputElement>('input');
    input?.focus();
  }, [loentrinFinderOpenForAfId]);

  React.useEffect(() => {
    if (!loentrinFinderOpenForAfId) return;

    const current = readLoentrinFinderSessionState();
    const next: LoentrinFinderSessionState = {
      ...current,
      [loentrinFinderOpenForAfId]: {
        ansaettelse: loentrinFinderAnsaettelse,
        beloeb: loentrinFinderBeloeb,
        dato: loentrinFinderDato,
      },
    };
    writeLoentrinFinderSessionState(next);
  }, [
    loentrinFinderAnsaettelse,
    loentrinFinderBeloeb,
    loentrinFinderDato,
    loentrinFinderOpenForAfId,
    readLoentrinFinderSessionState,
    writeLoentrinFinderSessionState,
  ]);

  const getLoentrinFinderTabOrder = React.useCallback((): HTMLElement[] => {
    const ansaettelseInput = loentrinFinderAnsaettelseRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const beloebInput = loentrinFinderBeloebRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const datoInput = loentrinFinderDatoRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const beregnButton = loentrinFinderBeregnRef.current;
    const orderedElements: Array<HTMLElement | null> = [ansaettelseInput, beloebInput, datoInput, beregnButton];
    return orderedElements.filter((item): item is HTMLElement => item !== null);
  }, []);

  React.useEffect(() => {
    if (!loentrinFinderOpenForAfId) return;

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
            if (!loentrinFinderOpenForAfId) return;
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
    return () => document.removeEventListener('keydown', handleDocumentKeyDown, true);
  }, [closeLoentrinFinder, getLoentrinFinderTabOrder, handleLoentrinFinderCalculate, loentrinFinderOpenForAfId]);


  // Hent alle organisationer
  const alleLoenmodtagerOrg = React.useMemo(() => getAlleLoenmodtagerOrg(), []);
  const alleArbejdsgiverOrg = React.useMemo(() => getAlleArbejdsgiverOrg(), []);
  const updateAnsaettelsesforhold = React.useCallback(
    (id: string, updater: (prev: Ansaettelsesforhold) => Ansaettelsesforhold, origin?: { fieldPath?: string }) => {
      onAnsaettelsesforholdChange((prev) => {
        const index = prev.findIndex((item) => item.id === id);
        if (index === -1) return prev;

        const nextItems = [...prev];
        const updated = updater(prev[index]);
        nextItems[index] = syncManualBaseRowSatser(updated);

        return nextItems;
      }, origin);
    },
    [onAnsaettelsesforholdChange]
  );

  const setSatsErrorsForAnsaettelsesforhold = React.useCallback(
    (id: string, af: Ansaettelsesforhold) => {
      const errors = validateAllSatserForAnsaettelsesforhold(af);
      setSatsErrors((prev) => {
        if (Object.keys(errors).length === 0) {
          const { [id]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [id]: errors };
      });
    },
    [validateAllSatserForAnsaettelsesforhold]
  );

  const handleTextCommit = React.useCallback(
    (id: string, field: keyof Pick<Ansaettelsesforhold, 'navnPaaArbejdssted' | 'loenudviklingManuelNavn'>) =>
      (event: CommitEvent<string | undefined>) => {
        const nextValue = normalizeOptionalFreeText(event.target.value);
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, [field]: nextValue }), { fieldPath: `${id}:${field}` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleToggleChange = React.useCallback(
    (
      id: string,
      field: keyof Pick<
        Ansaettelsesforhold,
        'harOverenskomst' | 'ansatPaaSkadestidspunktet' | 'ansaettelsesforholdOphoert' | 'harAnciennitetstillaegEfterSkadedatoen'
      >
    ): CommitHandler<boolean> =>
      (event: CommitEvent<boolean>) => {
        updateAnsaettelsesforhold(id, (prev) => {
          const next = applyAnsaettelsesforholdToggleCleanup(prev, field, event.target.value);
          return syncManualBaseRowSatser(applyAutoSatsFields(next, getAnvendtReguleringsdatoForAnsaettelsesforhold(next)));
        }, { fieldPath: `${id}:${field}` });
      },
    [getAnvendtReguleringsdatoForAnsaettelsesforhold, updateAnsaettelsesforhold]
  );

  const handleOverenskomstChange = React.useCallback(
    (id: string) =>
      (e: StyledDropdownChangeEvent<string | undefined>) => {
        const nextOverenskomstId = normalizeOptionalFreeText(e.target.value);
        updateAnsaettelsesforhold(id, (prev) => {
          const next = {
            ...prev,
            overenskomstId: nextOverenskomstId,
            offentligLoenType:
              nextOverenskomstId && isOffentligOverenskomstId(nextOverenskomstId)
                ? (prev.offentligLoenType ?? 'Månedsløn')
                : prev.offentligLoenType,
          };
          return syncManualBaseRowSatser(applyAutoSatsFields(next, getAnvendtReguleringsdatoForAnsaettelsesforhold(next)));
        }, { fieldPath: `${id}:overenskomstId` });

        // Revalider alle satser når overenskomst ændres
        const ansaettelsesforhold = loenindkomstAnsaettelsesforhold.find((af) => af.id === id);
        if (ansaettelsesforhold) {
          const updatedAf = {
            ...ansaettelsesforhold,
            overenskomstId: nextOverenskomstId,
          };
          setSatsErrorsForAnsaettelsesforhold(id, updatedAf);
        }
      },
    [getAnvendtReguleringsdatoForAnsaettelsesforhold, setSatsErrorsForAnsaettelsesforhold, updateAnsaettelsesforhold, loenindkomstAnsaettelsesforhold]
  );

  const handleOffentligLoenTypeChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string | undefined>) => {
        const parsed = offentligLoenTypeEnum.safeParse(event.target.value ?? 'Månedsløn');
        const nextValue: OffentligLoenTypeLabel = parsed.success ? parsed.data : 'Månedsløn';
        updateAnsaettelsesforhold(id, (prev) => ({
          ...prev,
          offentligLoenType: nextValue,
        }), { fieldPath: `${id}:offentligLoenType` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleOffentligLoenTrinCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<number | undefined>) => {
        updateAnsaettelsesforhold(id, (prev) => ({
          ...prev,
          offentligLoenTrin: event.target.value,
        }), { fieldPath: `${id}:offentligLoenTrin` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleOffentligLoenGruppeCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<number | undefined>) => {
        updateAnsaettelsesforhold(id, (prev) => ({
          ...prev,
          offentligLoenGruppe: event.target.value,
        }), { fieldPath: `${id}:offentligLoenGruppe` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleOffentligLoenEkstraGrundloenCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<Ansaettelsesforhold['offentligLoenEkstraGrundloen']>) => {
        updateAnsaettelsesforhold(id, (prev) => ({
          ...prev,
          offentligLoenEkstraGrundloen: event.target.value,
        }), { fieldPath: `${id}:offentligLoenEkstraGrundloen` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleSidsteArbejdsdagCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<Ansaettelsesforhold['sidsteArbejdsdag']>) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, sidsteArbejdsdag: event.target.value }), { fieldPath: `${id}:sidsteArbejdsdag` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleSaerligFraDatoReguleringCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<Ansaettelsesforhold['saerligFraDatoRegulering']>) => {
        const nextSaerligFraDatoRegulering = event.target.value;
        updateAnsaettelsesforhold(id, (prev) => {
          const next = { ...prev, saerligFraDatoRegulering: nextSaerligFraDatoRegulering };
          return syncManualBaseRowSatser(applyAutoSatsFields(next, getAnvendtReguleringsdatoForAnsaettelsesforhold(next)));
        }, { fieldPath: `${id}:saerligFraDatoRegulering` });

        const ansaettelsesforhold = loenindkomstAnsaettelsesforhold.find((af) => af.id === id);
        if (!ansaettelsesforhold) return;

        const updatedAf = { ...ansaettelsesforhold, saerligFraDatoRegulering: nextSaerligFraDatoRegulering };
        setSatsErrorsForAnsaettelsesforhold(id, updatedAf);
      },
    [getAnvendtReguleringsdatoForAnsaettelsesforhold, setSatsErrorsForAnsaettelsesforhold, updateAnsaettelsesforhold, loenindkomstAnsaettelsesforhold]
  );

  const handleAnciennitetstillaegDatoCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<Ansaettelsesforhold['anciennitetstillaegDato']>) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, anciennitetstillaegDato: event.target.value }), { fieldPath: `${id}:anciennitetstillaegDato` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleAnciennitetstillaegSatsAngivesPerChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string>) => {
        const parsed = anciennitetSatsPerEnum.safeParse(event.target.value);
        if (!parsed.success) return;
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, anciennitetstillaegSatsAngivesPer: parsed.data }), { fieldPath: `${id}:anciennitetstillaegSatsAngivesPer` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleAnciennitetstillaegSatsCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<Ansaettelsesforhold['anciennitetstillaegSats']>) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, anciennitetstillaegSats: event.target.value }), { fieldPath: `${id}:anciennitetstillaegSats` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleFeriePctCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<number | undefined>) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, feriePct: event.target.value }), { fieldPath: `${id}:feriePct` });

        const ansaettelsesforhold = loenindkomstAnsaettelsesforhold.find((af) => af.id === id);
        if (!ansaettelsesforhold) return;

        const kræverFeriePct = beregnesUdFra === 'Beregningsperiode'
          && hasIndtastetLoenoplysninger(ansaettelsesforhold.indtaegtsoplysningerTableData ?? []);
        const errorMsg = validateFeriePct(ansaettelsesforhold.fuldLoenUnderFerie, event.target.value, kræverFeriePct);
        setSatsErrors((prev) => {
          const afErrors = prev[id] || {};
          if (errorMsg) {
            return { ...prev, [id]: { ...afErrors, feriePct: errorMsg } };
          }
          const { feriePct: _, ...rest } = afErrors;
          if (Object.keys(rest).length === 0) {
            const { [id]: __, ...restAf } = prev;
            return restAf;
          }
          return { ...prev, [id]: rest };
        });
      },
    [updateAnsaettelsesforhold, validateFeriePct, beregnesUdFra, loenindkomstAnsaettelsesforhold]
  );

  /**
   * Handler for sats-felter der skal valideres mod overenskomst
   */
  const handleValidatedSatsCommit = React.useCallback(
    (
      id: string,
      field: OverenskomstSatsField
    ) =>
      (event: CommitEvent<number | undefined>) => {
        // Opdater værdien
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, [field]: event.target.value }), { fieldPath: `${id}:${field}` });

        // Valider værdien
        const ansaettelsesforhold = loenindkomstAnsaettelsesforhold.find(af => af.id === id);
        if (!ansaettelsesforhold) return;

        const anvendtReguleringsdato = getAnvendtReguleringsdatoForAnsaettelsesforhold(ansaettelsesforhold);
        const errorMsg = validateSats(
          ansaettelsesforhold,
          field,
          event.target.value,
          anvendtReguleringsdato
        );

        // Opdater fejl-state
        setSatsErrors((prev) => {
          const afErrors = prev[id] || {};
          if (errorMsg) {
            return { ...prev, [id]: { ...afErrors, [field]: errorMsg } };
          } else {
            const { [field]: _, ...rest } = afErrors;
            if (Object.keys(rest).length === 0) {
              const { [id]: __, ...restAf } = prev;
              return restAf;
            }
            return { ...prev, [id]: rest };
          }
        });
      },
    [getAnvendtReguleringsdatoForAnsaettelsesforhold, updateAnsaettelsesforhold, loenindkomstAnsaettelsesforhold, validateSats]
  );

  const handleLoenperiodeChange = React.useCallback(
    (id: string) =>
      (_event: React.ChangeEvent<HTMLInputElement>, value: string) => {
        if (!isLoenperiodeValue(value)) return;
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenperiode: value }), { fieldPath: `${id}:loenperiode` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleFuldLoenUnderFerieChange = React.useCallback(
    (id: string): CommitHandler<boolean> =>
      (event: CommitEvent<boolean>) => {
        const nextValue: Ansaettelsesforhold['fuldLoenUnderFerie'] = event.target.value ? 'Ja' : 'Nej';
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, fuldLoenUnderFerie: nextValue }), { fieldPath: `${id}:fuldLoenUnderFerie` });

        const ansaettelsesforhold = loenindkomstAnsaettelsesforhold.find((af) => af.id === id);
        if (!ansaettelsesforhold) return;

        const kræverFeriePct = beregnesUdFra === 'Beregningsperiode'
          && hasIndtastetLoenoplysninger(ansaettelsesforhold.indtaegtsoplysningerTableData ?? []);
        const errorMsg = validateFeriePct(nextValue, ansaettelsesforhold.feriePct, kræverFeriePct);
        setSatsErrors((prev) => {
          const afErrors = prev[id] || {};
          if (errorMsg) {
            return { ...prev, [id]: { ...afErrors, feriePct: errorMsg } };
          }
          const { feriePct: _, ...rest } = afErrors;
          if (Object.keys(rest).length === 0) {
            const { [id]: __, ...restAf } = prev;
            return restAf;
          }
          return { ...prev, [id]: rest };
        });
      },
    [updateAnsaettelsesforhold, validateFeriePct, beregnesUdFra, loenindkomstAnsaettelsesforhold]
  );

  const handleLoenPaaHelligdageChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string>) => {
        const parsed = loenPaaHelligdageEnum.safeParse(event.target.value);
        if (!parsed.success) return;
        updateAnsaettelsesforhold(id, (prev) => {
          const next = { ...prev, loenPaaHelligdage: parsed.data };
          return syncManualBaseRowSatser(applyAutoSatsFields(next, getAnvendtReguleringsdatoForAnsaettelsesforhold(next)));
        }, { fieldPath: `${id}:loenPaaHelligdage` });

        // Revalider alle satser når "Løn på helligdage" ændres.
        const ansaettelsesforhold = loenindkomstAnsaettelsesforhold.find((af) => af.id === id);
        if (!ansaettelsesforhold) return;

        const updatedAf = { ...ansaettelsesforhold, loenPaaHelligdage: parsed.data };
        setSatsErrorsForAnsaettelsesforhold(id, updatedAf);
      },
    [getAnvendtReguleringsdatoForAnsaettelsesforhold, setSatsErrorsForAnsaettelsesforhold, updateAnsaettelsesforhold, loenindkomstAnsaettelsesforhold]
  );

  const handleTableDataChange = React.useCallback(
    (id: string) =>
      (newTableData: Ansaettelsesforhold['indtaegtsoplysningerTableData'], origin?: { fieldPath?: string }) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, indtaegtsoplysningerTableData: newTableData }), origin);
      },
    [updateAnsaettelsesforhold]
  );

  const handleAarsloenValidationChange = React.useCallback(
    (id: string) => (summary: StandardLoenTableValidationSummary) => {
      setStandardLoenTableHasErrorsByAfId((prev) => {
        return updateValidationFlagById(prev, id, summary.hasErrors);
      });
    },
    []
  );

  const handleLoenudviklingBeregningsgrundlagChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string | undefined>) => {
        const raw = event.target.value;
        if (!raw) {
          setManuelReguleringHasErrorsByAfId((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          updateAnsaettelsesforhold(id, (prev) =>
            applyLoenudviklingBeregningsgrundlagChange(prev, undefined)
          , { fieldPath: `${id}:loenudviklingBeregningsgrundlag` });
          return;
        }
        const parsed = loenudviklingBeregningsgrundlagEnum.safeParse(raw);
        if (!parsed.success) return;

        if (parsed.data !== 'Manuelt angivet') {
          setManuelReguleringHasErrorsByAfId((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }

        updateAnsaettelsesforhold(id, (prev) =>
          applyLoenudviklingBeregningsgrundlagChange(prev, parsed.data)
        , { fieldPath: `${id}:loenudviklingBeregningsgrundlag` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleLoenudviklingStatistikModelChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string | undefined>) => {
        const raw = event.target.value;
        if (!raw) {
          updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenudviklingStatistikModel: undefined }), { fieldPath: `${id}:loenudviklingStatistikModel` });
          return;
        }
        const parsed = loenudviklingStatistikModelEnum.safeParse(raw);
        if (!parsed.success) return;
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenudviklingStatistikModel: parsed.data }), { fieldPath: `${id}:loenudviklingStatistikModel` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleLoenudviklingKRLSatstabelChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string | undefined>) => {
        const raw = event.target.value;
        if (!raw) {
          updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenudviklingKRLSatstabel: undefined }), { fieldPath: `${id}:loenudviklingKRLSatstabel` });
          return;
        }
        const parsed = krlSatstabelEnum.safeParse(raw);
        if (!parsed.success) return;
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenudviklingKRLSatstabel: parsed.data }), { fieldPath: `${id}:loenudviklingKRLSatstabel` });
      },
    [updateAnsaettelsesforhold]
  );

  const handleLoenudviklingManuelTableChange = React.useCallback(
    (id: string) =>
      (newTableData: Ansaettelsesforhold['loenudviklingManuelTableData'], origin?: { fieldPath?: string }) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenudviklingManuelTableData: newTableData }), origin);
      },
    [updateAnsaettelsesforhold]
  );

  const handleManuelReguleringInputErrorChange = React.useCallback(
    (id: string) => (hasError: boolean) => {
      setManuelReguleringHasErrorsByAfId((prev) => {
        const next = { ...prev };
        if (hasError) {
          next[id] = true;
        } else {
          delete next[id];
        }
        return next;
      });
    },
    []
  );

  const resolveOverenskomstLabel = React.useCallback((overenskomstId: string | undefined): string => {
    if (!overenskomstId || overenskomstId.trim() === '') return 'Ingen valgt';
    const meta = getOverenskomstMetaById(overenskomstId);
    if (!meta) return overenskomstId;
    const loenPart = meta.loenmodtagerOrg[0] || '';
    const arbPart = meta.arbejdsgiverOrg[0] || '';
    return `${meta.navn} (${loenPart} / ${arbPart})`;
  }, []);

  const handleAddConfirm = React.useCallback(() => {
    const newAf = createBlankAnsaettelsesforhold(settings);
    onAnsaettelsesforholdChange((prev) => [...prev, newAf]);

    setAddDialogOpen(false);
  }, [onAnsaettelsesforholdChange, settings]);

  const handleDeleteConfirm = React.useCallback(() => {
    if (!deleteTargetId) return;
    try {
      setStandardLoenTableHasErrorsByAfId((prev) => {
        const next = { ...prev };
        delete next[deleteTargetId];
        return next;
      });
      setManuelReguleringHasErrorsByAfId((prev) => {
        const next = { ...prev };
        delete next[deleteTargetId];
        return next;
      });
      onAnsaettelsesforholdChange((prev) => prev.filter((af) => af.id !== deleteTargetId));
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, onAnsaettelsesforholdChange]);

  const handleMoveUp = React.useCallback((afId: string) => {
    onAnsaettelsesforholdChange((prev) => {
      const index = prev.findIndex((af) => af.id === afId);
      if (index <= 0) return prev;
      const nextItems = [...prev];
      [nextItems[index - 1], nextItems[index]] = [nextItems[index], nextItems[index - 1]];
      return nextItems;
    });
    setScrollTargetId(afId);
  }, [onAnsaettelsesforholdChange]);

  const handleMoveDown = React.useCallback((afId: string) => {
    onAnsaettelsesforholdChange((prev) => {
      const index = prev.findIndex((af) => af.id === afId);
      if (index === -1 || index >= prev.length - 1) return prev;
      const nextItems = [...prev];
      [nextItems[index], nextItems[index + 1]] = [nextItems[index + 1], nextItems[index]];
      return nextItems;
    });
    setScrollTargetId(afId);
  }, [onAnsaettelsesforholdChange]);

  React.useEffect(() => {
    if (!scrollTargetId) return;
    const id = scrollTargetId;
    const handle = window.requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-mineo-row-id="${id}"]`);
      // Efter en eksplicit flyt op/ned: centrér altid den flyttede række (force), så brugeren får
      // tydelig bekræftelse på flytningen — på linje med den tidligere block:'center'-adfærd. Selve
      // scroll-mekanikken ejes af den samlede scroll-helper.
      scrollTargetIntoView(el, { force: true });
      setScrollTargetId(null);
    });
    return () => window.cancelAnimationFrame(handle);
  }, [scrollTargetId, loenindkomstAnsaettelsesforhold]);

  const handleDownloadReguleringPdf = React.useCallback(
    async (input: ReguleringPdfInput) => {
      await downloadReguleringPdf({
        input,
        settings,
        persistedStamdata: getPersistedSectionSnapshot('stamdata'),
      });
    },
    [settings]
  );

  const handleDownloadKRLPdf = React.useCallback(
    async () => {
      await downloadKrlPdf({
        settings,
        persistedStamdata: getPersistedSectionSnapshot('stamdata'),
      });
    },
    [settings]
  );

  /**
   * Handler til at opdatere filtre for et specifikt Ansættelsesforhold (persisted i sagsdata)
   *
   * Modtager domæneværdier (string | undefined), IKKE UI-værdier.
   * Normaliseringen fra 'ALLE' → undefined sker i dropdown-onChange, ikke her.
   */
  const handleFilterChange = React.useCallback(
    (afId: string, filterType: 'loenmodtager' | 'arbejdsgiver', value: string | undefined) => {
      updateAnsaettelsesforhold(afId, (prev) => ({
        ...prev,
        overenskomstFilter: {
          ...prev.overenskomstFilter,
          [filterType]: value,
        },
      }), { fieldPath: `${afId}:overenskomstFilter.${filterType}` });
    },
    [updateAnsaettelsesforhold]
  );

  // Hent filtrerede overenskomster for hvert Ansættelsesforhold (bruger persisted filter fra sagsdata)
  const getFilteredOverenskomsterForAnsaettelsesforhold = React.useCallback(
    (af: Ansaettelsesforhold) => {
      // overenskomstFilter er nu altid til stede (ikke-optional i schema)
      return getOverenskomsterByOrg(af.overenskomstFilter.loenmodtager, af.overenskomstFilter.arbejdsgiver);
    },
    []
  );

  const totalAnsaettelsesforhold = loenindkomstAnsaettelsesforhold.length;
  const cannotAddMore = totalAnsaettelsesforhold >= MAX_ANSAETTELSESFORHOLD;
  const showDeleteButton = totalAnsaettelsesforhold > 0;

  // Stabile props pr. af til React.memo'd StandardLoenTable.
  const satserByAfId = React.useMemo(() => {
    const map = new Map<string, StandardLoenTableSatser>();
    for (const af of loenindkomstAnsaettelsesforhold) {
      map.set(af.id, {
        ferie: af.feriePct,
        fritvalg: af.fritvalgPct,
        shSo: af.shSoPct,
        bededag: af.storeBededagPct,
        pension: af.pensionPct,
      } satisfies StandardLoenTableSatser);
    }
    return map;
  }, [loenindkomstAnsaettelsesforhold]);

  const derivedCalculatorByAfId = React.useMemo(() => {
    const map = new Map<string, (row: Ansaettelsesforhold['indtaegtsoplysningerTableData'][number]) => ReturnType<typeof calculateLoenindkomstRowDerived>>();
    for (const af of loenindkomstAnsaettelsesforhold) {
      map.set(af.id, (row) => {
        return calculateLoenindkomstRowDerived({
          row,
          ansaettelsesforhold: af,
          context: {
            beregnesUdFra,
            tafBeregningsperiodeFra,
            tafBeregningsperiodeTil,
            loenindkomstAnsaettelsesforhold,
            ferieperioder,
            fravaerPerioder,
          },
          skadedato: stamdataValues?.skadedato,
        });
      });
    }
    return map;
  }, [
    beregnesUdFra,
    ferieperioder,
    fravaerPerioder,
    loenindkomstAnsaettelsesforhold,
    stamdataValues?.skadedato,
    tafBeregningsperiodeFra,
    tafBeregningsperiodeTil,
  ]);

  // Callback-maps afhænger kun af id-listen, ikke af tabeldata.
  // Ids ændrer sig kun ved tilføj/slet af ansaettelsesforhold — ikke ved normale dataredits.
  // Dette sikrer at onTableDataChange/onValidationChange er stabile props til React.memo'd StandardLoenTable.
  const afIds = React.useMemo(
    () => loenindkomstAnsaettelsesforhold.map((af) => af.id).join(','),
    [loenindkomstAnsaettelsesforhold]
  );

  const tableDataChangeByAfId = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof handleTableDataChange>>();
    for (const af of loenindkomstAnsaettelsesforhold) {
      map.set(af.id, handleTableDataChange(af.id));
    }
    return map;
    // afIds er en strengserialisering af id-listen og bruges som proxy-dep i stedet for
    // loenindkomstAnsaettelsesforhold, fordi map'et kun skal genopbygges ved tilføj/slet
    // af ansaettelsesforhold — ikke ved normale dataedits. Optimeringsgevinsten holder
    // kun så længe handleTableDataChange forbliver stabil (afhænger af onAnsaettelsesforholdChange →
    // form.setValues, som er stabil fra useState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afIds, handleTableDataChange]);

  const validationChangeByAfId = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof handleAarsloenValidationChange>>();
    for (const af of loenindkomstAnsaettelsesforhold) {
      map.set(af.id, handleAarsloenValidationChange(af.id));
    }
    return map;
    // Se comment ved tableDataChangeByAfId — samme afIds-proxy-mønster.
    // Holder så længe handleAarsloenValidationChange er stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afIds, handleAarsloenValidationChange]);

  return (
    <Box data-section-id="loenindkomst">
      <ContentBox
        className="content-box"
        sx={{ position: 'relative', marginBottom: totalAnsaettelsesforhold > 0 ? '40px' : '60px' }}
      >
        <Typography className="section-header">Oplysninger om ansættelsesforhold</Typography>

        <Box className="row--label-right-hover">
          <Box className="row--label-right-hover__content" sx={{ width: '100%', justifyContent: 'flex-start' }}>
            <Typography className="row--text">
              Lønindkomst, tillæg og andre relevante oplysninger angives individuelt for hvert enkelt
              ansættelsesforhold.
            </Typography>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Box className="row--label-right-hover__content" sx={{ width: '100%', justifyContent: 'flex-start' }}>
            <Typography className="row--text">
              Det er ikke nødvendigt at dele indtastninger op i før og efter skaden. Programmet sondrer selv.
            </Typography>
          </Box>
        </Box>

        {totalAnsaettelsesforhold === 0 ? (
          <Box sx={{ position: 'absolute', bottom: -28, right: 44, display: 'flex', gap: '14px' }}>
            <FloatingActionButton
              icon={<AddIcon />}
              color="primary"
              disabled={cannotAddMore}
              tooltip={cannotAddMore ? 'Maksimalt 10 ansættelsesforhold' : 'Tilføj nyt ansættelsesforhold'}
              shake={cannotAddMore}
              onClick={() => {
                setAddDialogOpen(true);
              }}
            />
          </Box>
        ) : null}

      </ContentBox>

      {loenindkomstAnsaettelsesforhold.map((af, index) => {
        const showOverenskomst = af.harOverenskomst;
        const showMedlemOpsagt = af.ansatPaaSkadestidspunktet;
        const showSidsteArbejdsdag = showMedlemOpsagt && af.ansaettelsesforholdOphoert;
        const isLastAnsaettelsesforhold = index === totalAnsaettelsesforhold - 1;
        const displayNumber = index + 1;
        const anvendtReguleringsdato = getAnvendtReguleringsdatoForAnsaettelsesforhold(af);
        const satserHeading = resolveSatserHeading({
          anvendtReguleringsdato,
          skadedato: stamdataValues?.skadedato,
          skadestype: stamdataValues?.skadestype,
          beregningsperiodeTil: beregnesUdFra === 'Beregningsperiode' ? tafBeregningsperiodeTil : undefined,
        });
        const loenudviklingBasis = af.loenudviklingBeregningsgrundlag;
        const fritvalgLocked = isOverenskomstSatsFieldLocked(af, anvendtReguleringsdato, 'fritvalgPct');
        const shSoLocked = isOverenskomstSatsFieldLocked(af, anvendtReguleringsdato, 'shSoPct');
        const pensionLocked = isOverenskomstSatsFieldLocked(af, anvendtReguleringsdato, 'pensionPct');
        const erOffentligOverenskomst = Boolean(
          af.overenskomstId && isOffentligOverenskomstId(af.overenskomstId)
        );
        const loenudviklingBaseDate = getLoenudviklingBaseDate(af);
        const anciennitetSatsPerTekst = af.anciennitetstillaegSatsAngivesPer === 'Time' ? 'time' : 'måned';
        const showAnciennitetstillaegSection = beregnesUdFra === 'Beregningsperiode'
          && loenudviklingBasis === 'Overenskomst'
          && Boolean(af.overenskomstId?.trim());
        const shouldShowReguleringsDatoInterval =
          loenudviklingBasis === 'Overenskomst' ||
          (loenudviklingBasis === 'Statistik' && Boolean(af.loenudviklingStatistikModel)) ||
          (loenudviklingBasis === 'KRL satstabel' && Boolean(af.loenudviklingKRLSatstabel));

        const reguleringsDatoIntervalData: ReguleringsDatoInterval | undefined = (() => {
          if (!shouldShowReguleringsDatoInterval) return undefined;
          if (loenudviklingBasis === 'Overenskomst') {
            return getReguleringsDatoIntervalForOverenskomst(af.overenskomstId ?? '');
          }
          if (loenudviklingBasis === 'Statistik') {
            return getReguleringsDatoIntervalForStatistikModel(af.loenudviklingStatistikModel ?? '');
          }
          if (loenudviklingBasis === 'KRL satstabel' && af.loenudviklingKRLSatstabel) {
            return getReguleringsDatoIntervalForKRL(af.loenudviklingKRLSatstabel as KRLSatstabelId);
          }
          return undefined;
        })();
        const reguleringsDatoInterval = formatReguleringsDatoInterval(reguleringsDatoIntervalData);
        const hasReguleringsDatoInterval =
          Boolean(reguleringsDatoIntervalData?.fraDato) && Boolean(reguleringsDatoIntervalData?.tilDato);

        const baseHeaderText = `Ansættelsesforhold ${displayNumber}`;

        const headerText = af.navnPaaArbejdssted
          ? `${baseHeaderText} (${af.navnPaaArbejdssted})`
          : baseHeaderText;
        const showSygeferiegodtgoerelseSection = eoValues.kravPaaTabtArbejdsfortjeneste === 'Ja' && af.ansatPaaSkadestidspunktet;
        const sfggRow = eoValues.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === af.id);
        const sfggPolicy = af.overenskomstId
          ? getOverenskomstSfggPolicy(af.overenskomstId)
          : undefined;
        const sfggOverenskomstMeta = af.overenskomstId
          ? getOverenskomstMetaById(af.overenskomstId)
          : undefined;
        const hasSfggOverenskomst = hasSfggSelectedOverenskomst(sfggRow, af);
        const sfggSelectedOverenskomstLabel = hasSfggOverenskomst
          ? (sfggOverenskomstMeta?.navn ?? af.overenskomstId!.trim())
          : 'Ingen overenskomst valgt';
        const canShowSfggOverenskomstDetails =
          sfggRow?.sfggBeregningskilde !== 'Overenskomst' || hasSfggOverenskomst;
        const requiresReferenceperiode =
          sfggRow?.sfggBeregningskilde === 'Ferieloven'
          || (
            sfggRow?.sfggBeregningskilde === 'Overenskomst'
            && hasSfggOverenskomst
            && sfggPolicy?.model !== 'direkte_sats'
          );
        const showSatsvalg =
          sfggRow?.sfggBeregningskilde === 'Overenskomst'
          && hasSfggOverenskomst
          && sfggPolicy?.model === 'direkte_sats'
          && sfggPolicy.direkteSatsErDifferentieret;
        const referenceperiodeAvailability = getSfggReferenceperiodeAvailability(af, sfggRow);
        const referenceperiodeErrorText = referenceperiodeAvailability.hasNoRelevantDaysError
          ? referenceperiodeAvailability.dayLabel === 'kalenderdage'
            ? 'Referenceperioden indeholder ingen kalenderdage.'
            : 'Referenceperioden indeholder ingen arbejdsdage.'
          : '';
        const firstTafFraDato = (eoValues.tafPerioder ?? [])
          .map((tafRow) => tafRow.fra)
          .filter((value): value is ISODateString => value !== undefined)
          .reduce<ISODateString | undefined>((earliest, current) => {
            if (!earliest) return current;
            return current < earliest ? current : earliest;
          }, undefined);
        const sfggReferenceperiodeMaxDate = resolveSfggReferenceperiodeMaxDate(eoValues);
        const sfggReferenceperiodeFravaersdageMax = Math.min(
          referenceperiodeAvailability.maxFravaersdage ?? DAY_COUNT_MAX,
          DAY_COUNT_MAX
        );
        const showSharedSfggBefore2015 = Boolean(
          stamdataValues?.skadedato && stamdataValues.skadedato < '2015-01-01'
        );

        return (
          <ContentBox
            key={af.id}
            className="content-box"
            data-mineo-row-id={af.id}
            sx={{ position: 'relative', marginBottom: isLastAnsaettelsesforhold ? '60px' : '40px' }}
          >
            <Typography className="section-header">{headerText}</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Navn på arbejdssted</Typography>
              <Box className="row--label-right-hover__content">
                <StyledTextField
                  name={`${af.id}:navnPaaArbejdssted`}
                  width={300}
                  value={af.navnPaaArbejdssted || ''}
                  onCommit={handleTextCommit(af.id, 'navnPaaArbejdssted')}
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Ansat på skadestidspunktet</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch
                  name={`${af.id}:ansatPaaSkadestidspunktet`}
                  checked={af.ansatPaaSkadestidspunktet}
                  onCommit={handleToggleChange(af.id, 'ansatPaaSkadestidspunktet')}
                />
              </Box>
            </Box>

            {showMedlemOpsagt ? (
              <Box className="row--label-right-hover">
                <Typography className="row--text">Opsagt fra stillingen</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledToggleSwitch
                    name={`${af.id}:ansaettelsesforholdOphoert`}
                    checked={af.ansaettelsesforholdOphoert}
                    onCommit={handleToggleChange(af.id, 'ansaettelsesforholdOphoert')}
                  />
                </Box>
              </Box>
            ) : null}

            <Box sx={{ display: showSidsteArbejdsdag ? 'block' : 'none' }}>
              <Box className="row--label-right-hover">
                <Typography className="row--text">Sidste dag i ansættelsesforholdet</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledDateField name={`${af.id}:sidsteArbejdsdag`} value={af.sidsteArbejdsdag} onCommit={handleSidsteArbejdsdagCommit(af.id)} />
                </Box>
              </Box>
            </Box>

            <Typography className="row--subheading">Lønforhold</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Overenskomst</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch name={`${af.id}:harOverenskomst`} checked={af.harOverenskomst} onCommit={handleToggleChange(af.id, 'harOverenskomst')} />
              </Box>
            </Box>

            <Box sx={{ display: showOverenskomst ? 'block' : 'none' }}>
              <Box className="row--label-right-hover">
                <Typography className="row--text">Vælg overenskomst</Typography>
                <Box className="row--label-right-hover__content">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Lønmodtager filter dropdown - UI viser 'ALLE', domæne bruger undefined */}
                    <Typography sx={{ fontSize: '11px', lineHeight: '24px' }}>L:</Typography>
                    <StyledDropdown
                      name={`${af.id}:overenskomstFilter.loenmodtager`}
                      value={af.overenskomstFilter.loenmodtager ?? 'ALLE'}
                      onChange={(e: StyledDropdownChangeEvent<string>) => {
                        const uiValue = e.target.value;
                        // Normalisér UI-værdi → domæne-værdi i dropdown-laget
                        handleFilterChange(af.id, 'loenmodtager', uiValue === 'ALLE' ? undefined : uiValue);
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
                      name={`${af.id}:overenskomstFilter.arbejdsgiver`}
                      value={af.overenskomstFilter.arbejdsgiver ?? 'ALLE'}
                      onChange={(e: StyledDropdownChangeEvent<string>) => {
                        const uiValue = e.target.value;
                        // Normalisér UI-værdi → domæne-værdi i dropdown-laget
                        handleFilterChange(af.id, 'arbejdsgiver', uiValue === 'ALLE' ? undefined : uiValue);
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
                      name={`${af.id}:overenskomstId`}
                      value={af.overenskomstId || undefined}
                      onChange={handleOverenskomstChange(af.id)}
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
                      {getFilteredOverenskomsterForAnsaettelsesforhold(af).map((meta) => {
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
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Fuld løn under ferie:</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch
                  name={`${af.id}:fuldLoenUnderFerie`}
                  checked={getCheckedJaNej(af.fuldLoenUnderFerie)}
                  onCommit={handleFuldLoenUnderFerieChange(af.id)}
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Løn på helligdage:</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDropdown
                  name={`${af.id}:loenPaaHelligdage`}
                  width={185}
                  value={af.loenPaaHelligdage}
                  onChange={handleLoenPaaHelligdageChange(af.id)}
                  allowEmpty={false}
                >
                  <MenuItem value="Almindelig løn">Almindelig løn</MenuItem>
                  <MenuItem value="SH-udbetaling">SH-udbetaling</MenuItem>
                  <MenuItem value="Ingen">Ingen</MenuItem>
                </StyledDropdown>
              </Box>
            </Box>

            {beregnesUdFra === 'Beregningsperiode' && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">Evt. særlig fra-dato for regulering</Typography>
                <Box className="row--label-right-hover__content">
                  <StyledDateField
                    name={`${af.id}:saerligFraDatoRegulering`}
                    value={af.saerligFraDatoRegulering}
                    onCommit={handleSaerligFraDatoReguleringCommit(af.id)}
                  />
                </Box>
              </Box>
            )}

            <Typography className="row--subheading">{satserHeading}</Typography>

            {/* Første række: 3 felter */}
            <Box className="row--label-right-hover">
              <Box
                sx={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '160px' }}>
                    Feriegodtgørelse/-tillæg:
                  </Typography>
                  <StyledPercentField
                    name={`${af.id}:feriePct`}
                    value={af.feriePct}
                    onCommit={handleFeriePctCommit(af.id)}
                    placeholder="0 %"
                    useDefaultPercentRange
                    error={Boolean(satsErrors[af.id]?.feriePct)}
                    helperText={satsErrors[af.id]?.feriePct}
                    sx={{ width: '100px' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '60px' }}>Fritvalg:</Typography>
                  <StyledPercentField
                    name={`${af.id}:fritvalgPct`}
                    value={af.fritvalgPct}
                    onCommit={handleValidatedSatsCommit(af.id, 'fritvalgPct')}
                    placeholder="0 %"
                    useDefaultPercentRange
                    disabled={fritvalgLocked}
                    disabledAppearance={fritvalgLocked ? 'locked' : 'default'}
                    error={Boolean(satsErrors[af.id]?.fritvalgPct)}
                    helperText={satsErrors[af.id]?.fritvalgPct}
                    sx={LOCKED_SATS_FIELD_SX}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '140px' }}>
                    SH/SO-sats:
                  </Typography>
                  <StyledPercentField
                    name={`${af.id}:shSoPct`}
                    value={af.shSoPct}
                    onCommit={handleValidatedSatsCommit(af.id, 'shSoPct')}
                    placeholder="0 %"
                    useDefaultPercentRange
                    disabled={shSoLocked}
                    disabledAppearance={shSoLocked ? 'locked' : 'default'}
                    error={Boolean(satsErrors[af.id]?.shSoPct)}
                    helperText={satsErrors[af.id]?.shSoPct}
                    sx={LOCKED_SATS_FIELD_SX}
                  />
                </Box>
              </Box>
            </Box>

            {/* Anden række: 2 felter */}
            <Box className="row--label-right-hover">
              <Box
                sx={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '160px' }}>
                    Store Bededagstillæg:
                  </Typography>
                  <StyledPercentField
                    value={af.storeBededagPct}
                    onCommit={undefined}
                    placeholder="0 %"
                    useDefaultPercentRange
                    disabled
                    disabledAppearance="locked"
                    error={Boolean(satsErrors[af.id]?.storeBededagPct)}
                    helperText={satsErrors[af.id]?.storeBededagPct}
                    sx={LOCKED_SATS_FIELD_SX}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '190px' }}>
                    Arbejdsgivers pensionsbidrag:
                  </Typography>
                  <StyledPercentField
                    name={`${af.id}:pensionPct`}
                    value={af.pensionPct}
                    onCommit={handleValidatedSatsCommit(af.id, 'pensionPct')}
                    placeholder="0 %"
                    useDefaultPercentRange
                    disabled={pensionLocked}
                    disabledAppearance={pensionLocked ? 'locked' : 'default'}
                    error={Boolean(satsErrors[af.id]?.pensionPct)}
                    helperText={satsErrors[af.id]?.pensionPct}
                    sx={LOCKED_SATS_FIELD_SX}
                  />
                </Box>
              </Box>
            </Box>

            <Typography className="row--subheading">Indtægtsoplysninger</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Løn indtastes som:</Typography>
              <Box className="row--label-right-hover__content">
                <StyledRadioButton
                  name={`${af.id}:loenperiode`}
                  value={af.loenperiode}
                  onChange={handleLoenperiodeChange(af.id)}
                  row={true}
                  options={[
                    { value: LOENPERIODE.MAANED, label: 'Måned' },
                    { value: LOENPERIODE.UGE, label: 'Uge' },
                    { value: LOENPERIODE.DAG, label: 'Dato' },
                  ]}
                />
              </Box>
            </Box>

            <StandardLoenTable
              loenperiode={af.loenperiode}
              satser={satserByAfId.get(af.id)!}
              tableData={af.indtaegtsoplysningerTableData}
              onTableDataChange={tableDataChangeByAfId.get(af.id)}
              onValidationChange={validationChangeByAfId.get(af.id)}
              externalCellErrorMessagesByCellKey={aarsloenExternalCellErrorMessagesByAfId[af.id] ?? EMPTY_CELL_ERROR_MESSAGES}
              useSmallFont={true}
              saveOrderPath={`erstatningsopgoerelse.ansaettelsesforhold.${index}.indtaegtsoplysningerTableData`}
              calculateDerivedRow={derivedCalculatorByAfId.get(af.id)}
            />

            {beregnesUdFra === 'Beregningsperiode' ? (
              <>
            <Typography className="row--subheading">Lønudvikling</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Lønudvikling beregnes ud fra</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDropdown
                  name={`${af.id}:loenudviklingBeregningsgrundlag`}
                  width={220}
                  value={loenudviklingBasis}
                  onChange={handleLoenudviklingBeregningsgrundlagChange(af.id)}
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
                <Typography className="row--text">Overenskomst</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{resolveOverenskomstLabel(af.overenskomstId)}</Typography>
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
                        name={`${af.id}:offentligLoenType`}
                        width={160}
                        value={af.offentligLoenType ?? 'Månedsløn'}
                        onChange={handleOffentligLoenTypeChange(af.id)}
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
                        name={`${af.id}:offentligLoenTrin`}
                        value={af.offentligLoenTrin}
                        onCommit={handleOffentligLoenTrinCommit(af.id)}
                        minValue={1}
                        maxValue={55}
                        maxDigits={2}
                        width={80}
                      />
                      <Typography className="row--text">Gruppe</Typography>
                      <StyledIntegerField
                        name={`${af.id}:offentligLoenGruppe`}
                        value={af.offentligLoenGruppe}
                        onCommit={handleOffentligLoenGruppeCommit(af.id)}
                        minValue={0}
                        maxValue={4}
                        maxDigits={1}
                        width={70}
                      />
                      <Tooltip title="Find løntrin" arrow>
                        <IconButton
                          onClick={() => openLoentrinFinder(af)}
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
                        name={`${af.id}:offentligLoenEkstraGrundloen`}
                        width={160}
                        value={af.offentligLoenEkstraGrundloen}
                        allowNegative={false}
                        onCommit={handleOffentligLoenEkstraGrundloenCommit(af.id)}
                      />
                      <Typography className="row--text">{getOffentligLoenEkstraGrundloenSuffix(af.offentligLoenType)}</Typography>
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
                    name={`${af.id}:loenudviklingStatistikModel`}
                    width={270}
                    value={af.loenudviklingStatistikModel}
                    onChange={handleLoenudviklingStatistikModelChange(af.id)}
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
                    name={`${af.id}:loenudviklingKRLSatstabel`}
                    width={270}
                    value={af.loenudviklingKRLSatstabel}
                    onChange={handleLoenudviklingKRLSatstabelChange(af.id)}
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
                {(() => {
                  const anvendtReguleringsdato = getAnvendtReguleringsdatoForAnsaettelsesforhold(af);
                  const baseDateTooltipText =
                    loenudviklingBaseDate.display === '' || !anvendtReguleringsdato
                      ? undefined
                      : anvendtReguleringsdato === stamdataValues?.skadedato
                        ? (stamdataValues?.skadestype === 'Erhvervssygdom' ? 'Anmeldelsesdato' : 'Skadedato')
                        : (
                            beregnesUdFra === 'Beregningsperiode'
                            && anvendtReguleringsdato === tafBeregningsperiodeTil
                            && af.saerligFraDatoRegulering === undefined
                          )
                          ? 'Beregningsperiode slutdato'
                          : undefined;
                  return (
                    <>
                      <Box className="row--label-right-hover">
                        <Typography className="row--text">Navn på reguleringsform</Typography>
                        <Box className="row--label-right-hover__content">
                          <StyledTextField
                            name={`${af.id}:loenudviklingManuelNavn`}
                            width={350}
                            value={af.loenudviklingManuelNavn || ''}
                            onCommit={handleTextCommit(af.id, 'loenudviklingManuelNavn')}
                          />
                        </Box>
                      </Box>
                      <LoenudviklingManuelTable
                        tableData={af.loenudviklingManuelTableData}
                        onTableDataChange={handleLoenudviklingManuelTableChange(af.id)}
                        onInputErrorChange={handleManuelReguleringInputErrorChange(af.id)}
                        baseDateDisplay={loenudviklingBaseDate.display}
                        baseDateErrorMessage={loenudviklingBaseDate.display === '' ? loenudviklingBaseDate.errorMessage : undefined}
                        baseDateInfoTooltipText={baseDateTooltipText}
                        baseRowPercentErrors={manualBaseRowErrorsByAfId[af.id]}
                        readOnlyBaseRowPercentFields={true}
                        useSmallFont={true}
                      />
                    </>
                  );
                })()}
              </Box>
            ) : null}

            {shouldShowReguleringsDatoInterval ? (
              <Box className="row--label-right-hover">
                <Typography className="row--text">Tilgængelige reguleringssatser</Typography>
                <Box className="row--label-right-hover__content">
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'flex-end', gap: 1 }}>
                    {(() => {
                      const offentligReady = isOffentligLoenSelectionReady(af);
                      const canDownload =
                        hasReguleringsDatoInterval &&
                        (loenudviklingBasis !== 'Overenskomst' || !erOffentligOverenskomst || offentligReady);
                      return (
                        <>
                          <Typography className="row--text" sx={{ textAlign: 'right' }}>
                            {reguleringsDatoInterval}
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
                                if (
                                  loenudviklingBasis !== 'Overenskomst' &&
                                  loenudviklingBasis !== 'Statistik'
                                ) {
                                  return;
                                }
                                void handleDownloadReguleringPdf({
                                  overenskomstLabel: resolveOverenskomstLabel(af.overenskomstId),
                                  loenudviklingBasis,
                                  overenskomstId: af.overenskomstId,
                                  statistikModelLabel: af.loenudviklingStatistikModel,
                                  interval: reguleringsDatoIntervalData,
                                  applyAlmindeligLoenPaaShDageRegel: af.loenPaaHelligdage === 'Almindelig løn',
                                  offentligLoenType: af.offentligLoenType,
                                  offentligLoenTrin: af.offentligLoenTrin,
                                  offentligLoenGruppe: af.offentligLoenGruppe,
                                  offentligLoenEkstraGrundloen: amountValueToNumber(af.offentligLoenEkstraGrundloen),
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
            ) : null}

            {showAnciennitetstillaegSection ? (
              <>
                <Typography className="row--subheading">Anciennitetstillæg</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Ville skadelidte have opnået anciennitetstillæg efter skadedatoen</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledToggleSwitch
                      name={`${af.id}:harAnciennitetstillaegEfterSkadedatoen`}
                      checked={af.harAnciennitetstillaegEfterSkadedatoen}
                      onCommit={handleToggleChange(af.id, 'harAnciennitetstillaegEfterSkadedatoen')}
                    />
                  </Box>
                </Box>

                {af.harAnciennitetstillaegEfterSkadedatoen ? (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Dato for opnået anciennitetstillæg</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledDateField
                          name={`${af.id}:anciennitetstillaegDato`}
                          value={af.anciennitetstillaegDato}
                          minDate={stamdataValues?.skadedato}
                          specialRangeErrors={{
                            minBoundKind: stamdataValues?.skadedato ? 'skadedato' : undefined,
                            minBoundReferenceISO: stamdataValues?.skadedato,
                          }}
                          onCommit={handleAnciennitetstillaegDatoCommit(af.id)}
                        />
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Satsen angives per</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledDropdown
                          name={`${af.id}:anciennitetstillaegSatsAngivesPer`}
                          width={160}
                          value={af.anciennitetstillaegSatsAngivesPer}
                          onChange={handleAnciennitetstillaegSatsAngivesPerChange(af.id)}
                          allowEmpty={false}
                        >
                          <MenuItem value="Time">Time</MenuItem>
                          <MenuItem value="Måned">Måned</MenuItem>
                        </StyledDropdown>
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">{`Sats per ${anciennitetSatsPerTekst}`}</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledAmountField
                          name={`${af.id}:anciennitetstillaegSats`}
                          width={160}
                          value={af.anciennitetstillaegSats}
                          allowNegative={false}
                          onCommit={handleAnciennitetstillaegSatsCommit(af.id)}
                        />
                      </Box>
                    </Box>
                  </>
                ) : null}
              </>
            ) : null}

            {showSygeferiegodtgoerelseSection ? (
              <>
                <Typography className="row--subheading">Sygeferiegodtgørelse</Typography>

                {showSharedSfggBefore2015 ? (
                  <Box className="row--label-right-hover">
                    <Box className="row--label-right-hover__content" sx={{ width: '100%', justifyContent: 'flex-start' }}>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <Typography className="row--text">
                          Bemærk, at da skaden er før 01-01-2015, er det afgørende, at samtlige TAF-perioder siden skaden er indtastet på
                        </Typography>
                        <Typography className="row--text">&nbsp;</Typography>
                        <Typography
                          className="row--text icon-text-link"
                          component="button"
                          type="button"
                          onClick={onNavigateToTabtArbejdsfortjeneste}
                          sx={{
                            cursor: 'pointer',
                            border: 0,
                            background: 'transparent',
                            p: 0,
                            m: 0,
                            font: 'inherit',
                          }}
                        >
                          fanen med EO Oplysninger
                        </Typography>
                        <Typography className="row--text">.</Typography>
                      </Box>
                    </Box>
                  </Box>
                ) : null}

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Sygeferiegodtgørelse beregnes ud fra</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledDropdown
                      name={`${af.id}:sfggBeregningskilde`}
                      width={200}
                      value={sfggRow?.sfggBeregningskilde}
                      placeholder="Vælg..."
                      allowEmpty={true}
                      onChange={(event: StyledDropdownChangeEvent<string | undefined>) => {
                        const nextValue = event.target.value;
                        const nextBeregningskilde =
                          nextValue === 'Overenskomst' || nextValue === 'Manuelt angivet' || nextValue === 'Ferieloven' || nextValue === 'Ingen'
                            ? nextValue
                            : undefined;
                        updateSfggAnsaettelsesforhold(
                          af.id,
                          (current) => applySfggBeregningskildeChange(current, nextBeregningskilde),
                          { fieldPath: `${af.id}:sfggBeregningskilde` }
                        );
                      }}
                    >
                      <MenuItem value="Overenskomst">Overenskomst</MenuItem>
                      <MenuItem value="Manuelt angivet">Manuelt angivet</MenuItem>
                      <MenuItem value="Ferieloven">Ferieloven</MenuItem>
                      <MenuItem value="Ingen">Ingen</MenuItem>
                    </StyledDropdown>
                  </Box>
                </Box>

                {sfggRow?.sfggBeregningskilde === 'Overenskomst' ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Overenskomst (angivet ovenfor)</Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text" sx={{ textAlign: 'right', maxWidth: '520px' }}>
                        {sfggSelectedOverenskomstLabel}
                      </Typography>
                    </Box>
                  </Box>
                ) : null}

                {sfggRow?.sfggBeregningskilde === 'Overenskomst' && canShowSfggOverenskomstDetails && sfggPolicy?.model !== 'direkte_sats' ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Overenskomstens referenceperiode</Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text" sx={{ textAlign: 'right', maxWidth: '520px' }}>
                        {`Følger ferieloven${sfggPolicy?.referenceperiodeLabel ? ` (${sfggPolicy.referenceperiodeLabel})` : ''}`}
                      </Typography>
                    </Box>
                  </Box>
                ) : null}

                {canShowSfggOverenskomstDetails && showSatsvalg ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Angiv skadelidtes uddannelse og arbejdssted</Typography>
                    <Box className="row--label-right-hover__content">
                      <StyledDropdown
                        name={`${af.id}:sfggSatsvalg`}
                        width={220}
                        value={sfggRow?.sfggSatsvalg}
                        placeholder="Vælg..."
                        allowEmpty={true}
                        onChange={(event: StyledDropdownChangeEvent<string | undefined>) => {
                          const nextValue = event.target.value;
                          updateSfggAnsaettelsesforhold(af.id, (current) => ({
                            ...current,
                            sfggSatsvalg:
                              nextValue === 'Faglaert-Koebenhavn' ||
                              nextValue === 'Faglaert-Provinsen' ||
                              nextValue === 'Ufaglaert-Koebenhavn' ||
                              nextValue === 'Ufaglaert-Provinsen'
                                ? nextValue
                                : undefined,
                          }), { fieldPath: `${af.id}:sfggSatsvalg` });
                        }}
                      >
                        <MenuItem value="Faglaert-Koebenhavn">Faglært-København</MenuItem>
                        <MenuItem value="Faglaert-Provinsen">Faglært-Provinsen</MenuItem>
                        <MenuItem value="Ufaglaert-Koebenhavn">Ufaglært-København</MenuItem>
                        <MenuItem value="Ufaglaert-Provinsen">Ufaglært-Provinsen</MenuItem>
                      </StyledDropdown>
                    </Box>
                  </Box>
                ) : null}

                {canShowSfggOverenskomstDetails && requiresReferenceperiode ? (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Referenceperiode</Typography>
                      <Box className="row--label-right-hover__content">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <StyledDateField
                            name={`${af.id}:sfggReferenceperiodeFra`}
                            value={sfggRow?.sfggReferenceperiodeFra}
                            maxDate={
                              sfggRow?.sfggReferenceperiodeTil && sfggReferenceperiodeMaxDate
                                ? (sfggRow.sfggReferenceperiodeTil < sfggReferenceperiodeMaxDate ? sfggRow.sfggReferenceperiodeTil : sfggReferenceperiodeMaxDate)
                                : (sfggRow?.sfggReferenceperiodeTil ?? sfggReferenceperiodeMaxDate)
                            }
                            specialRangeErrors={{
                              fraTilRole: 'fra',
                              maxBoundKind: sfggReferenceperiodeMaxDate ? 'foerFoersteTafFraDato' : undefined,
                              maxBoundReferenceISO: firstTafFraDato,
                            }}
                            error={referenceperiodeErrorText !== ''}
                            helperText={referenceperiodeErrorText}
                            onCommit={(event) => {
                              updateSfggAnsaettelsesforhold(af.id, (current) => ({
                                ...current,
                                sfggReferenceperiodeFra: event.target.value,
                              }));
                            }}
                          />
                          <Typography className="row--text">til og med</Typography>
                          <StyledDateField
                            name={`${af.id}:sfggReferenceperiodeTil`}
                            value={sfggRow?.sfggReferenceperiodeTil}
                            minDate={sfggRow?.sfggReferenceperiodeFra}
                            maxDate={sfggReferenceperiodeMaxDate}
                            specialRangeErrors={{
                              fraTilRole: 'til',
                              maxBoundKind: sfggReferenceperiodeMaxDate ? 'foerFoersteTafFraDato' : undefined,
                              maxBoundReferenceISO: firstTafFraDato,
                            }}
                            error={referenceperiodeErrorText !== ''}
                            helperText={referenceperiodeErrorText}
                            onCommit={(event) => {
                              updateSfggAnsaettelsesforhold(af.id, (current) => ({
                                ...current,
                                sfggReferenceperiodeTil: event.target.value,
                              }));
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Evt. ferie- og fraværsdage i referenceperioden uden løn</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledIntegerField
                          name={`${af.id}:sfggReferenceperiodeFravaersdageUdenLoen`}
                          width={100}
                          minValue={0}
                          maxValue={sfggReferenceperiodeFravaersdageMax ?? DAY_COUNT_MAX}
                          value={sfggRow?.sfggReferenceperiodeFravaersdageUdenLoen}
                          placeholder="0"
                          onCommit={(event) => {
                            updateSfggAnsaettelsesforhold(af.id, (current) => ({
                              ...current,
                              sfggReferenceperiodeFravaersdageUdenLoen: event.target.value,
                            }));
                          }}
                        />
                      </Box>
                    </Box>

                  </>
                ) : null}

                {sfggRow?.sfggBeregningskilde === 'Overenskomst' && canShowSfggOverenskomstDetails && sfggPolicy?.model === 'direkte_sats' && !showSatsvalg ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Referencesats</Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">Fastlægges automatisk af overenskomsten</Typography>
                    </Box>
                  </Box>
                ) : null}

                {sfggRow?.sfggBeregningskilde === 'Manuelt angivet' ? (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Dagssats for sygeferiegodtgørelse (mandag-fredag)</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledAmountField
                          name={`${af.id}:sfggManuelDagssats`}
                          width={150}
                          value={sfggRow?.sfggManuelDagssats}
                          allowNegative={false}
                          onCommit={(event) => {
                            updateSfggAnsaettelsesforhold(af.id, (current) => ({
                              ...current,
                              sfggManuelDagssats: event.target.value,
                            }));
                          }}
                        />
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Beløbet er i henhold til</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledTextField
                          name={`${af.id}:sfggManuelBeloebIHenholdTil`}
                          width={260}
                          value={sfggRow?.sfggManuelBeloebIHenholdTil ?? ''}
                          onCommit={(event) => {
                            updateSfggAnsaettelsesforhold(af.id, (current) => ({
                              ...current,
                              sfggManuelBeloebIHenholdTil: normalizeOptionalFreeText(event.target.value),
                            }));
                          }}
                        />
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Først sygeferiegodtgørelse efter ophør af sygeløn</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledToggleSwitch
                          name={`${af.id}:sfggManuelFoerstEfterSygeloen`}
                          checked={sfggRow?.sfggManuelFoerstEfterSygeloen === 'Ja'}
                          onCommit={(event) => {
                            updateSfggAnsaettelsesforhold(af.id, (current) => ({
                              ...current,
                              sfggManuelFoerstEfterSygeloen: event.target.value ? 'Ja' : 'Nej',
                            }), { fieldPath: `${af.id}:sfggManuelFoerstEfterSygeloen` });
                          }}
                        />
                      </Box>
                    </Box>
                  </>
                ) : null}

                {sfggRow?.sfggBeregningskilde !== undefined && sfggRow.sfggBeregningskilde !== 'Ingen' && canShowSfggOverenskomstDetails ? (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Evt. allerede betalt sygeferiegodtgørelse i denne erstatningsperiode<InfoTooltipIcon title="Angiv kun faktisk SFGG. Feriegodtgørelse af sygeløn beregnes automatisk." /></Typography>
                    <Box className="row--label-right-hover__content">
                      <StyledAmountField
                        name={`${af.id}:sfggAlleredeBetaltBeloeb`}
                        width={150}
                        value={sfggRow?.sfggAlleredeBetaltBeloeb}
                        allowNegative={false}
                        onCommit={(event) => {
                          updateSfggAnsaettelsesforhold(af.id, (current) => ({
                            ...current,
                            sfggAlleredeBetaltBeloeb: event.target.value,
                          }));
                        }}
                      />
                    </Box>
                  </Box>
                ) : null}
              </>
            ) : null}

            {/* Handlingsknapper – flex-container der fylder ud fra højre */}
            <Box sx={{ position: 'absolute', bottom: -28, right: 44, display: 'flex', gap: '14px' }}>
              {isLastAnsaettelsesforhold && (
                <FloatingActionButton
                  icon={<AddIcon />}
                  color="primary"
                  disabled={cannotAddMore}
                  tooltip={cannotAddMore ? 'Maksimalt 10 ansættelsesforhold' : 'Tilføj nyt ansættelsesforhold'}
                  shake={cannotAddMore}
                  onClick={() => {
                    setAddDialogOpen(true);
                  }}
                />
              )}

              {/* Flyt op (kun synlig hvis >1 Ansættelsesforhold og ikke det første) */}
              {totalAnsaettelsesforhold > 1 && index > 0 && (
                <FloatingActionButton
                  icon={<ArrowUpwardIcon />}
                  color="primary"
                  tooltip="Flyt ansættelsesforhold op"
                  onClick={() => handleMoveUp(af.id)}
                />
              )}

              {/* Flyt ned (kun synlig hvis >1 Ansættelsesforhold og ikke det sidste) */}
              {totalAnsaettelsesforhold > 1 && !isLastAnsaettelsesforhold && (
                <FloatingActionButton
                  icon={<ArrowDownwardIcon />}
                  color="primary"
                  tooltip="Flyt ansættelsesforhold ned"
                  onClick={() => handleMoveDown(af.id)}
                />
              )}

              {/* Slet (kun synlig hvis der er mere end ét Ansættelsesforhold) */}
              {showDeleteButton && (
                <FloatingActionButton
                  icon={<DeleteIcon />}
                  color="error"
                  tooltip="Slet ansættelsesforhold"
                  onClick={() => {
                    setDeleteTargetId(af.id);
                    setDeleteDialogOpen(true);
                  }}
                />
              )}

            </Box>
          </ContentBox>
        );
      })}

      {loentrinFinderOpenForAfId ? (
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
                      const nextValue: OffentligLoenTypeLabel = parsed.success ? parsed.data : 'Månedsløn';
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
                    onFieldError={handleLoentrinFinderAmountFieldError}
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
                    onFieldError={handleLoentrinFinderDateFieldError}
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

      {/* Tilføj-dialog */}
      <ConfirmationDialog
        open={addDialogOpen}
        title="Tilføj ansættelsesforhold"
        message={
          <>
            Dette vil tilføje et nyt ansættelsesforhold nederst på siden.
            <br />
            <br />
            Bekræft venligst.
          </>
        }
        confirmText="Ja, tilføj"
        cancelText="Annuller"
        onConfirm={handleAddConfirm}
        onCancel={() => {
          setAddDialogOpen(false);
        }}
      />

      {/* Slet-dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        title="Slet ansættelsesforhold"
        message={
          <>
            {deleteTargetName !== ''
              ? `Dette vil slette alle oplysninger i ansættelsesforholdet (${deleteTargetName}). Handlingen kan ikke fortrydes.`
              : 'Dette vil slette alle oplysninger i dette ansættelsesforhold. Handlingen kan ikke fortrydes.'}
            <br />
            <br />
            Bekræft venligst.
          </>
        }
        confirmText="Ja, slet"
        cancelText="Annuller"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setDeleteTargetId(null);
        }}
      />
    </Box>
  );
});

LoenindkomstTab.displayName = 'LoenindkomstTab';

export default LoenindkomstTab;
