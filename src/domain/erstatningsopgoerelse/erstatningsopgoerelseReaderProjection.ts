import type { InputReader } from '../../inputCore/inputReader';
import type { FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';
import type { EvaluationSourceToken } from '../../inputCore/evaluationSource';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../types/branded';
import { createCollectionRef, type CollectionRef } from '../../inputCore/fieldAddress';
import type { ProjectionResult } from '../../inputCore/projection';
import type {
  EoInputIssue,
  EoInputIssueSource,
  EoInputIssues,
  EoStamdataInputIssues,
} from './eoInputIssues';
import type {
  ErstatningsopgoerelseValues,
  EOAngivetLoenLoenudvikling,
  FerieperiodeRow,
  LoenindkomstAnsaettelsesforhold,
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
import { projectStamdataForDocument } from '../stamdata/stamdataDocumentProjection';
import { computeEoSnapshot, type EoSnapshot } from './snapshot/eoSnapshot';
import { buildTafRanges } from './helpers/indtaegtPerioder';
import { buildMidlertidigtEetImportContext } from './helpers/midlertidigtEetTransientInjection';
import type { EetImportSource } from '../erhvervsevnetab/eetImportPort';

// Greenfield Erstatningsopgørelse-projektion (§3.4/§5.4/§1.10, Fase 2.4 trin 8 — den SIDSTE + STØRSTE slice). En
// ALMINDELIG ren funktion over den offentlige `InputReader`, der erstatter `Erstatningsopgoerelse.tsx`'s revisions-
// gatede `getPersistedSectionSnapshot`/`getFieldErrorsBySourceSnapshot`-effekt, som byggede `computeEoSnapshot`.
//
// Modsat de mindre slices har EO's snapshot-motor (`computeEoSnapshot`) sin egen `erstatningsopgoerelseValidator`,
// der re-validerer ALLE bounds/regler PÅ VÆRDIERNE (ikke på et fieldErrors-map). Blokeringen kommer derfor fra
// værdierne — ikke fra de to fieldErrors-maps, som motoren kun videregiver uændret til inspektion-snapshottet.
// Vi følger derfor Satser-/EET-/Forsørgertab-doktrinen (§3.4/§5.4):
//  - VALUE-REKONSTRUKTION: hvert felt læses gennem readeren og falder tilbage til sin canonical tomværdi, når
//    readeren skjuler en rød feltfejl (rejected format/range) ELLER en null-sektion giver `undefined` for et felt,
//    hvis tomværdi ikke er `undefined` (fx required-choice 'maaned'). Det er præcis, hvad legacy læste (den tomme/
//    maskerede canonical værdi). `computeEoSnapshot` køres UÆNDRET på det (§5.4 hårdt stop mod talændring).
//  - FEJL-MAPS: for inspektion-echoet + den nedstrøms download-gate (collectAllEoRows) bygges `eoErrors`/
//    `stamdataErrors` fra de RØDE reader-feltfejl, keyed by top-level feltnavn (reason→source: format→'invalid-draft',
//    bounds→'input'+blocksSave:false, rule→'rule'), plus det syntetiske `${afId}:loenindkomst`-aggregat, som legacy's
//    loenindkomst-view-model rapporterede, når en ansættelsesforholds StandardLoen-/manuel-regulerings-celle var ugyldig.
//    Kildeklassifikationen er observationelt neutral for row-buildere (source-agnostiske); kun `:loenindkomst`-
//    aggregatets `blocksSave`-flag afgør, om det tæller i suffix-gaten — derfor er det altid `input`+blocksSave:true.

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
const rebuildEmploymentRow = (reader: InputReader, employmentId: string): LoenindkomstAnsaettelsesforhold => {
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
    storeBededagPct: readOrEmpty(reader, e.storeBededagPct.bind(employmentId)),
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
export const readErstatningsopgoerelseValues = (reader: InputReader): ErstatningsopgoerelseValues => {
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
/** Reader-reason → legacy field-error source (jf. field-error-channel-analysen). */
const reasonToSource = (reason: string): EoInputIssueSource =>
  reason === 'format' ? 'invalid-draft' : reason === 'rule' ? 'rule' : reason === 'schema' ? 'schema' : 'input';

/**
 * En rød reader-feltfejl omsat til én EO-inputissue. Readerens `reason` bæres UÆNDRET videre, så
 * blokerings-konsekvensen kan udledes strukturelt af `eoIssueBlocksDependents` — ikke af et flag her.
 */
const toInputIssue = (message: string, reason: string): EoInputIssue => ({
  message,
  severity: 'error',
  source: reasonToSource(reason),
  reason: toIssueReason(reason),
});

/** Readerens årsagsstreng normaliseret til EO's årsagsunion. Ukendt årsag behandles konservativt som `rule`. */
const toIssueReason = (reason: string): EoInputIssue['reason'] =>
  reason === 'format' || reason === 'bounds' || reason === 'rule' || reason === 'schema' ? reason : 'rule';

/**
 * Bygger et section-field-error-map (keyed by top-level feltnavn) fra de RØDE reader-feltfejl på de opgivne felter.
 * Kun til inspektion-echoet + den nedstrøms download-gate (`collectAllEoRows`) — `computeEoSnapshot` bruger ikke
 * mappet til sin egen blokering (den kommer fra værdierne via `erstatningsopgoerelseValidator`).
 */
/** En rå read-adgang der udslettes til `unknown`, så heterogene refs kan holdes i én liste (variance-sikkert). */
type ErrorFieldEntry = Readonly<{ key: string; readIssue: (reader: InputReader) => Readonly<{ message: string; reason: string }> | undefined }>;

const errEntry = <T>(key: string, field: FieldRef<T>): ErrorFieldEntry => ({
  key,
  readIssue: (reader) => {
    const result = reader.read(field);
    return result.status === 'error' ? { message: result.issue.message, reason: result.issue.reason } : undefined;
  },
});

const collectSectionFieldErrors = (
  reader: InputReader,
  entries: readonly ErrorFieldEntry[]
): EoInputIssues => {
  const map: EoInputIssues = {};
  for (const { key, readIssue } of entries) {
    const issue = readIssue(reader);
    if (issue === undefined) continue;
    const error = toInputIssue(issue.message, issue.reason);
    map[key] = { ...(map[key] ?? {}), [error.source]: error };
  }
  return map;
};

/** Sand, hvis en ansættelsesforholds StandardLoen- eller manuel-regulerings-celle har en aktiv rød reader-feltfejl. */
const employmentHasLoenindkomstCellError = (reader: InputReader, employment: LoenindkomstAnsaettelsesforhold): boolean => {
  const employmentId = employment.id;
  // Heterogene celle-descriptors udslettes til `FieldDescriptor<unknown>`, så en enkelt løkke kan læse alle celletyper
  // (variance: `FieldRef<T>` er invariant, så union-refs kan ikke unificeres uden erasure).
  const cellHasError = (cell: FieldDescriptor<unknown>, ...ids: readonly string[]): boolean =>
    reader.read(cell.bind(...ids)).status === 'error';
  const asUnknown = (cell: FieldDescriptor<unknown> | FieldDescriptor<string | undefined> | FieldDescriptor<number | undefined> | FieldDescriptor<AmountValue | undefined> | FieldDescriptor<ISODateString | undefined>): FieldDescriptor<unknown> =>
    cell as FieldDescriptor<unknown>;
  for (const row of employment.indtaegtsoplysningerTableData) {
    for (const cell of Object.values(eoStandardRowFields)) {
      if (cellHasError(asUnknown(cell), employmentId, row.id)) return true;
    }
  }
  const manual = eoEmploymentManual;
  for (const row of employment.loenudviklingManuelTableData) {
    for (const cell of Object.values(manual.manualFields)) {
      if (cellHasError(asUnknown(cell), employmentId, row.id)) return true;
    }
  }
  for (const row of employment.loenudviklingManuelProcentsatsTableData) {
    for (const cell of Object.values(manual.manualPercentFields)) {
      if (cellHasError(asUnknown(cell), employmentId, row.id)) return true;
    }
  }
  return false;
};

const EO_TOP_LEVEL_ERROR_FIELDS: readonly ErrorFieldEntry[] = [
  errEntry('forligAnsvarsgradProcent', eoForligAnsvarsgradProcentField.bind()),
  errEntry('forligAnsvarsgradBroek', eoForligAnsvarsgradBroekField.bind()),
  errEntry('forligDato', eoForligDatoField.bind()),
  errEntry('svieSmerteSatserAar', eoSvieSmerteSatserAarField.bind()),
  errEntry('svieSmerteTidligereTotal', eoSvieSmerteTidligereTotalField.bind()),
  errEntry('svieSmerteAktuelPeriode', eoSvieSmerteAktuelPeriodeField.bind()),
  errEntry('tidligereModtagetTaf', eoTidligereModtagetTafField.bind()),
  errEntry('uspecificeredeFerieFridage', eoUspecificeredeFerieFridageField.bind()),
  errEntry('oevrigeFravaersdage', eoOevrigeFravaersdageField.bind()),
  errEntry('maanedsloenenUdgoer', eoMaanedsloenenUdgoerField.bind()),
  errEntry('dagsloenenUdgoer', eoDagsloenenUdgoerField.bind()),
];

const STAMDATA_ERROR_FIELDS: readonly ErrorFieldEntry[] = [
  errEntry('journalnr', stamdataJournalnrField.bind()),
  errEntry('advokat', stamdataAdvokatField.bind()),
  errEntry('sagsbehandler', stamdataSagsbehandlerField.bind()),
  errEntry('skadelidte', stamdataSkadelidteField.bind()),
  errEntry('skadelidteFodselsdato', stamdataSkadelidteFodselsdatoField.bind()),
  errEntry('skadestype', stamdataSkadestypeField.bind()),
  errEntry('skadedato', stamdataSkadedatoField.bind()),
];

export type ErstatningsopgoerelseReaderProjection = Readonly<{
  /** Det ENE snapshot (uændret beregning). Driver Beregning/Inspektion/Kontroltabel + download-gaten. */
  snapshot: EoSnapshot;
  /** De reader-rekonstruerede EO-værdier (skjulte røde felter = tomværdi). Til fane-visning + gate-input. */
  eoValues: ErstatningsopgoerelseValues;
  /** De reader-rekonstruerede stamdata-værdier. */
  stamdataValues: StamdataValues;
  /** Section-field-error-maps (top-level feltnavn + `${afId}:loenindkomst`-aggregat) til inspektion-echo + gate. */
  eoErrors: EoInputIssues;
  stamdataErrors: EoStamdataInputIssues;
  /** Fælles dokumentmetadata-projektion; samme resultat indgår i reaktiv gate og click-preflight. */
  documentStamdata: ProjectionResult<StamdataValues>;
  /** Kildesnapshottets token — issue-snapshot og reader stammer fra samme evaluering (§3.4). */
  sourceToken: EvaluationSourceToken;
}>;

/**
 * Bygger den kanoniske reader-afledte projektion for Erstatningsopgørelse. Rekonstruerer de fulde EO-/stamdata-
 * værdier fra readeren, kører `computeEoSnapshot` UÆNDRET (§5.4) og udleder de field-error-maps, som inspektion-
 * echoet og den nedstrøms download-gate forbruger.
 */
export const buildErstatningsopgoerelseReaderProjection = (
  reader: InputReader,
  options?: Readonly<{ revision?: string; midlertidigtEetInsertSource?: EetImportSource | null }>
): ErstatningsopgoerelseReaderProjection => {
  const eoValues = readErstatningsopgoerelseValues(reader);
  const stamdataValues = readStamdataValues(reader);

  const eoErrors: EoInputIssues = {
    ...collectSectionFieldErrors(reader, EO_TOP_LEVEL_ERROR_FIELDS),
  };
  // Det syntetiske `${afId}:loenindkomst`-aggregat: rapporteres når en ansættelsesforholds StandardLoen-/
  // manuel-regulerings-celle er ugyldig. Årsagen er `aggregate` (ikke `bounds`), så den blokerer de afhængige
  // consumers gennem `eoIssueBlocksDependents` — uanset hvilken celle-årsag der udløste den.
  for (const employment of eoValues.loenindkomstAnsaettelsesforhold) {
    if (employmentHasLoenindkomstCellError(reader, employment)) {
      eoErrors[`${employment.id}:loenindkomst`] = {
        input: { message: 'Ugyldig manuel regulering', severity: 'error', source: 'input', reason: 'aggregate' },
      };
    }
  }
  const stamdataErrors = collectSectionFieldErrors(reader, STAMDATA_ERROR_FIELDS);

  // Transient midlertidigt-EET-injection: kun når togglen er 'Ja' (uændret fra legacy-siden).
  const midlertidigtEetImportContext =
    eoValues.midlertidigtEetFraEetSiden === 'Ja' && options?.midlertidigtEetInsertSource
      ? buildMidlertidigtEetImportContext(
        options.midlertidigtEetInsertSource,
        buildTafRanges(eoValues, { skadedatoISO: stamdataValues.skadedato })
      )
      : undefined;

  const snapshot = computeEoSnapshot({
    revision: options?.revision ?? `input-${String(reader.sourceToken.inputRevision)}-settings-${String(reader.sourceToken.settingsRevision)}`,
    stamdataValues,
    eoValues,
    stamdataErrors,
    eoErrors,
    ...(midlertidigtEetImportContext === undefined ? {} : { midlertidigtEetImportContext }),
  });

  return {
    snapshot,
    eoValues,
    stamdataValues,
    eoErrors,
    stamdataErrors,
    documentStamdata: projectStamdataForDocument(reader, 'document.erstatningsopgoerelse'),
    sourceToken: reader.sourceToken,
  };
};
