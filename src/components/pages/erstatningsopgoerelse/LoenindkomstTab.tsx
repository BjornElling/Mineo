import React from 'react';
import { Box, IconButton, MenuItem, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import Download from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import StyledTextField from '../../inputs/StyledTextField';
import StyledDateField from '../../inputs/StyledDateField';
import StyledDropdown, { type StyledDropdownChangeEvent } from '../../inputs/StyledDropdown';
import StyledAmountField from '../../inputs/StyledAmountField';
import StyledPercentField from '../../inputs/StyledPercentField';
import StyledRadioButton from '../../inputs/StyledRadioButton';
import StyledToggleSwitch from '../../inputs/StyledToggleSwitch';
import StyledIntegerField from '../../inputs/StyledIntegerField';
import type { CommitEvent, CommitHandler } from '../../../types/fieldEvents';
import StandardLoenTable, { type StandardLoenTableSatser } from '../../tables/StandardLoenTable';
import LoenudviklingManuelTable from '../../tables/LoenudviklingManuelTable';
import { CellInvalidDraftScopeProvider } from '../../../contexts/CellInvalidDraftScopeContext';
import { CELL_TABLE_IDS } from '../../../config/cellInvalidDraftScopes';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ContentBox from '../../layout/ContentBox';
import {
  loenPaaHelligdageEnum,
  tillaegAngivesSomEnum,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  krlSatstabelEnum,
  anciennitetSatsPerEnum,
  offentligLoenTypeEnum,
  type OffentligLoenTypeLabel,
  type ErstatningsopgoerelseValues,
} from '../../../schemas/formSchemas';
import { DAY_COUNT_MAX } from '../../../schemas/formSchemas/baseSchemas';
import { LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import type { ISODateString } from '../../../types/branded';
import { parseISODate } from '../../../types/branded';
import { formatDanishDate } from '../../../utils/dateUtils';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { isLoenperiodeValue } from '../../../utils/zodTypeGuards';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { scrollTargetIntoView } from '../../../utils/scrollTargetIntoView';
import type { StandardLoenTableValidationSummary } from '../../../types/table';
import {
  getAlleLoenmodtagerOrg,
  getAlleArbejdsgiverOrg,
  getOverenskomsterByOrg,
  getOverenskomstMetaById,
  getOverenskomstSfggPolicy,
  getReguleringsDatoIntervalForOverenskomst,
  isOffentligOverenskomstId,
} from '../../../data/overenskomstRates';
import { toLoentrin } from '../../../data/offentligLoenTypes';
import {
  ASL_AARSLOENSMAKSIMUM_MODEL_LABEL,
  getReguleringsDatoIntervalForStatistikModel,
} from '../../../data/statistiskeRates';
import { getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../../data/krlRates';
import { getPersistedSectionSnapshot, usePersistedSectionSelector } from '../../../hooks/useFormPersistenceSelectors';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { downloadKrlDokument, downloadReguleringDokument, type ReguleringDocumentInput } from '../../../document/service/documentService';
import { formatAsAmount } from '../../../utils/formatUtils';
import { hasIndtastetLoenoplysninger } from '../../../domain/erstatningsopgoerelse/helpers/loenoplysningerInput';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  applyAnsaettelsesforholdToggleCleanup,
  applyLoenudviklingBeregningsgrundlagChange,
} from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstStateCleanup';
import {
  applyAutoSatsFields,
  isOverenskomstSatsFieldLocked,
  resolveOverenskomstSatsBindings,
  syncManualBaseRowSatser,
} from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { getAngivetLoenOpreguleresFraDato } from '../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import {
  normalizeOptionalFreeText,
  resolveAnvendtReguleringsdato,
} from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import {
  hasSfggSelectedOverenskomst,
  resolveSfggSource,
  resolveSfggReferenceperiodeDayCount,
  resolveSfggReferenceperiodeMaxDate,
} from '../../../domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelse';
import { shouldRequireSygeferiegodtgoerelseInput } from '../../../domain/erstatningsopgoerelse/helpers/sygeferiegodtgoerelseEligibility';
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
import { useLoentrinFinder } from './loenindkomst/useLoentrinFinder';
import LoentrinFinderOverlay from './shared/LoentrinFinderOverlay';
import SygeferiegodtgoerelseSection from './loenindkomst/SygeferiegodtgoerelseSection';

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
  /** Id'er på ansættelsesforhold hvor SFGG løber >6 mdr. efter sidste indkomst.
   *  Beregnet i EO-snapshot (committed-state); tom liste når snapshot.data er null. */
  sfggSixMonthWarningEmploymentIds: readonly string[];
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

const LOCKED_SATS_FIELD_SX = { width: '100px' } as const;

type SatsErrorState = {
  feriePct?: string;
  fritvalgPct?: string;
  shSoPct?: string;
  storeBededagPct?: string;
  pensionPct?: string;
};

type OverenskomstSatsField = 'fritvalgPct' | 'shSoPct' | 'pensionPct';

type ReguleringsDatoInterval = Readonly<{ fraDato: string; tilDato: string }>;

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
  sfggSixMonthWarningEmploymentIds,
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
  const loentrinFinder = useLoentrinFinder(loenindkomstAnsaettelsesforhold);
  const { openLoentrinFinder } = loentrinFinder;
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
      // Beløb-tilstand bruger ikke satserne; ingen sats-validering (og dermed ingen blokerende fejl).
      if (af.tillaegAngivesSom === TILLAEG_ANGIVES_SOM.BELOEB) return errors;
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
        return { display: '', iso: undefined, errorMessage: 'Skadedato er ikke udfyldt' };
      }
      const parsed = parseISODate(iso);
      if (!parsed) {
        return { display: '', iso: undefined, errorMessage: 'Skadedato er ikke udfyldt' };
      }
      return { display: formatDanishDate(parsed), iso, errorMessage: undefined };
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

  const handleTillaegAngivesSomChange = React.useCallback(
    (id: string) =>
      (event: StyledDropdownChangeEvent<string>) => {
        const parsed = tillaegAngivesSomEnum.safeParse(event.target.value);
        if (!parsed.success) return;
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, tillaegAngivesSom: parsed.data }), { fieldPath: `${id}:tillaegAngivesSom` });
        // Beløb-tilstand bruger ikke satserne; ryd evt. sats-fejl, så stale røde kanter ikke bliver
        // hængende. Skifter man tilbage til Procent, revalideres satserne.
        if (parsed.data === 'beloeb') {
          setSatsErrors((prev) => {
            if (!prev[id]) return prev;
            const { [id]: _removed, ...rest } = prev;
            return rest;
          });
        } else {
          const ansaettelsesforhold = loenindkomstAnsaettelsesforhold.find((af) => af.id === id);
          if (ansaettelsesforhold) setSatsErrorsForAnsaettelsesforhold(id, ansaettelsesforhold);
        }
      },
    [updateAnsaettelsesforhold, loenindkomstAnsaettelsesforhold, setSatsErrorsForAnsaettelsesforhold]
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
    const newAf = createDefaultLoenindkomstAnsaettelsesforhold(settings);
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
    async (input: ReguleringDocumentInput) => {
      await downloadReguleringDokument({
        input,
        settings,
        persistedStamdata: getPersistedSectionSnapshot('stamdata'),
      });
    },
    [settings]
  );

  const handleDownloadKRLPdf = React.useCallback(
    async () => {
      await downloadKrlDokument({
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
        const showSygeferiegodtgoerelseSection = shouldRequireSygeferiegodtgoerelseInput(eoValues, af);
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
        const showSfggSixMonthWarning = sfggSixMonthWarningEmploymentIds.includes(af.id);

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

            <Box className="row--label-right-hover">
              <Typography className="row--text">Tillæg angives som</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDropdown
                  name={`${af.id}:tillaegAngivesSom`}
                  width={185}
                  value={af.tillaegAngivesSom}
                  onChange={handleTillaegAngivesSomChange(af.id)}
                  allowEmpty={false}
                >
                  <MenuItem value={TILLAEG_ANGIVES_SOM.PROCENT}>Procent</MenuItem>
                  <MenuItem value={TILLAEG_ANGIVES_SOM.BELOEB}>Beløb</MenuItem>
                </StyledDropdown>
              </Box>
            </Box>

            {af.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB && (
              <>
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
                    placeholder="0"
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
                    placeholder="0"
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
                    placeholder="0"
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
                    name={`${af.id}:storeBededagPct`}
                    value={af.storeBededagPct}
                    onCommit={undefined}
                    placeholder="0"
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
                    placeholder="0"
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
              </>
            )}

            <Typography className="row--subheading">Indtægtsoplysninger</Typography>

            <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoStandardLoen} rowScope={af.id}>
            <StandardLoenTable
              loenperiode={af.loenperiode}
              tillaegAngivesSom={af.tillaegAngivesSom}
              satser={satserByAfId.get(af.id)!}
              tableData={af.indtaegtsoplysningerTableData}
              onTableDataChange={tableDataChangeByAfId.get(af.id)}
              onValidationChange={validationChangeByAfId.get(af.id)}
              externalCellErrorMessagesByCellKey={aarsloenExternalCellErrorMessagesByAfId[af.id] ?? EMPTY_CELL_ERROR_MESSAGES}
              useSmallFont={true}
              saveOrderPath={`erstatningsopgoerelse.ansaettelsesforhold.${index}.indtaegtsoplysningerTableData`}
              calculateDerivedRow={derivedCalculatorByAfId.get(af.id)}
            />
            </CellInvalidDraftScopeProvider>

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
                  {/* 'Manuelt angivet' bygger på tillægsprocenter pr. dato og giver ikke mening i
                      Beløb-tilstand; valget skjules der. Tidligere indtastede manuelle rækker bevares. */}
                  {af.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB && (
                    <MenuItem value="Manuelt angivet">Manuelt angivet</MenuItem>
                  )}
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

            {loenudviklingBasis === 'Manuelt angivet' && af.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB ? (
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
                      <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoLoenudvikling} rowScope={af.id}>
                      <LoenudviklingManuelTable
                        tableData={af.loenudviklingManuelTableData}
                        onTableDataChange={handleLoenudviklingManuelTableChange(af.id)}
                        onInputErrorChange={handleManuelReguleringInputErrorChange(af.id)}
                        baseDateDisplay={loenudviklingBaseDate.display}
                        baseDateISO={loenudviklingBaseDate.iso}
                        baseDateErrorMessage={loenudviklingBaseDate.display === '' ? loenudviklingBaseDate.errorMessage : undefined}
                        baseDateInfoTooltipText={baseDateTooltipText}
                        baseRowPercentErrors={manualBaseRowErrorsByAfId[af.id]}
                        readOnlyBaseRowPercentFields={true}
                        useSmallFont={true}
                      />
                      </CellInvalidDraftScopeProvider>
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

            <SygeferiegodtgoerelseSection
              show={showSygeferiegodtgoerelseSection}
              af={af}
              sfggRow={sfggRow}
              sfggPolicy={sfggPolicy}
              showSharedSfggBefore2015={showSharedSfggBefore2015}
              showSfggSixMonthWarning={showSfggSixMonthWarning}
              sfggSelectedOverenskomstLabel={sfggSelectedOverenskomstLabel}
              canShowSfggOverenskomstDetails={canShowSfggOverenskomstDetails}
              requiresReferenceperiode={requiresReferenceperiode}
              showSatsvalg={showSatsvalg}
              referenceperiodeErrorText={referenceperiodeErrorText}
              firstTafFraDato={firstTafFraDato}
              sfggReferenceperiodeMaxDate={sfggReferenceperiodeMaxDate}
              sfggReferenceperiodeFravaersdageMax={sfggReferenceperiodeFravaersdageMax}
              onNavigateToTabtArbejdsfortjeneste={onNavigateToTabtArbejdsfortjeneste}
              updateSfggAnsaettelsesforhold={updateSfggAnsaettelsesforhold}
            />

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

      <LoentrinFinderOverlay
        open={loentrinFinder.loentrinFinderOpenForAfId !== null}
        ansaettelse={loentrinFinder.loentrinFinderAnsaettelse}
        setAnsaettelse={loentrinFinder.setLoentrinFinderAnsaettelse}
        beloeb={loentrinFinder.loentrinFinderBeloeb}
        setBeloeb={loentrinFinder.setLoentrinFinderBeloeb}
        dato={loentrinFinder.loentrinFinderDato}
        setDato={loentrinFinder.setLoentrinFinderDato}
        errors={loentrinFinder.loentrinFinderErrors}
        setErrors={loentrinFinder.setLoentrinFinderErrors}
        onAmountFieldError={loentrinFinder.handleLoentrinFinderAmountFieldError}
        onDateFieldError={loentrinFinder.handleLoentrinFinderDateFieldError}
        results={loentrinFinder.loentrinFinderResults}
        buttonShake={loentrinFinder.loentrinFinderButtonShake}
        dialogRef={loentrinFinder.loentrinFinderDialogRef}
        loentrinFinderAnsaettelseRef={loentrinFinder.loentrinFinderAnsaettelseRef}
        loentrinFinderBeloebRef={loentrinFinder.loentrinFinderBeloebRef}
        loentrinFinderDatoRef={loentrinFinder.loentrinFinderDatoRef}
        beregnRef={loentrinFinder.loentrinFinderBeregnRef}
        headingId={loentrinFinder.loentrinFinderHeadingId}
        overenskomstLabel={loentrinFinder.loentrinFinderOverenskomstLabel}
        inputAmountNumber={loentrinFinder.loentrinFinderInputAmountNumber}
        onClose={loentrinFinder.closeLoentrinFinder}
        onCalculate={loentrinFinder.handleLoentrinFinderCalculate}
      />

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
              ? `Dette vil slette alle oplysninger i ansættelsesforholdet (${deleteTargetName}). Handlingen kan fortrydes.`
              : 'Dette vil slette alle oplysninger i dette ansættelsesforhold. Handlingen kan fortrydes.'}
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
