/**
 * De tre reguleringssats-outputs.
 *
 * Knappen "Tilgængelige reguleringssatser" findes to steder — EO's Oplysninger-fane (sagsniveau, ét
 * `eoAngivetLoenLoenudvikling`-objekt) og hvert ansættelsesforhold på Lønindkomst-fanen — og den
 * dispatcher til TRE forskellige dokumenter afhængigt af `loenudviklingBeregningsgrundlag`:
 * `regulering` (Overenskomst/Statistik), `krl` (KRL satstabel) og `kl-loenaftaler` (KL-lønaftaler).
 *
 * Alle tre outputs bruger den fælles commit-, kilde- og friskhedslivscyklus. Downloadreglen bor ét
 * sted i `project` og bruger `isOffentligLoenSelectionReady`, så sagsniveau og ansættelsesforhold
 * validerer offentligt løntrin og løntype ens.
 *
 * **Hvorfor de tre outputs deler modul.** De deler aktiveringsidentitet, gate-regel og
 * kilde-læsning; kun `loenudviklingBeregningsgrundlag` afgør hvilket af de tre dokumenter der
 * gælder. Valget sker i `resolveReguleringDocumentAction` — EFTER commit-barrieren, på det friske
 * snapshot — fordi `loenudviklingBeregningsgrundlag` selv er en almindelig committed indtastning,
 * som et settle kan ændre. Læste callsiten den ved klik (som i dag), kunne det leverede dokument
 * tilhøre et andet output end det, den friske revision peger på.
 *
 * De forbliver TRE outputs og ikke ét med en intern variant-switch: de har tre generatorer, tre
 * navne og tre id'er i `CONSUMER_DOCUMENT_OUTPUTS`, og at skjule dem bag ét id ville bryde
 * katalogets "ét id = ét output"-invariant og dermed completeness-testen.
 */
import { getReguleringsDatoIntervalForOverenskomst, isOffentligOverenskomstId, resolveOverenskomstDisplay } from '../../data/overenskomstRates';
import { getReguleringsDatoIntervalForKlLoenaftaler } from '../../data/klLoenaftaler';
import { getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../data/krlRates';
import { toLoentrin } from '../../data/offentligLoenTypes';
import { getReguleringsDatoIntervalForStatistikModel } from '../../data/statistiskeRates';
import type { DocumentProjectionResult } from '../../document/definition/documentDefinition';
import { defineDocumentAction, resolveDocumentDefinition } from '../../document/definition/documentAction';
import type { DocumentBrevhovedType } from '../../document/layout/documentBrevhoved';
import { missingInputReason, type DocumentDownloadGateReason } from '../../document/layout/documentGateTypes';
import { blockedProjection, blockedProjectionFromCauses } from '../../document/definition/documentOutcome';
import type { DocumentSourceContext } from '../../document/definition/documentSourceContext';
import {
  defineMineoDocument,
  type MineoDocumentDefinition,
  type MineoDocumentGateSettings,
} from '../../document/definition/mineoDocumentDefinition';
import {
  eoAngivetLoenFields,
  eoEmploymentFields,
  eoLoenindkomstAnsaettelsesforholdCollection,
} from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { createCollectionRef } from '../../inputCore/fieldAddress';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { InputReader } from '../../inputCore/inputReader';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { offentligLoenTypeEnum } from '../../schemas/formSchemas/enumSchemas';
import type { StamdataValues } from '../../schemas/formSchemas';
import { coerceToDanishDateString, type DanishDateString } from '../../types/branded';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { projectStamdataForDocument } from '../stamdata/stamdataDocumentProjection';

export const REGULERING_DOCUMENT_CONSUMER_ID = 'document.regulering';

/**
 * Aktiveringsidentiteten. REN identitet: enten sagens overordnede lønudvikling, eller ét konkret
 * ansættelsesforhold udpeget ved sit `af.id`.
 *
 * Callsiten sender i dag `interval`, `overenskomstId`, labels og satsvalg med i klikket. Alle de
 * værdier er læst FØR commit-barrieren og genlæses derfor friskt i `project` — requesten bærer dem
 * ikke. Findes ansættelsesforholdet ikke længere efter settle, fail-closer `project`.
 */
export type ReguleringDocumentRequest =
  | Readonly<{ scope: 'case' }>
  | Readonly<{ scope: 'employment'; employmentId: string }>;

/** De fire lønudviklingsgrundlag, der har et reguleringssats-dokument. */
type ReguleringBasis = 'Overenskomst' | 'Statistik' | 'KRL satstabel' | 'KL-lønaftaler';

/**
 * De felter, gaten og de tre dokumenter læser, uafhængigt af scope.
 *
 * De to scopes har hver sit descriptor-sæt (`eoAngivetLoenFields` bundet til ét property-objekt vs.
 * `eoEmploymentFields` bundet til `af.id`), men PRÆCIS samme feltnavne og betydninger. Den fælles
 * form er derfor det, gate-reglen kan udtrykkes på ét sted.
 */
type LoenudviklingSource = Readonly<{
  basis: ReguleringBasis | undefined;
  overenskomstId: string | undefined;
  statistikModel: string | undefined;
  krlSatstabel: string | undefined;
  loenPaaHelligdage: string | undefined;
  offentligLoenType: string | undefined;
  offentligLoenTrin: number | undefined;
  offentligLoenGruppe: number | undefined;
  offentligLoenEkstraGrundloen: AmountValue | undefined;
  /** Etiketten for det valgte overenskomst-id. Bevidst scope-specifik — se `resolveCaseOverenskomstLabel`. */
  overenskomstLabel: string;
}>;

/** Læser en valgfri feltværdi; alt andet end `usable` behandles som fraværende (fail-closed). */
const readOptional = <T>(reader: InputReader, ref: ReturnType<FieldDescriptor<T>['bind']>): T | undefined => {
  const result = reader.read(ref);
  return result.status === 'usable' ? result.value : undefined;
};

/**
 * Sagsniveauets overenskomst-etiket.
 *
 * Viste tidligere KUN `meta.navn`, mens ansættelsesforholdet viste `navn (lønmodtager / arbejdsgiver)`.
 * Forskellen var eksisterende dokumentindhold og afventede derfor en brugerbeslutning (§5.4's hårde stop).
 * Beslutningen faldt 2026-07-31: navn OG parter, alle steder. De to etiketter er nu samme funktion —
 * kun fallback-teksten for et manglende ID skiller dem.
 */
const resolveCaseOverenskomstLabel = (overenskomstId: string | undefined): string =>
  resolveOverenskomstDisplay(overenskomstId);

/** Ansættelsesforholdets overenskomst-etiket, ordret som `loenindkomstDerivations.resolveOverenskomstLabel`. */
const resolveEmploymentOverenskomstLabel = (overenskomstId: string | undefined): string =>
  resolveOverenskomstDisplay(overenskomstId, 'Ingen valgt');

const isReguleringBasis = (value: string | undefined): value is ReguleringBasis =>
  value === 'Overenskomst' || value === 'Statistik' || value === 'KRL satstabel' || value === 'KL-lønaftaler';

const readCaseSource = (reader: InputReader): LoenudviklingSource => {
  const f = eoAngivetLoenFields;
  const basis = readOptional(reader, f.loenudviklingBeregningsgrundlag.bind());
  const overenskomstId = readOptional(reader, f.overenskomstId.bind());
  return {
    basis: isReguleringBasis(basis) ? basis : undefined,
    overenskomstId,
    statistikModel: readOptional(reader, f.loenudviklingStatistikModel.bind()),
    krlSatstabel: readOptional(reader, f.loenudviklingKRLSatstabel.bind()),
    loenPaaHelligdage: readOptional(reader, f.loenPaaHelligdage.bind()),
    offentligLoenType: readOptional(reader, f.offentligLoenType.bind()),
    offentligLoenTrin: readOptional(reader, f.offentligLoenTrin.bind()),
    offentligLoenGruppe: readOptional(reader, f.offentligLoenGruppe.bind()),
    offentligLoenEkstraGrundloen: readOptional(reader, f.offentligLoenEkstraGrundloen.bind()),
    overenskomstLabel: resolveCaseOverenskomstLabel(overenskomstId),
  };
};

const readEmploymentSource = (reader: InputReader, employmentId: string): LoenudviklingSource => {
  const f = eoEmploymentFields;
  const basis = readOptional(reader, f.loenudviklingBeregningsgrundlag.bind(employmentId));
  const overenskomstId = readOptional(reader, f.overenskomstId.bind(employmentId));
  return {
    basis: isReguleringBasis(basis) ? basis : undefined,
    overenskomstId,
    statistikModel: readOptional(reader, f.loenudviklingStatistikModel.bind(employmentId)),
    krlSatstabel: readOptional(reader, f.loenudviklingKRLSatstabel.bind(employmentId)),
    loenPaaHelligdage: readOptional(reader, f.loenPaaHelligdage.bind(employmentId)),
    offentligLoenType: readOptional(reader, f.offentligLoenType.bind(employmentId)),
    offentligLoenTrin: readOptional(reader, f.offentligLoenTrin.bind(employmentId)),
    offentligLoenGruppe: readOptional(reader, f.offentligLoenGruppe.bind(employmentId)),
    offentligLoenEkstraGrundloen: readOptional(reader, f.offentligLoenEkstraGrundloen.bind(employmentId)),
    overenskomstLabel: resolveEmploymentOverenskomstLabel(overenskomstId),
  };
};

/**
 * ÉN fælles regel for om et offentligt overenskomstvalg er komplet nok til at slå satser op.
 *
 * **Gælder KUN når det aktive grundlag er `Overenskomst`.** Løntrin, gruppe og ansættelsestype er
 * Overenskomst-grundlagets felter; Statistik, KRL-satstabel og KL-lønaftaler bruger dem ikke. Ved et
 * grundlagsskift BEVARES skjulte felter bevidst (`loenudviklingStateCleanup.ts`), og hele det øvrige
 * system gater derfor eksplicit på `loenudviklingBeregningsgrundlag` frem for at rydde dem. Kaldte
 * gaten her ubetinget, ville et tomt løntrin fra et tidligere valgt offentligt overenskomst-grundlag
 * blokere et efterfølgende KL-dokument, som slet ikke bruger løntrinnet — en blokering på et
 * irrelevant felt. Kaldsstedet nedenfor må derfor aldrig gøre kaldet ubetinget igen.
 *
 * Inden for Overenskomst-grundlaget kræves den strenge `isOffentligLoenSelectionReady`-regel:
 * løntrinnet skal kunne normaliseres, og løntypen skal være en kendt enumværdi.
 *
 * Den reelle forskel er `offentligLoenType`-enumtjekket. `toLoentrin`-kaldet er derimod defensivt og
 * kan i praksis ikke afvise noget: descriptoren bounder allerede feltet til 1..55 med præcis samme
 * grænse, så en værdi uden for intervallet afvises af FELTET (§1.6) og læses tilbage som
 * `undefined` — den fanges altså af `typeof !== 'number'` ovenfor. Kaldet bevares som værn mod, at
 * de to grænser en dag driver fra hinanden, men det er ikke den kæde, der beskytter opslaget.
 */
const isOffentligSelectionComplete = (source: LoenudviklingSource): boolean => {
  if (source.basis !== 'Overenskomst') return true;

  const overenskomstId = source.overenskomstId?.trim();
  if (!overenskomstId || !isOffentligOverenskomstId(overenskomstId)) return true;

  if (!offentligLoenTypeEnum.safeParse(source.offentligLoenType ?? 'Månedsløn').success) return false;

  if (typeof source.offentligLoenTrin !== 'number') return false;
  try {
    toLoentrin(source.offentligLoenTrin);
  } catch {
    return false;
  }

  if (typeof source.offentligLoenGruppe !== 'number') return false;
  if (source.offentligLoenGruppe < 0 || source.offentligLoenGruppe > 4) return false;

  return true;
};

/** Dæknings-intervallet for det valgte grundlag. Rene moduldata-opslag; ingen kildelæsning. */
const resolveReguleringsDatoInterval = (
  source: LoenudviklingSource
): Readonly<{ fraDato: string; tilDato: string }> | undefined => {
  switch (source.basis) {
    case 'Overenskomst':
      return getReguleringsDatoIntervalForOverenskomst(source.overenskomstId ?? '');
    case 'Statistik':
      return getReguleringsDatoIntervalForStatistikModel(source.statistikModel ?? '');
    case 'KRL satstabel':
      return source.krlSatstabel === undefined
        ? undefined
        : getReguleringsDatoIntervalForKRL(source.krlSatstabel as KRLSatstabelId);
    case 'KL-lønaftaler':
      return getReguleringsDatoIntervalForKlLoenaftaler();
    case undefined:
      return undefined;
  }
};

/**
 * Alt de tre outputs deler: kilde, stamdata og de fælles gate-trin.
 *
 * `stamdata` er en obligatorisk dokumentdependency for alle tre (brevhovedet bygges af den), præcis
 * som for de øvrige 15 outputs. Tidligere blev den sendt uvalideret ind i servicelaget som
 * `unknown` og re-parset dér; den sti findes ikke længere.
 */
type SharedReguleringSource = Readonly<{
  reader: InputReader;
  stamdata: ReturnType<typeof projectStamdataForDocument>;
}>;

/** Builderen er selv memo-nøglen, så de tre outputs deler ét slot pr. kildekontekst. */
const readSharedReguleringSource = (
  context: DocumentSourceContext<MineoDocumentGateSettings>
): SharedReguleringSource => ({
  reader: context.evaluation.reader,
  stamdata: projectStamdataForDocument(context.evaluation.reader, REGULERING_DOCUMENT_CONSUMER_ID),
});

/**
 * Ansættelsesforholds-samlingen som en bundet `CollectionRef`.
 *
 * Bygget af descriptorens egne felter frem for castet fra dens `template`: templaten er en
 * SUPERtype (dens entity-segmenter mangler `entityId`), og et cast ville derfor skjule, at netop
 * denne samling ligger i sektionens rod uden entity-forfædre. Antagelsen kontrolleres eksplicit, så
 * en fremtidig indlejring af samlingen fejler ved modulindlæsning frem for at give en tavst tom
 * entitetsliste — og dermed en tavst blokeret download.
 */
const employmentCollection = (() => {
  const { section, path, collection } = eoLoenindkomstAnsaettelsesforholdCollection.template;
  if (path.length > 0) {
    throw new Error(`Ansættelsesforholds-samlingen forventes i sektionsroden, men har stien ${JSON.stringify(path)}`);
  }
  return createCollectionRef({ section, path: [], collection });
})();

/**
 * Læser den aktiverede entitets felter, eller `null` hvis et udpeget ansættelsesforhold ikke længere
 * findes. Ét sted, fordi både gaten og outputvalget skal fail-close på præcis samme betingelse.
 */
const readRequestedSource = (
  shared: SharedReguleringSource,
  request: ReguleringDocumentRequest
): LoenudviklingSource | null => {
  if (request.scope === 'case') return readCaseSource(shared.reader);
  const exists = shared.reader
    .listEntities(employmentCollection)
    .some((entity) => entity.entityId === request.employmentId);
  return exists ? readEmploymentSource(shared.reader, request.employmentId) : null;
};

/** Fælles for alle tre outputs. */
type ReguleringCommonInput = Readonly<{
  interval: Readonly<{ fraDato: DanishDateString; tilDato: DanishDateString }>;
  stamdata: StamdataValues;
}>;

/**
 * Den fælles gate for alle tre outputs, i den rækkefølge kontrakten kræver: dependencies først
 * (stamdata), så entitetens eksistens, så grundlagsvalget, så dækningsintervallet.
 *
 * Bemærk `resolveReguleringInterval`'s tidligere adfærd: den KASTEDE ved et interval, hvis datoer
 * ikke kunne omsættes til dansk format (`documentService.ts`). En exception midt i afviklingen ville
 * i den nye struktur blive rapporteret som en uventet systemfejl. Det er en normal, forventelig
 * tilstand og er derfor nu en `blocked`-årsag fra gaten.
 */
const projectReguleringCommon = <TInput>(
  context: DocumentSourceContext<MineoDocumentGateSettings>,
  request: ReguleringDocumentRequest
):
  | Readonly<{ kind: 'blocked'; result: DocumentProjectionResult<TInput> }>
  | Readonly<{ kind: 'ok'; source: LoenudviklingSource; common: ReguleringCommonInput }> => {
  const shared = context.shared(readSharedReguleringSource);

  // Alle blokeringer nedenfor betyder "der mangler en indtastning/et valg" og viser derfor den universelle
  // tekst; kun stamdata-ISSUET navngiver et konkret felt og citeres ordret.
  if (shared.stamdata.status !== 'ready') {
    return {
      kind: 'blocked',
      result: blockedProjectionFromCauses(
        'regulering:stamdata-blocked',
        shared.stamdata.status === 'blocked' ? shared.stamdata.issues : undefined,
        'Stamdata indeholder fejl'
      ),
    };
  }

  // Frisk opslag af den aktiverede entitet. Ansættelsesforholdet kan være slettet siden klikket.
  const source = readRequestedSource(shared, request);
  if (source === null) {
    return {
      kind: 'blocked',
      result: blockedProjection('regulering:employment-missing', 'Ansættelsesforholdet findes ikke længere'),
    };
  }

  if (source.basis === undefined) {
    return {
      kind: 'blocked',
      result: blockedProjection('regulering:no-basis', 'Der er ikke valgt et grundlag for lønudviklingen'),
    };
  }

  if (!isOffentligSelectionComplete(source)) {
    return {
      kind: 'blocked',
      result: blockedProjection(
        'regulering:offentlig-loen-incomplete',
        'Løntrin og gruppe skal være udfyldt for den offentlige overenskomst'
      ),
    };
  }

  const rawInterval = resolveReguleringsDatoInterval(source);
  if (rawInterval === undefined || !rawInterval.fraDato || !rawInterval.tilDato) {
    return {
      kind: 'blocked',
      result: blockedProjection(
        'regulering:no-interval',
        'Der findes ingen tilgængelige reguleringssatser for det valgte grundlag'
      ),
    };
  }

  const fraDato = coerceToDanishDateString(rawInterval.fraDato);
  const tilDato = coerceToDanishDateString(rawInterval.tilDato);
  if (!fraDato || !tilDato) {
    return {
      kind: 'blocked',
      result: blockedProjection(
        'regulering:invalid-interval',
        `Ugyldigt reguleringsinterval: ${rawInterval.fraDato} - ${rawInterval.tilDato}`
      ),
    };
  }

  return { kind: 'ok', source, common: { interval: { fraDato, tilDato }, stamdata: shared.stamdata.value } };
};

// ---------------------------------------------------------------------------------------------
// regulering (Overenskomst / Statistik)
// ---------------------------------------------------------------------------------------------

export type ReguleringDocumentInput = ReguleringCommonInput & Readonly<{
  overenskomstLabel: string;
  loenudviklingBasis: 'Overenskomst' | 'Statistik';
  overenskomstId: string | undefined;
  statistikModelLabel: string | undefined;
  applyAlmindeligLoenPaaShDageRegel: boolean;
  offentligLoenType: string | undefined;
  offentligLoenTrin: number | undefined;
  offentligLoenGruppe: number | undefined;
  offentligLoenEkstraGrundloen: number | undefined;
}>;

export const reguleringDocumentDefinition: MineoDocumentDefinition<ReguleringDocumentInput, ReguleringDocumentRequest> =
  defineMineoDocument({
    id: 'regulering',
    brevhoved: { kind: 'settings-key', key: 'regulering' },
    labels: { documentName: 'reguleringssatser' },
    project: (context, request) => {
      const common = projectReguleringCommon<ReguleringDocumentInput>(context, request);
      if (common.kind === 'blocked') return common.result;
      const { source } = common;

      // Fail-closed: dette output gælder KUN Overenskomst/Statistik. Vælger den friske revision et
      // andet grundlag, hører aktiveringen til et af de to andre outputs, og resolveren nedenfor
      // sender den derhen. Nås denne gren alligevel, blokeres der frem for at rende videre.
      if (source.basis !== 'Overenskomst' && source.basis !== 'Statistik') {
        return blockedProjection('regulering:wrong-basis', 'Det valgte grundlag har ikke et reguleringssats-dokument');
      }

      return {
        status: 'ready',
        input: {
          ...common.common,
          overenskomstLabel: source.overenskomstLabel,
          loenudviklingBasis: source.basis,
          overenskomstId: source.overenskomstId,
          statistikModelLabel: source.statistikModel,
          applyAlmindeligLoenPaaShDageRegel: source.loenPaaHelligdage === 'Almindelig løn',
          offentligLoenType: source.offentligLoenType,
          offentligLoenTrin: source.offentligLoenTrin,
          offentligLoenGruppe: source.offentligLoenGruppe,
          offentligLoenEkstraGrundloen: amountValueToNumber(source.offentligLoenEkstraGrundloen),
        },
      };
    },
    loadRenderer: async () => {
      const { generateReguleringDocument } = await import('../../document/generators/eo/reguleringDocument');
      return (session, input, ctx) => generateReguleringDocument(session, {
        overenskomstLabel: input.overenskomstLabel,
        loenudviklingBasis: input.loenudviklingBasis,
        overenskomstId: input.overenskomstId,
        statistikModelLabel: input.statistikModelLabel,
        interval: input.interval,
        applyAlmindeligLoenPaaShDageRegel: input.applyAlmindeligLoenPaaShDageRegel,
        offentligLoenType: input.offentligLoenType,
        offentligLoenTrin: input.offentligLoenTrin,
        offentligLoenGruppe: input.offentligLoenGruppe,
        offentligLoenEkstraGrundloen: input.offentligLoenEkstraGrundloen,
        visBrevhoved: ctx.visBrevhoved,
        stamdata: input.stamdata,
      });
    },
  });

// ---------------------------------------------------------------------------------------------
// krl / kl-loenaftaler
// ---------------------------------------------------------------------------------------------

/**
 * KRL og KL-lønaftaler renderer rene moduldata-tabeller og har derfor ingen andre dependencies end
 * stamdata (til brevhovedet). Gaten er alligevel den fulde fælles gate — dækningsintervallet skal
 * findes, før knappen må være aktiv, præcis som for `regulering`.
 */
export type ReguleringSatstabelDocumentInput = ReguleringCommonInput;

export const krlDocumentDefinition: MineoDocumentDefinition<ReguleringSatstabelDocumentInput, ReguleringDocumentRequest> =
  defineMineoDocument({
    id: 'krl',
    // Bevidst UX: KRL bruger samme brevhoved-indstilling som regulering (ingen separat KRL-toggle).
    brevhoved: { kind: 'settings-key', key: 'regulering' },
    labels: { documentName: 'KRL-satstabeller' },
    project: (context, request) => {
      const common = projectReguleringCommon<ReguleringSatstabelDocumentInput>(context, request);
      if (common.kind === 'blocked') return common.result;
      if (common.source.basis !== 'KRL satstabel') {
        return blockedProjection('krl:wrong-basis', 'Grundlaget er ikke en KRL-satstabel');
      }
      return { status: 'ready', input: common.common };
    },
    loadRenderer: async () => {
      const { generateKRLDocument } = await import('../../document/generators/krl/krlDocument');
      return (session, input, ctx) =>
        generateKRLDocument(session, { visBrevhoved: ctx.visBrevhoved, stamdata: input.stamdata });
    },
  });

export const klLoenaftalerDocumentDefinition: MineoDocumentDefinition<ReguleringSatstabelDocumentInput, ReguleringDocumentRequest> =
  defineMineoDocument({
    id: 'kl-loenaftaler',
    // Bevidst UX: KL-lønaftaler bruger samme brevhoved-indstilling som regulering (ingen separat toggle).
    brevhoved: { kind: 'settings-key', key: 'regulering' },
    labels: { documentName: 'KL-lønaftaler' },
    project: (context, request) => {
      const common = projectReguleringCommon<ReguleringSatstabelDocumentInput>(context, request);
      if (common.kind === 'blocked') return common.result;
      if (common.source.basis !== 'KL-lønaftaler') {
        return blockedProjection('kl-loenaftaler:wrong-basis', 'Grundlaget er ikke KL-lønaftaler');
      }
      return { status: 'ready', input: common.common };
    },
    loadRenderer: async () => {
      const { generateKlLoenaftalerDocument } = await import('../../document/generators/klLoenaftaler/klLoenaftalerDocument');
      return (session, input, ctx) =>
        generateKlLoenaftalerDocument(session, { visBrevhoved: ctx.visBrevhoved, stamdata: input.stamdata });
    },
  });

// ---------------------------------------------------------------------------------------------
// Outputvalget
// ---------------------------------------------------------------------------------------------

/**
 * Hvilket af de tre outputs ét klik på "Tilgængelige reguleringssatser" hører til.
 *
 * Bruges BÅDE af den reaktive knap-gate (mod render-tidens kontekst) og af click-preflighten (mod
 * det friske snapshot efter settle). Fordi den er en ren funktion af kilden, kan de to ikke drifte —
 * og fordi preflighten kalder den EFTER barrieren, kan et settle, der ændrer
 * `loenudviklingBeregningsgrundlag`, ikke længere levere det forrige grundlags dokument.
 */
export type ReguleringDocumentOutputId = 'regulering' | 'krl' | 'kl-loenaftaler';

export const resolveReguleringDocumentOutputId = (
  context: DocumentSourceContext<MineoDocumentGateSettings>,
  request: ReguleringDocumentRequest
): ReguleringDocumentOutputId | null => {
  const source = readRequestedSource(context.shared(readSharedReguleringSource), request);
  if (source === null) return null;
  switch (source.basis) {
    case 'Overenskomst':
    case 'Statistik':
      return 'regulering';
    case 'KRL satstabel':
      return 'krl';
    case 'KL-lønaftaler':
      return 'kl-loenaftaler';
    case undefined:
      return null;
  }
};

/**
 * Den ene dynamiske dokumenthandling: det committed grundlag vælger outputtet EFTER lifecycleens
 * settle og friske capture. React må derfor aldrig selv køre en ekstra preflight.
 */
export const reguleringDocumentAction = defineDocumentAction<
  ReguleringDocumentRequest,
  MineoDocumentGateSettings,
  DocumentBrevhovedType
>({
  id: 'regulering',
  labels: { documentName: 'reguleringssatser' },
  resolve: (context, request) => {
    switch (resolveReguleringDocumentOutputId(context, request)) {
      case 'regulering':
        return resolveDocumentDefinition(reguleringDocumentDefinition, context, request);
      case 'krl':
        return resolveDocumentDefinition(krlDocumentDefinition, context, request);
      case 'kl-loenaftaler':
        return resolveDocumentDefinition(klLoenaftalerDocumentDefinition, context, request);
      case null:
        return { status: 'blocked', reasons: [REGULERING_NO_OUTPUT_REASON] };
    }
  },
});

/**
 * "Der er ikke valgt et grundlag" er en manglende INDTASTNING, ikke en specifik fejl: brugeren ser
 * derfor den universelle tekst, mens beskeden her bevares som den interne forklaring.
 *
 * Bygget med `missingInputReason` frem for et objektliteral. Literalet var det ENE sted i `src/`, der
 * konstruerede en gate-årsag uden om konstruktørerne, og dermed det ene sted, hvor en forkert `kind` ikke
 * ville blive fanget af en ændring i konstruktørerne.
 */
export const REGULERING_NO_OUTPUT_REASON: DocumentDownloadGateReason = missingInputReason(
  'regulering:no-output',
  'Der er ikke valgt et grundlag med tilgængelige reguleringssatser'
);
