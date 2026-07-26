import * as React from 'react';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import { useAppSettings } from '../../../../contexts/useAppSettings';
import { useInputEditPort } from '../../../../inputCore/react/inputRuntimeContext';
import {
  buildRowHistoryOrigin,
  useCollectionRows,
  type CollectionRowOrigin,
} from '../../../../inputCore/react/useCollectionRows';
import {
  deleteRow,
  inputTransaction,
  inputTransactionStep,
  settleField,
  structuralInputTransaction,
} from '../../../../inputCore/inputReducer';
import type { CollectionRef } from '../../../../inputCore/fieldAddress';
import { APP_ROUTES } from '../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../config/eoTabKeys';
import {
  eoLoenindkomstAnsaettelsesforholdCollection,
  eoEmploymentFields,
  eoEmploymentManual,
} from '../../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { eoSfggAnsaettelsesforholdCollection } from '../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { applyAutoSatsFields, syncManualBaseRowSatser } from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { validateAllSatserForAnsaettelsesforhold, type SatsErrorState } from '../../../../domain/erstatningsopgoerelse/validation/loenindkomstSatsValidation';
import { deriveLoenindkomstVm } from '../../../../domain/erstatningsopgoerelse/viewModel/loenindkomstDerivations';
import { getAlleArbejdsgiverOrg, getAlleLoenmodtagerOrg } from '../../../../data/overenskomstRates';
import { scrollTargetIntoView } from '../../../../utils/scrollTargetIntoView';
import { useLoentrinFinder } from './useLoentrinFinder';

type Employment = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
const MAX_ANSAETTELSESFORHOLD = 10;
const employmentCollection = eoLoenindkomstAnsaettelsesforholdCollection.template as CollectionRef;
const sfggCollection = eoSfggAnsaettelsesforholdCollection.template as CollectionRef;

/**
 * Ansættelsesforholdenes lokation. ÉT sted, fordi både hookens rækkehandlinger og den direkte
 * slette-transaktion nedenfor skal give SAMME destination — ellers ville en undo af "tilføj" og en undo af
 * "slet" navigere forskelligt (§3.7).
 */
const EMPLOYMENT_ROW_ORIGIN: CollectionRowOrigin = {
  locationId: 'erstatningsopgoerelse.loenindkomstAnsaettelsesforhold',
  route: APP_ROUTES.erstatningsopgoerelse,
  tabKey: EO_TAB_KEYS.LOENINDKOMST,
};

export type LoenindkomstViewModelParams = Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
}>;

/** Greenfield EO-lønindkomst: reader-afledt visning og kun typed række-/feltcommands som write-grænse. */
export function useLoenindkomstViewModel({ eoValues, stamdataValues }: LoenindkomstViewModelParams) {
  const { settings } = useAppSettings();
  const edit = useInputEditPort();
  // Ansættelsesforholdene bor på lønindkomst-fanen; destinationen følger rækkehandlingen, så en undo af
  // tilføj/slet ansættelsesforhold navigerer tilbage hertil (§3.7).
  const rows = useCollectionRows<Employment>(employmentCollection, EMPLOYMENT_ROW_ORIGIN);
  const employments = eoValues.loenindkomstAnsaettelsesforhold;
  const derived = React.useMemo(() => deriveLoenindkomstVm({
    loenindkomstAnsaettelsesforhold: employments,
    beregnesUdFra: eoValues.beregnesUdFra,
    tafBeregningsperiodeFra: eoValues.tafBeregningsperiodeFra,
    tafBeregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
    ferieperioder: eoValues.ferieperioder,
    fravaerPerioder: eoValues.fravaerPerioder,
    eoValues,
    skadedato: stamdataValues.skadedato,
    skadestype: stamdataValues.skadestype,
  }), [employments, eoValues, stamdataValues.skadedato, stamdataValues.skadestype]);

  const satsErrors = React.useMemo<Record<string, SatsErrorState>>(() => Object.fromEntries(
    employments.flatMap((employment) => {
      const errors = validateAllSatserForAnsaettelsesforhold(employment, {
        anvendtReguleringsdato: derived.getAnvendtReguleringsdatoForAnsaettelsesforhold(employment),
        beregnesUdFra: eoValues.beregnesUdFra,
      });
      return Object.keys(errors).length === 0 ? [] : [[employment.id, errors] as const];
    })
  ), [derived, employments, eoValues.beregnesUdFra]);

  // Bevar den eksisterende auto-satsadfærd, men skriv alle berørte felter som én typed transaktion. Dermed kan
  // ingen mellemtilstand observeres, og hel-sektionssynkroniseringen er fjernet.
  React.useEffect(() => {
    const steps = [];
    for (const current of employments) {
      const next = syncManualBaseRowSatser(
        applyAutoSatsFields(current, derived.getAnvendtReguleringsdatoForAnsaettelsesforhold(current))
      );
      for (const key of ['fritvalgPct', 'shSoPct', 'storeBededagPct', 'pensionPct'] as const) {
        if (Object.is(current[key], next[key])) continue;
        const descriptor = eoEmploymentFields[key];
        steps.push(inputTransactionStep(settleField(
          descriptor.bind(current.id),
          descriptor.codec.formatForEdit(next[key])
        )));
      }
      const currentBase = current.loenudviklingManuelTableData[0];
      const nextBase = next.loenudviklingManuelTableData[0];
      if (currentBase !== undefined && nextBase !== undefined && currentBase.id === nextBase.id) {
        for (const key of ['feriepenge', 'shSoSats', 'fritvalg', 'agPension'] as const) {
          if (Object.is(currentBase[key], nextBase[key])) continue;
          const descriptor = eoEmploymentManual.manualFields[key];
          steps.push(inputTransactionStep(settleField(
            descriptor.bind(current.id, currentBase.id),
            descriptor.codec.formatForEdit(nextBase[key])
          )));
        }
      }
    }
    if (steps.length > 0) edit.dispatch(inputTransaction(steps));
  }, [derived, employments, edit]);

  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [scrollTargetId, setScrollTargetId] = React.useState<string | null>(null);
  const deleteTargetName = employments.find((employment) => employment.id === deleteTargetId)?.navnPaaArbejdssted?.trim() ?? '';
  const loentrinFinder = useLoentrinFinder(employments);

  const handleAddConfirm = React.useCallback(() => {
    if (rows.rowIds.length < MAX_ANSAETTELSESFORHOLD) {
      rows.insert(createDefaultLoenindkomstAnsaettelsesforhold(settings));
    }
    setAddDialogOpen(false);
  }, [rows, settings]);
  const handleDeleteConfirm = React.useCallback(() => {
    if (deleteTargetId === null) return;
    const steps = [inputTransactionStep(deleteRow(employmentCollection, deleteTargetId))];
    if (eoValues.sfggAnsaettelsesforhold.some((row) => row.ansaettelsesforholdId === deleteTargetId)) {
      steps.push(inputTransactionStep(deleteRow(sfggCollection, deleteTargetId)));
    }
    // Transaktionen sletter i TO collections, men destinationen er den brugerudløste primære: tabellen over
    // ansættelsesforhold. SFGG-rækken er en afledt konsekvens, ikke stedet brugeren handlede (§3.7).
    edit.dispatch(
      structuralInputTransaction(steps),
      buildRowHistoryOrigin(employmentCollection, EMPLOYMENT_ROW_ORIGIN)
    );
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
  }, [deleteTargetId, eoValues.sfggAnsaettelsesforhold, edit]);
  const move = React.useCallback((employmentId: string, offset: -1 | 1) => {
    const index = rows.rowIds.indexOf(employmentId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= rows.rowIds.length) return;
    const ordered = [...rows.rowIds];
    [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
    rows.reorder(ordered);
    setScrollTargetId(employmentId);
  }, [rows]);
  React.useEffect(() => {
    if (scrollTargetId === null) return;
    const handle = window.requestAnimationFrame(() => {
      scrollTargetIntoView(document.querySelector<HTMLElement>(`[data-mineo-row-id="${scrollTargetId}"]`), { force: true });
      setScrollTargetId(null);
    });
    return () => window.cancelAnimationFrame(handle);
  }, [employments, scrollTargetId]);

  // Reguleringssats-downloaden ligger IKKE her: den er pr. ansættelsesforhold, og dens
  // aktiveringsidentitet er `af.id`. `AnsaettelsesforholdCard` komponerer derfor sin egen
  // `useReguleringDocumentAction` pr. kort.

  return {
    ...derived,
    skadedato: stamdataValues.skadedato,
    skadestype: stamdataValues.skadestype,
    satsErrors,
    loentrinFinder,
    alleLoenmodtagerOrg: getAlleLoenmodtagerOrg(),
    alleArbejdsgiverOrg: getAlleArbejdsgiverOrg(),
    addDialogOpen,
    setAddDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    setDeleteTargetId,
    deleteTargetName,
    totalAnsaettelsesforhold: employments.length,
    cannotAddMore: employments.length >= MAX_ANSAETTELSESFORHOLD,
    showDeleteButton: employments.length > 0,
    handleAddConfirm,
    handleDeleteConfirm,
    handleMoveUp: (id: string) => move(id, -1),
    handleMoveDown: (id: string) => move(id, 1),
  };
}
