import { createInputCatalog, type InputCatalog } from '../fieldCatalog';
import { renteberegningCollections, renteberegningFields } from './renteberegningDescriptors';
import { createProductionFieldLocations } from './fieldLocationCatalog';

// MinProcesrentes felt-katalog: kun renteberegningens descriptors. Standalone-beregneren har ingen andre
// sider, og ingen renteberegningsregel læser felter fra andre sektioner. Et eget katalog holder Mineos øvrige
// descriptors – og de sats-, løn- og kapitaliseringstabeller, deres relevans- og validatorregler importerer –
// ude af MinProcesrentes opstartschunk. Descriptorerne er de SAMME objekter som i produktionskataloget, så de
// to varianter kan ikke drifte i, hvordan et renteberegningsfelt parses, valideres eller lokaliseres.

let renteberegningCatalog: InputCatalog | null = null;

/** Returnerer MinProcesrentes katalog og bygger/validerer det ved første kald. */
export const getRenteberegningInputCatalog = (): InputCatalog => {
  renteberegningCatalog ??= createInputCatalog({
    fields: renteberegningFields,
    collections: renteberegningCollections,
    fieldLocations: createProductionFieldLocations(renteberegningFields),
  });
  return renteberegningCatalog;
};
