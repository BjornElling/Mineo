import type { CodecFamily, ControlKind, SectionKey } from './ledgerTypes';

// Midlertidigt fase-0-inventar (§6.2): én entry pr. dynamisk collection. `path` er den strukturelle sti til collectionen
// (tom for top-level; en forælder-collection-sti udtrykkes med `[]`). Completeness-testen verificerer, at
// nøjagtig disse collections findes i de faktiske Zod-schemas, og at hver childfield hører til collectionen.

export type CollectionChildField = Readonly<{
  name: string;
  codec: CodecFamily;
  control: ControlKind;
}>;

export type CollectionLedgerEntry = Readonly<{
  id: string;
  section: SectionKey;
  /** Strukturel forælder-sti; tom for top-level collections. `[]` markerer en forælder-collections rækker. */
  path: string;
  collection: string;
  /** Entity-id-egenskaben (§6.2). De fleste bruger `id`; sfgg-ansættelsesforhold bruger `ansaettelsesforholdId`. */
  entityIdProperty: string;
  childFields: readonly CollectionChildField[];
  /** Id'er på nested collections under denne collections rækker. */
  nestedCollectionIds: readonly string[];
}>;

const f = (name: string, codec: CodecFamily, control: ControlKind = 'text'): CollectionChildField =>
  ({ name, codec, control });

export const INPUT_COLLECTION_LEDGER: readonly CollectionLedgerEntry[] = [
  // ── Ikke-EO (3) ────────────────────────────────────────────────────────────────────────────────
  {
    id: 'aarsloen.tableData',
    section: 'aarsloen',
    path: '',
    collection: 'tableData',
    entityIdProperty: 'id',
    childFields: [
      f('col0_maaned', 'integer'), f('col1_maaned', 'year'),
      f('col0_uge', 'week'), f('col1_uge', 'week'),
      f('col0_dag', 'date'), f('col1_dag', 'date'),
      f('col2', 'amount'), f('col3', 'amount'), f('col4', 'amount'), f('col5', 'amount'),
      f('fpFvShSoBeloeb', 'amount'), f('pensionBeloeb', 'amount'),
    ],
    nestedCollectionIds: [],
  },
  {
    id: 'renteberegning.rentekravRows',
    section: 'renteberegning',
    path: '',
    collection: 'rentekravRows',
    entityIdProperty: 'id',
    childFields: [
      f('belob', 'amount'), f('renterFra', 'date'), f('tillaegstid', 'integer'), f('enhed', 'choice', 'choice'),
    ],
    nestedCollectionIds: [],
  },
  {
    id: 'erhvervsevnetab.aslAfgoerelser',
    section: 'erhvervsevnetab',
    path: '',
    collection: 'aslAfgoerelser',
    entityIdProperty: 'id',
    childFields: [
      f('afgoerelsesDato', 'date'), f('virkningsDato', 'date'), f('kapDato', 'date'), f('tidlKapDato', 'date'),
      f('eetPct', 'percent'), f('kapPct', 'percent'),
      f('afgoerelseType', 'choice', 'choice'), f('fsTilbageholdtEet', 'choice', 'choice'),
    ],
    nestedCollectionIds: [],
  },

  // ── Erstatningsopgørelse (14) ────────────────────────────────────────────────────────────────────
  {
    id: 'eo.tafPerioder', section: 'erstatningsopgoerelse', path: '', collection: 'tafPerioder',
    entityIdProperty: 'id',
    childFields: [f('fra', 'date'), f('til', 'date'), f('loseFeriedage', 'integer')],
    nestedCollectionIds: [],
  },
  {
    id: 'eo.ferieperioder', section: 'erstatningsopgoerelse', path: '', collection: 'ferieperioder',
    entityIdProperty: 'id', childFields: [f('fra', 'date'), f('til', 'date')], nestedCollectionIds: [],
  },
  {
    id: 'eo.fravaerPerioder', section: 'erstatningsopgoerelse', path: '', collection: 'fravaerPerioder',
    entityIdProperty: 'id', childFields: [f('fra', 'date'), f('til', 'date')], nestedCollectionIds: [],
  },
  {
    id: 'eo.svieSmertePerioder', section: 'erstatningsopgoerelse', path: '', collection: 'svieSmertePerioder',
    entityIdProperty: 'id',
    childFields: [f('fra', 'date'), f('til', 'date'), f('tilstand', 'choice', 'choice')],
    nestedCollectionIds: [],
  },
  {
    id: 'eo.oevrigeKravPerioder', section: 'erstatningsopgoerelse', path: '', collection: 'oevrigeKravPerioder',
    entityIdProperty: 'id',
    childFields: [f('dato', 'date'), f('udgiftTil', 'text'), f('beloeb', 'amount')],
    nestedCollectionIds: [],
  },
  {
    id: 'eo.offentligeYdelserRows', section: 'erstatningsopgoerelse', path: '', collection: 'offentligeYdelserRows',
    entityIdProperty: 'id',
    childFields: [
      f('fraDato', 'date'), f('tilDato', 'date'),
      f('ydelse', 'amount'), f('tillaeg', 'amount'), f('ydelsestype', 'optionalText', 'choice'),
    ],
    nestedCollectionIds: [],
  },
  {
    id: 'eo.sfggAnsaettelsesforhold', section: 'erstatningsopgoerelse', path: '', collection: 'sfggAnsaettelsesforhold',
    entityIdProperty: 'ansaettelsesforholdId',
    childFields: [
      f('sfggBeregningskilde', 'choice', 'choice'),
      f('sfggReferenceperiodeFra', 'date'), f('sfggReferenceperiodeTil', 'date'),
      f('sfggReferenceperiodeFravaersdageUdenLoen', 'integer'),
      f('sfggManuelDagssats', 'amount'), f('sfggAlleredeBetaltBeloeb', 'amount'),
      f('sfggManuelBeloebIHenholdTil', 'optionalText'),
      f('sfggManuelFoerstEfterSygeloen', 'choice', 'choice'), f('sfggSatsvalg', 'choice', 'choice'),
    ],
    nestedCollectionIds: [],
  },
  {
    id: 'eo.loenindkomstAnsaettelsesforhold', section: 'erstatningsopgoerelse', path: '',
    collection: 'loenindkomstAnsaettelsesforhold', entityIdProperty: 'id',
    // Skalarfelter under ansættelsesforholdet; se feltledgeren for den fulde liste. Nested tabeller nedenfor.
    childFields: [
      f('navnPaaArbejdssted', 'optionalText'), f('harOverenskomst', 'boolean', 'toggle'),
      f('ansatPaaSkadestidspunktet', 'boolean', 'toggle'), f('ansaettelsesforholdOphoert', 'boolean', 'toggle'),
      f('harAnciennitetstillaegEfterSkadedatoen', 'boolean', 'toggle'), f('overenskomstId', 'choice', 'choice'),
      f('sidsteArbejdsdag', 'date'), f('anciennitetstillaegDato', 'date'), f('saerligFraDatoRegulering', 'date'),
      f('fritvalgPct', 'percent'), f('shSoPct', 'percent'), f('storeBededagPct', 'percent'),
      f('pensionPct', 'percent'), f('feriePct', 'percent'),
      f('tillaegAngivesSom', 'choice', 'choice'), f('loenperiode', 'choice', 'choice'),
      f('fuldLoenUnderFerie', 'choice', 'toggle'), f('anciennitetstillaegSatsAngivesPer', 'choice', 'choice'),
      f('loenPaaHelligdage', 'choice', 'choice'), f('loenudviklingBeregningsgrundlag', 'choice', 'choice'),
      f('loenudviklingStatistikModel', 'choice', 'choice'), f('loenudviklingKRLSatstabel', 'choice', 'choice'),
      f('offentligLoenType', 'choice', 'choice'), f('anciennitetstillaegSats', 'amount'),
      f('offentligLoenEkstraGrundloen', 'amount'), f('loenudviklingManuelNavn', 'optionalText'),
      f('offentligLoenTrin', 'integer'), f('offentligLoenGruppe', 'integer'),
      f('overenskomstFilter.loenmodtager', 'choice', 'choice'), f('overenskomstFilter.arbejdsgiver', 'optionalText', 'choice'),
    ],
    nestedCollectionIds: [
      'eo.loenindkomstAnsaettelsesforhold.indtaegtsoplysningerTableData',
      'eo.loenindkomstAnsaettelsesforhold.loenudviklingManuelTableData',
      'eo.loenindkomstAnsaettelsesforhold.loenudviklingManuelProcentsatsTableData',
    ],
  },
  {
    id: 'eo.loenindkomstAnsaettelsesforhold.indtaegtsoplysningerTableData', section: 'erstatningsopgoerelse',
    path: 'loenindkomstAnsaettelsesforhold[]', collection: 'indtaegtsoplysningerTableData', entityIdProperty: 'id',
    childFields: [
      f('col0_maaned', 'integer'), f('col1_maaned', 'year'), f('col0_uge', 'week'), f('col1_uge', 'week'),
      f('col0_dag', 'date'), f('col1_dag', 'date'),
      f('col2', 'amount'), f('col3', 'amount'), f('col4', 'amount'), f('col5', 'amount'),
      f('fpFvShSoBeloeb', 'amount'), f('pensionBeloeb', 'amount'),
    ],
    nestedCollectionIds: [],
  },
  {
    id: 'eo.loenindkomstAnsaettelsesforhold.loenudviklingManuelTableData', section: 'erstatningsopgoerelse',
    path: 'loenindkomstAnsaettelsesforhold[]', collection: 'loenudviklingManuelTableData', entityIdProperty: 'id',
    childFields: [
      f('dato', 'date'), f('grundloen', 'amount'), f('feriepenge', 'percent'),
      f('shSoSats', 'percent'), f('fritvalg', 'percent'), f('agPension', 'percent'),
    ],
    nestedCollectionIds: [],
  },
  {
    id: 'eo.loenindkomstAnsaettelsesforhold.loenudviklingManuelProcentsatsTableData', section: 'erstatningsopgoerelse',
    path: 'loenindkomstAnsaettelsesforhold[]', collection: 'loenudviklingManuelProcentsatsTableData', entityIdProperty: 'id',
    childFields: [f('dato', 'date'), f('procent', 'percent')],
    nestedCollectionIds: [],
  },
  {
    id: 'eo.eoAngivetLoenLoenudvikling.loenudviklingManuelTableData', section: 'erstatningsopgoerelse',
    path: 'eoAngivetLoenLoenudvikling', collection: 'loenudviklingManuelTableData', entityIdProperty: 'id',
    childFields: [
      f('dato', 'date'), f('grundloen', 'amount'), f('feriepenge', 'percent'),
      f('shSoSats', 'percent'), f('fritvalg', 'percent'), f('agPension', 'percent'),
    ],
    nestedCollectionIds: [],
  },
  {
    id: 'eo.eoAngivetLoenLoenudvikling.loenudviklingManuelProcentsatsTableData', section: 'erstatningsopgoerelse',
    path: 'eoAngivetLoenLoenudvikling', collection: 'loenudviklingManuelProcentsatsTableData', entityIdProperty: 'id',
    childFields: [f('dato', 'date'), f('procent', 'percent')],
    nestedCollectionIds: [],
  },
] as const;

export const EXPECTED_COLLECTION_COUNT = 16;
