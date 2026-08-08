import { createTrackedInputReader, type InputReader } from '../../inputCore/inputReader';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import type { EvaluationSourceToken } from '../../inputCore/evaluationSource';
import { createCollectionRef, type CollectionRef } from '../../inputCore/fieldAddress';
import { buildFieldIssueSet, type FieldIssue, type FieldIssueSet } from '../../inputCore/inputIssue';
import type {
  ErstatningsopgoerelseValues,
  EOAngivetLoenLoenudvikling,
  FerieperiodeRow,
  PersistedErstatningsopgoerelseValues,
  PersistedLoenindkomstAnsaettelsesforhold,
  LoenudviklingManuelProcentsatsRow,
  LoenudviklingManuelRow,
  OevrigeKravRow,
  OffentligeYdelserRow,
  StamdataValues,
  StandardLoenTableRow,
  SvieSmertePeriodeRow,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
  TafPeriodeRow,
} from '../../schemas/formSchemas';
import { projectLoenindkomstSatser } from './loenindkomstSatsProjection';
import {
  eoAfsluttesMedField,
  eoAngivetDagsloenBaseretPaaField,
  eoAngivetDagsloenOpreguleresFraDatoField,
  eoAngivetMaanedsloenBaseretPaaField,
  eoAngivetMaanedsloenOpreguleresFraDatoField,
  eoBeregnesUdFraField,
  eoBilagIndgaarField,
  eoBilagSelectionLoenindkomstField,
  eoBilagSelectionMidlertidigEetField,
  eoBilagSelectionOffentligeYdelserField,
  eoBilagSelectionOkSatserField,
  eoBilagSelectionOpgoerelseField,
  eoBilagSelectionReguleringField,
  eoBilagSelectionShDageField,
  eoBilagSelectionSygeferiegodtgoerelseField,
  eoBilagsnumreBeregningsgrundlagTafField,
  eoBilagsnumreEetAfgoerelserField,
  eoBilagsnumreLoenISygeperiodenField,
  eoBilagsnumreMenAfgoerelseField,
  eoBilagsnumreOevrigeErstatningskravField,
  eoBilagsnumreOffentligeYdelserField,
  eoBilagsnumreSvieSmerteDokumentationField,
  eoDagsloenenUdgoerField,
  eoDifferencekravDatoField,
  eoEndeligEETAfgoerelseDatoField,
  eoEndeligEETVirkningsdatoField,
  eoEndeligtEETAfgorelseField,
  eoFerieperiodeFraField,
  eoFerieperioderCollection,
  eoFerieperiodeTilField,
  eoForligAnsvarsgradBroekField,
  eoForligAnsvarsgradProcentField,
  eoForligDatoField,
  eoFravaerPerioderCollection,
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoIndsaetUdkastStempelField,
  eoKomprimerBeregningField,
  eoKravPaaOevrigeErstatningskravField,
  eoKravPaaSvieSmerteGodtgoerelseField,
  eoKravPaaTabtArbejdsfortjenesteField,
  eoLedsagetekstField,
  eoMaanedsloenenUdgoerField,
  eoMenAfgoerelseDatoField,
  eoMidlertidigEETAfgoerelseDatoField,
  eoMidlertidigEETVirkningsdatoField,
  eoMidlertidigtEETAfgorelseField,
  eoMidlertidigtEetFraEetSidenField,
  eoNummerField,
  eoOevrigeFravaersdageBeskrivelseField,
  eoOevrigeFravaersdageField,
  eoOevrigeKravBeloebField,
  eoOevrigeKravDatoField,
  eoOevrigeKravPerioderCollection,
  eoOevrigeKravUdgiftTilField,
  eoOffentligeYdelserFraDatoField,
  eoOffentligeYdelserKommentarerField,
  eoOffentligeYdelserRowsCollection,
  eoOffentligeYdelserTilDatoField,
  eoOffentligeYdelserTillaegField,
  eoOffentligeYdelserYdelseField,
  eoOffentligeYdelserYdelsestypeField,
  eoOpgørelseLavetDenField,
  eoOevrigtFravaerUdenLoenField,
  eoRegulerOffentligeYdelserField,
  eoRevideretOpgoerelseField,
  eoSaerligeKommentarerField,
  eoSfggAlleredeBetaltBeloebField,
  eoSfggAnsaettelsesforholdCollection,
  eoSfggBeregningskildeField,
  eoSfggManuelBeloebIHenholdTilField,
  eoSfggManuelDagssatsField,
  eoSfggManuelFoerstEfterSygeloenField,
  eoSfggReferenceperiodeFraField,
  eoSfggReferenceperiodeFravaersdageUdenLoenField,
  eoSfggReferenceperiodeTilField,
  eoSfggSatsvalgField,
  eoSidsteDagAnsaettelsesforholdField,
  eoSvieSmerteAktuelPeriodeField,
  eoSvieSmerteDelvisSygemeldingSatsField,
  eoSvieSmerteHelbredsstatusField,
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
  eoSvieSmertePeriodeTilstandField,
  eoSvieSmertePerioderCollection,
  eoSvieSmerteSatserAarField,
  eoSvieSmerteTidligereTotalField,
  eoTafArbejdsstatusField,
  eoTafBeregningsperiodeFraField,
  eoTafBeregningsperiodeTilField,
  eoTafPeriodeFraField,
  eoTafPeriodeLoseFeriedageField,
  eoTafPerioderCollection,
  eoTafPeriodeTilField,
  eoTidligereModtagetTafField,
  eoTidligereSsMaxField,
  eoUspecificeredeFerieFridageField,
  eoVarigeMenAfgorelseField,
  eoVedroererPeriodeFraField,
  eoVedroererPeriodeTilField,
  eoVerserendeKlageEetField,
  eoVerserendeKlageMenField,
  eoVisBilagsnumreField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  eoAngivetLoenFields,
  eoAngivetLoenFilterFields,
  eoAngivetLoenManual,
  eoEmploymentFields,
  eoEmploymentFilterFields,
  eoEmploymentManual,
  eoLoenindkomstAnsaettelsesforholdCollection,
  eoStandardRowFields,
  type ManualBindings,
} from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import {
  stamdataAdvokatField,
  stamdataJournalnrField,
  stamdataSagsbehandlerField,
  stamdataSkadedatoField,
  stamdataSkadelidteField,
  stamdataSkadelidteFodselsdatoField,
  stamdataSkadestypeField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { computeEoSnapshot, type EoSnapshot } from './snapshot/eoSnapshot';
import { buildTafRanges } from './helpers/indtaegtPerioder';
import { buildMidlertidigtEetImportContext } from './helpers/midlertidigtEetTransientInjection';
import type { EetImportSource } from '../erhvervsevnetab/eetImportPort';
import type { EoDependencyProjection } from './snapshot/eoDependencyProjection';
import type { SvieSmerteCalculationValues } from './engines/svieSmerteEngine';
import type { TafCalculationValues } from './engines/tafCalculationInput';
import { collectManualRegulationDateIssues } from './manualRegulationDateIssues';
import { collectTafCutoffDateIssues } from './tafCutoffDateIssues';

// Erstatningsopgørelse-projektionen (§3.4/§5.4/§1.10). En
// ALMINDELIG ren funktion over den offentlige `InputReader`, der erstatter `Erstatningsopgoerelse.tsx`'s revisions-
// gatede `getPersistedSectionSnapshot`/`getFieldErrorsBySourceSnapshot`-effekt, som byggede `computeEoSnapshot`.
//
// Modsat de mindre slices har EO's snapshot-motor (`computeEoSnapshot`) sin egen `erstatningsopgoerelseValidator`,
// der re-validerer ALLE bounds/regler PÅ VÆRDIERNE (ikke på et fieldErrors-map). Blokeringen kommer derfor fra
// værdierne — ikke fra de to fieldErrors-maps, som motoren kun videregiver uændret til inspektion-snapshottet.
// Vi følger derfor Satser-/EET-/Forsørgertab-doktrinen (§3.4/§5.4):
//  - VALUE-REKONSTRUKTION: hvert felt læses gennem readeren og falder tilbage til sin canonical tomværdi, når
//    readeren skjuler en rød feltfejl (rejected format/range) ELLER en null-sektion giver `undefined` for et felt,
//    hvis tomværdi ikke er `undefined` (fx required-choice 'maaned'). `computeEoSnapshot` køres UÆNDRET på
//    den tomme/maskerede canonical værdi (§5.4 hårdt stop mod talændring).
//  - FELTISSUES: inspektions- og downloadlaget modtager de samme kanoniske `FieldIssueSet`s, filtreret på
//    EO- og stamdatasektion. Readerens reason og faktiske strukturelle adresse bæres uændret videre; der findes
//    hverken en feltnøgle-map, et syntetisk rækkeaggregat, en source-klassifikation eller et gate-flag.

const S = 'erstatningsopgoerelse' as const;

// ── Value-rekonstruktion (ikke-blokerende) ─────────────────────────────────────────
/**
 * Ikke-blokerende read: canonical værdi eller feltets tomværdi. Falder tilbage til `emptyValue` både når værdien
 * er skjult bag en rød feltfejl OG når en null-sektion giver `undefined` for et felt, hvis tomværdi ikke er
 * `undefined` (samme kontrakt som `readAarsloenValues`' `readOrEmpty`).
 */
const readOrEmpty = <T>(reader: InputReader, field: FieldRef<T>): T => {
  const result = reader.read(field);
  const emptyValue = field.descriptor.emptyValue;
  if (result.status !== 'usable') return emptyValue;
  return result.value === undefined && emptyValue !== undefined ? emptyValue : result.value;
};

/** Bygger en collection-ref for en nested samling under en konkret ansættelsesforholds-række. */
const bindNestedCollectionRef = (collectionName: string, employmentId: string): CollectionRef =>
  createCollectionRef({
    section: S,
    path: [{ kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold', entityId: employmentId }],
    collection: collectionName,
  });

/** Rekonstruerer én manuel-lønudviklings-række fra et ManualBindings-felts sæt (bundet til employment-id'et). */
const rebuildManualRow = (
  reader: InputReader,
  manual: ManualBindings,
  employmentId: string,
  rowId: string
): LoenudviklingManuelRow => ({
  id: rowId,
  dato: readOrEmpty(reader, manual.manualFields.dato.bind(employmentId, rowId)),
  grundloen: readOrEmpty(reader, manual.manualFields.grundloen.bind(employmentId, rowId)),
  feriepenge: readOrEmpty(reader, manual.manualFields.feriepenge.bind(employmentId, rowId)),
  shSoSats: readOrEmpty(reader, manual.manualFields.shSoSats.bind(employmentId, rowId)),
  fritvalg: readOrEmpty(reader, manual.manualFields.fritvalg.bind(employmentId, rowId)),
  agPension: readOrEmpty(reader, manual.manualFields.agPension.bind(employmentId, rowId)),
});

const rebuildManualPercentRow = (
  reader: InputReader,
  manual: ManualBindings,
  employmentId: string,
  rowId: string
): LoenudviklingManuelProcentsatsRow => ({
  id: rowId,
  dato: readOrEmpty(reader, manual.manualPercentFields.dato.bind(employmentId, rowId)),
  procent: readOrEmpty(reader, manual.manualPercentFields.procent.bind(employmentId, rowId)),
});

/** Rekonstruerer én nested StandardLoen-tabelrække under en ansættelsesforholds-række. */
const rebuildStandardRow = (reader: InputReader, employmentId: string, rowId: string): StandardLoenTableRow => ({
  id: rowId,
  col0_maaned: readOrEmpty(reader, eoStandardRowFields.col0_maaned.bind(employmentId, rowId)),
  col1_maaned: readOrEmpty(reader, eoStandardRowFields.col1_maaned.bind(employmentId, rowId)),
  col0_uge: readOrEmpty(reader, eoStandardRowFields.col0_uge.bind(employmentId, rowId)),
  col1_uge: readOrEmpty(reader, eoStandardRowFields.col1_uge.bind(employmentId, rowId)),
  col0_dag: readOrEmpty(reader, eoStandardRowFields.col0_dag.bind(employmentId, rowId)),
  col1_dag: readOrEmpty(reader, eoStandardRowFields.col1_dag.bind(employmentId, rowId)),
  col2: readOrEmpty(reader, eoStandardRowFields.col2.bind(employmentId, rowId)),
  col3: readOrEmpty(reader, eoStandardRowFields.col3.bind(employmentId, rowId)),
  col4: readOrEmpty(reader, eoStandardRowFields.col4.bind(employmentId, rowId)),
  col5: readOrEmpty(reader, eoStandardRowFields.col5.bind(employmentId, rowId)),
  fpFvShSoBeloeb: readOrEmpty(reader, eoStandardRowFields.fpFvShSoBeloeb.bind(employmentId, rowId)),
  pensionBeloeb: readOrEmpty(reader, eoStandardRowFields.pensionBeloeb.bind(employmentId, rowId)),
});

/** Rekonstruerer én ansættelsesforholds-række med skalarer, overenskomstFilter og de tre nested tabeller. */
const rebuildEmploymentRow = (
  reader: InputReader,
  employmentId: string
): PersistedLoenindkomstAnsaettelsesforhold => {
  const e = eoEmploymentFields;
  const standardRowIds = reader
    .listEntities(bindNestedCollectionRef('indtaegtsoplysningerTableData', employmentId))
    .map((entity) => entity.entityId);
  const manualRowIds = reader
    .listEntities(bindNestedCollectionRef('loenudviklingManuelTableData', employmentId))
    .map((entity) => entity.entityId);
  const manualPercentRowIds = reader
    .listEntities(bindNestedCollectionRef('loenudviklingManuelProcentsatsTableData', employmentId))
    .map((entity) => entity.entityId);

  return {
    id: employmentId,
    navnPaaArbejdssted: readOrEmpty(reader, e.navnPaaArbejdssted.bind(employmentId)),
    harOverenskomst: readOrEmpty(reader, e.harOverenskomst.bind(employmentId)),
    overenskomstId: readOrEmpty(reader, e.overenskomstId.bind(employmentId)),
    ansatPaaSkadestidspunktet: readOrEmpty(reader, e.ansatPaaSkadestidspunktet.bind(employmentId)),
    ansaettelsesforholdOphoert: readOrEmpty(reader, e.ansaettelsesforholdOphoert.bind(employmentId)),
    sidsteArbejdsdag: readOrEmpty(reader, e.sidsteArbejdsdag.bind(employmentId)),
    fritvalgPct: readOrEmpty(reader, e.fritvalgPct.bind(employmentId)),
    shSoPct: readOrEmpty(reader, e.shSoPct.bind(employmentId)),
    pensionPct: readOrEmpty(reader, e.pensionPct.bind(employmentId)),
    tillaegAngivesSom: readOrEmpty(reader, e.tillaegAngivesSom.bind(employmentId)),
    loenperiode: readOrEmpty(reader, e.loenperiode.bind(employmentId)),
    indtaegtsoplysningerTableData: standardRowIds.map((rowId) => rebuildStandardRow(reader, employmentId, rowId)),
    fuldLoenUnderFerie: readOrEmpty(reader, e.fuldLoenUnderFerie.bind(employmentId)),
    harAnciennitetstillaegEfterSkadedatoen: readOrEmpty(reader, e.harAnciennitetstillaegEfterSkadedatoen.bind(employmentId)),
    anciennitetstillaegDato: readOrEmpty(reader, e.anciennitetstillaegDato.bind(employmentId)),
    anciennitetstillaegSatsAngivesPer: readOrEmpty(reader, e.anciennitetstillaegSatsAngivesPer.bind(employmentId)),
    anciennitetstillaegSats: readOrEmpty(reader, e.anciennitetstillaegSats.bind(employmentId)),
    feriePct: readOrEmpty(reader, e.feriePct.bind(employmentId)),
    loenPaaHelligdage: readOrEmpty(reader, e.loenPaaHelligdage.bind(employmentId)),
    saerligFraDatoRegulering: readOrEmpty(reader, e.saerligFraDatoRegulering.bind(employmentId)),
    loenudviklingBeregningsgrundlag: readOrEmpty(reader, e.loenudviklingBeregningsgrundlag.bind(employmentId)),
    loenudviklingStatistikModel: readOrEmpty(reader, e.loenudviklingStatistikModel.bind(employmentId)),
    loenudviklingKRLSatstabel: readOrEmpty(reader, e.loenudviklingKRLSatstabel.bind(employmentId)),
    loenudviklingManuelNavn: readOrEmpty(reader, e.loenudviklingManuelNavn.bind(employmentId)),
    loenudviklingManuelTableData: manualRowIds.map((rowId) => rebuildManualRow(reader, eoEmploymentManual, employmentId, rowId)),
    loenudviklingManuelProcentsatsTableData: manualPercentRowIds.map((rowId) =>
      rebuildManualPercentRow(reader, eoEmploymentManual, employmentId, rowId)),
    offentligLoenType: readOrEmpty(reader, e.offentligLoenType.bind(employmentId)),
    offentligLoenTrin: readOrEmpty(reader, e.offentligLoenTrin.bind(employmentId)),
    offentligLoenGruppe: readOrEmpty(reader, e.offentligLoenGruppe.bind(employmentId)),
    offentligLoenEkstraGrundloen: readOrEmpty(reader, e.offentligLoenEkstraGrundloen.bind(employmentId)),
    overenskomstFilter: {
      loenmodtager: readOrEmpty(reader, eoEmploymentFilterFields.loenmodtager.bind(employmentId)),
      arbejdsgiver: readOrEmpty(reader, eoEmploymentFilterFields.arbejdsgiver.bind(employmentId)),
    },
  };
};

/** Rekonstruerer det singulære `eoAngivetLoenLoenudvikling`-property-objekt (bruges ved 'Angivet måneds-/dagsløn'). */
const rebuildAngivetLoenLoenudvikling = (reader: InputReader): EOAngivetLoenLoenudvikling => {
  const a = eoAngivetLoenFields;
  const manual = eoAngivetLoenManual;
  const eoLoenPropertyPath: CollectionRef['path'] = [{ kind: 'property', name: 'eoAngivetLoenLoenudvikling' }];
  const manualRowIds = reader
    .listEntities(createCollectionRef({ section: S, path: eoLoenPropertyPath, collection: 'loenudviklingManuelTableData' }))
    .map((entity) => entity.entityId);
  const manualPercentRowIds = reader
    .listEntities(createCollectionRef({ section: S, path: eoLoenPropertyPath, collection: 'loenudviklingManuelProcentsatsTableData' }))
    .map((entity) => entity.entityId);
  return {
    overenskomstId: readOrEmpty(reader, a.overenskomstId.bind()),
    harAnciennitetstillaegEfterSkadedatoen: readOrEmpty(reader, a.harAnciennitetstillaegEfterSkadedatoen.bind()),
    anciennitetstillaegDato: readOrEmpty(reader, a.anciennitetstillaegDato.bind()),
    anciennitetstillaegSatsAngivesPer: readOrEmpty(reader, a.anciennitetstillaegSatsAngivesPer.bind()),
    anciennitetstillaegSats: readOrEmpty(reader, a.anciennitetstillaegSats.bind()),
    feriePct: readOrEmpty(reader, a.feriePct.bind()),
    loenPaaHelligdage: readOrEmpty(reader, a.loenPaaHelligdage.bind()),
    saerligFraDatoRegulering: readOrEmpty(reader, a.saerligFraDatoRegulering.bind()),
    loenudviklingBeregningsgrundlag: readOrEmpty(reader, a.loenudviklingBeregningsgrundlag.bind()),
    loenudviklingStatistikModel: readOrEmpty(reader, a.loenudviklingStatistikModel.bind()),
    loenudviklingKRLSatstabel: readOrEmpty(reader, a.loenudviklingKRLSatstabel.bind()),
    loenudviklingManuelNavn: readOrEmpty(reader, a.loenudviklingManuelNavn.bind()),
    loenudviklingManuelTableData: manualRowIds.map((rowId) => rebuildPropertyManualRow(reader, manual, rowId)),
    loenudviklingManuelProcentsatsTableData: manualPercentRowIds.map((rowId) => rebuildPropertyManualPercentRow(reader, manual, rowId)),
    offentligLoenType: readOrEmpty(reader, a.offentligLoenType.bind()),
    offentligLoenTrin: readOrEmpty(reader, a.offentligLoenTrin.bind()),
    offentligLoenGruppe: readOrEmpty(reader, a.offentligLoenGruppe.bind()),
    offentligLoenEkstraGrundloen: readOrEmpty(reader, a.offentligLoenEkstraGrundloen.bind()),
    overenskomstFilter: {
      loenmodtager: readOrEmpty(reader, eoAngivetLoenFilterFields.loenmodtager.bind()),
      arbejdsgiver: readOrEmpty(reader, eoAngivetLoenFilterFields.arbejdsgiver.bind()),
    },
  };
};

/** Manuel-række under det singulære property-objekt (ingen employment-entity i stien → bind uden id). */
const rebuildPropertyManualRow = (reader: InputReader, manual: ManualBindings, rowId: string): LoenudviklingManuelRow => ({
  id: rowId,
  dato: readOrEmpty(reader, manual.manualFields.dato.bind(rowId)),
  grundloen: readOrEmpty(reader, manual.manualFields.grundloen.bind(rowId)),
  feriepenge: readOrEmpty(reader, manual.manualFields.feriepenge.bind(rowId)),
  shSoSats: readOrEmpty(reader, manual.manualFields.shSoSats.bind(rowId)),
  fritvalg: readOrEmpty(reader, manual.manualFields.fritvalg.bind(rowId)),
  agPension: readOrEmpty(reader, manual.manualFields.agPension.bind(rowId)),
});

const rebuildPropertyManualPercentRow = (
  reader: InputReader,
  manual: ManualBindings,
  rowId: string
): LoenudviklingManuelProcentsatsRow => ({
  id: rowId,
  dato: readOrEmpty(reader, manual.manualPercentFields.dato.bind(rowId)),
  procent: readOrEmpty(reader, manual.manualPercentFields.procent.bind(rowId)),
});

// ── Top-level collection-rekonstruktion ─────────────────────────────────────────────
const rebuildTafPeriodeRow = (reader: InputReader, rowId: string): TafPeriodeRow => ({
  id: rowId,
  fra: readOrEmpty(reader, eoTafPeriodeFraField.bind(rowId)),
  til: readOrEmpty(reader, eoTafPeriodeTilField.bind(rowId)),
  loseFeriedage: readOrEmpty(reader, eoTafPeriodeLoseFeriedageField.bind(rowId)),
});

const rebuildFerieperiodeRow = (
  reader: InputReader,
  fraField: typeof eoFerieperiodeFraField,
  tilField: typeof eoFerieperiodeTilField,
  rowId: string
): FerieperiodeRow => ({
  id: rowId,
  fra: readOrEmpty(reader, fraField.bind(rowId)),
  til: readOrEmpty(reader, tilField.bind(rowId)),
});

const rebuildSvieSmerteRow = (reader: InputReader, rowId: string): SvieSmertePeriodeRow => ({
  id: rowId,
  fra: readOrEmpty(reader, eoSvieSmertePeriodeFraField.bind(rowId)),
  til: readOrEmpty(reader, eoSvieSmertePeriodeTilField.bind(rowId)),
  tilstand: readOrEmpty(reader, eoSvieSmertePeriodeTilstandField.bind(rowId)),
});

const rebuildOevrigeKravRow = (reader: InputReader, rowId: string): OevrigeKravRow => ({
  id: rowId,
  dato: readOrEmpty(reader, eoOevrigeKravDatoField.bind(rowId)),
  udgiftTil: readOrEmpty(reader, eoOevrigeKravUdgiftTilField.bind(rowId)),
  beloeb: readOrEmpty(reader, eoOevrigeKravBeloebField.bind(rowId)),
});

const rebuildOffentligeYdelserRow = (reader: InputReader, rowId: string): OffentligeYdelserRow => ({
  id: rowId,
  fraDato: readOrEmpty(reader, eoOffentligeYdelserFraDatoField.bind(rowId)),
  tilDato: readOrEmpty(reader, eoOffentligeYdelserTilDatoField.bind(rowId)),
  ydelse: readOrEmpty(reader, eoOffentligeYdelserYdelseField.bind(rowId)),
  tillaeg: readOrEmpty(reader, eoOffentligeYdelserTillaegField.bind(rowId)),
  ydelsestype: readOrEmpty(reader, eoOffentligeYdelserYdelsestypeField.bind(rowId)),
});

const rebuildSfggRow = (reader: InputReader, ansaettelsesforholdId: string): SygeferiegodtgoerelseAnsaettelsesforholdRow => ({
  ansaettelsesforholdId,
  sfggBeregningskilde: readOrEmpty(reader, eoSfggBeregningskildeField.bind(ansaettelsesforholdId)),
  sfggReferenceperiodeFra: readOrEmpty(reader, eoSfggReferenceperiodeFraField.bind(ansaettelsesforholdId)),
  sfggReferenceperiodeTil: readOrEmpty(reader, eoSfggReferenceperiodeTilField.bind(ansaettelsesforholdId)),
  sfggReferenceperiodeFravaersdageUdenLoen: readOrEmpty(reader, eoSfggReferenceperiodeFravaersdageUdenLoenField.bind(ansaettelsesforholdId)),
  sfggManuelDagssats: readOrEmpty(reader, eoSfggManuelDagssatsField.bind(ansaettelsesforholdId)),
  sfggManuelBeloebIHenholdTil: readOrEmpty(reader, eoSfggManuelBeloebIHenholdTilField.bind(ansaettelsesforholdId)),
  sfggManuelFoerstEfterSygeloen: readOrEmpty(reader, eoSfggManuelFoerstEfterSygeloenField.bind(ansaettelsesforholdId)),
  sfggSatsvalg: readOrEmpty(reader, eoSfggSatsvalgField.bind(ansaettelsesforholdId)),
  sfggAlleredeBetaltBeloeb: readOrEmpty(reader, eoSfggAlleredeBetaltBeloebField.bind(ansaettelsesforholdId)),
});

const listRowIds = (reader: InputReader, collection: CollectionRef): readonly string[] =>
  reader.listEntities(collection).map((entity) => entity.entityId);

/** Rekonstruerer det komplette, schema-formede `ErstatningsopgoerelseValues` fra readeren (ikke-blokerende). */
export const readErstatningsopgoerelseValues = (
  reader: InputReader
): PersistedErstatningsopgoerelseValues => {
  const employmentIds = listRowIds(reader, eoLoenindkomstAnsaettelsesforholdCollection.template as CollectionRef);
  return {
    eoNummer: readOrEmpty(reader, eoNummerField.bind()),
    eoLedsagetekst: readOrEmpty(reader, eoLedsagetekstField.bind()),
    opgørelseLavetDen: readOrEmpty(reader, eoOpgørelseLavetDenField.bind()),
    indsaetUdkastStempel: readOrEmpty(reader, eoIndsaetUdkastStempelField.bind()),
    vedroererPeriodeFra: readOrEmpty(reader, eoVedroererPeriodeFraField.bind()),
    vedroererPeriodeTil: readOrEmpty(reader, eoVedroererPeriodeTilField.bind()),
    revideretOpgoerelse: readOrEmpty(reader, eoRevideretOpgoerelseField.bind()),
    midlertidigtEetFraEetSiden: readOrEmpty(reader, eoMidlertidigtEetFraEetSidenField.bind()),
    regulerOffentligeYdelser: readOrEmpty(reader, eoRegulerOffentligeYdelserField.bind()),
    erstatningsopgoerelseAfsluttesMed: readOrEmpty(reader, eoAfsluttesMedField.bind()),
    forligAnsvarsgradProcent: readOrEmpty(reader, eoForligAnsvarsgradProcentField.bind()),
    forligAnsvarsgradBroek: readOrEmpty(reader, eoForligAnsvarsgradBroekField.bind()),
    forligDato: readOrEmpty(reader, eoForligDatoField.bind()),
    kravPaaOevrigeErstatningskrav: readOrEmpty(reader, eoKravPaaOevrigeErstatningskravField.bind()),
    oevrigeKravPerioder: listRowIds(reader, eoOevrigeKravPerioderCollection.template as CollectionRef)
      .map((rowId) => rebuildOevrigeKravRow(reader, rowId)),
    offentligeYdelserRows: listRowIds(reader, eoOffentligeYdelserRowsCollection.template as CollectionRef)
      .map((rowId) => rebuildOffentligeYdelserRow(reader, rowId)),
    offentligeYdelserKommentarer: readOrEmpty(reader, eoOffentligeYdelserKommentarerField.bind()),
    saerligeKommentarer: readOrEmpty(reader, eoSaerligeKommentarerField.bind()),
    eoBilagSelection: {
      opgoerelse: readOrEmpty(reader, eoBilagSelectionOpgoerelseField.bind()),
      loenindkomst: readOrEmpty(reader, eoBilagSelectionLoenindkomstField.bind()),
      offentligeYdelser: readOrEmpty(reader, eoBilagSelectionOffentligeYdelserField.bind()),
      midlertidigEet: readOrEmpty(reader, eoBilagSelectionMidlertidigEetField.bind()),
      shDage: readOrEmpty(reader, eoBilagSelectionShDageField.bind()),
      regulering: readOrEmpty(reader, eoBilagSelectionReguleringField.bind()),
      okSatser: readOrEmpty(reader, eoBilagSelectionOkSatserField.bind()),
      sygeferiegodtgoerelse: readOrEmpty(reader, eoBilagSelectionSygeferiegodtgoerelseField.bind()),
    },
    eoBilagLoenindkomstOgOffentligeYdelserIndgaar: readOrEmpty(reader, eoBilagIndgaarField.bind()),
    varigeMenAfgorelse: readOrEmpty(reader, eoVarigeMenAfgorelseField.bind()),
    menAfgoerelseDato: readOrEmpty(reader, eoMenAfgoerelseDatoField.bind()),
    verserendeKlageMen: readOrEmpty(reader, eoVerserendeKlageMenField.bind()),
    midlertidigtEETAfgorelse: readOrEmpty(reader, eoMidlertidigtEETAfgorelseField.bind()),
    midlertidigEETAfgoerelseDato: readOrEmpty(reader, eoMidlertidigEETAfgoerelseDatoField.bind()),
    midlertidigEETVirkningsdato: readOrEmpty(reader, eoMidlertidigEETVirkningsdatoField.bind()),
    endeligtEETAfgorelse: readOrEmpty(reader, eoEndeligtEETAfgorelseField.bind()),
    endeligEETAfgoerelseDato: readOrEmpty(reader, eoEndeligEETAfgoerelseDatoField.bind()),
    endeligEETVirkningsdato: readOrEmpty(reader, eoEndeligEETVirkningsdatoField.bind()),
    verserendeKlageEet: readOrEmpty(reader, eoVerserendeKlageEetField.bind()),
    differencekravDato: readOrEmpty(reader, eoDifferencekravDatoField.bind()),
    kravPaaSvieSmerteGodtgoerelse: readOrEmpty(reader, eoKravPaaSvieSmerteGodtgoerelseField.bind()),
    svieSmerteHelbredsstatus: readOrEmpty(reader, eoSvieSmerteHelbredsstatusField.bind()),
    tidligereSsMax: readOrEmpty(reader, eoTidligereSsMaxField.bind()),
    svieSmertePerioder: listRowIds(reader, eoSvieSmertePerioderCollection.template as CollectionRef)
      .map((rowId) => rebuildSvieSmerteRow(reader, rowId)),
    svieSmerteSatserAar: readOrEmpty(reader, eoSvieSmerteSatserAarField.bind()),
    svieSmerteDelvisSygemeldingSats: readOrEmpty(reader, eoSvieSmerteDelvisSygemeldingSatsField.bind()),
    svieSmerteTidligereTotal: readOrEmpty(reader, eoSvieSmerteTidligereTotalField.bind()),
    svieSmerteAktuelPeriode: readOrEmpty(reader, eoSvieSmerteAktuelPeriodeField.bind()),
    kravPaaTabtArbejdsfortjeneste: readOrEmpty(reader, eoKravPaaTabtArbejdsfortjenesteField.bind()),
    tafArbejdsstatus: readOrEmpty(reader, eoTafArbejdsstatusField.bind()),
    tafPerioder: listRowIds(reader, eoTafPerioderCollection.template as CollectionRef)
      .map((rowId) => rebuildTafPeriodeRow(reader, rowId)),
    ferieperioder: listRowIds(reader, eoFerieperioderCollection.template as CollectionRef)
      .map((rowId) => rebuildFerieperiodeRow(reader, eoFerieperiodeFraField, eoFerieperiodeTilField, rowId)),
    sidsteDagAnsaettelsesforhold: readOrEmpty(reader, eoSidsteDagAnsaettelsesforholdField.bind()),
    tidligereModtagetTaf: readOrEmpty(reader, eoTidligereModtagetTafField.bind()),
    komprimerBeregningEfterFoersteOpgoerelse: readOrEmpty(reader, eoKomprimerBeregningField.bind()),
    beregnesUdFra: readOrEmpty(reader, eoBeregnesUdFraField.bind()),
    tafBeregningsperiodeFra: readOrEmpty(reader, eoTafBeregningsperiodeFraField.bind()),
    tafBeregningsperiodeTil: readOrEmpty(reader, eoTafBeregningsperiodeTilField.bind()),
    fravaerPerioder: listRowIds(reader, eoFravaerPerioderCollection.template as CollectionRef)
      .map((rowId) => rebuildFerieperiodeRow(reader, eoFravaerPeriodeFraField, eoFravaerPeriodeTilField, rowId)),
    uspecificeredeFerieFridage: readOrEmpty(reader, eoUspecificeredeFerieFridageField.bind()),
    oevrigtFravaerUdenLoen: readOrEmpty(reader, eoOevrigtFravaerUdenLoenField.bind()),
    oevrigeFravaersdage: readOrEmpty(reader, eoOevrigeFravaersdageField.bind()),
    oevrigeFravaersdageBeskrivelse: readOrEmpty(reader, eoOevrigeFravaersdageBeskrivelseField.bind()),
    maanedsloenenUdgoer: readOrEmpty(reader, eoMaanedsloenenUdgoerField.bind()),
    dagsloenenUdgoer: readOrEmpty(reader, eoDagsloenenUdgoerField.bind()),
    angivetMaanedsloenBaseretPaa: readOrEmpty(reader, eoAngivetMaanedsloenBaseretPaaField.bind()),
    angivetMaanedsloenOpreguleresFraDato: readOrEmpty(reader, eoAngivetMaanedsloenOpreguleresFraDatoField.bind()),
    angivetDagsloenBaseretPaa: readOrEmpty(reader, eoAngivetDagsloenBaseretPaaField.bind()),
    angivetDagsloenOpreguleresFraDato: readOrEmpty(reader, eoAngivetDagsloenOpreguleresFraDatoField.bind()),
    sfggAnsaettelsesforhold: listRowIds(reader, eoSfggAnsaettelsesforholdCollection.template as CollectionRef)
      .map((rowId) => rebuildSfggRow(reader, rowId)),
    loenindkomstAnsaettelsesforhold: employmentIds.map((employmentId) => rebuildEmploymentRow(reader, employmentId)),
    eoAngivetLoenLoenudvikling: rebuildAngivetLoenLoenudvikling(reader),
    visBilagsnumre: readOrEmpty(reader, eoVisBilagsnumreField.bind()),
    bilagsnumreMenAfgoerelse: readOrEmpty(reader, eoBilagsnumreMenAfgoerelseField.bind()),
    bilagsnumreEetAfgoerelser: readOrEmpty(reader, eoBilagsnumreEetAfgoerelserField.bind()),
    bilagsnumreSvieSmerteDokumentation: readOrEmpty(reader, eoBilagsnumreSvieSmerteDokumentationField.bind()),
    bilagsnumreBeregningsgrundlagTaf: readOrEmpty(reader, eoBilagsnumreBeregningsgrundlagTafField.bind()),
    bilagsnumreLoenISygeperioden: readOrEmpty(reader, eoBilagsnumreLoenISygeperiodenField.bind()),
    bilagsnumreOffentligeYdelser: readOrEmpty(reader, eoBilagsnumreOffentligeYdelserField.bind()),
    bilagsnumreOevrigeErstatningskrav: readOrEmpty(reader, eoBilagsnumreOevrigeErstatningskravField.bind()),
  };
};

/** Rekonstruerer det komplette `StamdataValues` fra readeren (ikke-blokerende). */
export const readStamdataValues = (reader: InputReader): StamdataValues => ({
  journalnr: readOrEmpty(reader, stamdataJournalnrField.bind()),
  advokat: readOrEmpty(reader, stamdataAdvokatField.bind()),
  sagsbehandler: readOrEmpty(reader, stamdataSagsbehandlerField.bind()),
  skadelidte: readOrEmpty(reader, stamdataSkadelidteField.bind()),
  skadelidteFodselsdato: readOrEmpty(reader, stamdataSkadelidteFodselsdatoField.bind()),
  skadestype: readOrEmpty(reader, stamdataSkadestypeField.bind()),
  skadedato: readOrEmpty(reader, stamdataSkadedatoField.bind()),
});

// ── Fejl-map-rekonstruktion ─────────────────────────────────────────────────────────
export type ErstatningsopgoerelseReaderProjection = Readonly<{
  /** Det ENE snapshot (uændret beregning). Driver Beregning/Inspektion/Kontroltabel + download-gaten. */
  snapshot: EoSnapshot;
  /** De reader-rekonstruerede EO-værdier (skjulte røde felter = tomværdi). Til fane-visning + gate-input. */
  eoValues: ErstatningsopgoerelseValues;
  /** De reader-rekonstruerede stamdata-værdier. */
  stamdataValues: StamdataValues;
  /** Section-field-error-maps (top-level feltnavn + `${afId}:loenindkomst`-aggregat) til inspektion-echo + gate. */
  eoErrors: FieldIssueSet;
  stamdataErrors: FieldIssueSet;
  /** Aktiv manuel reguleringsforms strenge datoregel, adresseret direkte til de berørte datoceller. */
  manualRegulationDateIssues: FieldIssueSet;
  /** TAF-cutoff mod differencekrav/EET, adresseret til den konkrete fra-/til-celle der overskrider grænsen. */
  tafCutoffDateIssues: FieldIssueSet;
  // EO-dokumenterne læser `stamdataValues`, mens blokeringen sker gennem snapshottets strukturelle
  // stamdata-invarianter. Projektionen må ikke bære en ekstra, ulæst `documentStamdata`-projektion,
  // fordi den ville ligne en dependency-erklæring uden faktisk at gate outputtet.
  /** Kildesnapshottets token — issue-snapshot og reader stammer fra samme evaluering (§3.4). */
  sourceToken: EvaluationSourceToken;
}>;

const mergeIssues = (...sets: readonly (readonly FieldIssue[])[]): readonly FieldIssue[] =>
  Object.freeze([...new Set(sets.flat())]);

/**
 * Læser de konkrete refs, der bygger hver uafhængig beregningsgrens input. Collection-celler bindes til
 * de aktuelle række-id'er; blockers kan derfor ikke drive fra motorens read-set via et tekst-ID-inventar.
 */
const buildEoDependencyProjection = (
  reader: InputReader,
  aggregateEoIssues: readonly FieldIssue[],
  /**
   * Domæne-projekterede rækkeregler (manuel regulering + TAF-cutoff). De dannes efter readerens egne
   * feltreads, men skal blokere præcis samme beregningsgren som en rød cellefejl fra descriptoren.
   */
  projectedRowIssues: readonly FieldIssue[]
): EoDependencyProjection => {
  const forlig = createTrackedInputReader(reader);
  const forligInput = {
    forligAnsvarsgradProcent: readOrEmpty(forlig.reader, eoForligAnsvarsgradProcentField.bind()),
    forligAnsvarsgradBroek: readOrEmpty(forlig.reader, eoForligAnsvarsgradBroekField.bind()),
  };
  readOrEmpty(forlig.reader, eoForligDatoField.bind());

  const svieSmerte = createTrackedInputReader(reader);
  const svieSmerteValues: SvieSmerteCalculationValues = {
    kravPaaSvieSmerteGodtgoerelse: readOrEmpty(svieSmerte.reader, eoKravPaaSvieSmerteGodtgoerelseField.bind()),
    tidligereSsMax: readOrEmpty(svieSmerte.reader, eoTidligereSsMaxField.bind()),
    vedroererPeriodeFra: readOrEmpty(svieSmerte.reader, eoVedroererPeriodeFraField.bind()),
    vedroererPeriodeTil: readOrEmpty(svieSmerte.reader, eoVedroererPeriodeTilField.bind()),
    menAfgoerelseDato: readOrEmpty(svieSmerte.reader, eoMenAfgoerelseDatoField.bind()),
    varigeMenAfgorelse: readOrEmpty(svieSmerte.reader, eoVarigeMenAfgorelseField.bind()),
    verserendeKlageMen: readOrEmpty(svieSmerte.reader, eoVerserendeKlageMenField.bind()),
    svieSmerteSatserAar: readOrEmpty(svieSmerte.reader, eoSvieSmerteSatserAarField.bind()),
    svieSmerteDelvisSygemeldingSats: readOrEmpty(svieSmerte.reader, eoSvieSmerteDelvisSygemeldingSatsField.bind()),
    svieSmerteTidligereTotal: readOrEmpty(svieSmerte.reader, eoSvieSmerteTidligereTotalField.bind()),
    svieSmerteAktuelPeriode: readOrEmpty(svieSmerte.reader, eoSvieSmerteAktuelPeriodeField.bind()),
    svieSmertePerioder: listRowIds(svieSmerte.reader, eoSvieSmertePerioderCollection.template as CollectionRef)
      .map((rowId) => rebuildSvieSmerteRow(svieSmerte.reader, rowId)),
    forligAnsvarsgradProcent: forligInput.forligAnsvarsgradProcent,
    forligAnsvarsgradBroek: forligInput.forligAnsvarsgradBroek,
  };
  const svieSmerteStamdata = {
    skadedato: readOrEmpty(svieSmerte.reader, stamdataSkadedatoField.bind()),
    skadestype: readOrEmpty(svieSmerte.reader, stamdataSkadestypeField.bind()),
  };

  const taf = createTrackedInputReader(reader);
  const tafValues: TafCalculationValues = {
    eoNummer: readOrEmpty(taf.reader, eoNummerField.bind()),
    opgørelseLavetDen: readOrEmpty(taf.reader, eoOpgørelseLavetDenField.bind()),
    kravPaaTabtArbejdsfortjeneste: readOrEmpty(taf.reader, eoKravPaaTabtArbejdsfortjenesteField.bind()),
    tidligereModtagetTaf: readOrEmpty(taf.reader, eoTidligereModtagetTafField.bind()),
    uspecificeredeFerieFridage: readOrEmpty(taf.reader, eoUspecificeredeFerieFridageField.bind()),
    oevrigtFravaerUdenLoen: readOrEmpty(taf.reader, eoOevrigtFravaerUdenLoenField.bind()),
    oevrigeFravaersdage: readOrEmpty(taf.reader, eoOevrigeFravaersdageField.bind()),
    oevrigeFravaersdageBeskrivelse: readOrEmpty(taf.reader, eoOevrigeFravaersdageBeskrivelseField.bind()),
    maanedsloenenUdgoer: readOrEmpty(taf.reader, eoMaanedsloenenUdgoerField.bind()),
    dagsloenenUdgoer: readOrEmpty(taf.reader, eoDagsloenenUdgoerField.bind()),
    beregnesUdFra: readOrEmpty(taf.reader, eoBeregnesUdFraField.bind()),
    tafBeregningsperiodeFra: readOrEmpty(taf.reader, eoTafBeregningsperiodeFraField.bind()),
    tafBeregningsperiodeTil: readOrEmpty(taf.reader, eoTafBeregningsperiodeTilField.bind()),
    vedroererPeriodeFra: readOrEmpty(taf.reader, eoVedroererPeriodeFraField.bind()),
    vedroererPeriodeTil: readOrEmpty(taf.reader, eoVedroererPeriodeTilField.bind()),
    differencekravDato: readOrEmpty(taf.reader, eoDifferencekravDatoField.bind()),
    midlertidigtEETAfgorelse: readOrEmpty(taf.reader, eoMidlertidigtEETAfgorelseField.bind()),
    midlertidigEETAfgoerelseDato: readOrEmpty(taf.reader, eoMidlertidigEETAfgoerelseDatoField.bind()),
    midlertidigEETVirkningsdato: readOrEmpty(taf.reader, eoMidlertidigEETVirkningsdatoField.bind()),
    endeligtEETAfgorelse: readOrEmpty(taf.reader, eoEndeligtEETAfgorelseField.bind()),
    endeligEETAfgoerelseDato: readOrEmpty(taf.reader, eoEndeligEETAfgoerelseDatoField.bind()),
    endeligEETVirkningsdato: readOrEmpty(taf.reader, eoEndeligEETVirkningsdatoField.bind()),
    verserendeKlageEet: readOrEmpty(taf.reader, eoVerserendeKlageEetField.bind()),
    regulerOffentligeYdelser: readOrEmpty(taf.reader, eoRegulerOffentligeYdelserField.bind()),
    midlertidigtEetFraEetSiden: readOrEmpty(taf.reader, eoMidlertidigtEetFraEetSidenField.bind()),
    angivetMaanedsloenBaseretPaa: readOrEmpty(taf.reader, eoAngivetMaanedsloenBaseretPaaField.bind()),
    angivetMaanedsloenOpreguleresFraDato: readOrEmpty(
      taf.reader,
      eoAngivetMaanedsloenOpreguleresFraDatoField.bind()
    ),
    angivetDagsloenBaseretPaa: readOrEmpty(taf.reader, eoAngivetDagsloenBaseretPaaField.bind()),
    angivetDagsloenOpreguleresFraDato: readOrEmpty(taf.reader, eoAngivetDagsloenOpreguleresFraDatoField.bind()),
    tafPerioder: listRowIds(taf.reader, eoTafPerioderCollection.template as CollectionRef)
      .map((rowId) => rebuildTafPeriodeRow(taf.reader, rowId)),
    ferieperioder: listRowIds(taf.reader, eoFerieperioderCollection.template as CollectionRef)
      .map((rowId) => rebuildFerieperiodeRow(taf.reader, eoFerieperiodeFraField, eoFerieperiodeTilField, rowId)),
    fravaerPerioder: listRowIds(taf.reader, eoFravaerPerioderCollection.template as CollectionRef)
      .map((rowId) => rebuildFerieperiodeRow(taf.reader, eoFravaerPeriodeFraField, eoFravaerPeriodeTilField, rowId)),
    offentligeYdelserRows: listRowIds(taf.reader, eoOffentligeYdelserRowsCollection.template as CollectionRef)
      .map((rowId) => rebuildOffentligeYdelserRow(taf.reader, rowId)),
    sfggAnsaettelsesforhold: listRowIds(taf.reader, eoSfggAnsaettelsesforholdCollection.template as CollectionRef)
      .map((rowId) => rebuildSfggRow(taf.reader, rowId)),
    loenindkomstAnsaettelsesforhold: listRowIds(
      taf.reader,
      eoLoenindkomstAnsaettelsesforholdCollection.template as CollectionRef
    ).map((rowId) => rebuildEmploymentRow(taf.reader, rowId)),
    eoAngivetLoenLoenudvikling: rebuildAngivetLoenLoenudvikling(taf.reader),
  };
  const tafStamdata = {
    skadedato: readOrEmpty(taf.reader, stamdataSkadedatoField.bind()),
    skadestype: readOrEmpty(taf.reader, stamdataSkadestypeField.bind()),
  };

  const oevrigeKrav = createTrackedInputReader(reader);
  const oevrigeKravInput = {
    kravPaaOevrigeErstatningskrav: readOrEmpty(
      oevrigeKrav.reader,
      eoKravPaaOevrigeErstatningskravField.bind()
    ),
    oevrigeKravPerioder: listRowIds(
      oevrigeKrav.reader,
      eoOevrigeKravPerioderCollection.template as CollectionRef
    ).map((rowId) => rebuildOevrigeKravRow(oevrigeKrav.reader, rowId)),
  };

  const documentStamdata = createTrackedInputReader(reader);
  readOrEmpty(documentStamdata.reader, stamdataJournalnrField.bind());
  readOrEmpty(documentStamdata.reader, stamdataSkadelidteField.bind());
  readOrEmpty(documentStamdata.reader, stamdataAdvokatField.bind());
  readOrEmpty(documentStamdata.reader, stamdataSagsbehandlerField.bind());
  readOrEmpty(documentStamdata.reader, stamdataSkadedatoField.bind());
  readOrEmpty(documentStamdata.reader, stamdataSkadestypeField.bind());

  const svieSmerteIssues = svieSmerte.readIssues();
  const forligIssues = forlig.readIssues();
  // Manuel regulering er TAF-input. Collection-reglen dannes efter readerens egne feltreads, men skal
  // blokere præcis samme beregningsgren som en rød cellefejl fra descriptoren.
  const tafIssues = mergeIssues(taf.readIssues(), projectedRowIssues);
  const oevrigeKravIssues = oevrigeKrav.readIssues();
  return Object.freeze({
    svieSmerteInput: {
      erstatningsopgoerelse: svieSmerteValues,
      stamdata: svieSmerteStamdata,
    },
    forligInput,
    tafInput: { values: tafValues, stamdata: tafStamdata },
    oevrigeKravInput,
    svieSmerteIssues,
    forligIssues,
    tafIssues,
    oevrigeKravIssues,
    aggregateIssues: mergeIssues(
      aggregateEoIssues,
      documentStamdata.readIssues(),
      svieSmerteIssues,
      forligIssues,
      tafIssues,
      oevrigeKravIssues
    ),
  });
};

/**
 * Bygger den kanoniske reader-afledte projektion for Erstatningsopgørelse. Rekonstruerer de fulde EO-/stamdata-
 * værdier fra readeren, kører `computeEoSnapshot` UÆNDRET (§5.4) og udleder de field-error-maps, som inspektion-
 * echoet og den nedstrøms download-gate forbruger.
 */
export const buildErstatningsopgoerelseReaderProjection = (
  reader: InputReader,
  options?: Readonly<{ revision?: string; midlertidigtEetInsertSource?: EetImportSource | null }>
): ErstatningsopgoerelseReaderProjection => {
  const eoProjection = createTrackedInputReader(reader);
  const stamdataProjection = createTrackedInputReader(reader);
  const stamdataValues = readStamdataValues(stamdataProjection.reader);
  // Låste referencesatser er domæneafledning, ikke persisteret brugerinput.
  const eoValues = projectLoenindkomstSatser(
    readErstatningsopgoerelseValues(eoProjection.reader),
    stamdataValues
  );

  // Transient midlertidigt-EET-injektion: kun når togglen er 'Ja'.
  const midlertidigtEetImportContext =
    eoValues.midlertidigtEetFraEetSiden === 'Ja' && options?.midlertidigtEetInsertSource
      ? buildMidlertidigtEetImportContext(
        options.midlertidigtEetInsertSource,
        buildTafRanges(eoValues, { skadedatoISO: stamdataValues.skadedato })
      )
      : undefined;

  // Dependency-gatingens autoritet: de STRUKTURELLE røde feltissues i EO-sektionen.
  // `eoErrors` ovenfor er en PRÆSENTATIONS-projektion med kun 11 top-level feltnavne + løn-aggregatet; den kan
  // ikke se en rød rækkecelle, og en gate bygget på den lod motoren regne på readerens maskerede tomværdi.
  const manualRegulationDateIssueList = collectManualRegulationDateIssues(eoValues, stamdataValues);
  // TAF-cutoff (differencekrav + endeligt/midlertidigt EET) kan ikke ligge på descriptoren: grænsen udledes
  // af domæneregler (klage-suspension, 2011-skæringsdatoen, virkningsdato-præcedens). Den projekteres derfor
  // herfra med samme datogrundlag, som motorens clamping bruger, og bærer selv feltadressen.
  const tafCutoffDateIssueList = collectTafCutoffDateIssues(eoValues, stamdataValues);
  const projectedRowIssues = mergeIssues(manualRegulationDateIssueList, tafCutoffDateIssueList);
  const eoFieldIssues = mergeIssues(eoProjection.readIssues(), projectedRowIssues);
  const stamdataFieldIssues = stamdataProjection.readIssues();
  const eoErrors = buildFieldIssueSet(eoFieldIssues);
  const stamdataErrors = buildFieldIssueSet(stamdataFieldIssues);
  const dependencyProjection = buildEoDependencyProjection(
    reader,
    eoFieldIssues,
    projectedRowIssues
  );

  const snapshot = computeEoSnapshot({
    revision: options?.revision ?? `input-${String(reader.sourceToken.inputRevision)}-settings-${String(reader.sourceToken.settingsRevision)}`,
    stamdataValues,
    eoValues,
    stamdataErrors,
    eoErrors,
    dependencyProjection,
    ...(midlertidigtEetImportContext === undefined ? {} : { midlertidigtEetImportContext }),
  });

  return {
    snapshot,
    eoValues,
    stamdataValues,
    eoErrors,
    stamdataErrors,
    manualRegulationDateIssues: buildFieldIssueSet(manualRegulationDateIssueList),
    tafCutoffDateIssues: buildFieldIssueSet(tafCutoffDateIssueList),
    sourceToken: reader.sourceToken,
  };
};
