import React from 'react';
import {
  Box,
  Typography,
  MenuItem,
} from '@mui/material';
import Download from '@mui/icons-material/Download';
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
import SvieSmerteTable from '../../tables/SvieSmerteTable';
import TAFPeriodeTable from '../../tables/TAFPeriodeTable';
import FerieperiodeTable from '../../tables/FerieperiodeTable';
import BeregningsperiodeFerieTable from '../../tables/BeregningsperiodeFerieTable';
import OevrigeKravTable from '../../tables/OevrigeKravTable';
import LoenudviklingManuelTable from '../../tables/LoenudviklingManuelTable';
import useSvieSmerteRows from '../../tables/useSvieSmerteRows';
import useTafRows from '../../tables/useTafRows';
import useFerieRows from '../../tables/useFerieRows';
import useFravaerRows from '../../tables/useFravaerRows';
import useOevrigeKravRows from '../../tables/useOevrigeKravRows';
import type { CommitEvent, CommitHandler } from '../../inputs/fieldEvents';
import type { UsePersistedFormReturn } from '../../../hooks/usePersistedForm';
import { MAX_YEAR, MIN_YEAR, computeSkadesdatoMinRule, dateRanges_erstatningsopgoerelse } from '../../../config/dateRanges';
import { useFormFieldErrorReporter } from '../../../hooks/useFormFieldErrors';
import { useFormPersistence } from '../../../contexts/FormPersistenceContext';
import {
  type ErstatningsopgoerelseValues,
  type EOAngivetLoenLoenudvikling,
  arbejdsstatusEnum,
  afsluttesMedEnum,
  beregningsmetodeEnum,
  helbredsstatusEnum,
  krlSatstabelEnum,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  offentligLoenTypeEnum,
} from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../types/branded';
import { coerceToISODateString, parseISODate } from '../../../types/branded';
import { isoDateToDate } from '../../../domain/dates/isoDate';
import { calculateFerieHverdageMinusSHDage } from '../../../domain/erstatningsopgoerelse/ferieCalculations';
import { EO_ANGIVET_LOEN_ID } from '../../../domain/erstatningsopgoerelse/angivetLoenHelpers';
import { buildBeregningsperiodeTafOverlap, buildTafDerived } from '../../../domain/erstatningsopgoerelse/tafEngine';
import { erDetteFoersteErstatningsopgoerelse } from '../../../domain/erstatningsopgoerelse/eoNummerValidering';
import { MONTH_NAMES_DA } from '../../../utils/dateFormatting';
import { formatDanishDate } from '../../../utils/dateUtils';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import {
  getAlleArbejdsgiverOrg,
  getAlleLoenmodtagerOrg,
  getOverenskomsterByOrg,
  getOverenskomstMetaById,
  getReguleringsDatoIntervalForOverenskomst,
  isOffentligOverenskomstId,
} from '../../../data/overenskomstRates';
import { getReguleringsDatoIntervalForStatistikModel } from '../../../data/statistiskLoenudviklingRates';
import { getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../../data/KRLrates';
import { loadKRLPdfModule, loadReguleringPdfModule } from '../../../utils/pdf/pdfLoader';
import { getVisBrevhoved } from '../../../utils/pdf/pdfBrevhoved';
import { useAppSettings } from '../../../contexts/AppSettingsContext';

type JaNej = 'Ja' | 'Nej';

type ValueChangeEvent<T> = { target: { value: T } };

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

const normalizeOptionalFreeText = (value: string | undefined): string | undefined => {
  const asString = typeof value === 'string' ? value : '';
  const trimmed = asString.trim();
  return trimmed === '' ? undefined : trimmed;
};

const hasNonEmptyDateValue = (value: ISODateString | string | undefined | null): boolean => {
  if (value === undefined || value === null) return false;
  return String(value).trim() !== '';
};

/**
 * Henter skadesdato fra persisted stamdata (via FormPersistenceContext).
 * Ingen direkte sessionStorage-læsning i UI-laget.
 */
const useSkadesdatoFromStamdata = (): ISODateString | undefined => {
  const { getPersistedData } = useFormPersistence();
  return getPersistedData('stamdata')?.skadesdato;
};

/**
 * Henter skadestype fra persisted stamdata (via FormPersistenceContext).
 */
const useSkadestypeFromStamdata = (): '' | 'Arbejdsulykke' | 'Erhvervssygdom' => {
  const { getPersistedData } = useFormPersistence();
  return getPersistedData('stamdata')?.skadestype ?? '';
};

const formatLabelDayAfterIsoDate = (defaultLabel: string, tilDato: ISODateString | undefined, prefix: string): string => {
  if (!tilDato) return defaultLabel;
  const dateObj = isoDateToDate(tilDato);

  const nextDay = new Date(dateObj);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const monthName = MONTH_NAMES_DA[nextDay.getUTCMonth()];
  return `${prefix} den ${nextDay.getUTCDate()}. ${monthName} ${nextDay.getUTCFullYear()}:`;
};

// TODO: Implementer bilagsnummer-system og reintroducer felter til bilagsnumre de relevante steder.

/**
 * EO oplysninger-fanen - sagsoplysninger og grunddata
 */
type ErstatningsopgoerelseFormApi = Pick<
  UsePersistedFormReturn<ErstatningsopgoerelseValues>,
  'values' | 'setValues' | 'handleChange' | 'formVersion'
>;

const EOOplysningerTab = React.memo(({ form }: { form: ErstatningsopgoerelseFormApi }) => {
  const { values, setValues, handleChange, formVersion } = form;

  const skadesdatoISO = useSkadesdatoFromStamdata();
  const skadestypeFromStamdata = useSkadestypeFromStamdata();
  const { settings } = useAppSettings();
  const { getPersistedData, setLoenindkomstManuelReguleringInputError } = useFormPersistence();

  // Beregn minDate for øvrige krav-tabel
  const oevrigeKravMinDate = React.useMemo(() => {
    return computeSkadesdatoMinRule({
      skadesdatoISO,
      erErhvervssygdom: skadestypeFromStamdata === 'Erhvervssygdom',
      fallbackMin: dateRanges_erstatningsopgoerelse.tabelOevrigeKravDato.fallbackMin,
    }).minDate;
  }, [skadesdatoISO, skadestypeFromStamdata]);

  type ToggleFieldName = {
    [K in keyof ErstatningsopgoerelseValues]-?: ErstatningsopgoerelseValues[K] extends JaNej ? K : never
  }[keyof ErstatningsopgoerelseValues];

  const getChecked = React.useCallback((val: JaNej): boolean => val === 'Ja', []);

  const handleToggleChange = React.useCallback(
    (fieldName: ToggleFieldName): CommitHandler<boolean> =>
      (event: CommitEvent<boolean>) => {
        setValues((prev) => ({ ...prev, [fieldName]: event.target.value ? 'Ja' : 'Nej' }));
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
        setValues((prev) => ({ ...prev, [fieldName]: nextValue }));
      },
    [setValues]
  );

  /**
   * Handler til onBlur for integer-felter (StyledIntegerField)
   * Komponenten parser allerede til number | undefined
   */
  const handleIntegerBlur = React.useCallback(
    <K extends NumberLikeKeys>(fieldName: K) =>
      (event: { target: { value: number | undefined } }) => {
        setValues((prev) => ({ ...prev, [fieldName]: event.target.value }));
      },
    [setValues]
  );

  /**
   * Handler til onBlur for amount/percent/year-felter
   * Komponenten parser allerede til number | undefined
   */
  const handleNumberBlur = React.useCallback(
    <K extends NumberLikeKeys>(fieldName: K) =>
      (event: { target: { value: number | undefined } }) => {
        setValues((prev) => ({ ...prev, [fieldName]: event.target.value }));
      },
    [setValues]
  );

  /**
   * Handler til onBlur for amount-felter (expression-aware)
   */
  const handleAmountBlur = React.useCallback(
    <K extends AmountLikeKeys>(fieldName: K) =>
      (event: { target: { value: AmountValue | undefined } }) => {
        setValues((prev) => ({ ...prev, [fieldName]: event.target.value }));
      },
    [setValues]
  );

  const handleHelbredsfoholdChange = React.useCallback((event: ValueChangeEvent<unknown>) => {
    const parsed = helbredsstatusEnum.safeParse(event.target.value);
    setValues((prev) => ({ ...prev, svieSmerteHelbredsstatus: parsed.success ? parsed.data : undefined }));
  }, [setValues]);

  const handleArbejdssituationChange = React.useCallback((event: ValueChangeEvent<unknown>) => {
    const parsed = arbejdsstatusEnum.safeParse(event.target.value);
    setValues((prev) => ({ ...prev, tafArbejdsstatus: parsed.success ? parsed.data : undefined }));
  }, [setValues]);

  const handleBeregnesUdFraChange = React.useCallback((event: ValueChangeEvent<unknown>) => {
    const parsed = beregningsmetodeEnum.safeParse(event.target.value);
    if (!parsed.success) return;
    setValues((prev) => ({ ...prev, beregnesUdFra: parsed.data }));
  }, [setValues]);

  const handleAfsluttesMedChange = React.useCallback((event: ValueChangeEvent<unknown>) => {
    const parsed = afsluttesMedEnum.safeParse(event.target.value);
    if (!parsed.success) return;
    setValues((prev) => ({ ...prev, erstatningsopgoerelseAfsluttesMed: parsed.data }));
  }, [setValues]);

  const visLoenudviklingFraEO =
    values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn';
  const eoLoenudvikling = values.eoAngivetLoenLoenudvikling;

  const updateEoLoenudvikling = React.useCallback(
    (updater: (prev: EOAngivetLoenLoenudvikling) => EOAngivetLoenLoenudvikling) => {
      setValues((prev) => ({ ...prev, eoAngivetLoenLoenudvikling: updater(prev.eoAngivetLoenLoenudvikling) }));
    },
    [setValues]
  );

  const handleLoenudviklingBeregningsgrundlagChange = React.useCallback((event: ValueChangeEvent<unknown>) => {
    const parsed = loenudviklingBeregningsgrundlagEnum.safeParse(event.target.value);
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingBeregningsgrundlag: parsed.success ? parsed.data : undefined,
    }));
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingStatistikModelChange = React.useCallback((event: ValueChangeEvent<unknown>) => {
    const parsed = loenudviklingStatistikModelEnum.safeParse(event.target.value);
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingStatistikModel: parsed.success ? parsed.data : undefined,
    }));
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingKRLSatstabelChange = React.useCallback((event: ValueChangeEvent<unknown>) => {
    const parsed = krlSatstabelEnum.safeParse(event.target.value);
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingKRLSatstabel: parsed.success ? parsed.data : undefined,
    }));
  }, [updateEoLoenudvikling]);

  const handleEoOverenskomstFilterChange = React.useCallback(
    (filterType: 'loenmodtager' | 'arbejdsgiver', value: string | undefined) => {
      updateEoLoenudvikling((prev) => ({
        ...prev,
        overenskomstFilter: {
          ...prev.overenskomstFilter,
          [filterType]: value,
        },
      }));
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
      }));
    },
    [updateEoLoenudvikling]
  );

  const handleOffentligLoenTypeChange = React.useCallback((event: ValueChangeEvent<unknown>) => {
    const parsed = offentligLoenTypeEnum.safeParse(event.target.value);
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenType: parsed.success ? parsed.data : prev.offentligLoenType,
    }));
  }, [updateEoLoenudvikling]);

  const handleOffentligLoenTrinCommit = React.useCallback((event: { target: { value: number | undefined } }) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenTrin: event.target.value,
    }));
  }, [updateEoLoenudvikling]);

  const handleOffentligLoenGruppeCommit = React.useCallback((event: { target: { value: number | undefined } }) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenGruppe: event.target.value,
    }));
  }, [updateEoLoenudvikling]);

  const handleOffentligLoenEkstraGrundloenCommit = React.useCallback((event: CommitEvent<EOAngivetLoenLoenudvikling['offentligLoenEkstraGrundloen']>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenEkstraGrundloen: event.target.value,
    }));
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingManuelNavnCommit = React.useCallback((event: CommitEvent<string | undefined>) => {
    const trimmed = (event.target.value ?? '').trim();
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingManuelNavn: trimmed,
    }));
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingManuelTableChange = React.useCallback((
    tableData: EOAngivetLoenLoenudvikling['loenudviklingManuelTableData']
  ) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingManuelTableData: tableData,
    }));
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingManuelInputErrorChange = React.useCallback((hasError: boolean) => {
    setLoenindkomstManuelReguleringInputError(EO_ANGIVET_LOEN_ID, hasError);
  }, [setLoenindkomstManuelReguleringInputError]);

  const alleLoenmodtagerOrg = React.useMemo(() => getAlleLoenmodtagerOrg(), []);
  const alleArbejdsgiverOrg = React.useMemo(() => getAlleArbejdsgiverOrg(), []);

  const filteredOverenskomster = React.useMemo(() => {
    return getOverenskomsterByOrg(
      eoLoenudvikling.overenskomstFilter?.loenmodtager,
      eoLoenudvikling.overenskomstFilter?.arbejdsgiver
    );
  }, [eoLoenudvikling.overenskomstFilter?.arbejdsgiver, eoLoenudvikling.overenskomstFilter?.loenmodtager]);

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
    | 'periodeTilBeregningFra'
    | 'periodeTilBeregningTil'
    | 'angivetMaanedsloenOpreguleresFraDato'
    | 'angivetDagsloenOpreguleresFraDato';

  const handleIsoDateBlur = React.useCallback(
    (fieldName: IsoDateFieldName) =>
      (event: { target: { value: ISODateString | string | undefined | null } }) => {
        const nextValue = coerceToISODateString(event.target.value ?? undefined);
        setValues((prev) => {
          const next: ErstatningsopgoerelseValues = { ...prev };
          next[fieldName] = nextValue;
          return next;
        });
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

  // Cross-field validering: Forlig dato kræver ansvarsgrad
  const forligDatoFejl = React.useMemo(() => {
    const harForligDato = hasNonEmptyDateValue(values.forligDato);
    const harProcent = values.forligAnsvarsgradProcent !== undefined && values.forligAnsvarsgradProcent !== null;
    const harBroek = values.forligAnsvarsgradBroek !== undefined && values.forligAnsvarsgradBroek !== null && values.forligAnsvarsgradBroek.trim() !== '';
    const harAnsvarsgrad = harProcent || harBroek;
    const fejl = harForligDato && !harAnsvarsgrad;
    return {
      harFejl: fejl,
      fejlbesked: fejl ? 'Forlig dato kræver ansvarsgrad (procent eller brøk)' : '',
    };
  }, [values.forligDato, values.forligAnsvarsgradProcent, values.forligAnsvarsgradBroek]);

  // Error reporting for debug/diagnostics (runtime-only).
  // These are intentionally reported to the central field-error model so EODebug can reflect current invalid inputs
  // even when the committed persisted value remains unchanged (draft ≠ committed).
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
  const reportAndelSfggILoenenInputError = useFormFieldErrorReporter('erstatningsopgoerelse', 'andelSfggILoenen', {
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
  const reportForligDatoRuleError = useFormFieldErrorReporter('erstatningsopgoerelse', 'forligDato', { severity: 'error', source: 'rule' });
  const reportForligDatoInputErrorSafe = React.useCallback((errorMsg: string | undefined) => {
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
    reportForligDatoRuleError(forligDatoFejl.harFejl ? forligDatoFejl.fejlbesked : undefined);
  }, [forligDatoFejl.fejlbesked, forligDatoFejl.harFejl, reportForligDatoRuleError]);

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
    });
  }, [ferie.committedRowsEnsured, taf.committedRowsEnsured, values]);

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
    return `Det angivne beløb afspejler ${loenLabel}en per dato (hvis forskellige fra skadesdato)`;
  }, [values.beregnesUdFra]);

  const loenudviklingBasis = eoLoenudvikling.loenudviklingBeregningsgrundlag;
  const erOffentligOverenskomst = Boolean(
    eoLoenudvikling.overenskomstId &&
    isOffentligOverenskomstId(eoLoenudvikling.overenskomstId)
  );

  const aktivAngivetLoenOpreguleresFraDato =
    values.beregnesUdFra === 'Angivet månedsløn'
      ? values.angivetMaanedsloenOpreguleresFraDato
      : values.beregnesUdFra === 'Angivet dagsløn'
        ? values.angivetDagsloenOpreguleresFraDato
        : undefined;

  const loenudviklingBaseDateDisplay = React.useMemo(() => {
    const baseIso = aktivAngivetLoenOpreguleresFraDato || skadesdatoISO;
    const parsed = baseIso ? parseISODate(baseIso) : null;
    if (!parsed) return '';
    return formatDanishDate(parsed);
  }, [aktivAngivetLoenOpreguleresFraDato, skadesdatoISO]);

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
    async (params: {
      overenskomstLabel: string;
      loenudviklingBasis: 'Overenskomst' | 'Statistik';
      overenskomstId: string | undefined;
      statistikModelLabel: string | undefined;
      interval: ReguleringsDatoInterval;
      applyAlmindeligLoenPaaShDageRegel: boolean;
      offentligLoenType?: string;
      offentligLoenTrin?: number;
      offentligLoenGruppe?: number;
      offentligLoenEkstraGrundloen?: number;
    }) => {
      try {
        const stamdata = getPersistedData('stamdata');
        const visBrevhoved = getVisBrevhoved(settings, 'regulering');
        const { generateReguleringPdf } = await loadReguleringPdfModule();
        generateReguleringPdf({
          ...params,
          visBrevhoved,
          stamdata,
        });
      } catch (error) {
        console.error('Kunne ikke indlæse PDF-modulet for regulering:', error);
      }
    },
    [getPersistedData, settings]
  );

  const handleDownloadKRLPdf = React.useCallback(async () => {
    try {
      const stamdata = getPersistedData('stamdata');
      const visBrevhoved = getVisBrevhoved(settings, 'regulering');
      const { generateKRLPdf } = await loadKRLPdfModule();
      generateKRLPdf({ visBrevhoved, stamdata });
    } catch (error) {
      console.error('Kunne ikke indlæse PDF-modulet for KRL satstabel:', error);
    }
  }, [getPersistedData, settings]);

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
    const endeligEetErSynlig = values.endeligtEetAfgorelse === 'Ja';
    if (!endeligEetErSynlig) return undefined;

    // Hvis virkningsdato er udfyldt, brug den, ellers brug afgørelsesdato
    return values.endeligEETVirkningsdato || values.endeligEETAfgoerelseDato;
  }, [values.endeligtEetAfgorelse, values.endeligEETVirkningsdato, values.endeligEETAfgoerelseDato]);

  const erErhvervssygdom = skadestypeFromStamdata === 'Erhvervssygdom';

  const skadesdatoMinRule = React.useMemo(
    () =>
      computeSkadesdatoMinRule({
        skadesdatoISO,
        erErhvervssygdom,
        fallbackMin: dateRanges_erstatningsopgoerelse.forligDato.fallbackMin,
      }),
    [erErhvervssygdom, skadesdatoISO]
  );

  const opgoerelseLavetDenMinRule = React.useMemo(
    () =>
      computeSkadesdatoMinRule({
        skadesdatoISO,
        erErhvervssygdom,
        fallbackMin: dateRanges_erstatningsopgoerelse.opgoerelse.min,
      }),
    [erErhvervssygdom, skadesdatoISO]
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
                width={80}
                value={values.eoNummer || ''}
                onCommit={handleStringBlur('eoNummer')}
                sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
              />
              <Typography className="row--text">+ evt. ledsagetekst</Typography>
              <StyledTextField
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
                value={values.vedroererPeriodeFra}
                onCommit={handleIsoDateBlur('vedroererPeriodeFra')}
                onFieldError={reportVedroererPeriodeFraInputError}
                minDate={skadesdatoMinRule.minDate}
                maxDate={values.vedroererPeriodeTil || dateRanges_erstatningsopgoerelse.periodeFra.fallbackMax}
                specialRangeErrors={{
                  fraTilRole: 'fra',
                  minBoundKind: skadesdatoMinRule.minBoundKind,
                  minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
                }}
                noValidRangeCause={skadesdatoISO ? 'Skadesdato, Vedrører perioden: til og med' : 'Vedrører perioden: til og med'}
              />
              <Typography className="row--text">til og med</Typography>
              <StyledDateField
                value={values.vedroererPeriodeTil}
                onCommit={handleIsoDateBlur('vedroererPeriodeTil')}
                onFieldError={reportVedroererPeriodeTilInputError}
                minDate={values.vedroererPeriodeFra || dateRanges_erstatningsopgoerelse.periodeTil.fallbackMin}
                maxDate={dateRanges_erstatningsopgoerelse.periodeTil.max}
                specialRangeErrors={{ fraTilRole: 'til' }}
                noValidRangeCause="Vedrører perioden: fra og med"
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Opgørelse lavet den</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StyledDateField
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
                noValidRangeCause={skadesdatoISO ? 'Skadesdato, dags dato' : 'dags dato'}
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
              value={values.forligDato}
              onCommit={handleIsoDateBlur('forligDato')}
              onFieldError={reportForligDatoInputErrorSafe}
              minDate={skadesdatoMinRule.minDate}
              maxDate={dateRanges_erstatningsopgoerelse.forligDato.max}
              specialRangeErrors={{
                minBoundKind: skadesdatoMinRule.minBoundKind,
                minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
              }}
              noValidRangeCause="Skadesdato"
              error={forligDatoFejl.harFejl}
              helperText={forligDatoFejl.fejlbesked}
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
                  value={values.menAfgoerelseDato}
                  onCommit={handleIsoDateBlur('menAfgoerelseDato')}
                  onFieldError={reportMenAfgoerelseDatoInputError}
                  minDate={skadesdatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.menAfgoerelseDato.max}
                  specialRangeErrors={{
                    minBoundKind: skadesdatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
                  }}
                  noValidRangeCause="Skadesdato"
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Verserende klagesag over ménafgørelse?</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch
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
              checked={getChecked(values.midlertidigtEetAfgorelse)}
              onCommit={handleToggleChange('midlertidigtEetAfgorelse')}
            />
          </Box>
        </Box>

        {getChecked(values.midlertidigtEetAfgorelse) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for første midlertidige erhvervsevnetabsafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  value={values.midlertidigEETAfgoerelseDato}
                  onCommit={handleIsoDateBlur('midlertidigEETAfgoerelseDato')}
                  onFieldError={reportMidlertidigEETAfgoerelseDatoInputError}
                  minDate={skadesdatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.midlertidigEETAfgoerelseDato.max}
                  specialRangeErrors={{
                    minBoundKind: skadesdatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
                  }}
                  noValidRangeCause="Skadesdato"
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Virkningsdato (hvis forskellig fra afgørelsesdatoen)</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  value={values.midlertidigEETVirkningsdato}
                  onCommit={handleIsoDateBlur('midlertidigEETVirkningsdato')}
                  onFieldError={reportMidlertidigEETVirkningsdatoInputError}
                  minDate={skadesdatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.midlertidigEETVirkningsdato.max}
                  specialRangeErrors={{
                    minBoundKind: skadesdatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
                  }}
                  noValidRangeCause="Skadesdato"
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
              checked={getChecked(values.endeligtEetAfgorelse)}
              onCommit={handleToggleChange('endeligtEetAfgorelse')}
            />
          </Box>
        </Box>

        {getChecked(values.endeligtEetAfgorelse) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for endelig erhvervsevnetabsafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  value={values.endeligEETAfgoerelseDato}
                  onCommit={handleIsoDateBlur('endeligEETAfgoerelseDato')}
                  onFieldError={reportEndeligEETAfgoerelseDatoInputError}
                  minDate={skadesdatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.endeligEETAfgoerelseDato.max}
                  specialRangeErrors={{
                    minBoundKind: skadesdatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
                  }}
                  noValidRangeCause="Skadesdato"
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Virkningsdato (hvis forskellig fra afgørelsesdatoen)</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  value={values.endeligEETVirkningsdato}
                  onCommit={handleIsoDateBlur('endeligEETVirkningsdato')}
                  onFieldError={reportEndeligEETVirkningsdatoInputError}
                  minDate={skadesdatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.endeligEETVirkningsdato.max}
                  specialRangeErrors={{
                    minBoundKind: skadesdatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
                  }}
                  noValidRangeCause="Skadesdato"
                />
              </Box>
            </Box>
          </>
        )}

        <Typography className="row--subheading">
          Øvrigt
        </Typography>

        {(getChecked(values.midlertidigtEetAfgorelse) || getChecked(values.endeligtEetAfgorelse)) && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Verserende klagesag over EET-afgørelse?</Typography>
            <Box className="row--label-right-hover__content">
              <StyledToggleSwitch
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
              value={values.differencekravDato}
              onCommit={handleIsoDateBlur('differencekravDato')}
              onFieldError={reportDifferencekravDatoInputError}
              minDate={skadesdatoMinRule.minDate}
              maxDate={dateRanges_erstatningsopgoerelse.differencekravDato.max}
              specialRangeErrors={{
                minBoundKind: skadesdatoMinRule.minBoundKind,
                minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
              }}
              noValidRangeCause="Skadesdato"
            />
          </Box>
        </Box>
      </ContentBox>

      {/* Sektion 4: Svie/smerte godtgørelse */}
      <ContentBox className="content-box" data-section-id="sviesmerte">
        <Typography className="section-header">Svie/smerte godtgørelse</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Beregnes der svie/smerte godtgørelse i opgørelsen</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              checked={getChecked(values.beregnesSvieSmerteGodtgoerelse)}
              onCommit={handleToggleChange('beregnesSvieSmerteGodtgoerelse')}
            />
          </Box>
        </Box>

        {getChecked(values.beregnesSvieSmerteGodtgoerelse) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Tidligere beregnet S/S til max.</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch
                  checked={getChecked(values.tidligereSsMax)}
                  onCommit={handleToggleChange('tidligereSsMax')}
                />
              </Box>
            </Box>

            {!getChecked(values.tidligereSsMax) && (
              <>
                <Typography className="row--subheading">Periode:</Typography>
                <SvieSmerteTable
                  rows={svie.draftRows}
                  committedById={svie.committedById}
                  derivedById={svie.derivedById}
                  overlappingIds={svie.overlappingIds}
                  skadesdatoISO={skadesdatoISO}
                  menAfgoerelseDato={menAfgoerelseDatoForTabel}
                  erErhvervssygdom={erErhvervssygdom}
                  verserendeKlageMen={verserendeKlageMen}
                  onFieldChange={svie.onFieldChange}
                  onRowBlur={(rowId) => svie.onFieldBlur(rowId)}
                />

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Hvilket års svie/smerte satser lægges til grund?</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledYearField
                      width={100}
                      value={values.svieSmerteSatserAar}
                      onCommit={handleNumberBlur('svieSmerteSatserAar')}
                      onFieldError={reportSvieSmerteSatserAarInputError}
                      minYear={MIN_YEAR}
                      maxYear={MAX_YEAR}
                    />
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Svie/smerte sats ved delvis sygemelding:</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledRadioButton
                      value={values.svieSmerteDelvisSygemeldingSats}
                      onChange={handleChange('svieSmerteDelvisSygemeldingSats')}
                      row={true}
                      options={[
                        { value: 'fuld', label: 'Fuld sats' },
                        { value: 'halv', label: 'Halv sats' },
                      ]}
                    />
                  </Box>
                </Box>

                <Typography className="row--subheading">Tidligere svie/smerte godtgørelse</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Svie/smerte krav i tidligere erstatningsopgørelser:</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledAmountField
                      width={150}
                      value={values.svieSmerteTidligereTotal}
                      onCommit={handleAmountBlur('svieSmerteTidligereTotal')}
                      onFieldError={reportSvieSmerteTidligereTotalInputError}
                    />
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Evt. allerede modtaget svie/smerte for nuværende erstatningsperiode:</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledAmountField
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
          <Typography className="row--text">Beregnes der tabt arbejdsfortjeneste i opgørelsen</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              checked={getChecked(values.beregnesTabtArbejdsfortjeneste)}
              onCommit={handleToggleChange('beregnesTabtArbejdsfortjeneste')}
            />
          </Box>
        </Box>

        {getChecked(values.beregnesTabtArbejdsfortjeneste) && (
          <>
            <Typography className="row--subheading">Periode:</Typography>
            <TAFPeriodeTable
              rows={taf.draftRows}
              committedById={taf.committedById}
              overlappingIds={taf.overlappingIds}
              onFieldChange={taf.onFieldChange}
              onRowBlur={(rowId) => taf.onFieldBlur(rowId)}
              derivedById={tafDerived.derivedById}
              derivedColumnHeader={tafDerived.kolonneOverskrift}
              overlapWithBeregningsperiodeByRowId={beregningsperiodeTafOverlap.overlapMessageByRowId}
              skadesdatoISO={skadesdatoISO}
              endeligEETBeregnetDato={endeligEETBeregnetDato}
              differencekravDato={values.differencekravDato}
              erErhvervssygdom={erErhvervssygdom}
              verserendeKlageEet={verserendeKlageEet}
            />

            <Typography className="row--subheading">Evt. ferie i perioden:</Typography>
            <FerieperiodeTable
              rows={ferie.draftRows}
              committedById={ferie.committedById}
              feriedageById={ferieFeriedageById}
              onFieldChange={ferie.onFieldChange}
              onRowBlur={(rowId) => ferie.onFieldBlur(rowId)}
              skadesdatoISO={skadesdatoISO}
              endeligEETBeregnetDato={endeligEETBeregnetDato}
              differencekravDato={values.differencekravDato}
              erErhvervssygdom={erErhvervssygdom}
              verserendeKlageEet={verserendeKlageEet}
            />

            <Typography className="row--subheading">Øvrigt</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Evt. allerede modtaget tabt arbejdsfortjeneste for nuværende erstatningsperiode:</Typography>
              <Box className="row--label-right-hover__content">
                <StyledAmountField
                  width={150}
                  value={values.tidligereModtagetTaf}
                  onCommit={handleAmountBlur('tidligereModtagetTaf')}
                  onFieldError={reportTidligereModtagetTafInputError}
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Andel af løn i perioden, der består af sygeferiegodtgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <StyledAmountField
                  width={150}
                  value={values.andelSfggILoenen}
                  onCommit={handleAmountBlur('andelSfggILoenen')}
                  onFieldError={reportAndelSfggILoenenInputError}
                />
              </Box>
            </Box>
          </>
        )}
      </ContentBox>

      {/* Sektion 5: Indtægt før skaden */}
      {getChecked(values.beregnesTabtArbejdsfortjeneste) && (
        <ContentBox className="content-box" data-section-id="taf-beregningsgrundlag">
        <Typography className="section-header">Indtægt før skaden</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Skjul beregning efter første opgørelse</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
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
                        value={values.periodeTilBeregningFra}
                        onCommit={handleIsoDateBlur('periodeTilBeregningFra')}
                        error={beregningsperiodeTafOverlap.firstOverlapMessage !== undefined}
                        helperText={beregningsperiodeTafOverlap.firstOverlapMessage ?? ''}
                      />
                      <Typography sx={{ minWidth: 'auto' }}>til:</Typography>
                      <StyledDateField
                        value={values.periodeTilBeregningTil}
                        onCommit={handleIsoDateBlur('periodeTilBeregningTil')}
                        error={beregningsperiodeTafOverlap.firstOverlapMessage !== undefined}
                        helperText={beregningsperiodeTafOverlap.firstOverlapMessage ?? ''}
                      />
                    </Box>
                  </Box>
                </Box>

                <Typography className="row--subheading">Ferie i beregningsperioden:</Typography>
                <BeregningsperiodeFerieTable
                  rows={fravaer.draftRows}
                  committedById={fravaer.committedById}
                  feriedageById={fravaerFeriedageById}
                  onFieldChange={fravaer.onFieldChange}
                  onRowBlur={(rowId) => fravaer.onFieldBlur(rowId)}
                  beregningsperiodeFra={values.periodeTilBeregningFra}
                  beregningsperiodeTil={values.periodeTilBeregningTil}
                />

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Uspecificerede ferie-/feriefridage</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledIntegerField
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
                          width={300}
                          value={values.oevrigeFravaersdageBeskrivelse || ''}
                          onCommit={handleChange('oevrigeFravaersdageBeskrivelse')}
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
                    width={300}
                    value={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? (values.angivetMaanedsloenBaseretPaa || '')
                        : (values.angivetDagsloenBaseretPaa || '')
                    }
                    onCommit={
                      values.beregnesUdFra === 'Angivet månedsløn'
                        ? handleChange('angivetMaanedsloenBaseretPaa')
                        : handleChange('angivetDagsloenBaseretPaa')
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
                            value={eoLoenudvikling.offentligLoenTrin}
                            onCommit={handleOffentligLoenTrinCommit}
                            minValue={1}
                            maxValue={55}
                            maxDigits={2}
                            width={80}
                          />
                          <Typography className="row--text">Gruppe</Typography>
                          <StyledIntegerField
                            value={eoLoenudvikling.offentligLoenGruppe}
                            onCommit={handleOffentligLoenGruppeCommit}
                            minValue={0}
                            maxValue={4}
                            maxDigits={1}
                            width={70}
                          />
                        </Box>
                      </Box>
                    </Box>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Evt. øget grundløn udover løntrin</Typography>
                      <Box className="row--label-right-hover__content">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <StyledAmountField
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
                        width={270}
                        value={eoLoenudvikling.loenudviklingStatistikModel}
                        onChange={handleLoenudviklingStatistikModelChange}
                        allowEmpty={true}
                        placeholder="Vælg..."
                      >
                        <MenuItem value="ASL-årslønsmaksimum">ASL-årslønsmaksimum</MenuItem>
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
                          width={300}
                          value={eoLoenudvikling.loenudviklingManuelNavn || ''}
                          onCommit={handleLoenudviklingManuelNavnCommit}
                        />
                      </Box>
                    </Box>
                    <LoenudviklingManuelTable
                      tableData={eoLoenudvikling.loenudviklingManuelTableData}
                      onTableDataChange={handleLoenudviklingManuelTableChange}
                      onInputErrorChange={handleLoenudviklingManuelInputErrorChange}
                      baseDateDisplay={loenudviklingBaseDateDisplay}
                      baseDateErrorMessage={loenudviklingBaseDateDisplay === '' ? 'Skadesdato er ikke udfyldt' : undefined}
                      useSmallFont={true}
                    />
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
            )}
          </>
        )}
      </ContentBox>
      )}

      {/* Sektion 7: Øvrige erstatningskrav */}
      <ContentBox className="content-box" data-section-id="oevrige-krav">
        <Typography className="section-header">Øvrige erstatningskrav</Typography>

        <OevrigeKravTable
          rows={oevrigeKrav.draftRows}
          committedById={oevrigeKrav.committedById}
          onFieldChange={oevrigeKrav.onFieldChange}
          onRowBlur={(rowId) => oevrigeKrav.onFieldBlur(rowId)}
          minDate={oevrigeKravMinDate}
          maxDate={dateRanges_erstatningsopgoerelse.tabelOevrigeKravDato.max}
          specialRangeErrors={{
            minBoundKind: skadesdatoMinRule.minBoundKind,
            minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
          }}
          noValidRangeCause={skadesdatoISO ? 'Skadesdato, dags dato' : 'dags dato'}
        />
      </ContentBox>

      {/* Sektion 8: Eventuelle særlige kommentarer */}
      <ContentBox className="content-box" data-section-id="saerlige-kommentarer">
        <Typography className="section-header">Eventuelle særlige kommentarer</Typography>

        <StyledTextField
          width={800}
          value={values.saerligeKommentarer || ''}
          onCommit={handleChange('saerligeKommentarer')}
          multiline
          rows={4}
          placeholder="Indtast eventuelle kommentarer her..."
        />
      </ContentBox>

      {/* TODO: Modul til beregning af sygeferiegodtgørelse skal implementeres */}
    </Box>
  );
});

EOOplysningerTab.displayName = 'EOOplysningerTab';

export default EOOplysningerTab;
