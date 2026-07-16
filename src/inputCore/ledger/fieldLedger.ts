import type { CodecFamily, ControlKind, SectionKey } from './ledgerTypes';

// Greenfield-kerne (§6.1): én dataidentitet pr. persisteret felt (IKKE pr. Zod-leaf — en AmountValue er ÉT
// felt, selv om schemaet har `kind`/`value`/`expression`; entity-id'er er strukturelle, ikke felter).
//
// Feltidentiteterne + baseline-count udledes MASKINELT fra de levende Zod-schemas i completeness-testen, så
// der ikke findes en parallel manuel path-autoritet (§ Fase 1 exitkriterium). Dette modul bidrager med
// canonicaliseringen (leaf → datafelt) og codec-/kontroltype-annotationen pr. felt. Collection-børns codecs
// ejes af `collectionLedger.ts`; her annoteres kun top-level-felter (inkl. felter i singular property-objekter
// som `eoBilagSelection`, `overenskomstFilter`, `eoAngivetLoenLoenudvikling`).

/** Amount-triplens leaves (`X.kind`/`X.value`/`X.expression`) samles til datafeltet `X`. */
export const AMOUNT_LEAF_SUFFIX = /\.(kind|value|expression)$/;

/** Entity-id-leaves (`...[].id` / `...[].ansaettelsesforholdId`) er strukturelle, ikke datafelter. */
export const ENTITY_ID_LEAF = /(?:^|\.)(?:id|ansaettelsesforholdId)$/;

/** Reducerer et Zod-leaf til dets canonical datafelt-sti, eller `null` hvis leafet ikke er et datafelt. */
export const leafToDataFieldPath = (leaf: string): string | null => {
  if (ENTITY_ID_LEAF.test(leaf)) return null;
  return leaf.replace(AMOUNT_LEAF_SUFFIX, '');
};

/** True hvis stien ligger inde i en collection (indeholder `[]`). Collection-børn ejes af collectionLedger. */
export const isCollectionChildPath = (path: string): boolean => path.includes('[]');

export type FieldCodecAnnotation = Readonly<{ codec: CodecFamily; control: ControlKind }>;

const t = (codec: CodecFamily): FieldCodecAnnotation => ({ codec, control: 'text' });
const c = (codec: CodecFamily = 'choice'): FieldCodecAnnotation => ({ codec, control: 'choice' });
const tog = (codec: CodecFamily = 'boolean'): FieldCodecAnnotation => ({ codec, control: 'toggle' });

/**
 * Codec-/kontroltype pr. TOP-LEVEL datafelt (ikke collection-børn). Completeness-testen håndhæver, at nøglerne
 * er nøjagtig de top-level datafelter, de levende schemas producerer — en manglende eller overflødig nøgle
 * fejler testen, så transskriptionsfejl fanges.
 */
export const TOP_LEVEL_FIELD_CODECS: Readonly<Record<SectionKey, Readonly<Record<string, FieldCodecAnnotation>>>> = {
  stamdata: {
    journalnr: t('optionalText'), advokat: t('optionalText'), sagsbehandler: t('optionalText'),
    skadelidte: t('optionalText'), skadelidteFodselsdato: t('date'), skadestype: c(), skadedato: t('date'),
  },
  satser: { aargang: t('year') },
  aarsloen: {
    feriePct: t('percent'), fritvalgPct: t('percent'), shSoPct: t('percent'), storeBededagPct: t('percent'),
    pensionPct: t('percent'), loenperiode: c(), tillaegAngivesSom: c(), loenPaaHelligdage: c(),
    omregningTilFuldtAar: tog(), fuldLoenUnderFerie: tog(), retTilSjetteFerieuge: tog(), antalFeriedage: t('integer'),
  },
  faellesAarsloen: { aslAarsloen: t('amount'), ealAarsloen: t('amount') },
  renteberegning: { beregningsdato: t('date'), kommentarer: t('optionalText') },
  varigemen: { mengrad: t('integer'), beregningsdato: t('date') },
  forsoergertab: {
    efterladteFodselsdato: t('date'), beregningsdato: t('date'), virkningsdato: t('date'),
    koen: c(), tilkendtForPeriodeAar: t('integer'),
  },
  erhvervsevnetab: {
    beregningsdato: t('date'), koen: c(), ealEetPct: t('percent'),
    endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: tog(),
    indregnMerErstatningVedForhoejetPensionsalder: tog(),
    'eetDifferencekravBilagSelection.loebendeYdelser': tog(),
    'eetDifferencekravBilagSelection.kapitalisering': tog(),
    'eetDifferencekravBilagSelection.eetEfterEal': tog(),
    'eetDifferencekravBilagSelection.proformaKapitalisering': tog(),
    'eetDifferencekravBilagSelection.merErstatningPensionsalder': tog(),
    'eetDifferencekravBilagSelection.visUdvidetSpecifikation': tog(),
    'eetDifferencekravBilagSelection.visUdvidetSpecifikationLoebendeYdelserBilag': tog(),
  },
  erstatningsopgoerelse: {
    // Basisblok
    eoNummer: t('optionalText'), eoLedsagetekst: t('optionalText'), offentligeYdelserKommentarer: t('optionalText'),
    loenudviklingPaaGrundlagAf: t('optionalText'), saerligeKommentarer: t('optionalText'),
    opgørelseLavetDen: t('date'), vedroererPeriodeFra: t('date'), vedroererPeriodeTil: t('date'), forligDato: t('date'),
    indsaetUdkastStempel: c(), revideretOpgoerelse: c(), midlertidigtEetFraEetSiden: c(), regulerOffentligeYdelser: c(),
    erstatningsopgoerelseAfsluttesMed: c(),
    forligAnsvarsgradProcent: t('percent'), forligAnsvarsgradBroek: t('fraction'),
    kravPaaOevrigeErstatningskrav: c(), eoBilagLoenindkomstOgOffentligeYdelserIndgaar: c(),
    // eoBilagSelection (8 toggles)
    'eoBilagSelection.opgoerelse': tog(), 'eoBilagSelection.loenindkomst': tog(),
    'eoBilagSelection.offentligeYdelser': tog(), 'eoBilagSelection.midlertidigEet': tog(),
    'eoBilagSelection.shDage': tog(), 'eoBilagSelection.regulering': tog(),
    'eoBilagSelection.okSatser': tog(), 'eoBilagSelection.sygeferiegodtgoerelse': tog(),
    // AES-afgørelser
    varigeMenAfgorelse: c(), verserendeKlageMen: c(), midlertidigtEETAfgorelse: c(), endeligtEETAfgorelse: c(),
    verserendeKlageEet: c(),
    menAfgoerelseDato: t('date'), midlertidigEETAfgoerelseDato: t('date'), midlertidigEETVirkningsdato: t('date'),
    endeligEETAfgoerelseDato: t('date'), endeligEETVirkningsdato: t('date'), differencekravDato: t('date'),
    // Svie/smerte
    kravPaaSvieSmerteGodtgoerelse: c(), svieSmerteHelbredsstatus: c(), tidligereSsMax: c(),
    svieSmerteSatserAar: t('year'), svieSmerteDelvisSygemeldingSats: c(),
    svieSmerteTidligereTotal: t('amount'), svieSmerteAktuelPeriode: t('amount'),
    // TAF
    kravPaaTabtArbejdsfortjeneste: c(), tafArbejdsstatus: c(), opsagtFraStilling: c(),
    sidsteDagAnsaettelsesforhold: t('date'), tidligereModtagetTaf: t('amount'),
    // Indtægt før skaden
    komprimerBeregningEfterFoersteOpgoerelse: c(), oevrigtFravaerUdenLoen: c(), beregnesUdFra: c(),
    tafBeregningsperiodeFra: t('date'), tafBeregningsperiodeTil: t('date'),
    angivetMaanedsloenOpreguleresFraDato: t('date'), angivetDagsloenOpreguleresFraDato: t('date'),
    uspecificeredeFerieFridage: t('integer'), oevrigeFravaersdage: t('integer'),
    oevrigeFravaersdageBeskrivelse: t('optionalText'),
    angivetMaanedsloenBaseretPaa: t('optionalText'), angivetDagsloenBaseretPaa: t('optionalText'),
    maanedsloenenUdgoer: t('amount'), dagsloenenUdgoer: t('amount'),
    // Bilagsnumre
    visBilagsnumre: c(), bilagsnumreMenAfgoerelse: t('optionalText'), bilagsnumreEetAfgoerelser: t('optionalText'),
    bilagsnumreSvieSmerteDokumentation: t('optionalText'), bilagsnumreBeregningsgrundlagTaf: t('optionalText'),
    bilagsnumreLoenISygeperioden: t('optionalText'), bilagsnumreOffentligeYdelser: t('optionalText'),
    bilagsnumreOevrigeErstatningskrav: t('optionalText'),
    // eoAngivetLoenLoenudvikling (singular property-objekt, 18 felter)
    'eoAngivetLoenLoenudvikling.overenskomstId': c(),
    'eoAngivetLoenLoenudvikling.harAnciennitetstillaegEfterSkadedatoen': tog(),
    'eoAngivetLoenLoenudvikling.anciennitetstillaegDato': t('date'),
    'eoAngivetLoenLoenudvikling.anciennitetstillaegSatsAngivesPer': c(),
    'eoAngivetLoenLoenudvikling.anciennitetstillaegSats': t('amount'),
    'eoAngivetLoenLoenudvikling.feriePct': t('percent'),
    'eoAngivetLoenLoenudvikling.loenPaaHelligdage': c(),
    'eoAngivetLoenLoenudvikling.saerligFraDatoRegulering': t('date'),
    'eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag': c(),
    'eoAngivetLoenLoenudvikling.loenudviklingStatistikModel': c(),
    'eoAngivetLoenLoenudvikling.loenudviklingKRLSatstabel': c(),
    'eoAngivetLoenLoenudvikling.loenudviklingManuelNavn': t('optionalText'),
    'eoAngivetLoenLoenudvikling.offentligLoenType': c(),
    'eoAngivetLoenLoenudvikling.offentligLoenTrin': t('integer'),
    'eoAngivetLoenLoenudvikling.offentligLoenGruppe': t('integer'),
    'eoAngivetLoenLoenudvikling.offentligLoenEkstraGrundloen': t('amount'),
    'eoAngivetLoenLoenudvikling.overenskomstFilter.loenmodtager': c(),
    'eoAngivetLoenLoenudvikling.overenskomstFilter.arbejdsgiver': t('optionalText'),
  },
};

/** Baseline-count (§6, Fase 0 trin 13). Låst mod de levende schemas i completeness-testen — ingen placeholder. */
export const EXPECTED_FIELD_REF_COUNT = 243;

/**
 * Editorlokationer (§6.1): den primære editorside/route pr. sektion. Fokusmål-id'er pr. felt populeres i
 * Fase-1/2-descriptorerne. Delte felter (redigeres flere steder) er markeret særskilt.
 */
export const SECTION_PRIMARY_EDITOR_ROUTE: Readonly<Record<SectionKey, string | null>> = {
  stamdata: '/stamdata',
  satser: '/satser',
  aarsloen: '/aarsloen',
  // faellesAarsloen har ingen egen route — den redigeres i EET-, Forsørgertab- og EO-kontekster (delt felt).
  faellesAarsloen: null,
  renteberegning: '/renteberegning',
  varigemen: '/varige-men',
  forsoergertab: '/forsoergertab',
  erstatningsopgoerelse: '/erstatningsopgoerelse',
  erhvervsevnetab: '/erhvervsevnetab',
};

/** Datafelter der redigeres på flere editorlokationer (§6.1 delte felter). */
export const SHARED_FIELD_PATHS: readonly Readonly<{ section: SectionKey; path: string }>[] = [
  { section: 'faellesAarsloen', path: 'aslAarsloen' },
  { section: 'faellesAarsloen', path: 'ealAarsloen' },
];
