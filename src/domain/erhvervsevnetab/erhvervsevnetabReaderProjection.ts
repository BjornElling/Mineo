import type { InputReader, ReadFieldResult } from '../../inputCore/inputReader';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import type { EvaluationSourceToken } from '../../inputCore/evaluationSource';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type {
  AfgoerelseType,
  AslAfgoerelseRow,
  ErhvervsevnetabComposedValues,
  JaNej,
  Koen,
} from '../../schemas/formSchemas';
import { amountValueToNumber } from '../../utils/expressionAmount';
import {
  validateAslAarsloenBySkadesaarMax,
  validateAslAarsloenDivisibleBy1000,
} from '../aslEalAarsloen/aarsloenValidators';
import {
  aslAfgoerelseAfgoerelseTypeField,
  aslAfgoerelseAfgoerelsesDatoField,
  aslAfgoerelseEetPctField,
  aslAfgoerelseFsTilbageholdtEetField,
  aslAfgoerelseKapDatoField,
  aslAfgoerelseKapPctField,
  aslAfgoerelseTidlKapDatoField,
  aslAfgoerelseVirkningsDatoField,
  erhvervsevnetabAslAfgoerelserCollectionRef,
  erhvervsevnetabBeregningsdatoField,
  erhvervsevnetabBilagEetEfterEalField,
  erhvervsevnetabBilagKapitaliseringField,
  erhvervsevnetabBilagLoebendeYdelserField,
  erhvervsevnetabBilagMerErstatningPensionsalderField,
  erhvervsevnetabBilagProformaKapitaliseringField,
  erhvervsevnetabBilagVisUdvidetSpecLoebendeField,
  erhvervsevnetabBilagVisUdvidetSpecifikationField,
  erhvervsevnetabEalEetPctField,
  erhvervsevnetabEndeligEetTilbagevirkendeField,
  erhvervsevnetabIndregnMerErstatningField,
  erhvervsevnetabKoenField,
} from '../../inputCore/catalog/erhvervsevnetabDescriptors';
import {
  faellesAarsloenAslAarsloenField,
  faellesAarsloenEalAarsloenField,
} from '../../inputCore/catalog/faellesAarsloenDescriptors';
import {
  eoForligAnsvarsgradBroekField,
  eoForligAnsvarsgradProcentField,
  eoForligDatoField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { collectEetAslAfgoerelseValidationIssues } from './eetAslAfgoerelser';
import { computeEetSnapshot, type EetSnapshot } from './eetSnapshot';

// Greenfield Erhvervsevnetab-projektion (§3.4/§5.4/§1.10, Fase 3 Erhvervsevnetab-slice). En ALMINDELIG ren
// funktion over den offentlige `InputReader`, der erstatter `Erhvervsevnetab.tsx`'s rå `usePersistedForm`/
// `usePersistedSectionSelector`/`useInvalidDraftForFieldSelector`-læsning + `useFormFieldErrors`-gating. Den er
// den ENE kanoniske projektion til alle fem tabs (løbende ydelser, kapitalisering, EET efter EAL, differencekrav)
// samt deres download-gates.
//
//  - Alle inputs læses gennem readeren: erhvervsevnetab-skalarer + bilagsvalg, den fulde `aslAfgoerelser`-collection
//    (rekonstrueret række for række i afsluttet rækkefølge), de delte faellesAarsloen-beløb, de tværsektionelle
//    stamdata-datoer og de EO-delte forligs-felter. En rød feltfejl (rejected format ELLER canonical bounds — her
//    procent-bounds på ealEetPct + hver rækkes eetPct/kapPct) skjules af readeren: værdien bliver `undefined`, og
//    feltets røde besked føres ind i snapshottets `fieldErrors`.
//  - `computeEetSnapshot` køres UÆNDRET (§5.4 hårdt stop mod talændring) på de reader-læste værdier. Snapshottet
//    ejer allerede den DEPENDENCY-SPECIFIKKE per-fane-blokering (§1.10): fx blokerer en ealEetPct-fejl kun EET-efter-
//    EAL-fanen, mens de øvrige faner bevares. Derfor gates hele projektionen IKKE bag en global `blocked`-projektion —
//    den er altid `ready` og bærer snapshottet; det er snapshottets egne per-fane-`issues`/`pdfGate`, der afgør
//    konsekvenserne. `hadReaderFieldError` medbringes, så en download-gate kan skelne en rød feltfejl fra en ren
//    manglende-felt-tilstand.
//  - Tre felt-placerede DOMÆNEREGLER føres slice-lokalt ind i snapshottets `fieldErrors` (som legacy gjorde via
//    error-bus-effekter), fordi de deler descriptor med endnu ikke migrerede sektioner:
//      * ASL-årsløns-reglen (delelig 1.000 / maks i skadesår) → `fieldErrors.faellesAarsloen.aslAarsloen` (samme regel
//        som Forsørgertab-slicen; `faellesAarsloen.aslAarsloen` er delt).
//      * ASL-afgørelsesrækkernes indbyrdes valideringsfejl (`collectEetAslAfgoerelseValidationIssues`) → snapshottet
//        aftager KUN den FØRSTE via `fieldErrors.erhvervsevnetab.aslAfgoerelser` (bevidst afgrænsning, uændret fra
//        legacy; øvrige row-fejl vises inline i tabellen ved den senere tab-cutover).
//      * Forligs-blokeringen ("begge udfyldt"/brøk > 1/ugyldigt rå draft) føres via `forlig`-argumentet uændret ind.
//  - BEMÆRK afgrænsning: køn-reglen (køn påkrævet ved beregning/kapitalisering før 1. marts 2015) er i legacy en REN
//    SAVE-GATE-fejl (rapporteret til error-bus, men IKKE aftaget af `computeEetSnapshot`). Den påvirker derfor ikke
//    denne projektion og hører til tab-/save-gate-cutoveren, ikke beregningsprojektionen.

const beregningsdatoRef: FieldRef<ISODateString | undefined> = erhvervsevnetabBeregningsdatoField.bind();
const koenRef: FieldRef<Koen | undefined> = erhvervsevnetabKoenField.bind();
const ealEetPctRef: FieldRef<number | undefined> = erhvervsevnetabEalEetPctField.bind();
const endeligEetTilbagevirkendeRef: FieldRef<boolean> = erhvervsevnetabEndeligEetTilbagevirkendeField.bind();
const indregnMerErstatningRef: FieldRef<boolean> = erhvervsevnetabIndregnMerErstatningField.bind();

const bilagLoebendeYdelserRef: FieldRef<boolean> = erhvervsevnetabBilagLoebendeYdelserField.bind();
const bilagKapitaliseringRef: FieldRef<boolean> = erhvervsevnetabBilagKapitaliseringField.bind();
const bilagEetEfterEalRef: FieldRef<boolean> = erhvervsevnetabBilagEetEfterEalField.bind();
const bilagProformaKapitaliseringRef: FieldRef<boolean> = erhvervsevnetabBilagProformaKapitaliseringField.bind();
const bilagMerErstatningPensionsalderRef: FieldRef<boolean> = erhvervsevnetabBilagMerErstatningPensionsalderField.bind();
const bilagVisUdvidetSpecifikationRef: FieldRef<boolean> = erhvervsevnetabBilagVisUdvidetSpecifikationField.bind();
const bilagVisUdvidetSpecLoebendeRef: FieldRef<boolean> = erhvervsevnetabBilagVisUdvidetSpecLoebendeField.bind();

const aslAarsloenRef: FieldRef<AmountValue | undefined> = faellesAarsloenAslAarsloenField.bind();
const ealAarsloenRef: FieldRef<AmountValue | undefined> = faellesAarsloenEalAarsloenField.bind();
const skadedatoRef: FieldRef<ISODateString | undefined> = stamdataSkadedatoField.bind();
const skadelidteFodselsdatoRef: FieldRef<ISODateString | undefined> = stamdataSkadelidteFodselsdatoField.bind();

const forligProcentRef: FieldRef<number | undefined> = eoForligAnsvarsgradProcentField.bind();
const forligBroekRef: FieldRef<string | undefined> = eoForligAnsvarsgradBroekField.bind();
const forligDatoRef: FieldRef<ISODateString | undefined> = eoForligDatoField.bind();

export type ErhvervsevnetabReaderProjection = Readonly<{
  /** Det ENE snapshot (uændret beregning). Driver sidevisningen for alle fem tabs + download-gates. */
  snapshot: EetSnapshot;
  /** Sandt, hvis mindst ét læst felt havde en aktiv rød feltfejl (format/bounds). Adskiller `field-error` fra en ren manglende-felt-tilstand. */
  hadReaderFieldError: boolean;
  /** Kildesnapshottets token — issue-snapshot og reader stammer fra samme evaluering (§3.4). */
  sourceToken: EvaluationSourceToken;
}>;

/** En reader-læsning omsat til {værdi, fejlbesked}: en rød feltfejl skjuler værdien (§1.5/§1.6). */
type ReadField<T> = Readonly<{ value: T | undefined; errorMessage: string | undefined }>;

const readField = <T>(read: ReadFieldResult<T | undefined>): ReadField<T> =>
  read.status === 'error'
    ? { value: undefined, errorMessage: read.issue.message }
    : { value: read.value, errorMessage: undefined };

const asFieldError = (errorMessage: string | undefined): { message: string } | undefined =>
  errorMessage === undefined ? undefined : { message: errorMessage };

/** Læser en required-boolean gennem readeren (aldrig rød; fald tilbage til codec-tomværdien ved en umulig fejl). */
const readBoolean = (read: ReadFieldResult<boolean>, fallback: boolean): boolean =>
  read.status === 'usable' ? read.value : fallback;

/**
 * Rekonstruerer én committed ASL-afgørelsesrække fra readeren. En celle med rød feltfejl (eetPct/kapPct-bounds)
 * skjules til `undefined`, præcis som readeren gør — rækkevaliderings-collectoren (der udleder de indbyrdes
 * regler) ser derfor samme værdier som beregningen. `fsTilbageholdtEet` er required-choice (tomværdi 'Nej').
 */
const readCommittedAslRow = (reader: InputReader, rowId: string): AslAfgoerelseRow => {
  const afgoerelsesDato = readField<ISODateString>(reader.read(aslAfgoerelseAfgoerelsesDatoField.bind(rowId)));
  const virkningsDato = readField<ISODateString>(reader.read(aslAfgoerelseVirkningsDatoField.bind(rowId)));
  const eetPct = readField<number>(reader.read(aslAfgoerelseEetPctField.bind(rowId)));
  const kapDato = readField<ISODateString>(reader.read(aslAfgoerelseKapDatoField.bind(rowId)));
  const kapPct = readField<number>(reader.read(aslAfgoerelseKapPctField.bind(rowId)));
  const tidlKapDato = readField<ISODateString>(reader.read(aslAfgoerelseTidlKapDatoField.bind(rowId)));
  const afgoerelseType = readField<AfgoerelseType>(reader.read(aslAfgoerelseAfgoerelseTypeField.bind(rowId)));
  const fsTilbageholdtEet = reader.read(aslAfgoerelseFsTilbageholdtEetField.bind(rowId));
  return {
    id: rowId,
    afgoerelsesDato: afgoerelsesDato.value,
    virkningsDato: virkningsDato.value,
    eetPct: eetPct.value,
    kapDato: kapDato.value,
    kapPct: kapPct.value,
    tidlKapDato: tidlKapDato.value,
    afgoerelseType: afgoerelseType.value,
    fsTilbageholdtEet: (fsTilbageholdtEet.status === 'usable' ? fsTilbageholdtEet.value : 'Nej') as JaNej,
  };
};

/** Rekonstruerer alle committede ASL-afgørelsesrækker (i afsluttet rækkefølge) fra readeren. */
export const readAslAfgoerelserCommittedRows = (reader: InputReader): AslAfgoerelseRow[] =>
  reader
    .listEntities(erhvervsevnetabAslAfgoerelserCollectionRef)
    .map((entity) => readCommittedAslRow(reader, entity.entityId));

/** Sandt, hvis mindst én ASL-rækkecelle har en aktiv rød feltfejl (bounds på eetPct/kapPct). */
const anyAslRowHasReaderFieldError = (reader: InputReader): boolean =>
  reader.listEntities(erhvervsevnetabAslAfgoerelserCollectionRef).some((entity) => {
    const rowId = entity.entityId;
    return (
      reader.read(aslAfgoerelseEetPctField.bind(rowId)).status === 'error' ||
      reader.read(aslAfgoerelseKapPctField.bind(rowId)).status === 'error'
    );
  });

/**
 * Bygger den kanoniske reader-afledte projektion for Erhvervsevnetab. Feltværdier og røde feltfejl læses gennem
 * readeren og føres ind i den (uændrede) `computeEetSnapshot`-beregning, som ejer den dependency-specifikke per-
 * fane-blokering (§1.10). Download-gates for hver fane afledes af `snapshot.<fane>` (jf. `erhvervsevnetabDownloadGate`).
 */
export const buildErhvervsevnetabReaderProjection = (reader: InputReader): ErhvervsevnetabReaderProjection => {
  const beregningsdato = readField(reader.read(beregningsdatoRef));
  const koen = readField(reader.read(koenRef));
  const ealEetPct = readField(reader.read(ealEetPctRef));
  const aslAarsloen = readField(reader.read(aslAarsloenRef));
  const ealAarsloen = readField(reader.read(ealAarsloenRef));
  const skadedato = readField(reader.read(skadedatoRef));
  const skadelidteFodselsdato = readField(reader.read(skadelidteFodselsdatoRef));

  const forligProcent = readField(reader.read(forligProcentRef));
  const forligBroek = readField(reader.read(forligBroekRef));
  const forligDato = readField(reader.read(forligDatoRef));

  const aslAfgoerelser = readAslAfgoerelserCommittedRows(reader);

  const hadReaderFieldError =
    [
      beregningsdato, koen, ealEetPct, aslAarsloen, ealAarsloen, skadedato, skadelidteFodselsdato,
      forligProcent, forligBroek,
    ].some((read) => read.errorMessage !== undefined) || anyAslRowHasReaderFieldError(reader);

  // ASL-årslønnens felt-placerede domæneregel (slice-lokal, som Forsørgertab): kun relevant, når ASL-årslønnen
  // ikke allerede har en rød feltfejl (readeren har da skjult værdien, og bounds-fejlen blokerer allerede).
  const aslRuleMessage = aslAarsloen.errorMessage === undefined
    ? (validateAslAarsloenDivisibleBy1000(amountValueToNumber(aslAarsloen.value))
      ?? validateAslAarsloenBySkadesaarMax(amountValueToNumber(aslAarsloen.value), skadedato.value))
    : undefined;

  // ASL-afgørelsesrækkernes indbyrdes valideringsfejl. Snapshottet aftager KUN den første (uændret afgrænsning).
  const aslAfgoerelserRuleMessage = collectEetAslAfgoerelseValidationIssues(
    aslAfgoerelser,
    coerceToISODateString(skadedato.value),
    coerceToISODateString(skadelidteFodselsdato.value)
  )[0]?.message;

  const composedValues: ErhvervsevnetabComposedValues = {
    beregningsdato: beregningsdato.value,
    koen: koen.value,
    ealEetPct: ealEetPct.value,
    aslAfgoerelser,
    eetDifferencekravBilagSelection: {
      loebendeYdelser: readBoolean(reader.read(bilagLoebendeYdelserRef), true),
      kapitalisering: readBoolean(reader.read(bilagKapitaliseringRef), true),
      eetEfterEal: readBoolean(reader.read(bilagEetEfterEalRef), true),
      proformaKapitalisering: readBoolean(reader.read(bilagProformaKapitaliseringRef), true),
      merErstatningPensionsalder: readBoolean(reader.read(bilagMerErstatningPensionsalderRef), true),
      visUdvidetSpecifikation: readBoolean(reader.read(bilagVisUdvidetSpecifikationRef), false),
      visUdvidetSpecifikationLoebendeYdelserBilag: readBoolean(reader.read(bilagVisUdvidetSpecLoebendeRef), false),
    },
    endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: readBoolean(reader.read(endeligEetTilbagevirkendeRef), true),
    indregnMerErstatningVedForhoejetPensionsalder: readBoolean(reader.read(indregnMerErstatningRef), true),
    aslAarsloen: aslAarsloen.value,
    ealAarsloen: ealAarsloen.value,
    skadelidteFodselsdato: skadelidteFodselsdato.value,
  };

  const snapshot = computeEetSnapshot({
    values: composedValues,
    // Snapshottet aftager kun skadedato fra stamdata (skadelidteFodselsdato læses fra composedValues). De øvrige
    // stamdata-felter er irrelevante for EET-beregningen.
    stamdata: {
      skadedato: skadedato.value,
      skadelidteFodselsdato: skadelidteFodselsdato.value,
      journalnr: '',
      advokat: '',
      sagsbehandler: '',
    },
    // De røde feltfejl ejes nu af readeren og føres ind her, så snapshottets dependency-specifikke per-fane-issues
    // blokerer PRÆCIS som legacy (§1.10). De tre felt-placerede domæneregler tilføjes på deres felter (en aktiv
    // reader-fejl har forrang, da den allerede skjuler værdien).
    fieldErrors: {
      stamdata: {
        skadedato: asFieldError(skadedato.errorMessage),
        skadelidteFodselsdato: asFieldError(skadelidteFodselsdato.errorMessage),
      },
      erhvervsevnetab: {
        beregningsdato: asFieldError(beregningsdato.errorMessage),
        ealEetPct: asFieldError(ealEetPct.errorMessage),
        aslAfgoerelser: asFieldError(aslAfgoerelserRuleMessage),
      },
      faellesAarsloen: {
        aslAarsloen: asFieldError(aslAarsloen.errorMessage ?? aslRuleMessage),
        ealAarsloen: asFieldError(ealAarsloen.errorMessage),
      },
    },
    forlig: {
      values: {
        forligAnsvarsgradProcent: forligProcent.value,
        forligAnsvarsgradBroek: forligBroek.value,
      },
      dato: forligDato.value,
      // Et ikke-committbart rå forligsdraft er i greenfield-modellen en rød reader-feltfejl (format-issue).
      hasInvalidDraft: forligProcent.errorMessage !== undefined || forligBroek.errorMessage !== undefined,
    },
  });

  return { snapshot, hadReaderFieldError, sourceToken: reader.sourceToken };
};
