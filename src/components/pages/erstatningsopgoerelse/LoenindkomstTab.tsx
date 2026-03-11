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
import type { CommitEvent, CommitHandler } from '../../inputs/fieldEvents';
import AarsloenTable, { type AarsloenTableSatser } from '../../tables/AarsloenTable';
import LoenudviklingManuelTable from '../../tables/LoenudviklingManuelTable';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ContentBox from '../../layout/ContentBox';
import type { UsePersistedFormReturn } from '../../../hooks/usePersistedForm';
import {
  loenPaaHelligdageSchema,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  krlSatstabelEnum,
  anciennitetSatsPerEnum,
  offentligLoenTypeEnum,
  type OffentligLoenTypeLabel,
  type ErstatningsopgoerelseValues,
} from '../../../schemas/formSchemas';
import { optionalAmountValueSchema } from '../../../schemas/amountExpressionSchema';
import { LOENPERIODE } from '../../../types/loen';
import type { ISODateString } from '../../../types/branded';
import { isISODateString, parseISODate } from '../../../types/branded';
import { formatDanishDate } from '../../../utils/dateUtils';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { isLoenperiodeValue } from '../../../utils/zodTypeGuards';
import { generateAnsaettelsesforholdId, generateLoenudviklingRowId, initialLoenudviklingManuelRow } from '../../../utils/eoConverters';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import type { AarsloenTableValidationSummary } from '../../../types/table';
import { UI_STORAGE_KEYS } from '../../../config/storageManifest';
import { STORE_BEDEDAG_START } from '../../../config/dateRanges';
import { STORE_BEDEDAG_PCT } from '../../../config/regulatoryRates';
import {
  getAlleLoenmodtagerOrg,
  getAlleArbejdsgiverOrg,
  getOverenskomsterByOrg,
  getOverenskomstMetaById,
  getEffektiveSatserForDato,
  getOffentligOverenskomstTypeById,
  getOffentligTillaegsSatserForDato,
  getReguleringsDatoIntervalForOverenskomst,
  isOffentligOverenskomstId,
  resolveOverenskomstRef,
  type OverenskomstId,
} from '../../../data/overenskomstRates';
import { toLoentrin } from '../../../data/offentligLoenTypes';
import { getOffentligLoenTabelForDato } from '../../../data/offentligLoenLookup';
import {
  ASL_AARSLOENSMAKSIMUM_MODEL_LABEL,
  getReguleringsDatoIntervalForStatistikModel,
} from '../../../data/statistiskLoenudviklingRates';
import { getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../../data/KRLrates';
import { useFormPersistence } from '../../../contexts/useFormPersistence';
import { useSetEOLoenindkomstInputError } from '../../../hooks/useEOLoenindkomstInputErrors';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { appSettingsSchema, DEFAULT_APP_SETTINGS, resolveDefaultOverenskomstFilter, type AppSettings } from '../../../settings/appSettingsSchema';
import { downloadKrlPdf, downloadReguleringPdf, type ReguleringPdfInput } from '../../../utils/pdf/pdfService';
import { formatCurrency } from '../../../utils/formatUtils';
import { hasIndtastetLoenoplysninger } from '../../../domain/erstatningsopgoerelse/loenoplysningerInput';
import { DEFAULT_ANCIENNITET_FIELDS } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { buildAarsloenZeroArbejdsdageCellErrorMessages } from '../../../domain/erstatningsopgoerelse/indkomstRowValidation';
import {
  validateLoenudviklingManualBaseRowSatser,
  type ManualBaseRowCellErrors,
} from '../../../domain/erstatningsopgoerelse/loenudviklingManuelBaseRowValidation';

type ErstatningsopgoerelseFormApi = Pick<
  UsePersistedFormReturn<ErstatningsopgoerelseValues>,
  'values' | 'setValues'
>;

type Props = {
  form: ErstatningsopgoerelseFormApi;
};

type Ansaettelsesforhold =
  ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

const MAX_ANSAETTELSESFORHOLD = 10;

const getCheckedJaNej = (value: 'Ja' | 'Nej'): boolean => value === 'Ja';

const normalizeOptionalFreeText = (value: string | undefined): string | undefined => {
  const asString = typeof value === 'string' ? value : '';
  const trimmed = asString.trim();
  return trimmed === '' ? undefined : trimmed;
};

const formatReguleringsDatoInterval = (interval?: { fraDato: string; tilDato: string }): string => {
  if (!interval) return '';
  return `${interval.fraDato} - ${interval.tilDato}`;
};

const getOffentligLoenEkstraGrundloenSuffix = (
  offentligLoenType: Ansaettelsesforhold['offentligLoenType']
): string => (offentligLoenType === 'Timeløn' ? '/ time' : '/ måned');

const formatManualBaseRowPercent = (value: number | undefined): string | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value.toFixed(2).replace('.', ',');
};

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

type OverenskomstSatsField = Exclude<keyof SatsErrorState, 'feriePct'>;

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

const hasExactDisplayedAmountMatch = (inputAmount: number, resultAmount: number): boolean => {
  return formatCurrency(inputAmount) === formatCurrency(resultAmount);
};

const LoenindkomstTab = React.memo(({ form }: Props) => {
  const { values, setValues } = form;
  const { getPersistedData } = useFormPersistence();
  const setLoenindkomstManuelReguleringInputError = useSetEOLoenindkomstInputError();
  const { settings } = useAppSettings();

  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [scrollTargetId, setScrollTargetId] = React.useState<string | null>(null);
  const deleteTargetName = React.useMemo(() => {
    if (!deleteTargetId) return '';
    const target = values.loenindkomstAnsaettelsesforhold.find((af) => af.id === deleteTargetId);
    return target?.navnPaaArbejdssted?.trim() ?? '';
  }, [deleteTargetId, values.loenindkomstAnsaettelsesforhold]);

  // State til fejlmeddelelser per Ansættelsesforhold
  const [satsErrors, setSatsErrors] = React.useState<Record<string, SatsErrorState>>({});
  const [aarsloenTableHasErrorsByAfId, setAarsloenTableHasErrorsByAfId] = React.useState<Record<string, true>>({});
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
    for (const af of values.loenindkomstAnsaettelsesforhold) {
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
  }, [values.loenindkomstAnsaettelsesforhold]);
  const aarsloenExternalCellErrorMessagesByAfId = React.useMemo<Record<string, Readonly<Record<string, string>>>>(() => {
    const result: Record<string, Readonly<Record<string, string>>> = {};
    for (const af of values.loenindkomstAnsaettelsesforhold) {
      const messages = buildAarsloenZeroArbejdsdageCellErrorMessages(values, af.id);
      if (Object.keys(messages).length > 0) {
        result[af.id] = messages;
      }
    }
    return result;
  }, [values]);
  const syncedLoenindkomstErrorIdsRef = React.useRef<ReadonlySet<string>>(new Set());

  // Hent stamdata for skadesdato
  const stamdataValues = getPersistedData('stamdata');

  /**
   * Valider Store Bededagstillæg
   *
   * @param loenPaaHelligdage Værdi fra dropdown "Løn på helligdage"
   * @param inputValue Den indtastede værdi (i procent, fx 0.45 for 0,45%)
   * @returns Fejlmeddelelse hvis ugyldig, undefined hvis OK
   */
  const validateStoreBededag = React.useCallback(
    (
      loenPaaHelligdage: string,
      inputValue: number | undefined,
      reguleringsDato: ISODateString | undefined
    ): string | undefined => {
      if (!reguleringsDato) return undefined;

      // Tjek om dato er fra 1. januar 2024 og frem
      const isFrom2024 = reguleringsDato >= STORE_BEDEDAG_START;

      // Bestem forventet værdi baseret på logik
      let expectedPct: number;
      if (loenPaaHelligdage === 'Almindelig løn' && isFrom2024) {
        expectedPct = STORE_BEDEDAG_PCT;
      } else {
        expectedPct = 0;
      }

      // Tom celle (undefined) behandles som 0
      const actualValue = inputValue ?? 0;

      // Sammenlign med tolerance på 0.01% (håndter afrundingsfejl)
      const diff = Math.abs(actualValue - expectedPct);
      if (diff > 0.01) {
        const prefix = isFrom2024 ? 'Fra' : 'Før';
        return `${prefix} 01-01-2024 udgjorde Store Bededagstillæg ${expectedPct.toFixed(2).replace('.', ',')} %`;
      }

      return undefined;
    },
    []
  );

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

  const getReguleringsDatoForAnsaettelsesforhold = React.useCallback(
    (af: Ansaettelsesforhold): ISODateString | undefined => {
      return af.saerligFraDatoRegulering || stamdataValues?.skadesdato;
    },
    [stamdataValues?.skadesdato]
  );
  const validateSats = React.useCallback(
    (
      overenskomstId: string | undefined,
      fieldName: OverenskomstSatsField,
      inputValue: number | undefined,
      reguleringsDato: ISODateString | undefined,
      applyAlmindeligLoenPaaShDageRegel: boolean
    ): string | undefined => {
      // Kun valider hvis der er valgt en overenskomst
      if (!overenskomstId) return undefined;

      // Tjek om der er en dato at validere mod
      if (!reguleringsDato) return undefined;

      // Konverter ISO til dansk format
      const dateObj = parseISODate(reguleringsDato);
      if (!dateObj) return undefined;

      const danishDate = formatDanishDate(dateObj);

      // Map felt til overenskomst-felt og sammenlign
      // null i overenskomst behandles som 0
      let expectedValue: number;
      if (isOffentligOverenskomstId(overenskomstId)) {
        const tillaegSatser = getOffentligTillaegsSatserForDato(
          overenskomstId,
          danishDate,
          applyAlmindeligLoenPaaShDageRegel
        );
        if (!tillaegSatser) return undefined;
        switch (fieldName) {
          case 'fritvalgPct':
            expectedValue = tillaegSatser.fritvalg ?? 0;
            break;
          case 'shSoPct':
            expectedValue = tillaegSatser.shSoSats ?? 0;
            break;
          case 'storeBededagPct':
            return undefined;
          case 'pensionPct':
            expectedValue = tillaegSatser.agPension ?? 0;
            break;
        }
      } else {
        const ref = resolveOverenskomstRef(overenskomstId);
        if (!ref) return undefined;
        const satser = getEffektiveSatserForDato({
          overenskomstId: ref.baseId as OverenskomstId,
          dato: danishDate,
          applyAlmindeligLoenPaaShDageRegel,
        });
        if (!satser) return undefined;

        switch (fieldName) {
          case 'fritvalgPct':
            expectedValue = satser.fritvalg ?? 0;
            break;
          case 'shSoPct':
            // SH/SO-sats
            expectedValue = satser.shSoSats ?? 0;
            break;
          case 'storeBededagPct':
            // Store Bededag valideres separat - returnér her hvis logikken ikke matcher
            return undefined;
          case 'pensionPct':
            expectedValue = satser.agPension ?? 0;
            break;
        }
      }

      // Hent overenskomst navn til fejlmeddelelse
      const overenskomstMeta = getOverenskomstMetaById(overenskomstId);
      const overenskomstNavn = overenskomstMeta?.navn || 'Overenskomsten';

      const dateObj2 = parseISODate(reguleringsDato);
      if (!dateObj2) return undefined;

      const danishDateShort = formatDanishDate(dateObj2);

      // Konverter til procent (0.1015 → 10.15)
      const expectedPct = expectedValue * 100;

      // Tom celle (undefined) behandles som 0
      const actualValue = inputValue ?? 0;

      // Sammenlign med tolerance på 0.01% (håndter afrundingsfejl)
      const diff = Math.abs(actualValue - expectedPct);
      if (diff > 0.01) {
        return `${overenskomstNavn}s sats per ${danishDateShort} udgør ${expectedPct.toFixed(2).replace('.', ',')} %`;
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
      const reguleringsDato = getReguleringsDatoForAnsaettelsesforhold(af);
      const kræverFeriePct = values.beregnesUdFra === 'Beregningsperiode'
        && hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []);

      // Valider Feriegodtgørelse/-tillæg
      const ferieError = validateFeriePct(af.fuldLoenUnderFerie, af.feriePct, kræverFeriePct);
      if (ferieError) errors.feriePct = ferieError;

      // Valider Fritvalg
      const applyAlmindeligLoenPaaShDageRegel = af.loenPaaHelligdage === 'Almindelig løn';

      const fritvalgError = validateSats(
        af.overenskomstId,
        'fritvalgPct',
        af.fritvalgPct,
        reguleringsDato,
        applyAlmindeligLoenPaaShDageRegel
      );
      if (fritvalgError) errors.fritvalgPct = fritvalgError;

      // Valider SH/SO-sats
      const shError = validateSats(
        af.overenskomstId,
        'shSoPct',
        af.shSoPct,
        reguleringsDato,
        applyAlmindeligLoenPaaShDageRegel
      );
      if (shError) errors.shSoPct = shError;

      // Valider Store Bededagstillæg
      const storeBededagError = validateStoreBededag(af.loenPaaHelligdage, af.storeBededagPct, reguleringsDato);
      if (storeBededagError) errors.storeBededagPct = storeBededagError;

      // Valider Arbejdsgivers pensionsbidrag
      const pensionError = validateSats(
        af.overenskomstId,
        'pensionPct',
        af.pensionPct,
        reguleringsDato,
        applyAlmindeligLoenPaaShDageRegel
      );
      if (pensionError) errors.pensionPct = pensionError;

      return errors;
    },
    [getReguleringsDatoForAnsaettelsesforhold, validateFeriePct, validateSats, validateStoreBededag, values.beregnesUdFra]
  );

  // Valider alle Ansættelsesforhold ved ændringer i datagrundlaget
  React.useEffect(() => {
    const allErrors: Record<string, SatsErrorState> = {};

    values.loenindkomstAnsaettelsesforhold.forEach((af) => {
      const errors = validateAllSatserForAnsaettelsesforhold(af);
      if (Object.keys(errors).length > 0) {
        allErrors[af.id] = errors;
      }
    });

    setSatsErrors(allErrors);
  }, [values.loenindkomstAnsaettelsesforhold, validateAllSatserForAnsaettelsesforhold]);

  React.useEffect(() => {
    const currentIds = new Set(values.loenindkomstAnsaettelsesforhold.map((af) => af.id));
    for (const id of syncedLoenindkomstErrorIdsRef.current) {
      if (!currentIds.has(id)) {
        setLoenindkomstManuelReguleringInputError(id, false);
      }
    }
    for (const id of currentIds) {
      const hasError = Boolean(aarsloenTableHasErrorsByAfId[id] || manuelReguleringHasErrorsByAfId[id]);
      setLoenindkomstManuelReguleringInputError(id, hasError);
    }
    syncedLoenindkomstErrorIdsRef.current = currentIds;
  }, [
    aarsloenTableHasErrorsByAfId,
    manuelReguleringHasErrorsByAfId,
    setLoenindkomstManuelReguleringInputError,
    values.loenindkomstAnsaettelsesforhold,
  ]);

  const getSaerligFraDatoReguleringLabel = React.useCallback((iso: ISODateString | undefined): string | undefined => {
    if (!iso) return undefined;
    const formatted = formatIsoDateLong(iso);
    return formatted === '' ? undefined : formatted;
  }, []);

  const getLoenudviklingBaseDate = React.useCallback(
    (af: Ansaettelsesforhold) => {
      const iso = af.saerligFraDatoRegulering || stamdataValues?.skadesdato;
      if (!iso) {
        return { display: '', errorMessage: 'Skadesdato er ikke udfyldt' };
      }
      const parsed = parseISODate(iso);
      if (!parsed) {
        return { display: '', errorMessage: 'Skadesdato er ikke udfyldt' };
      }
      return { display: formatDanishDate(parsed), errorMessage: undefined };
    },
    [stamdataValues?.skadesdato]
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
      const raw = sessionStorage.getItem(UI_STORAGE_KEYS.loentrinFinderOverlay);
      if (!raw) return {};
      const parsedJson: unknown = JSON.parse(raw);
      const parsed = loentrinFinderSessionStateSchema.safeParse(parsedJson);
      return parsed.success ? parsed.data : {};
    } catch {
      return {};
    }
  }, []);

  const writeLoentrinFinderSessionState = React.useCallback((nextState: LoentrinFinderSessionState): void => {
    try {
      sessionStorage.setItem(UI_STORAGE_KEYS.loentrinFinderOverlay, JSON.stringify(nextState));
    } catch {
      // Fail-safe: hvis sessionStorage ikke er tilgængelig, behold kun in-memory state.
    }
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
    () => values.loenindkomstAnsaettelsesforhold.find((item) => item.id === loentrinFinderOpenForAfId),
    [loentrinFinderOpenForAfId, values.loenindkomstAnsaettelsesforhold]
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

      // Intentionally hardcoded tab sequence:
      // Ansættelse -> Beløb -> Dato -> Beregn.
      // We force this order because generic focus-trap behavior proved unstable with StyledDropdown popover focus,
      // causing focus leaks to the underlying page. This explicit sequence is deliberate and audited UX behavior.
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
    (id: string, updater: (prev: Ansaettelsesforhold) => Ansaettelsesforhold) => {
      setValues((prev) => {
        const items = prev.loenindkomstAnsaettelsesforhold;
        const index = items.findIndex((item) => item.id === id);
        if (index === -1) return prev;

        const nextItems = [...items];
        const updated = updater(items[index]);
        nextItems[index] = syncManualBaseRowSatser(updated);

        return { ...prev, loenindkomstAnsaettelsesforhold: nextItems };
      });
    },
    [setValues]
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
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, [field]: nextValue }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleToggleChange = React.useCallback(
    (
      id: string,
      field: keyof Pick<
        Ansaettelsesforhold,
        'harOverenskomst' | 'ansatPaaSkadestidspunktet' | 'ansaettelsesforholdOphoert' | 'harAnciennitetstillaegEfterSkadesdatoen'
      >
    ): CommitHandler<boolean> =>
      (event: CommitEvent<boolean>) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, [field]: event.target.value }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleOverenskomstChange = React.useCallback(
    (id: string) =>
      (e: StyledDropdownChangeEvent<string | undefined>) => {
        const nextOverenskomstId = normalizeOptionalFreeText(e.target.value);
        updateAnsaettelsesforhold(id, (prev) => ({
          ...prev,
          overenskomstId: nextOverenskomstId,
          offentligLoenType:
            nextOverenskomstId && isOffentligOverenskomstId(nextOverenskomstId)
              ? (prev.offentligLoenType ?? 'Månedsløn')
              : prev.offentligLoenType,
        }));

        // Revalider alle satser når overenskomst ændres
        const ansaettelsesforhold = values.loenindkomstAnsaettelsesforhold.find((af) => af.id === id);
        if (ansaettelsesforhold) {
          const updatedAf = {
            ...ansaettelsesforhold,
            overenskomstId: nextOverenskomstId,
          };
          setSatsErrorsForAnsaettelsesforhold(id, updatedAf);
        }
      },
    [setSatsErrorsForAnsaettelsesforhold, updateAnsaettelsesforhold, values.loenindkomstAnsaettelsesforhold]
  );

  const handleOffentligLoenTypeChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string | undefined>) => {
        const parsed = offentligLoenTypeEnum.safeParse(event.target.value ?? 'Månedsløn');
        const nextValue: OffentligLoenTypeLabel = parsed.success ? parsed.data : 'Månedsløn';
        updateAnsaettelsesforhold(id, (prev) => ({
          ...prev,
          offentligLoenType: nextValue,
        }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleOffentligLoenTrinCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<number | undefined>) => {
        updateAnsaettelsesforhold(id, (prev) => ({
          ...prev,
          offentligLoenTrin: event.target.value,
        }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleOffentligLoenGruppeCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<number | undefined>) => {
        updateAnsaettelsesforhold(id, (prev) => ({
          ...prev,
          offentligLoenGruppe: event.target.value,
        }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleOffentligLoenEkstraGrundloenCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<Ansaettelsesforhold['offentligLoenEkstraGrundloen']>) => {
        updateAnsaettelsesforhold(id, (prev) => ({
          ...prev,
          offentligLoenEkstraGrundloen: event.target.value,
        }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleSidsteArbejdsdagCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<Ansaettelsesforhold['sidsteArbejdsdag']>) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, sidsteArbejdsdag: event.target.value }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleSaerligFraDatoReguleringCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<Ansaettelsesforhold['saerligFraDatoRegulering']>) => {
        const nextSaerligFraDatoRegulering = event.target.value;
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, saerligFraDatoRegulering: nextSaerligFraDatoRegulering }));

        const ansaettelsesforhold = values.loenindkomstAnsaettelsesforhold.find((af) => af.id === id);
        if (!ansaettelsesforhold) return;

        const updatedAf = { ...ansaettelsesforhold, saerligFraDatoRegulering: nextSaerligFraDatoRegulering };
        setSatsErrorsForAnsaettelsesforhold(id, updatedAf);
      },
    [setSatsErrorsForAnsaettelsesforhold, updateAnsaettelsesforhold, values.loenindkomstAnsaettelsesforhold]
  );

  const handleAnciennitetstillaegDatoCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<Ansaettelsesforhold['anciennitetstillaegDato']>) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, anciennitetstillaegDato: event.target.value }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleAnciennitetstillaegSatsAngivesPerChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string>) => {
        const parsed = anciennitetSatsPerEnum.safeParse(event.target.value);
        if (!parsed.success) return;
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, anciennitetstillaegSatsAngivesPer: parsed.data }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleAnciennitetstillaegSatsCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<Ansaettelsesforhold['anciennitetstillaegSats']>) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, anciennitetstillaegSats: event.target.value }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleFeriePctCommit = React.useCallback(
    (id: string) =>
      (event: CommitEvent<number | undefined>) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, feriePct: event.target.value }));

        const ansaettelsesforhold = values.loenindkomstAnsaettelsesforhold.find((af) => af.id === id);
        if (!ansaettelsesforhold) return;

        const kræverFeriePct = values.beregnesUdFra === 'Beregningsperiode'
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
    [updateAnsaettelsesforhold, validateFeriePct, values.beregnesUdFra, values.loenindkomstAnsaettelsesforhold]
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
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, [field]: event.target.value }));

        // Valider værdien
        const ansaettelsesforhold = values.loenindkomstAnsaettelsesforhold.find(af => af.id === id);
        if (!ansaettelsesforhold) return;

        const reguleringsDato = getReguleringsDatoForAnsaettelsesforhold(ansaettelsesforhold);

        // Brug specifik validering for Store Bededag
        let errorMsg: string | undefined;
        if (field === 'storeBededagPct') {
          errorMsg = validateStoreBededag(ansaettelsesforhold.loenPaaHelligdage, event.target.value, reguleringsDato);
        } else {
          const applyAlmindeligLoenPaaShDageRegel = ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn';
          errorMsg = validateSats(
            ansaettelsesforhold.overenskomstId,
            field,
            event.target.value,
            reguleringsDato,
            applyAlmindeligLoenPaaShDageRegel
          );
        }

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
    [getReguleringsDatoForAnsaettelsesforhold, updateAnsaettelsesforhold, values.loenindkomstAnsaettelsesforhold, validateSats, validateStoreBededag]
  );

  const handleLoenperiodeChange = React.useCallback(
    (id: string) =>
      (_event: React.ChangeEvent<HTMLInputElement>, value: string) => {
        if (!isLoenperiodeValue(value)) return;
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenperiode: value }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleFuldLoenUnderFerieChange = React.useCallback(
    (id: string): CommitHandler<boolean> =>
      (event: CommitEvent<boolean>) => {
        const nextValue: Ansaettelsesforhold['fuldLoenUnderFerie'] = event.target.value ? 'Ja' : 'Nej';
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, fuldLoenUnderFerie: nextValue }));

        const ansaettelsesforhold = values.loenindkomstAnsaettelsesforhold.find((af) => af.id === id);
        if (!ansaettelsesforhold) return;

        const kræverFeriePct = values.beregnesUdFra === 'Beregningsperiode'
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
    [updateAnsaettelsesforhold, validateFeriePct, values.beregnesUdFra, values.loenindkomstAnsaettelsesforhold]
  );

  const handleLoenPaaHelligdageChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string>) => {
        const parsed = loenPaaHelligdageSchema.safeParse(event.target.value);
        if (!parsed.success) return;
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenPaaHelligdage: parsed.data }));

        // Revalider alle satser når "Løn på helligdage" ændres.
        const ansaettelsesforhold = values.loenindkomstAnsaettelsesforhold.find((af) => af.id === id);
        if (!ansaettelsesforhold) return;

        const updatedAf = { ...ansaettelsesforhold, loenPaaHelligdage: parsed.data };
        setSatsErrorsForAnsaettelsesforhold(id, updatedAf);
      },
    [setSatsErrorsForAnsaettelsesforhold, updateAnsaettelsesforhold, values.loenindkomstAnsaettelsesforhold]
  );

  const handleTableDataChange = React.useCallback(
    (id: string) =>
      (newTableData: Ansaettelsesforhold['indtaegtsoplysningerTableData']) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, indtaegtsoplysningerTableData: newTableData }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleAarsloenValidationChange = React.useCallback(
    (id: string) => (summary: AarsloenTableValidationSummary) => {
      setAarsloenTableHasErrorsByAfId((prev) => {
        const hasError = summary.hasErrors;
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
          // Når grundlag cleares, nulstil også alle tilknyttede felter
          updateAnsaettelsesforhold(id, (prev) => ({
            ...prev,
            loenudviklingBeregningsgrundlag: undefined,
            loenudviklingStatistikModel: undefined,
            loenudviklingKRLSatstabel: undefined,
            loenudviklingManuelNavn: '',
            loenudviklingManuelTableData: [],
          }));
          return;
        }
        const parsed = loenudviklingBeregningsgrundlagEnum.safeParse(raw);
        if (!parsed.success) return;

        // Nulstil fejl-state for manuelt angivet hvis nødvendigt
        if (parsed.data !== 'Manuelt angivet') {
          setManuelReguleringHasErrorsByAfId((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }

        // Centraliseret state-oprydning: nulstil alle felter der ikke er relevante for det nye grundlag
        updateAnsaettelsesforhold(id, (prev) => {
          const updates: Partial<Ansaettelsesforhold> = {
            loenudviklingBeregningsgrundlag: parsed.data,
          };

          // Nulstil felter der kun hører til andre grundlag
          if (parsed.data !== 'Statistik') {
            updates.loenudviklingStatistikModel = undefined;
          }
          if (parsed.data !== 'KRL satstabel') {
            updates.loenudviklingKRLSatstabel = undefined;
          }
          if (parsed.data !== 'Manuelt angivet') {
            updates.loenudviklingManuelNavn = '';
            updates.loenudviklingManuelTableData = [];
          }

          return { ...prev, ...updates };
        });
      },
    [updateAnsaettelsesforhold]
  );

  const handleLoenudviklingStatistikModelChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string | undefined>) => {
        const raw = event.target.value;
        if (!raw) {
          updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenudviklingStatistikModel: undefined }));
          return;
        }
        const parsed = loenudviklingStatistikModelEnum.safeParse(raw);
        if (!parsed.success) return;
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenudviklingStatistikModel: parsed.data }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleLoenudviklingKRLSatstabelChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string | undefined>) => {
        const raw = event.target.value;
        if (!raw) {
          updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenudviklingKRLSatstabel: undefined }));
          return;
        }
        const parsed = krlSatstabelEnum.safeParse(raw);
        if (!parsed.success) return;
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenudviklingKRLSatstabel: parsed.data }));
      },
    [updateAnsaettelsesforhold]
  );

  const handleLoenudviklingManuelTableChange = React.useCallback(
    (id: string) =>
      (newTableData: Ansaettelsesforhold['loenudviklingManuelTableData']) => {
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, loenudviklingManuelTableData: newTableData }));
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

  const [addTargetId, setAddTargetId] = React.useState<string | null>(null);
  const addTargetName = React.useMemo(() => {
    if (!addTargetId) return '';
    const target = values.loenindkomstAnsaettelsesforhold.find((af) => af.id === addTargetId);
    return target?.navnPaaArbejdssted?.trim() ?? '';
  }, [addTargetId, values.loenindkomstAnsaettelsesforhold]);

  const handleAddConfirm = React.useCallback(() => {
    if (!addTargetId) return;
    // Nyt ansættelsesforhold oprettes med overenskomstFilter fra settings (via createBlankAnsaettelsesforhold)
    const newAf = createBlankAnsaettelsesforhold(settings);

    setValues((prev) => {
      const items = prev.loenindkomstAnsaettelsesforhold;
      const index = items.findIndex((af) => af.id === addTargetId);
      if (index === -1) return prev;

      // Indsæt nyt Ansættelsesforhold lige efter det nuværende
      const nextItems = [
        ...items.slice(0, index + 1),
        newAf,
        ...items.slice(index + 1),
      ];

      return { ...prev, loenindkomstAnsaettelsesforhold: nextItems };
    });

    setAddDialogOpen(false);
    setAddTargetId(null);
  }, [addTargetId, setValues, settings]);

  const handleDeleteConfirm = React.useCallback(() => {
    if (!deleteTargetId) return;
    try {
      setAarsloenTableHasErrorsByAfId((prev) => {
        const next = { ...prev };
        delete next[deleteTargetId];
        return next;
      });
      setManuelReguleringHasErrorsByAfId((prev) => {
        const next = { ...prev };
        delete next[deleteTargetId];
        return next;
      });
      setValues((prev) => ({
        ...prev,
        loenindkomstAnsaettelsesforhold: prev.loenindkomstAnsaettelsesforhold.filter(
          (af) => af.id !== deleteTargetId
        ),
      }));
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, setValues]);

  const handleMoveUp = React.useCallback((afId: string) => {
    setValues((prev) => {
      const items = prev.loenindkomstAnsaettelsesforhold;
      const index = items.findIndex((af) => af.id === afId);
      if (index <= 0) return prev;
      const nextItems = [...items];
      [nextItems[index - 1], nextItems[index]] = [nextItems[index], nextItems[index - 1]];
      return { ...prev, loenindkomstAnsaettelsesforhold: nextItems };
    });
    setScrollTargetId(afId);
  }, [setValues]);

  const handleMoveDown = React.useCallback((afId: string) => {
    setValues((prev) => {
      const items = prev.loenindkomstAnsaettelsesforhold;
      const index = items.findIndex((af) => af.id === afId);
      if (index === -1 || index >= items.length - 1) return prev;
      const nextItems = [...items];
      [nextItems[index], nextItems[index + 1]] = [nextItems[index + 1], nextItems[index]];
      return { ...prev, loenindkomstAnsaettelsesforhold: nextItems };
    });
    setScrollTargetId(afId);
  }, [setValues]);

  React.useEffect(() => {
    if (!scrollTargetId) return;
    const id = scrollTargetId;
    const handle = window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-mineo-row-id="${id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setScrollTargetId(null);
    });
    return () => window.cancelAnimationFrame(handle);
  }, [scrollTargetId, values.loenindkomstAnsaettelsesforhold]);

  const handleDownloadReguleringPdf = React.useCallback(
    async (input: ReguleringPdfInput) => {
      await downloadReguleringPdf({
        input,
        settings,
        persistedStamdata: getPersistedData('stamdata'),
      });
    },
    [getPersistedData, settings]
  );

  const handleDownloadKRLPdf = React.useCallback(
    async () => {
      await downloadKrlPdf({
        settings,
        persistedStamdata: getPersistedData('stamdata'),
      });
    },
    [getPersistedData, settings]
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
      }));
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

  const totalAnsaettelsesforhold = values.loenindkomstAnsaettelsesforhold.length;
  const cannotAddMore = totalAnsaettelsesforhold >= MAX_ANSAETTELSESFORHOLD;
  const showDeleteButton = totalAnsaettelsesforhold > 1;

  return (
    <Box data-section-id="loenindkomst">
      {values.loenindkomstAnsaettelsesforhold.map((af, index) => {
        const showOverenskomst = af.harOverenskomst;
        const showMedlemOpsagt = af.ansatPaaSkadestidspunktet;
        const showSidsteArbejdsdag = showMedlemOpsagt && af.ansaettelsesforholdOphoert;
        const isFirstAnsaettelsesforhold = index === 0;
        const isLastAnsaettelsesforhold = index === totalAnsaettelsesforhold - 1;
        const displayNumber = index + 1;
        const saerligFraDatoReguleringLabel = getSaerligFraDatoReguleringLabel(af.saerligFraDatoRegulering);
        const satserHeading = af.ansatPaaSkadestidspunktet
          ? saerligFraDatoReguleringLabel
            ? `Satser per ${saerligFraDatoReguleringLabel}`
            : 'Satser på skadestidspunktet'
          : 'Satser';
        const loenudviklingBasis = af.loenudviklingBeregningsgrundlag;
        const erOffentligOverenskomst = Boolean(
          af.overenskomstId && isOffentligOverenskomstId(af.overenskomstId)
        );
        const loenudviklingBaseDate = getLoenudviklingBaseDate(af);
        const anciennitetSatsPerTekst = af.anciennitetstillaegSatsAngivesPer === 'Time' ? 'time' : 'måned';
        const showAnciennitetstillaegSection = values.beregnesUdFra === 'Beregningsperiode'
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

        const baseHeaderText = isFirstAnsaettelsesforhold
          ? 'Ansættelsesforhold'
          : `Ansættelsesforhold ${displayNumber}`;

        const headerText = af.navnPaaArbejdssted
          ? `${baseHeaderText} (${af.navnPaaArbejdssted})`
          : baseHeaderText;

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
                  <StyledDateField value={af.sidsteArbejdsdag} onCommit={handleSidsteArbejdsdagCommit(af.id)} />
                </Box>
              </Box>
            </Box>

            <Typography className="row--subheading">Lønforhold</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Overenskomst</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch checked={af.harOverenskomst} onCommit={handleToggleChange(af.id, 'harOverenskomst')} />
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
                  checked={getCheckedJaNej(af.fuldLoenUnderFerie)}
                  onCommit={handleFuldLoenUnderFerieChange(af.id)}
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Løn på helligdage:</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDropdown
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

            <Box className="row--label-right-hover">
              <Typography className="row--text">Evt. særlig fra-dato for regulering</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  value={af.saerligFraDatoRegulering}
                  onCommit={handleSaerligFraDatoReguleringCommit(af.id)}
                />
              </Box>
            </Box>

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
                    value={af.fritvalgPct}
                    onCommit={handleValidatedSatsCommit(af.id, 'fritvalgPct')}
                    placeholder="0 %"
                    useDefaultPercentRange
                    error={Boolean(satsErrors[af.id]?.fritvalgPct)}
                    helperText={satsErrors[af.id]?.fritvalgPct}
                    sx={{ width: '100px' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '140px' }}>
                    SH/SO-sats:
                  </Typography>
                  <StyledPercentField
                    value={af.shSoPct}
                    onCommit={handleValidatedSatsCommit(af.id, 'shSoPct')}
                    placeholder="0 %"
                    useDefaultPercentRange
                    error={Boolean(satsErrors[af.id]?.shSoPct)}
                    helperText={satsErrors[af.id]?.shSoPct}
                    sx={{ width: '100px' }}
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
                    onCommit={handleValidatedSatsCommit(af.id, 'storeBededagPct')}
                    placeholder="0 %"
                    useDefaultPercentRange
                    error={Boolean(satsErrors[af.id]?.storeBededagPct)}
                    helperText={satsErrors[af.id]?.storeBededagPct}
                    sx={{ width: '100px' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '190px' }}>
                    Arbejdsgivers pensionsbidrag:
                  </Typography>
                  <StyledPercentField
                    value={af.pensionPct}
                    onCommit={handleValidatedSatsCommit(af.id, 'pensionPct')}
                    placeholder="0 %"
                    useDefaultPercentRange
                    error={Boolean(satsErrors[af.id]?.pensionPct)}
                    helperText={satsErrors[af.id]?.pensionPct}
                    sx={{ width: '100px' }}
                  />
                </Box>
              </Box>
            </Box>

            <Typography className="row--subheading">Indtægtsoplysninger</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Løn indtastes som:</Typography>
              <Box className="row--label-right-hover__content">
                <StyledRadioButton
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

            <AarsloenTable
              loenperiode={af.loenperiode}
              satser={{
                ferie: af.feriePct,
                fritvalg: af.fritvalgPct,
                shSo: af.shSoPct,
                bededag: af.storeBededagPct,
                pension: af.pensionPct,
              } satisfies AarsloenTableSatser}
              tableData={af.indtaegtsoplysningerTableData}
              onTableDataChange={handleTableDataChange(af.id)}
              onValidationChange={handleAarsloenValidationChange(af.id)}
              externalCellErrorMessagesByCellKey={aarsloenExternalCellErrorMessagesByAfId[af.id] ?? {}}
              useSmallFont={true}
            />

            {values.beregnesUdFra === 'Beregningsperiode' ? (
              <>
            <Typography className="row--subheading">Lønudvikling</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Lønudvikling beregnes ud fra</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDropdown
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
                        value={af.offentligLoenTrin}
                        onCommit={handleOffentligLoenTrinCommit(af.id)}
                        minValue={1}
                        maxValue={55}
                        maxDigits={2}
                        width={80}
                      />
                      <Typography className="row--text">Gruppe</Typography>
                      <StyledIntegerField
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
                              backgroundColor: '#e3f2fd',
                            },
                            '&:active': {
                              backgroundColor: '#bbdefb',
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
                  const baseDateTooltipText =
                    af.saerligFraDatoRegulering === undefined &&
                    stamdataValues?.skadesdato !== undefined &&
                    loenudviklingBaseDate.display !== ''
                      ? (stamdataValues.skadestype === 'Erhvervssygdom' ? 'Anmeldedato' : 'Skadesdato')
                      : undefined;
                  return (
                    <>
                      <Box className="row--label-right-hover">
                        <Typography className="row--text">Navn på reguleringsform</Typography>
                        <Box className="row--label-right-hover__content">
                          <StyledTextField
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
                                    backgroundColor: '#e3f2fd',
                                  },
                                  '&:active': {
                                    backgroundColor: '#bbdefb',
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
                  <Typography className="row--text">Ville skadelidte have opnået anciennitetstillæg efter skadesdatoen</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledToggleSwitch
                      checked={af.harAnciennitetstillaegEfterSkadesdatoen}
                      onCommit={handleToggleChange(af.id, 'harAnciennitetstillaegEfterSkadesdatoen')}
                    />
                  </Box>
                </Box>

                {af.harAnciennitetstillaegEfterSkadesdatoen ? (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Dato for opnået anciennitetstillæg</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledDateField
                          value={af.anciennitetstillaegDato}
                          minDate={stamdataValues?.skadesdato}
                          specialRangeErrors={{
                            minBoundKind: stamdataValues?.skadesdato ? 'skadesdato' : undefined,
                            minBoundReferenceISO: stamdataValues?.skadesdato,
                          }}
                          onCommit={handleAnciennitetstillaegDatoCommit(af.id)}
                        />
                      </Box>
                    </Box>

                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Satsen angives per</Typography>
                      <Box className="row--label-right-hover__content">
                        <StyledDropdown
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

            {/* Handlingsknapper – flex-container der fylder ud fra højre */}
            <Box sx={{ position: 'absolute', bottom: -28, right: 44, display: 'flex', gap: '14px' }}>
              {/* Flyt op (kun synlig hvis >1 Ansættelsesforhold og ikke det første) */}
              {totalAnsaettelsesforhold > 1 && !isFirstAnsaettelsesforhold && (
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

              {/* Tilføj (vises på alle Ansættelsesforhold) */}
              <FloatingActionButton
                icon={<AddIcon />}
                color="primary"
                disabled={cannotAddMore}
                tooltip={cannotAddMore ? 'Maksimalt 10 ansættelsesforhold' : 'Tilføj nyt ansættelsesforhold'}
                shake={cannotAddMore}
                onClick={() => {
                  setAddTargetId(af.id);
                  setAddDialogOpen(true);
                }}
              />
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
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
              backgroundColor: 'white',
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
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
                borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
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
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
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
                    onFieldError={(errorMsg) => setLoentrinFinderAmountFieldError(errorMsg)}
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
                    onFieldError={(errorMsg) => setLoentrinFinderDateFieldError(errorMsg)}
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
                          backgroundColor: 'rgba(25, 118, 210, 0.04)',
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
            {addTargetName !== ''
              ? `Dette vil indsætte et nyt ansættelsesforhold lige efter det nuværende (${addTargetName}).`
              : 'Dette vil indsætte et nyt ansættelsesforhold lige efter det nuværende.'}
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
          setAddTargetId(null);
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
