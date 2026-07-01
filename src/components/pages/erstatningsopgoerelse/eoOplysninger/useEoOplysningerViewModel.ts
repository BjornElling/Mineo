import React from 'react';
import { type StyledDropdownChangeEvent } from '../../../inputs/StyledDropdown';
import useSvieSmerteRows from '../../../tables/useSvieSmerteRows';
import useTafRows from '../../../tables/useTafRows';
import useFerieRows from '../../../tables/useFerieRows';
import useFravaerRows from '../../../tables/useFravaerRows';
import useOevrigeKravRows from '../../../tables/useOevrigeKravRows';
import { type ReportableFieldError } from '../../../../types/fieldErrors';
import type { UsePersistedFormReturn } from '../../../../hooks/usePersistedForm';
import { useEoFieldCommitHandlers } from './useEoFieldCommitHandlers';
import { useEoLoenudviklingHandlers } from './useEoLoenudviklingHandlers';
import { useEoLoentrinFinder } from './useEoLoentrinFinder';
import {
  computeSkadedatoMinRule,
  dateRanges_erstatningsopgoerelse,
} from '../../../../config/dateRanges';
import { resolveMidlertidigEetDatoHvisAktiv } from '../../../../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';
import { useDynamicFormFieldErrorReporter, useFormFieldErrorReporter } from '../../../../hooks/useFormFieldErrors';
import { useForligAnsvarsgradValidation } from '../../../../hooks/useForligAnsvarsgradValidation';
import { usePersistedSectionSelector } from '../../../../hooks/useFormPersistenceSelectors';
import {
  type ErstatningsopgoerelseValues,
  type EOAngivetLoenLoenudvikling,
  arbejdsstatusEnum,
  afsluttesMedEnum,
  beregningsmetodeEnum,
  helbredsstatusEnum,
} from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import { parseISODate } from '../../../../types/branded';
import { calculateFerieHverdageMinusSHDage } from '../../../../domain/erstatningsopgoerelse/engines/ferieCalculations';
import { buildBeregningsperiodeTafOverlap, buildTafDerived } from '../../../../domain/erstatningsopgoerelse/helpers/tafRowDerived';
import { erDetteFoersteErstatningsopgoerelse } from '../../../../domain/erstatningsopgoerelse/validation/eoNummerValidering';
import { MONTH_NAMES_DA } from '../../../../utils/dateFormatting';
import { formatDanishDate } from '../../../../utils/dateUtils';
import { isoDateToDate } from '../../../../domain/dates/isoDate';
import {
  getAlleArbejdsgiverOrg,
  getAlleLoenmodtagerOrg,
  getOverenskomsterByOrg,
  getReguleringsDatoIntervalForOverenskomst,
  isOffentligOverenskomstId,
} from '../../../../data/overenskomstRates';
import { getReguleringsDatoIntervalForStatistikModel } from '../../../../data/statistiskeRates';
import { getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../../../data/krlRates';
import { getReguleringsDatoIntervalForKlLoenaftaler } from '../../../../data/klLoenaftaler';
import { useAppSettings } from '../../../../contexts/useAppSettings';
import { downloadKlLoenaftalerDokument, downloadKrlDokument, downloadReguleringDokument, type ReguleringDocumentInput } from '../../../../document/service/documentService';

type JaNej = 'Ja' | 'Nej';

type ReguleringsDatoInterval = Readonly<{ fraDato: string; tilDato: string }>;

export type ErstatningsopgoerelseFormApi = Pick<
  UsePersistedFormReturn<ErstatningsopgoerelseValues>,
  'values' | 'setValues' | 'setFieldValue' | 'formVersion'
>;

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
 * View-model-laget for Erstatningsopgørelse-oplysninger-fanen.
 *
 * Ejer al afledt visningstilstand, fejl-rapportering, række-hooks (svie/TAF/ferie/fravær/øvrige
 * krav), lønudviklings-/løntrin-handlers og dokument-download for fanen, og returnerer én flad
 * model. Fanen forbruger modellen og beskriver layout — jf. arkitektur-kandidat A1
 * (view-model-lag under fagsiderne). Adfærdsbevarende: logikken er flyttet uændret ud af
 * `EOOplysningerTab`.
 */
export function useEoOplysningerViewModel(form: ErstatningsopgoerelseFormApi) {
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

  const getChecked = React.useCallback((val: JaNej): boolean => val === 'Ja', []);
  const ensureEoLoenPaaHelligdage = React.useCallback(
    (value: EOAngivetLoenLoenudvikling['loenPaaHelligdage']) => value ?? settings.defaultLoenPaaHelligdage,
    [settings.defaultLoenPaaHelligdage]
  );

  const {
    handleToggleChange,
    handleJaNejSkjulChange,
    handleStringBlur,
    handleIntegerBlur,
    handleNumberBlur,
    handleAmountBlur,
    commitField,
    handleIsoDateBlur,
  } = useEoFieldCommitHandlers({ setValues, setFieldValue });

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

  const updateEoLoenudvikling = React.useCallback(
    (updater: (prev: EOAngivetLoenLoenudvikling) => EOAngivetLoenLoenudvikling, origin?: { fieldPath?: string }) => {
      setValues((prev) => ({ ...prev, eoAngivetLoenLoenudvikling: updater(prev.eoAngivetLoenLoenudvikling) }), origin);
    },
    [setValues]
  );

  // Page-lokal, transient løntrin-finder (skriver aldrig til persisteret sagsdata).
  const loentrinFinder = useEoLoentrinFinder(eoLoenudvikling.overenskomstId, eoLoenudvikling.offentligLoenType);

  const {
    handleLoenudviklingBeregningsgrundlagChange,
    handleLoenudviklingStatistikModelChange,
    handleLoenudviklingKRLSatstabelChange,
    handleEoOverenskomstFilterChange,
    handleEoOverenskomstChange,
    handleOffentligLoenTypeChange,
    handleOffentligLoenTrinCommit,
    handleOffentligLoenGruppeCommit,
    handleOffentligLoenEkstraGrundloenCommit,
    handleEoAnciennitetstillaegToggleCommit,
    handleEoAnciennitetstillaegDatoCommit,
    handleEoAnciennitetstillaegSatsCommit,
    handleLoenudviklingManuelNavnCommit,
    handleLoenudviklingManuelTableChange,
    handleLoenudviklingManuelProcentsatsTableChange,
    handleLoenudviklingManuelInputErrorChange,
  } = useEoLoenudviklingHandlers({ updateEoLoenudvikling, reportDynamicFieldError });

  const alleLoenmodtagerOrg = React.useMemo(() => getAlleLoenmodtagerOrg(), []);
  const alleArbejdsgiverOrg = React.useMemo(() => getAlleArbejdsgiverOrg(), []);

  const filteredOverenskomster = React.useMemo(() => {
    return getOverenskomsterByOrg(
      eoLoenudvikling.overenskomstFilter?.loenmodtager,
      eoLoenudvikling.overenskomstFilter?.arbejdsgiver
    );
  }, [eoLoenudvikling.overenskomstFilter?.arbejdsgiver, eoLoenudvikling.overenskomstFilter?.loenmodtager]);

  // Cross-field validering: Forlig om ansvarsgrad (delt kilde med Erhvervsevnetab -> Differencekrav).
  // Den fælles hook rapporterer de to blokerende regler (begge udfyldt / dato uden ansvarsgrad) til den
  // centrale fejl-model og returnerer den visuelle "begge udfyldt"-fejl til procent/brøk-felterne.
  const forligFejl = useForligAnsvarsgradValidation({
    forligAnsvarsgradProcent: values.forligAnsvarsgradProcent,
    forligAnsvarsgradBroek: values.forligAnsvarsgradBroek,
    forligDato: values.forligDato,
  });

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

  const reportForligDatoInputErrorSafe = React.useCallback((errorMsg: ReportableFieldError | undefined) => {
    if (!hasNonEmptyDateValue(values.forligDato)) {
      reportForligDatoInputError(undefined);
      return;
    }
    reportForligDatoInputError(errorMsg);
  }, [reportForligDatoInputError, values.forligDato]);

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
      || (loenudviklingBasis === 'KRL satstabel' && Boolean(eoLoenudvikling.loenudviklingKRLSatstabel))
      || loenudviklingBasis === 'KL-lønaftaler';
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
    if (loenudviklingBasis === 'KL-lønaftaler') {
      return getReguleringsDatoIntervalForKlLoenaftaler();
    }
    return undefined;
  }, [eoLoenudvikling.loenudviklingKRLSatstabel, eoLoenudvikling.loenudviklingStatistikModel, eoLoenudvikling.overenskomstId, loenudviklingBasis, shouldShowReguleringsDatoInterval]);

  const reguleringsDatoIntervalDisplay =
    reguleringsDatoIntervalData ? `${reguleringsDatoIntervalData.fraDato} - ${reguleringsDatoIntervalData.tilDato}` : '';

  const handleDownloadReguleringPdf = React.useCallback(
    async (input: ReguleringDocumentInput) => {
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

  const handleDownloadKlLoenaftalerPdf = React.useCallback(async () => {
    await downloadKlLoenaftalerDokument({
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

  return {
    // Rå form-state (forbruges direkte af sektion-komponenterne via kontekst)
    values,
    setValues,
    setFieldValue,

    // Persisteret kontekst
    skadedatoISO,
    erErhvervssygdom,

    // Små afledte hjælpere
    getChecked,

    // Felt-commit-handlers
    handleToggleChange,
    handleJaNejSkjulChange,
    handleStringBlur,
    handleIntegerBlur,
    handleNumberBlur,
    handleAmountBlur,
    commitField,
    handleIsoDateBlur,

    // Dropdown-handlers
    handleHelbredsfoholdChange,
    handleArbejdssituationChange,
    handleBeregnesUdFraChange,
    handleAfsluttesMedChange,

    // Angivet løn / lønudvikling
    visLoenudviklingFraEO,
    eoLoenudvikling,
    loentrinFinder,
    handleLoenudviklingBeregningsgrundlagChange,
    handleLoenudviklingStatistikModelChange,
    handleLoenudviklingKRLSatstabelChange,
    handleEoOverenskomstFilterChange,
    handleEoOverenskomstChange,
    handleOffentligLoenTypeChange,
    handleOffentligLoenTrinCommit,
    handleOffentligLoenGruppeCommit,
    handleOffentligLoenEkstraGrundloenCommit,
    handleEoAnciennitetstillaegToggleCommit,
    handleEoAnciennitetstillaegDatoCommit,
    handleEoAnciennitetstillaegSatsCommit,
    handleLoenudviklingManuelNavnCommit,
    handleLoenudviklingManuelTableChange,
    handleLoenudviklingManuelProcentsatsTableChange,
    handleLoenudviklingManuelInputErrorChange,
    alleLoenmodtagerOrg,
    alleArbejdsgiverOrg,
    filteredOverenskomster,
    loenudviklingBasis,
    erOffentligOverenskomst,
    eoAnciennitetSatsPerTekst,
    showEoAnciennitetstillaegSection,
    aktivAngivetLoenOpreguleresFraDato,
    loenudviklingBaseDateISO,
    loenudviklingBaseDateDisplay,
    shouldShowReguleringsDatoInterval,
    offentligLoenEkstraGrundloenSuffix,
    reguleringsDatoIntervalData,
    reguleringsDatoIntervalDisplay,
    angivetLoenOpreguleringLabel,
    handleDownloadReguleringPdf,
    handleDownloadKRLPdf,
    handleDownloadKlLoenaftalerPdf,

    // Forlig / ansvarsgrad
    forligFejl,

    // Fejl-rapportering
    reportVedroererPeriodeFraInputError,
    reportVedroererPeriodeTilInputError,
    reportOpgoerelseLavetDenInputError,
    reportMenAfgoerelseDatoInputError,
    reportMidlertidigEETAfgoerelseDatoInputError,
    reportMidlertidigEETVirkningsdatoInputError,
    reportEndeligEETAfgoerelseDatoInputError,
    reportEndeligEETVirkningsdatoInputError,
    reportDifferencekravDatoInputError,
    reportForligAnsvarsgradProcentInputError,
    reportForligAnsvarsgradBroekInputError,
    reportSvieSmerteSatserAarInputError,
    reportSvieSmerteTidligereTotalInputError,
    reportSvieSmerteAktuelPeriodeInputError,
    reportTidligereModtagetTafInputError,
    reportForligDatoInputErrorSafe,

    // Række-hooks (tabeller)
    svie,
    taf,
    ferie,
    fravaer,
    oevrigeKrav,
    tafDerived,
    ferieFeriedageById,
    fravaerFeriedageById,
    beregningsperiodeTafOverlap,
    oevrigeKravMinDate,

    // Diverse afledt visningstilstand
    opgoerelseLavetDenInputRef,
    skalKomprimereIndtaegtFoerSkaden,
    statusSubheaderLabel,
    menAfgoerelseDatoForTabel,
    endeligEETBeregnetDato,
    midlertidigEETBeregnetDato,
    skadedatoMinRule,
    opgoerelseLavetDenMinRule,
    verserendeKlageMen,
    verserendeKlageEet,
  };
}
