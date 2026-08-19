import type { InputReader, ReadFieldResult } from '../../inputCore/inputReader';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import type { EvaluationSourceToken } from '../../inputCore/evaluationSource';
import type { ISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { Koen } from '../../schemas/formSchemas';
import {
  forsoergertabBeregningsdatoField,
  forsoergertabEfterladteFodselsdatoField,
  forsoergertabKoenField,
  forsoergertabTilkendtForPeriodeAarField,
  forsoergertabVirkningsdatoField,
} from '../../inputCore/catalog/forsoergertabDescriptors';
import {
  faellesAarsloenAslAarsloenField,
  faellesAarsloenEalAarsloenField,
} from '../../inputCore/catalog/faellesAarsloenDescriptors';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { computeForsoergertabSnapshot, type ForsoergertabSnapshot } from './forsoergertabSnapshot';

// Forsørgertab-projektionen (§3.4/§5.4/§1.10). En ALMINDELIG ren funktion over
// den offentlige `InputReader`, der erstatter `Forsoergertab.tsx`'s rå `usePersistedForm`/
// `usePersistedSectionSelector`-læsning + `useFormFieldErrors`-gating. Den er den ENE kanoniske projektion til
// både sidevisning og download-gaten.
//
//  - Alle inputs (forsoergertab-felter, de delte faellesAarsloen-beløb, samt de tværsektionelle stamdata-datoer)
//    læses gennem readeren. En rød feltfejl (rejected format ELLER canonical bounds – dato-range/-orden,
//    beløbsgulv/loft, tilkendt-periode 1..10) skjules af readeren: værdien bliver `undefined` i beregningen, og
//    feltets røde besked føres ind i snapshottets `fieldErrors`.
//  - `computeForsoergertabSnapshot` køres UÆNDRET (§5.4 hårdt stop) på de reader-læste værdier. Den har allerede
//    den DEPENDENCY-SPECIFIKKE panel-/gate-logik (§1.10): en fejl på fx virkningsdato/ASL-årsløn blokerer ASL-
//    delen og download, men bevarer EAL-panelet. Derfor gates hele snapshottet IKKE bag en
//    global `blocked`-projektion – projektionen er altid `ready` og bærer snapshottet; det er snapshottets egen
//    `pdfGate`/`canShow*`, der afgør konsekvenserne uden en parallel klassifikations-sidekanal.
//  - ASL-årslønnens felt-placerede domæneregel (delelig med 1.000 / maks i skadesåret) holdes SLICE-LOKAL her.
//    Grunden er permanent, ikke en mellemtilstand: `faellesAarsloen.aslAarsloen` er en DELT descriptor, som både
//    denne slice og Erhvervsevnetab læser, og reglen afhænger af `skadedato` – altså af en kontekst, feltet selv
//    ikke kender. En descriptor-validator ville derfor skulle gælde ens for begge slices eller kende deres
//    kontekst; ingen af de to er rigtige. Reglen udledes i stedet af de reader-læste aslAarsloen + skadedato og
//    føres ind i snapshottets `fieldErrors.faellesAarsloen.aslAarsloen`, hvor `canShowAsl`/`pdfGate` blokerer.
//    Erhvervsevnetab-slicen bærer SAMME regel af samme grund; de to er bevidst parallelle, ikke duplikerede ved
//    et uheld.

const efterladteFodselsdatoRef: FieldRef<ISODateString | undefined> = forsoergertabEfterladteFodselsdatoField.bind();
const beregningsdatoRef: FieldRef<ISODateString | undefined> = forsoergertabBeregningsdatoField.bind();
const virkningsdatoRef: FieldRef<ISODateString | undefined> = forsoergertabVirkningsdatoField.bind();
const koenRef: FieldRef<Koen | undefined> = forsoergertabKoenField.bind();
const tilkendtForPeriodeAarRef: FieldRef<number | undefined> = forsoergertabTilkendtForPeriodeAarField.bind();
const aslAarsloenRef: FieldRef<AmountValue | undefined> = faellesAarsloenAslAarsloenField.bind();
const ealAarsloenRef: FieldRef<AmountValue | undefined> = faellesAarsloenEalAarsloenField.bind();
const skadedatoRef: FieldRef<ISODateString | undefined> = stamdataSkadedatoField.bind();
const skadelidteFodselsdatoRef: FieldRef<ISODateString | undefined> = stamdataSkadelidteFodselsdatoField.bind();

export type ForsoergertabReaderProjection = Readonly<{
  /** Det ENE snapshot (uændret beregning). Driver både sidevisning og download-gaten. */
  snapshot: ForsoergertabSnapshot;
  /** Kildesnapshottets token – issue-snapshot og reader stammer fra samme evaluering (§3.4). */
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

/**
 * Bygger den kanoniske reader-afledte projektion for Forsørgertab. Feltværdier og røde feltfejl læses gennem
 * readeren og føres ind i den (uændrede) snapshot-beregning, som ejer den dependency-specifikke panel-/gate-logik
 * (§1.10). Download-gaten afledes af `snapshot.pdfGate` (jf. `forsoergertabDownloadGate`).
 */
export const buildForsoergertabReaderProjection = (reader: InputReader): ForsoergertabReaderProjection => {
  const beregningsdato = readField(reader.read(beregningsdatoRef));
  const virkningsdato = readField(reader.read(virkningsdatoRef));
  const efterladteFodselsdato = readField(reader.read(efterladteFodselsdatoRef));
  const koen = readField(reader.read(koenRef));
  const tilkendtForPeriodeAar = readField(reader.read(tilkendtForPeriodeAarRef));
  const aslAarsloen = readField(reader.read(aslAarsloenRef));
  const ealAarsloen = readField(reader.read(ealAarsloenRef));
  const skadedato = readField(reader.read(skadedatoRef));
  const skadelidteFodselsdato = readField(reader.read(skadelidteFodselsdatoRef));

  const snapshot = computeForsoergertabSnapshot({
    values: {
      beregningsdato: beregningsdato.value,
      virkningsdato: virkningsdato.value,
      efterladteFodselsdato: efterladteFodselsdato.value,
      koen: koen.value,
      tilkendtForPeriodeAar: tilkendtForPeriodeAar.value,
    },
    faellesAarsloen: { aslAarsloen: aslAarsloen.value, ealAarsloen: ealAarsloen.value },
    stamdata: {
      // Snapshottet aftager kun de to datoer; de øvrige stamdata-felter er irrelevante for beregningen.
      skadedato: skadedato.value,
      skadelidteFodselsdato: skadelidteFodselsdato.value,
      journalnr: '',
      advokat: '',
      sagsbehandler: '',
    },
    // De røde feltfejl ejes af readeren og føres ind her, så snapshottets dependency-specifikke `canShow*` og
    // `pdfGate` blokerer præcist (§1.10): fx blokerer en virkningsdato-fejl ASL + download, men bevarer
    // EAL-panelet. ASL-årsløns-reglen (delelig med 1.000 / maks i skadesåret) er KANONISK i descriptoren, så den
    // kommer ind ad samme vej som enhver anden rød feltfejl – den genberegnes IKKE her (ét sandt sted, §1.6).
    fieldErrors: {
      forsoergertab: {
        beregningsdato: asFieldError(beregningsdato.errorMessage),
        virkningsdato: asFieldError(virkningsdato.errorMessage),
        efterladteFodselsdato: asFieldError(efterladteFodselsdato.errorMessage),
        koen: asFieldError(koen.errorMessage),
        tilkendtForPeriodeAar: asFieldError(tilkendtForPeriodeAar.errorMessage),
      },
      faellesAarsloen: {
        aslAarsloen: asFieldError(aslAarsloen.errorMessage),
        ealAarsloen: asFieldError(ealAarsloen.errorMessage),
      },
      stamdata: {
        skadedato: asFieldError(skadedato.errorMessage),
        skadelidteFodselsdato: asFieldError(skadelidteFodselsdato.errorMessage),
      },
    },
  });

  return { snapshot, sourceToken: reader.sourceToken };
};
