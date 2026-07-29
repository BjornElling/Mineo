import { createInputCatalog, type InputCatalog } from '../fieldCatalog';
import { aarsloenCollections, aarsloenFields } from './aarsloenDescriptors';
import { erhvervsevnetabCollections, erhvervsevnetabFields } from './erhvervsevnetabDescriptors';
import { erstatningsopgoerelseCollections, erstatningsopgoerelseFields } from './erstatningsopgoerelseDescriptors';
import { erstatningsopgoerelseLoenCollections, erstatningsopgoerelseLoenFields } from './erstatningsopgoerelseLoenDescriptors';
import { faellesAarsloenCollections, faellesAarsloenFields } from './faellesAarsloenDescriptors';
import { forsoergertabCollections, forsoergertabFields } from './forsoergertabDescriptors';
import { renteberegningCollections, renteberegningFields } from './renteberegningDescriptors';
import { satserCollections, satserFields } from './satserDescriptors';
import { stamdataCollections, stamdataFields } from './stamdataDescriptors';
import { varigeMenCollections, varigeMenFields } from './varigeMenDescriptors';
import { loenindkomstSatsDerivedWrite } from '../../domain/erstatningsopgoerelse/control/loenindkomstSatsDerivedWrite';

// Produkt-descriptor-kataloget (§3.2). Det ene statiske katalog over alle persisterede
// brugerfelter — fusion af de tidligere ti binding-manifester til inputCore-descriptors. Hvert descriptor
// ejer id, codec, semantisk tomhed, canonical read/write, label, kontroltype (relevans/validators tilføjes
// pr. slice i fase 3). Kataloget valideres ÉN gang i `createInputCatalog`; ingen seal/brand/WeakSet.

/** Alle produkt-felt-descriptors, flad. Eksponeret så completeness-testen kan reconcilere mod ledger/schemas. */
export const productionInputFields = Object.freeze([
  ...stamdataFields,
  ...satserFields,
  ...aarsloenFields,
  ...faellesAarsloenFields,
  ...renteberegningFields,
  ...varigeMenFields,
  ...forsoergertabFields,
  ...erhvervsevnetabFields,
  ...erstatningsopgoerelseFields,
  ...erstatningsopgoerelseLoenFields,
]);

/** Alle produkt-collection-descriptors, flad. */
export const productionInputCollections = Object.freeze([
  ...stamdataCollections,
  ...satserCollections,
  ...aarsloenCollections,
  ...faellesAarsloenCollections,
  ...renteberegningCollections,
  ...varigeMenCollections,
  ...forsoergertabCollections,
  ...erhvervsevnetabCollections,
  ...erstatningsopgoerelseCollections,
  ...erstatningsopgoerelseLoenCollections,
]);

/**
 * Alle erklærede afledte skrivninger (§3.6). Et afledt felt er ikke brugerinput men en konsekvens af det, og
 * det materialiseres derfor inde i samme reducerede kandidat som årsagen — ikke af en effect efter render,
 * som ville gøre konsekvensen til en selvstændig autoritativ handling med sit eget undo-trin (GM-F02).
 */
export const productionDerivedWrites = Object.freeze([
  loenindkomstSatsDerivedWrite,
]);

export const buildProductionInputCatalog = (): InputCatalog => createInputCatalog({
  fields: productionInputFields,
  collections: productionInputCollections,
  derivedWrites: productionDerivedWrites,
});

let productionCatalog: InputCatalog | null = null;

/** Returnerer det statiske produktionskatalog og bygger/validerer det ved første kald. */
export const getProductionInputCatalog = (): InputCatalog => {
  productionCatalog ??= buildProductionInputCatalog();
  return productionCatalog;
};
