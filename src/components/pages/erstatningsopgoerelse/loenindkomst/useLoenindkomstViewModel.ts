import React from 'react';
import type { CommitEvent, CommitHandler } from '../../../../types/fieldEvents';
import { type StyledDropdownChangeEvent } from '../../../inputs/StyledDropdown';
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
import { isLoenperiodeValue } from '../../../../utils/zodTypeGuards';
import { scrollTargetIntoView } from '../../../../utils/scrollTargetIntoView';
import type { StandardLoenTableValidationSummary } from '../../../../types/table';
import {
  getAlleLoenmodtagerOrg,
  getAlleArbejdsgiverOrg,
  isOffentligOverenskomstId,
} from '../../../../data/overenskomstRates';
import { getPersistedSectionSnapshot, usePersistedSectionSelector } from '../../../../hooks/useFormPersistenceSelectors';
import { useReconcileInvalidDraftScopes } from '../../../../hooks/tableInput';
import { CELL_TABLE_IDS } from '../../../../config/cellInvalidDraftScopes';
import { useAppSettings } from '../../../../contexts/useAppSettings';
import { downloadKlLoenaftalerDokument, downloadKrlDokument, downloadReguleringDokument, type ReguleringDocumentInput } from '../../../../document/service/documentService';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  applyAnsaettelsesforholdToggleCleanup,
  applyLoenudviklingBeregningsgrundlagChange,
} from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstStateCleanup';
import {
  applyAutoSatsFields,
  syncManualBaseRowSatser,
  type OverenskomstSatsField,
} from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { normalizeOptionalFreeText } from '../../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import {
  validateAllSatserForAnsaettelsesforhold as validateAllSatser,
  type SatsErrorState,
} from '../../../../domain/erstatningsopgoerelse/validation/loenindkomstSatsValidation';
import {
  deriveLoenindkomstVm,
  type LoenindkomstFlatModel,
} from '../../../../domain/erstatningsopgoerelse/viewModel/loenindkomstDerivations';
import { useDynamicFormFieldErrorReporter } from '../../../../hooks/useFormFieldErrors';
import { updateValidationFlagById } from '../../../../utils/validationFlagMap';
import { type SetValuesUpdater } from '../../../../hooks/usePersistedForm';
import { useLoentrinFinder } from './useLoentrinFinder';

type AnsaettelsesforholdList = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'];
type Ansaettelsesforhold = AnsaettelsesforholdList[number];

const MAX_ANSAETTELSESFORHOLD = 10;
const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';

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
// De eneste celle-tabeller der kvalificeres med et ansættelsesforhold-id som rowScope. Modul-konstant
// (stabil identitet) så scope-reconcile-effekten ikke kører ved hver render.
const AF_SCOPED_CELL_TABLE_IDS = [CELL_TABLE_IDS.eoStandardLoen, CELL_TABLE_IDS.eoLoenudvikling] as const;

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

  // Scope-niveau `invalidDrafts`-reconcile: et SLETTET ansættelsesforholds tabeller er afmonteret, så
  // deres per-tabel række-reconcile (useReconcileInvalidDraftsToLiveRows) aldrig kan nå deres celle-drafts.
  // Ryd drafts hvis rowScope (af-id) ikke længere lever, så en slettet AFs ugyldige input ikke blokerer
  // Gem som et spøgelses-mål uden synligt felt (overlever ellers F5). Kun eo-standardloen + eo-loenudvikling
  // kvalificeres med et af-id-rowScope. Housekeeping (ingen undo-frame; AFs egen sletnings-frame bærer draften).
  const liveAfIds = React.useMemo(
    () => new Set(loenindkomstAnsaettelsesforhold.map((af) => af.id)),
    [loenindkomstAnsaettelsesforhold]
  );
  useReconcileInvalidDraftScopes('erstatningsopgoerelse', AF_SCOPED_CELL_TABLE_IDS, liveAfIds);

  // Hele den rene afledning (maps + per-af-funktioner) bor i domænets view-model-lag, så den er
  // testbar uden React-render (jf. A1). Hooken ejer kun React-state/effekter/handlers og kalder
  // ind i den her. Dep-listen er præcis de committede input afledningen bruger — ingen regression
  // i re-render-granularitet ift. de tidligere separate memos.
  const derived: LoenindkomstFlatModel = React.useMemo(
    () => deriveLoenindkomstVm({
      loenindkomstAnsaettelsesforhold,
      beregnesUdFra,
      tafBeregningsperiodeFra,
      tafBeregningsperiodeTil,
      ferieperioder,
      fravaerPerioder,
      eoValues,
      skadedato: stamdataValues?.skadedato,
    }),
    [
      loenindkomstAnsaettelsesforhold,
      beregnesUdFra,
      tafBeregningsperiodeFra,
      tafBeregningsperiodeTil,
      ferieperioder,
      fravaerPerioder,
      eoValues,
      stamdataValues?.skadedato,
    ]
  );
  const {
    satserByAfId,
    derivedCalculatorByAfId,
    manualBaseRowErrorsByAfId,
    aarsloenExternalCellErrorMessagesByAfId,
    getAnvendtReguleringsdatoForAnsaettelsesforhold,
    getSfggReferenceperiodeAvailability,
    getLoenudviklingBaseDate,
    isOffentligLoenSelectionReady,
    resolveOverenskomstLabel,
    getFilteredOverenskomsterForAnsaettelsesforhold,
    showSygeferiegodtgoerelseSection,
    getSfggRowForAf,
    firstTafFraDato,
    sfggReferenceperiodeMaxDate,
  } = derived;

  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [scrollTargetId, setScrollTargetId] = React.useState<string | null>(null);
  const deleteTargetName = React.useMemo(() => {
    if (!deleteTargetId) return '';
    const target = loenindkomstAnsaettelsesforhold.find((af) => af.id === deleteTargetId);
    return target?.navnPaaArbejdssted?.trim() ?? '';
  }, [deleteTargetId, loenindkomstAnsaettelsesforhold]);

  const [standardLoenTableHasErrorsByAfId, setStandardLoenTableHasErrorsByAfId] = React.useState<Record<string, true>>({});
  const [manuelReguleringHasErrorsByAfId, setManuelReguleringHasErrorsByAfId] = React.useState<Record<string, true>>({});
  const loentrinFinder = useLoentrinFinder(loenindkomstAnsaettelsesforhold);
  const syncedLoenindkomstErrorIdsRef = React.useRef<ReadonlySet<string>>(new Set());

  // Tynd React-binding over den rene sats-validering: leverér den anvendte reguleringsdato (afledt af
  // committed EO/stamdata) + beregningsgrundlaget; selve afledningen bor i validation-laget (jf. A1).
  const validateAllSatserForAnsaettelsesforhold = React.useCallback(
    (af: Ansaettelsesforhold): SatsErrorState =>
      validateAllSatser(af, {
        anvendtReguleringsdato: getAnvendtReguleringsdatoForAnsaettelsesforhold(af),
        beregnesUdFra,
      }),
    [getAnvendtReguleringsdatoForAnsaettelsesforhold, beregnesUdFra]
  );

  // Sats-fejlene er en REN afledning af committed state (ansættelsesforhold + anvendt
  // reguleringsdato), ikke en parallel imperativ fejlmodel. Tidligere blev de holdt i en useState der
  // både en effekt OG hver handler skrev til — handlerne revaliderede mod closure-state (det stale
  // committede ansættelsesforhold + kun det ene ændrede felt), hvilket kunne afvige fra den faktisk
  // committede værdi (auto-satser/synkroniseret basisrække). Som ren useMemo afspejler fejlene altid
  // præcis committed state, i tråd med form-kernereglen "valider kun fra committed".
  const satsErrors = React.useMemo<Record<string, SatsErrorState>>(() => {
    const allErrors: Record<string, SatsErrorState> = {};
    loenindkomstAnsaettelsesforhold.forEach((af) => {
      const errors = validateAllSatserForAnsaettelsesforhold(af);
      if (Object.keys(errors).length > 0) {
        allErrors[af.id] = errors;
      }
    });
    return allErrors;
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
        // Sats-fejlene revalideres automatisk af satErrors-memo'en fra den nye committede værdi.
      },
    [getAnvendtReguleringsdatoForAnsaettelsesforhold, updateAnsaettelsesforhold]
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
        // Sats-fejlene revalideres automatisk af satsErrors-memo'en (anvendt reguleringsdato ændres).
      },
    [getAnvendtReguleringsdatoForAnsaettelsesforhold, updateAnsaettelsesforhold]
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
        // feriePct-fejlen revalideres automatisk af satsErrors-memo'en fra committed state.
      },
    [updateAnsaettelsesforhold]
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
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, [field]: event.target.value }), { fieldPath: `${id}:${field}` });
        // Overenskomst-sats-fejlen revalideres automatisk af satsErrors-memo'en fra committed state.
      },
    [updateAnsaettelsesforhold]
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
        // Beløb-tilstand bruger ikke satserne; satsErrors-memo'en returnerer {} for det
        // ansættelsesforhold, så røde kanter ryddes automatisk. Skift tilbage til Procent revaliderer.
      },
    [updateAnsaettelsesforhold]
  );

  const handleFuldLoenUnderFerieChange = React.useCallback(
    (id: string): CommitHandler<boolean> =>
      (event: CommitEvent<boolean>) => {
        const nextValue: Ansaettelsesforhold['fuldLoenUnderFerie'] = event.target.value ? 'Ja' : 'Nej';
        updateAnsaettelsesforhold(id, (prev) => ({ ...prev, fuldLoenUnderFerie: nextValue }), { fieldPath: `${id}:fuldLoenUnderFerie` });
        // feriePct-fejlen revalideres automatisk af satsErrors-memo'en fra committed state.
      },
    [updateAnsaettelsesforhold]
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
        // Sats-fejlene revalideres automatisk af satsErrors-memo'en fra den nye committede værdi.
      },
    [getAnvendtReguleringsdatoForAnsaettelsesforhold, updateAnsaettelsesforhold]
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

  const handleAddConfirm = React.useCallback(() => {
    const newAf = createDefaultLoenindkomstAnsaettelsesforhold(settings);
    // Maks-grænsen håndhæves i selve commit-updateren (ikke kun i UI'ets cannotAddMore), så et
    // imperativt/dialog-kald aldrig kan persistere mere end MAX_ANSAETTELSESFORHOLD.
    onAnsaettelsesforholdChange((prev) =>
      prev.length >= MAX_ANSAETTELSESFORHOLD ? prev : [...prev, newAf]
    );

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

  const handleDownloadKlLoenaftalerPdf = React.useCallback(
    async () => {
      await downloadKlLoenaftalerDokument({
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

  const totalAnsaettelsesforhold = loenindkomstAnsaettelsesforhold.length;
  const cannotAddMore = totalAnsaettelsesforhold >= MAX_ANSAETTELSESFORHOLD;
  const showDeleteButton = totalAnsaettelsesforhold > 0;

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
    // Kun de stamdata-felter kortet faktisk læser eksponeres — ikke hele den rå stamdata-sektion
    // gennem konteksten (samme A1-princip som for rå eoValues: intet komponentlag får bredere
    // committed-adgang end nødvendigt).
    skadedato: stamdataValues?.skadedato,
    skadestype: stamdataValues?.skadestype,

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

    // Kort-afledninger (committed-only) som tidligere blev udledt inde i kortet fra rå eoValues.
    // Eksponeres her, så kortet ikke længere behøver rå committed EO-state via konteksten (jf. A1).
    showSygeferiegodtgoerelseSection,
    getSfggRowForAf,
    firstTafFraDato,
    sfggReferenceperiodeMaxDate,

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
    handleDownloadKlLoenaftalerPdf,
  };
}
