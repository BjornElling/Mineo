import { erstatningsopgoerelseSchema } from '../../schemas/formSchemas/sections/erstatningsopgoerelseSchemas';

/**
 * Den tomme `erstatningsopgoerelse`-sektion – den fulde canonical default. `loenindkomstAnsaettelsesforhold`
 * er en påkrævet (ikke-defaultet) array, så den skal angives eksplicit for at parse.
 *
 * Den bor i sit eget modul, fordi BEGGE EO-descriptormoduler bruger den: lønindkomstens nested træ
 * (`erstatningsopgoerelseLoenDescriptors.ts`) og de øvrige EO-felter (`erstatningsopgoerelseDescriptors.ts`),
 * hvis relevansregler omvendt læser lønindkomstens felter. Lå den i det ene modul, importerede de to moduler
 * hinanden, og hvilket der blev evalueret først, ville afgøre, om fabrikken fandtes endnu.
 */
export const createEmptyErstatningsopgoerelseSection = (): unknown =>
  erstatningsopgoerelseSchema.parse({ loenindkomstAnsaettelsesforhold: [] });
