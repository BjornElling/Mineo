import type { StorageKey } from '../../config/storageManifest';
import type { FieldRef } from '../fieldDefinition';
import { InputCatalog, type FieldBinding } from '../fieldCatalog';
import { satserAargangBinding } from './satserInputBindings';
import {
  renteberegningBeregningsdatoBinding,
  renteberegningKommentarerBinding,
  rentekravBelobBinding,
  rentekravEnhedBinding,
  rentekravRenterFraBinding,
  rentekravRowsBinding,
  rentekravTillaegstidBinding,
} from './renteberegningInputBindings';
import {
  stamdataAdvokatBinding,
  stamdataJournalnrBinding,
  stamdataSagsbehandlerBinding,
  stamdataSkadedatoBinding,
  stamdataSkadelidteBinding,
  stamdataSkadelidteFodselsdatoBinding,
  stamdataSkadestypeBinding,
} from './stamdataInputBindings';
import {
  aarsloenAntalFeriedageBinding,
  aarsloenFeriePctBinding,
  aarsloenFritvalgPctBinding,
  aarsloenFuldLoenUnderFerieBinding,
  aarsloenLoenPaaHelligdageBinding,
  aarsloenLoenperiodeBinding,
  aarsloenOmregningTilFuldtAarBinding,
  aarsloenPensionPctBinding,
  aarsloenRetTilSjetteFerieugeBinding,
  aarsloenShSoPctBinding,
  aarsloenStoreBededagPctBinding,
  aarsloenTableCol0DagBinding,
  aarsloenTableCol1DagBinding,
  aarsloenTableCol2Binding,
  aarsloenTableCol3Binding,
  aarsloenTableCol4Binding,
  aarsloenTableCol5Binding,
  aarsloenTableDataBinding,
  aarsloenTableFpFvShSoBeloebBinding,
  aarsloenTablePensionBeloebBinding,
  aarsloenTillaegAngivesSomBinding,
} from './aarsloenInputBindings';
import {
  faellesAarsloenAslAarsloenBinding,
  faellesAarsloenEalAarsloenBinding,
} from './faellesAarsloenInputBindings';
import {
  varigeMenBeregningsdatoBinding,
  varigeMenMengradBinding,
} from './varigeMenInputBindings';
import {
  forsoergertabBeregningsdatoBinding,
  forsoergertabEfterladteFodselsdatoBinding,
  forsoergertabKoenBinding,
  forsoergertabTilkendtForPeriodeAarBinding,
  forsoergertabVirkningsdatoBinding,
} from './forsoergertabInputBindings';
import {
  aslAfgoerelseAfgoerelseTypeBinding,
  aslAfgoerelseAfgoerelsesDatoBinding,
  aslAfgoerelseEetPctBinding,
  aslAfgoerelseFsTilbageholdtEetBinding,
  aslAfgoerelseKapDatoBinding,
  aslAfgoerelseKapPctBinding,
  aslAfgoerelseTidlKapDatoBinding,
  aslAfgoerelseVirkningsDatoBinding,
  erhvervsevnetabAslAfgoerelserBinding,
  erhvervsevnetabBeregningsdatoBinding,
  erhvervsevnetabBilagEetEfterEalBinding,
  erhvervsevnetabBilagKapitaliseringBinding,
  erhvervsevnetabBilagLoebendeYdelserBinding,
  erhvervsevnetabBilagMerErstatningPensionsalderBinding,
  erhvervsevnetabBilagProformaKapitaliseringBinding,
  erhvervsevnetabBilagVisUdvidetSpecLoebendeBinding,
  erhvervsevnetabBilagVisUdvidetSpecifikationBinding,
  erhvervsevnetabEalEetPctBinding,
  erhvervsevnetabEndeligEetTilbagevirkendeBinding,
  erhvervsevnetabIndregnMerErstatningBinding,
  erhvervsevnetabKoenBinding,
} from './erhvervsevnetabInputBindings';
import {
  eoAfsluttesMedBinding,
  eoAngivetDagsloenBaseretPaaBinding,
  eoAngivetDagsloenOpreguleresFraDatoBinding,
  eoAngivetMaanedsloenBaseretPaaBinding,
  eoAngivetMaanedsloenOpreguleresFraDatoBinding,
  eoBeregnesUdFraBinding,
  eoBilagIndgaarBinding,
  eoBilagSelectionLoenindkomstBinding,
  eoBilagSelectionMidlertidigEetBinding,
  eoBilagSelectionOffentligeYdelserBinding,
  eoBilagSelectionOkSatserBinding,
  eoBilagSelectionOpgoerelseBinding,
  eoBilagSelectionReguleringBinding,
  eoBilagSelectionShDageBinding,
  eoBilagSelectionSygeferiegodtgoerelseBinding,
  eoBilagsnumreBeregningsgrundlagTafBinding,
  eoBilagsnumreEetAfgoerelserBinding,
  eoBilagsnumreLoenISygeperiodenBinding,
  eoBilagsnumreMenAfgoerelseBinding,
  eoBilagsnumreOevrigeErstatningskravBinding,
  eoBilagsnumreOffentligeYdelserBinding,
  eoBilagsnumreSvieSmerteDokumentationBinding,
  eoDagsloenenUdgoerBinding,
  eoDifferencekravDatoBinding,
  eoEndeligEETAfgoerelseDatoBinding,
  eoEndeligEETVirkningsdatoBinding,
  eoEndeligtEETAfgorelseBinding,
  eoFerieperioderBinding,
  eoFerieperiodeFraBinding,
  eoFerieperiodeTilBinding,
  eoForligAnsvarsgradBroekBinding,
  eoForligAnsvarsgradProcentBinding,
  eoForligDatoBinding,
  eoFravaerPerioderBinding,
  eoFravaerPeriodeFraBinding,
  eoFravaerPeriodeTilBinding,
  eoIndsaetUdkastStempelBinding,
  eoKomprimerBeregningBinding,
  eoKravPaaOevrigeErstatningskravBinding,
  eoKravPaaSvieSmerteGodtgoerelseBinding,
  eoKravPaaTabtArbejdsfortjenesteBinding,
  eoLedsagetekstBinding,
  eoLoenudviklingPaaGrundlagAfBinding,
  eoMaanedsloenenUdgoerBinding,
  eoMenAfgoerelseDatoBinding,
  eoMidlertidigEETAfgoerelseDatoBinding,
  eoMidlertidigEETVirkningsdatoBinding,
  eoMidlertidigtEETAfgorelseBinding,
  eoMidlertidigtEetFraEetSidenBinding,
  eoNummerBinding,
  eoOevrigeFravaersdageBeskrivelseBinding,
  eoOevrigeFravaersdageBinding,
  eoOevrigeKravBeloebBinding,
  eoOevrigeKravDatoBinding,
  eoOevrigeKravPerioderBinding,
  eoOevrigeKravUdgiftTilBinding,
  eoOevrigtFravaerUdenLoenBinding,
  eoOffentligeYdelserFraDatoBinding,
  eoOffentligeYdelserKommentarerBinding,
  eoOffentligeYdelserRowsBinding,
  eoOffentligeYdelserTilDatoBinding,
  eoOffentligeYdelserTillaegBinding,
  eoOffentligeYdelserYdelseBinding,
  eoOffentligeYdelserYdelsestypeBinding,
  eoOpgørelseLavetDenBinding,
  eoOpsagtFraStillingBinding,
  eoRegulerOffentligeYdelserBinding,
  eoRevideretOpgoerelseBinding,
  eoSaerligeKommentarerBinding,
  eoSfggAlleredeBetaltBeloebBinding,
  eoSfggAnsaettelsesforholdBinding,
  eoSfggBeregningskildeBinding,
  eoSfggManuelBeloebIHenholdTilBinding,
  eoSfggManuelDagssatsBinding,
  eoSfggManuelFoerstEfterSygeloenBinding,
  eoSfggReferenceperiodeFraBinding,
  eoSfggReferenceperiodeFravaersdageUdenLoenBinding,
  eoSfggReferenceperiodeTilBinding,
  eoSfggSatsvalgBinding,
  eoSfggSygeperioderFoer2015Binding,
  eoSfggSygeperiodeFraBinding,
  eoSfggSygeperiodeTilBinding,
  eoSidsteDagAnsaettelsesforholdBinding,
  eoSvieSmerteAktuelPeriodeBinding,
  eoSvieSmerteDelvisSygemeldingSatsBinding,
  eoSvieSmerteHelbredsstatusBinding,
  eoSvieSmertePerioderBinding,
  eoSvieSmertePeriodeFraBinding,
  eoSvieSmertePeriodeTilBinding,
  eoSvieSmertePeriodeTilstandBinding,
  eoSvieSmerteSatserAarBinding,
  eoSvieSmerteTidligereTotalBinding,
  eoTafArbejdsstatusBinding,
  eoTafBeregningsperiodeFraBinding,
  eoTafBeregningsperiodeTilBinding,
  eoTafPerioderBinding,
  eoTafPeriodeFraBinding,
  eoTafPeriodeLoseFeriedageBinding,
  eoTafPeriodeTilBinding,
  eoTidligereModtagetTafBinding,
  eoTidligereSsMaxBinding,
  eoUspecificeredeFerieFridageBinding,
  eoVarigeMenAfgorelseBinding,
  eoVedroererPeriodeFraBinding,
  eoVedroererPeriodeTilBinding,
  eoVerserendeKlageEetBinding,
  eoVerserendeKlageMenBinding,
  eoVisBilagsnumreBinding,
} from './erstatningsopgoerelseInputBindings';

/**
 * Eneste produktions-`InputCatalog`. Det bygges én gang, forsegles og deles af runneren og
 * readeren. Kataloget dækker nu alle domæner for de felter/samlinger, der passer rent ind i den
 * strukturelle model (observationelt identisk, ingen .eo-formatændring).
 *
 * BEVIDST DEFER (senere runder, forelægges hvor .eo-format berøres):
 *  - `aarsloen.tableData` måned/uge-kolonner (streng-vs-tal-mismatch),
 *  - EO's `loenindkomstAnsaettelsesforhold` + nested standardløn-/lønudviklings-tabeller,
 *  - EO's `eoAngivetLoenLoenudvikling`-objekts nested tabeller.
 *
 * `sfggAnsaettelsesforhold` (rækkeid = `ansaettelsesforholdId`) er nu registreret via en custom
 * entity-id på den strukturelle collection-binding.
 *
 * Samlinger registreres før deres rækkefelter, så parent-invarianten i `seal()` holder.
 */
export const buildProductionInputCatalog = (): InputCatalog => {
  const catalog = new InputCatalog();

  // Stamdata
  catalog.registerField(stamdataJournalnrBinding);
  catalog.registerField(stamdataAdvokatBinding);
  catalog.registerField(stamdataSagsbehandlerBinding);
  catalog.registerField(stamdataSkadelidteBinding);
  catalog.registerField(stamdataSkadelidteFodselsdatoBinding);
  catalog.registerField(stamdataSkadestypeBinding);
  catalog.registerField(stamdataSkadedatoBinding);

  // Satser
  catalog.registerField(satserAargangBinding);

  // Årsløn
  catalog.registerField(aarsloenFeriePctBinding);
  catalog.registerField(aarsloenFritvalgPctBinding);
  catalog.registerField(aarsloenShSoPctBinding);
  catalog.registerField(aarsloenStoreBededagPctBinding);
  catalog.registerField(aarsloenPensionPctBinding);
  catalog.registerField(aarsloenLoenperiodeBinding);
  catalog.registerField(aarsloenTillaegAngivesSomBinding);
  catalog.registerField(aarsloenLoenPaaHelligdageBinding);
  catalog.registerField(aarsloenOmregningTilFuldtAarBinding);
  catalog.registerField(aarsloenFuldLoenUnderFerieBinding);
  catalog.registerField(aarsloenRetTilSjetteFerieugeBinding);
  catalog.registerField(aarsloenAntalFeriedageBinding);
  catalog.registerCollection(aarsloenTableDataBinding);
  catalog.registerField(aarsloenTableCol0DagBinding);
  catalog.registerField(aarsloenTableCol1DagBinding);
  catalog.registerField(aarsloenTableCol2Binding);
  catalog.registerField(aarsloenTableCol3Binding);
  catalog.registerField(aarsloenTableCol4Binding);
  catalog.registerField(aarsloenTableCol5Binding);
  catalog.registerField(aarsloenTableFpFvShSoBeloebBinding);
  catalog.registerField(aarsloenTablePensionBeloebBinding);

  // Fælles årsløn (ASL/EAL)
  catalog.registerField(faellesAarsloenAslAarsloenBinding);
  catalog.registerField(faellesAarsloenEalAarsloenBinding);

  // Renteberegning
  catalog.registerField(renteberegningBeregningsdatoBinding);
  catalog.registerField(renteberegningKommentarerBinding);
  catalog.registerCollection(rentekravRowsBinding);
  catalog.registerField(rentekravBelobBinding);
  catalog.registerField(rentekravRenterFraBinding);
  catalog.registerField(rentekravTillaegstidBinding);
  catalog.registerField(rentekravEnhedBinding);

  // Varige mén
  catalog.registerField(varigeMenMengradBinding);
  catalog.registerField(varigeMenBeregningsdatoBinding);

  // Forsørgertab
  catalog.registerField(forsoergertabEfterladteFodselsdatoBinding);
  catalog.registerField(forsoergertabBeregningsdatoBinding);
  catalog.registerField(forsoergertabVirkningsdatoBinding);
  catalog.registerField(forsoergertabKoenBinding);
  catalog.registerField(forsoergertabTilkendtForPeriodeAarBinding);

  // Erhvervsevnetab
  catalog.registerField(erhvervsevnetabBeregningsdatoBinding);
  catalog.registerField(erhvervsevnetabKoenBinding);
  catalog.registerField(erhvervsevnetabEalEetPctBinding);
  catalog.registerField(erhvervsevnetabEndeligEetTilbagevirkendeBinding);
  catalog.registerField(erhvervsevnetabIndregnMerErstatningBinding);
  catalog.registerField(erhvervsevnetabBilagLoebendeYdelserBinding);
  catalog.registerField(erhvervsevnetabBilagKapitaliseringBinding);
  catalog.registerField(erhvervsevnetabBilagEetEfterEalBinding);
  catalog.registerField(erhvervsevnetabBilagProformaKapitaliseringBinding);
  catalog.registerField(erhvervsevnetabBilagMerErstatningPensionsalderBinding);
  catalog.registerField(erhvervsevnetabBilagVisUdvidetSpecifikationBinding);
  catalog.registerField(erhvervsevnetabBilagVisUdvidetSpecLoebendeBinding);
  catalog.registerCollection(erhvervsevnetabAslAfgoerelserBinding);
  catalog.registerField(aslAfgoerelseAfgoerelsesDatoBinding);
  catalog.registerField(aslAfgoerelseVirkningsDatoBinding);
  catalog.registerField(aslAfgoerelseEetPctBinding);
  catalog.registerField(aslAfgoerelseKapDatoBinding);
  catalog.registerField(aslAfgoerelseKapPctBinding);
  catalog.registerField(aslAfgoerelseTidlKapDatoBinding);
  catalog.registerField(aslAfgoerelseAfgoerelseTypeBinding);
  catalog.registerField(aslAfgoerelseFsTilbageholdtEetBinding);

  // Erstatningsopgørelse — skalarer
  catalog.registerField(eoNummerBinding);
  catalog.registerField(eoLedsagetekstBinding);
  catalog.registerField(eoOpgørelseLavetDenBinding);
  catalog.registerField(eoIndsaetUdkastStempelBinding);
  catalog.registerField(eoVedroererPeriodeFraBinding);
  catalog.registerField(eoVedroererPeriodeTilBinding);
  catalog.registerField(eoRevideretOpgoerelseBinding);
  catalog.registerField(eoMidlertidigtEetFraEetSidenBinding);
  catalog.registerField(eoRegulerOffentligeYdelserBinding);
  catalog.registerField(eoAfsluttesMedBinding);
  catalog.registerField(eoForligAnsvarsgradProcentBinding);
  catalog.registerField(eoForligAnsvarsgradBroekBinding);
  catalog.registerField(eoForligDatoBinding);
  catalog.registerField(eoKravPaaOevrigeErstatningskravBinding);
  catalog.registerField(eoOffentligeYdelserKommentarerBinding);
  catalog.registerField(eoLoenudviklingPaaGrundlagAfBinding);
  catalog.registerField(eoSaerligeKommentarerBinding);
  catalog.registerField(eoBilagIndgaarBinding);
  catalog.registerField(eoBilagSelectionOpgoerelseBinding);
  catalog.registerField(eoBilagSelectionLoenindkomstBinding);
  catalog.registerField(eoBilagSelectionOffentligeYdelserBinding);
  catalog.registerField(eoBilagSelectionMidlertidigEetBinding);
  catalog.registerField(eoBilagSelectionShDageBinding);
  catalog.registerField(eoBilagSelectionReguleringBinding);
  catalog.registerField(eoBilagSelectionOkSatserBinding);
  catalog.registerField(eoBilagSelectionSygeferiegodtgoerelseBinding);
  catalog.registerField(eoVarigeMenAfgorelseBinding);
  catalog.registerField(eoMenAfgoerelseDatoBinding);
  catalog.registerField(eoVerserendeKlageMenBinding);
  catalog.registerField(eoMidlertidigtEETAfgorelseBinding);
  catalog.registerField(eoMidlertidigEETAfgoerelseDatoBinding);
  catalog.registerField(eoMidlertidigEETVirkningsdatoBinding);
  catalog.registerField(eoEndeligtEETAfgorelseBinding);
  catalog.registerField(eoEndeligEETAfgoerelseDatoBinding);
  catalog.registerField(eoEndeligEETVirkningsdatoBinding);
  catalog.registerField(eoVerserendeKlageEetBinding);
  catalog.registerField(eoDifferencekravDatoBinding);
  catalog.registerField(eoKravPaaSvieSmerteGodtgoerelseBinding);
  catalog.registerField(eoSvieSmerteHelbredsstatusBinding);
  catalog.registerField(eoTidligereSsMaxBinding);
  catalog.registerField(eoSvieSmerteSatserAarBinding);
  catalog.registerField(eoSvieSmerteDelvisSygemeldingSatsBinding);
  catalog.registerField(eoSvieSmerteTidligereTotalBinding);
  catalog.registerField(eoSvieSmerteAktuelPeriodeBinding);
  catalog.registerField(eoKravPaaTabtArbejdsfortjenesteBinding);
  catalog.registerField(eoTafArbejdsstatusBinding);
  catalog.registerField(eoOpsagtFraStillingBinding);
  catalog.registerField(eoSidsteDagAnsaettelsesforholdBinding);
  catalog.registerField(eoTidligereModtagetTafBinding);
  catalog.registerField(eoKomprimerBeregningBinding);
  catalog.registerField(eoBeregnesUdFraBinding);
  catalog.registerField(eoTafBeregningsperiodeFraBinding);
  catalog.registerField(eoTafBeregningsperiodeTilBinding);
  catalog.registerField(eoUspecificeredeFerieFridageBinding);
  catalog.registerField(eoOevrigtFravaerUdenLoenBinding);
  catalog.registerField(eoOevrigeFravaersdageBinding);
  catalog.registerField(eoOevrigeFravaersdageBeskrivelseBinding);
  catalog.registerField(eoMaanedsloenenUdgoerBinding);
  catalog.registerField(eoDagsloenenUdgoerBinding);
  catalog.registerField(eoAngivetMaanedsloenBaseretPaaBinding);
  catalog.registerField(eoAngivetMaanedsloenOpreguleresFraDatoBinding);
  catalog.registerField(eoAngivetDagsloenBaseretPaaBinding);
  catalog.registerField(eoAngivetDagsloenOpreguleresFraDatoBinding);
  catalog.registerField(eoVisBilagsnumreBinding);
  catalog.registerField(eoBilagsnumreMenAfgoerelseBinding);
  catalog.registerField(eoBilagsnumreEetAfgoerelserBinding);
  catalog.registerField(eoBilagsnumreSvieSmerteDokumentationBinding);
  catalog.registerField(eoBilagsnumreBeregningsgrundlagTafBinding);
  catalog.registerField(eoBilagsnumreLoenISygeperiodenBinding);
  catalog.registerField(eoBilagsnumreOffentligeYdelserBinding);
  catalog.registerField(eoBilagsnumreOevrigeErstatningskravBinding);

  // Erstatningsopgørelse — rene top-level samlinger (registreres før rækkefelter)
  catalog.registerCollection(eoTafPerioderBinding);
  catalog.registerField(eoTafPeriodeFraBinding);
  catalog.registerField(eoTafPeriodeTilBinding);
  catalog.registerField(eoTafPeriodeLoseFeriedageBinding);

  catalog.registerCollection(eoFerieperioderBinding);
  catalog.registerField(eoFerieperiodeFraBinding);
  catalog.registerField(eoFerieperiodeTilBinding);

  catalog.registerCollection(eoSfggSygeperioderFoer2015Binding);
  catalog.registerField(eoSfggSygeperiodeFraBinding);
  catalog.registerField(eoSfggSygeperiodeTilBinding);

  // sfggAnsaettelsesforhold — custom entity-id (`ansaettelsesforholdId`)
  catalog.registerCollection(eoSfggAnsaettelsesforholdBinding);
  catalog.registerField(eoSfggBeregningskildeBinding);
  catalog.registerField(eoSfggReferenceperiodeFraBinding);
  catalog.registerField(eoSfggReferenceperiodeTilBinding);
  catalog.registerField(eoSfggReferenceperiodeFravaersdageUdenLoenBinding);
  catalog.registerField(eoSfggManuelDagssatsBinding);
  catalog.registerField(eoSfggManuelBeloebIHenholdTilBinding);
  catalog.registerField(eoSfggManuelFoerstEfterSygeloenBinding);
  catalog.registerField(eoSfggSatsvalgBinding);
  catalog.registerField(eoSfggAlleredeBetaltBeloebBinding);

  catalog.registerCollection(eoFravaerPerioderBinding);
  catalog.registerField(eoFravaerPeriodeFraBinding);
  catalog.registerField(eoFravaerPeriodeTilBinding);

  catalog.registerCollection(eoSvieSmertePerioderBinding);
  catalog.registerField(eoSvieSmertePeriodeFraBinding);
  catalog.registerField(eoSvieSmertePeriodeTilBinding);
  catalog.registerField(eoSvieSmertePeriodeTilstandBinding);

  catalog.registerCollection(eoOevrigeKravPerioderBinding);
  catalog.registerField(eoOevrigeKravDatoBinding);
  catalog.registerField(eoOevrigeKravUdgiftTilBinding);
  catalog.registerField(eoOevrigeKravBeloebBinding);

  catalog.registerCollection(eoOffentligeYdelserRowsBinding);
  catalog.registerField(eoOffentligeYdelserFraDatoBinding);
  catalog.registerField(eoOffentligeYdelserTilDatoBinding);
  catalog.registerField(eoOffentligeYdelserYdelseBinding);
  catalog.registerField(eoOffentligeYdelserTillaegBinding);
  catalog.registerField(eoOffentligeYdelserYdelsestypeBinding);

  return catalog.seal();
};

let productionCatalog: InputCatalog | null = null;

/** Returnerer det forseglede produktionskatalog og bygger det ved første kald. */
export const getProductionInputCatalog = (): InputCatalog => {
  if (productionCatalog === null) productionCatalog = buildProductionInputCatalog();
  return productionCatalog;
};

/** Bygger og forsegler kataloget tidligt (ved bootstrap), så registreringsfejl fanges før render. */
export const ensureProductionInputCatalog = (): void => {
  getProductionInputCatalog();
};

/**
 * Top-level felter (path uden entity-led), som er migreret til det typed command-spor. Kun disse
 * kan route et skalar-commit gennem `executeTypedInputTransaction`; celle-/rækkefelter migreres sammen
 * med tabelinfrastrukturen i en senere runde.
 */
const TOP_LEVEL_FIELD_BINDINGS: readonly FieldBinding<unknown>[] = [
  // Stamdata
  stamdataJournalnrBinding,
  stamdataAdvokatBinding,
  stamdataSagsbehandlerBinding,
  stamdataSkadelidteBinding,
  stamdataSkadelidteFodselsdatoBinding,
  stamdataSkadestypeBinding,
  stamdataSkadedatoBinding,
  // Satser
  satserAargangBinding,
  // Årsløn (skalarer)
  aarsloenFeriePctBinding,
  aarsloenFritvalgPctBinding,
  aarsloenShSoPctBinding,
  aarsloenStoreBededagPctBinding,
  aarsloenPensionPctBinding,
  aarsloenLoenperiodeBinding,
  aarsloenTillaegAngivesSomBinding,
  aarsloenLoenPaaHelligdageBinding,
  aarsloenOmregningTilFuldtAarBinding,
  aarsloenFuldLoenUnderFerieBinding,
  aarsloenRetTilSjetteFerieugeBinding,
  aarsloenAntalFeriedageBinding,
  // Fælles årsløn
  faellesAarsloenAslAarsloenBinding,
  faellesAarsloenEalAarsloenBinding,
  // Renteberegning (skalarer)
  renteberegningBeregningsdatoBinding,
  renteberegningKommentarerBinding,
  // Varige mén
  varigeMenMengradBinding,
  varigeMenBeregningsdatoBinding,
  // Forsørgertab
  forsoergertabEfterladteFodselsdatoBinding,
  forsoergertabBeregningsdatoBinding,
  forsoergertabVirkningsdatoBinding,
  forsoergertabKoenBinding,
  forsoergertabTilkendtForPeriodeAarBinding,
  // Erhvervsevnetab (skalarer — nested bilagsvalg har path og er ikke top-level)
  erhvervsevnetabBeregningsdatoBinding,
  erhvervsevnetabKoenBinding,
  erhvervsevnetabEalEetPctBinding,
  erhvervsevnetabEndeligEetTilbagevirkendeBinding,
  erhvervsevnetabIndregnMerErstatningBinding,
  // Erstatningsopgørelse (top-level skalarer — nested bilagsvalg og rækkefelter er ikke top-level)
  eoNummerBinding,
  eoLedsagetekstBinding,
  eoOpgørelseLavetDenBinding,
  eoIndsaetUdkastStempelBinding,
  eoVedroererPeriodeFraBinding,
  eoVedroererPeriodeTilBinding,
  eoRevideretOpgoerelseBinding,
  eoMidlertidigtEetFraEetSidenBinding,
  eoRegulerOffentligeYdelserBinding,
  eoAfsluttesMedBinding,
  eoForligAnsvarsgradProcentBinding,
  eoForligAnsvarsgradBroekBinding,
  eoForligDatoBinding,
  eoKravPaaOevrigeErstatningskravBinding,
  eoOffentligeYdelserKommentarerBinding,
  eoLoenudviklingPaaGrundlagAfBinding,
  eoSaerligeKommentarerBinding,
  eoBilagIndgaarBinding,
  eoVarigeMenAfgorelseBinding,
  eoMenAfgoerelseDatoBinding,
  eoVerserendeKlageMenBinding,
  eoMidlertidigtEETAfgorelseBinding,
  eoMidlertidigEETAfgoerelseDatoBinding,
  eoMidlertidigEETVirkningsdatoBinding,
  eoEndeligtEETAfgorelseBinding,
  eoEndeligEETAfgoerelseDatoBinding,
  eoEndeligEETVirkningsdatoBinding,
  eoVerserendeKlageEetBinding,
  eoDifferencekravDatoBinding,
  eoKravPaaSvieSmerteGodtgoerelseBinding,
  eoSvieSmerteHelbredsstatusBinding,
  eoTidligereSsMaxBinding,
  eoSvieSmerteSatserAarBinding,
  eoSvieSmerteDelvisSygemeldingSatsBinding,
  eoSvieSmerteTidligereTotalBinding,
  eoSvieSmerteAktuelPeriodeBinding,
  eoKravPaaTabtArbejdsfortjenesteBinding,
  eoTafArbejdsstatusBinding,
  eoOpsagtFraStillingBinding,
  eoSidsteDagAnsaettelsesforholdBinding,
  eoTidligereModtagetTafBinding,
  eoKomprimerBeregningBinding,
  eoBeregnesUdFraBinding,
  eoTafBeregningsperiodeFraBinding,
  eoTafBeregningsperiodeTilBinding,
  eoUspecificeredeFerieFridageBinding,
  eoOevrigtFravaerUdenLoenBinding,
  eoOevrigeFravaersdageBinding,
  eoOevrigeFravaersdageBeskrivelseBinding,
  eoMaanedsloenenUdgoerBinding,
  eoDagsloenenUdgoerBinding,
  eoAngivetMaanedsloenBaseretPaaBinding,
  eoAngivetMaanedsloenOpreguleresFraDatoBinding,
  eoAngivetDagsloenBaseretPaaBinding,
  eoAngivetDagsloenOpreguleresFraDatoBinding,
  eoVisBilagsnumreBinding,
  eoBilagsnumreMenAfgoerelseBinding,
  eoBilagsnumreEetAfgoerelserBinding,
  eoBilagsnumreSvieSmerteDokumentationBinding,
  eoBilagsnumreBeregningsgrundlagTafBinding,
  eoBilagsnumreLoenISygeperiodenBinding,
  eoBilagsnumreOffentligeYdelserBinding,
  eoBilagsnumreOevrigeErstatningskravBinding,
] as readonly FieldBinding<unknown>[];

const topLevelFieldBindingLookup: ReadonlyMap<string, FieldBinding<unknown>> = new Map(
  TOP_LEVEL_FIELD_BINDINGS
    .filter((binding) => binding.template.path.length === 0)
    .map((binding) => [`${binding.template.section} ${binding.template.field}`, binding])
);

/**
 * Slår et migreret top-level felt op på (sektion, feltnavn) og returnerer dets `FieldRef`, ellers null.
 * Bruges af skalar-commit-sporet til at afgøre, om et felt går gennem det typed katalog-spor.
 */
export const resolveTopLevelFieldRef = (
  section: StorageKey,
  fieldName: string
): FieldRef<unknown> | null => {
  const binding = topLevelFieldBindingLookup.get(`${section} ${fieldName}`);
  return binding === undefined ? null : binding.createRef();
};

/** Kun til isolerede tests, hvor et frisk katalog kan være ønsket. */
export const __resetProductionInputCatalogForTests = (): void => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('productionInputCatalog: reset er kun tilladt i testmiljøet');
  }
  productionCatalog = null;
};
