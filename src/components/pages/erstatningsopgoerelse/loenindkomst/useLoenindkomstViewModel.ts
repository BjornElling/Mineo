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
  inputTransactionStep,
  structuralInputTransaction,
} from '../../../../inputCore/inputReducer';
import type { CollectionRef } from '../../../../inputCore/fieldAddress';
import { APP_ROUTES } from '../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../config/eoTabKeys';
import {
  eoLoenindkomstAnsaettelsesforholdCollection,
  eoEmploymentFields,
} from '../../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { eoSfggAnsaettelsesforholdCollection } from '../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { assessLoenindkomstSatser } from '../../../../domain/erstatningsopgoerelse/validation/loenindkomstSatsAssessment';
import { buildFieldIssueSet, type FieldIssue, type FieldIssueSet } from '../../../../inputCore/inputIssue';
import { toAnyFieldRef } from '../../../../inputCore/fieldDescriptor';
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

  /**
   * Satsvurderingens fund som STRUKTURELLE feltissues (GM-F01, GM-F06).
   *
   * Reglen er en kryds-felt-regel — feriegodtgørelsens relevans afhænger af reguleringsformen og af, om der
   * er indtastet lønoplysninger — og kan derfor ikke bo i descriptorens egen validator, som kun ser sin egen
   * celles værdi. RESULTATET er til gengæld kanoniske `FieldIssue`s med rigtige feltadresser, så rød
   * markering, tooltip, fokusnavigation og consumerblokering læser ÉN repræsentation i stedet for en fri
   * fejltekst uden feltidentitet. `reason: 'rule'` er §1.6-klassifikationen for en feltplaceret domæneregel.
   */
  const satsIssues = React.useMemo<FieldIssueSet>(() => buildFieldIssueSet(
    employments.flatMap((employment) => assessLoenindkomstSatser(employment, {
      beregnesUdFra: eoValues.beregnesUdFra,
    }).map((finding): FieldIssue => Object.freeze({
      kind: 'field' as const,
      code: `erstatningsopgoerelse.loenindkomstSatser.${finding.field}.${finding.kind}`,
      severity: 'error' as const,
      field: toAnyFieldRef(eoEmploymentFields[finding.field].bind(employment.id)),
      reason: 'rule' as const,
      message: finding.message,
    })))
  ), [employments, eoValues.beregnesUdFra]);

  // De overenskomst-/lovbundne satser skrives IKKE herfra. De er erklæret som en afledt skrivning på
  // produktkataloget (`loenindkomstSatsDerivedWrite`) og materialiseres inde i samme reducerede kandidat som
  // det styrende valg — samme revision, samme history-trin. En effect her ville gøre konsekvensen til en
  // selvstændig autoritativ handling, brugeren skulle fortryde for sig, og som effecten straks kunne skrive
  // tilbage igen, fordi det styrende valg stadig var aktivt (GM-F02).

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
    satsIssues,
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
