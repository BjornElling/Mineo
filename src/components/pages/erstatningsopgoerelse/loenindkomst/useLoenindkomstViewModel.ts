import React from 'react';
import type { CommitEvent, CommitHandler } from '../../../../types/fieldEvents';
import { type StyledDropdownChangeEvent } from '../../../inputs/StyledDropdown';
import { type StandardLoenTableSatser } from '../../../tables/StandardLoenTable';
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
} from '../../../../schemas/formSchemas';
import { TILLAEG_ANGIVES_SOM } from '../../../../types/loen';
import type { ISODateString } from '../../../../types/branded';
import { parseISODate } from '../../../../types/branded';
import { formatDanishDate } from '../../../../utils/dateUtils';
import { isLoenperiodeValue } from '../../../../utils/zodTypeGuards';
import { scrollTargetIntoView } from '../../../../utils/scrollTargetIntoView';
import type { StandardLoenTableValidationSummary } from '../../../../types/table';
import {
  getAlleLoenmodtagerOrg,
  getAlleArbejdsgiverOrg,
  getOverenskomsterByOrg,
  getOverenskomstMetaById,
  isOffentligOverenskomstId,
} from '../../../../data/overenskomstRates';
import { toLoentrin } from '../../../../data/offentligLoenTypes';
import { getPersistedSectionSnapshot, usePersistedSectionSelector } from '../../../../hooks/useFormPersistenceSelectors';
import { useAppSettings } from '../../../../contexts/useAppSettings';
import { downloadKrlDokument, downloadReguleringDokument, type ReguleringDocumentInput } from '../../../../document/service/documentService';
import { formatAsAmount } from '../../../../utils/formatUtils';
import { hasIndtastetLoenoplysninger } from '../../../../domain/erstatningsopgoerelse/helpers/loenoplysningerInput';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  applyAnsaettelsesforholdToggleCleanup,
  applyLoenudviklingBeregningsgrundlagChange,
} from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstStateCleanup';
import {
  applyAutoSatsFields,
  resolveOverenskomstSatsBindings,
  syncManualBaseRowSatser,
} from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { getAngivetLoenOpreguleresFraDato } from '../../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import {
  normalizeOptionalFreeText,
  resolveAnvendtReguleringsdato,
} from '../../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import {
  resolveSfggSource,
  resolveSfggReferenceperiodeDayCount,
} from '../../../../domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelse';
import {
  buildStandardLoenZeroArbejdsdageCellErrorMessages,
  type AarsloenZeroArbejdsdageValidationInput,
} from '../../../../domain/erstatningsopgoerelse/validation/indkomstRowValidation';
import {
  validateLoenudviklingManualBaseRowSatser,
  type ManualBaseRowCellErrors,
} from '../../../../domain/erstatningsopgoerelse/validation/loenudviklingManuelBaseRowValidation';
import { useDynamicFormFieldErrorReporter } from '../../../../hooks/useFormFieldErrors';
import { updateValidationFlagById } from '../../../../utils/validationFlagMap';
import { type SetValuesUpdater } from '../../../../hooks/usePersistedForm';
import { calculateLoenindkomstRowDerived } from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstRowDerived';
import { useLoentrinFinder } from './useLoentrinFinder';

type AnsaettelsesforholdList = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'];
type Ansaettelsesforhold = AnsaettelsesforholdList[number];

const MAX_ANSAETTELSESFORHOLD = 10;
const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';

export type SatsErrorState = {
  feriePct?: string;
  fritvalgPct?: string;
  shSoPct?: string;
  storeBededagPct?: string;
  pensionPct?: string;
};

type OverenskomstSatsField = 'fritvalgPct' | 'shSoPct' | 'pensionPct';

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

export type UseLoenindkomstViewModelParams = Readonly<{
  loenindkomstAnsaettelsesforhold: AnsaettelsesforholdList;
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
  tafBeregningsperiodeFra: ErstatningsopgoerelseValues['tafBeregningsperiodeFra'];
  tafBeregningsperiodeTil: ErstatningsopgoerelseValues['tafBeregningsperiodeTil'];
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder'];
  fravaerPerioder: ErstatningsopgoerelseValues['fravaerPerioder'];
  eoValues: ErstatningsopgoerelseValues;
  setEOValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
  onAnsaettelsesforholdChange: (updater: (prev: AnsaettelsesforholdList) => AnsaettelsesforholdList, origin?: { fieldPath?: string }) => void;
}>;

/**
 * View-model-laget for Loenindkomst-fanen.
 *
 * Ejer al afledt visningstilstand, lokal UI-state (dialoger, fejl-tracking) og
 * commit-/redigerings-handlers for ansættelsesforholdene, og returnerer en flad model
 * som selve siden (og fremtidige sektion-komponenter) blot forbruger. Formålet er at
 * holde fagsiden fri for state- og handler-vægt, så JSX'en alene beskriver layout —
 * jf. arkitektur-kandidat A1 (view-model-lag under fagsiderne).
 *
 * Adfærdsbevarende: logikken er flyttet uændret ud af `LoenindkomstTab`.
 */
export function useLoenindkomstViewModel(params: UseLoenindkomstViewModelParams) {
  const {
    loenindkomstAnsaettelsesforhold,
    beregnesUdFra,
    tafBeregningsperiodeFra,
    tafBeregningsperiodeTil,
    ferieperioder,
    fravaerPerioder,
    eoValues,
    setEOValues,
    onAnsaettelsesforholdChange,
  } = params;

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

  return {
    // Persisteret/afledt kontekst som JSX'en læser
    stamdataValues,

    // Lokal UI-state (dialoger)
    addDialogOpen,
    setAddDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteTargetId,
    setDeleteTargetId,
    deleteTargetName,

    // Fejl-/validerings-state pr. ansættelsesforhold
    satsErrors,
    manualBaseRowErrorsByAfId,
    aarsloenExternalCellErrorMessagesByAfId,

    // Løntrin-finder (overlay-state + handlers)
    loentrinFinder,

    // Afledte opslag/lister
    alleLoenmodtagerOrg,
    alleArbejdsgiverOrg,
    satserByAfId,
    derivedCalculatorByAfId,
    tableDataChangeByAfId,
    validationChangeByAfId,
    totalAnsaettelsesforhold,
    cannotAddMore,
    showDeleteButton,

    // Afledte hjælpere brugt i render
    getAnvendtReguleringsdatoForAnsaettelsesforhold,
    getSfggReferenceperiodeAvailability,
    getLoenudviklingBaseDate,
    isOffentligLoenSelectionReady,
    resolveOverenskomstLabel,
    getFilteredOverenskomsterForAnsaettelsesforhold,

    // SFGG-opdatering
    updateSfggAnsaettelsesforhold,

    // Felt-/celle-handlers
    handleTextCommit,
    handleToggleChange,
    handleOverenskomstChange,
    handleOffentligLoenTypeChange,
    handleOffentligLoenTrinCommit,
    handleOffentligLoenGruppeCommit,
    handleOffentligLoenEkstraGrundloenCommit,
    handleSidsteArbejdsdagCommit,
    handleSaerligFraDatoReguleringCommit,
    handleAnciennitetstillaegDatoCommit,
    handleAnciennitetstillaegSatsAngivesPerChange,
    handleAnciennitetstillaegSatsCommit,
    handleFeriePctCommit,
    handleValidatedSatsCommit,
    handleLoenperiodeChange,
    handleTillaegAngivesSomChange,
    handleFuldLoenUnderFerieChange,
    handleLoenPaaHelligdageChange,
    handleTableDataChange,
    handleLoenudviklingBeregningsgrundlagChange,
    handleLoenudviklingStatistikModelChange,
    handleLoenudviklingKRLSatstabelChange,
    handleLoenudviklingManuelTableChange,
    handleManuelReguleringInputErrorChange,
    handleFilterChange,

    // Liste-/dokument-handlers
    handleAddConfirm,
    handleDeleteConfirm,
    handleMoveUp,
    handleMoveDown,
    handleDownloadReguleringPdf,
    handleDownloadKRLPdf,
  };
}
