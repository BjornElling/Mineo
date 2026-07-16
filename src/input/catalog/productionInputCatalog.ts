import { InputCatalog } from '../fieldCatalog';
import { aarsloenInputManifest } from './aarsloenInputBindings';
import { erhvervsevnetabInputManifest } from './erhvervsevnetabInputBindings';
import { erstatningsopgoerelseInputManifest } from './erstatningsopgoerelseInputBindings';
import { erstatningsopgoerelseLoenInputManifest } from './erstatningsopgoerelseLoenInputBindings';
import { faellesAarsloenInputManifest } from './faellesAarsloenInputBindings';
import { forsoergertabInputManifest } from './forsoergertabInputBindings';
import { registerInputManifests, type InputManifest } from './inputManifest';
import { renteberegningInputManifest } from './renteberegningInputBindings';
import { satserInputManifest } from './satserInputBindings';
import { stamdataInputManifest } from './stamdataInputBindings';
import { varigeMenInputManifest } from './varigeMenInputBindings';

export const productionInputManifests: readonly InputManifest[] = Object.freeze([
  stamdataInputManifest,
  satserInputManifest,
  aarsloenInputManifest,
  faellesAarsloenInputManifest,
  renteberegningInputManifest,
  varigeMenInputManifest,
  forsoergertabInputManifest,
  erhvervsevnetabInputManifest,
  erstatningsopgoerelseInputManifest,
  erstatningsopgoerelseLoenInputManifest,
]);

/**
 * Eneste produktions-`InputCatalog`. Hvert bindingsmodul ejer sit manifest; denne fil
 * komponerer kun manifesterne og forsegler det samlede katalog.
 */
export const buildProductionInputCatalog = (): InputCatalog => {
  const catalog = new InputCatalog();
  registerInputManifests(catalog, productionInputManifests);
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

/** Kun til isolerede tests, hvor et frisk katalog kan være ønsket. */
export const __resetProductionInputCatalogForTests = (): void => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('productionInputCatalog: reset er kun tilladt i testmiljøet');
  }
  productionCatalog = null;
};
