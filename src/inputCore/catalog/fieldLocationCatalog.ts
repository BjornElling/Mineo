import { APP_ROUTES, PAGE_DEFAULT_TAB, type AppRoute } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';
import { ERHVERVSEVNETAB_TAB_KEYS } from '../../config/eetTabKeys';
import type { SectionKey } from '../fieldAddress';
import type { FieldAddressTemplate, FieldDescriptor } from '../fieldDescriptor';
import type {
  StaticFieldLocation,
  StaticFieldLocationDestination,
} from '../fieldCatalog';

type AnyFieldDescriptor = FieldDescriptor<unknown>;

const destination = (route: AppRoute, tabKey: string | null): StaticFieldLocationDestination =>
  Object.freeze({ route, tabKey });

const SECTION_DEFAULT_DESTINATIONS: Readonly<Record<SectionKey, StaticFieldLocationDestination>> = Object.freeze({
  stamdata: destination(APP_ROUTES.stamdata, null),
  satser: destination(APP_ROUTES.satser, null),
  aarsloen: destination(APP_ROUTES.aarsloen, null),
  // Den delte årsløn har to spejlinger. EET-oplysninger er den prioriterede, altid tilgængelige consumer.
  faellesAarsloen: destination(
    APP_ROUTES.erhvervsevnetab,
    ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER
  ),
  renteberegning: destination(APP_ROUTES.renteberegning, PAGE_DEFAULT_TAB.renteberegning),
  varigemen: destination(APP_ROUTES.varigemen, PAGE_DEFAULT_TAB.varigemen),
  forsoergertab: destination(APP_ROUTES.forsoergertab, null),
  erstatningsopgoerelse: destination(APP_ROUTES.erstatningsopgoerelse, EO_TAB_KEYS.EO_OPLYSNINGER),
  erhvervsevnetab: destination(
    APP_ROUTES.erhvervsevnetab,
    ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER
  ),
});

const hasEntityCollection = (template: FieldAddressTemplate, collection: string): boolean =>
  template.path.some((segment) => segment.kind === 'entity' && segment.collection === collection);

const hasProperty = (template: FieldAddressTemplate, property: string): boolean =>
  template.path.some((segment) => segment.kind === 'property' && segment.name === property);

/**
 * De få sektioner med lazy faner erklærer deres afvigelser her. Reglerne klassificerer feltets statiske
 * adressetemplate, aldrig ordlyd eller mounted DOM, og katalogbygningen materialiserer derefter præcis én
 * destination for hvert produktionsdescriptor.
 */
const resolveTemplateDestination = (template: FieldAddressTemplate): StaticFieldLocationDestination => {
  if (template.section === 'erstatningsopgoerelse') {
    if (
      hasEntityCollection(template, 'loenindkomstAnsaettelsesforhold')
      || hasEntityCollection(template, 'sygeferiegodtgoerelseAnsaettelsesforhold')
    ) {
      return destination(APP_ROUTES.erstatningsopgoerelse, EO_TAB_KEYS.LOENINDKOMST);
    }
    if (
      hasEntityCollection(template, 'offentligeYdelserRows')
      || template.field === 'offentligeYdelserKommentarer'
      || template.field === 'midlertidigtEetFraEetSiden'
    ) {
      return destination(APP_ROUTES.erstatningsopgoerelse, EO_TAB_KEYS.OFFENTLIGE_YDELSER);
    }
    if (
      hasProperty(template, 'eoBilagSelection')
      || template.field === 'eoBilagLoenindkomstOgOffentligeYdelserIndgaar'
    ) {
      return destination(APP_ROUTES.erstatningsopgoerelse, EO_TAB_KEYS.BEREGNING);
    }
  }

  if (template.section === 'erhvervsevnetab') {
    if (hasProperty(template, 'eetDifferencekravBilagSelection')) {
      if (template.field === 'visUdvidetSpecifikation') {
        return destination(
          APP_ROUTES.erhvervsevnetab,
          ERHVERVSEVNETAB_TAB_KEYS.LOEBENDE_YDELSER
        );
      }
      return destination(APP_ROUTES.erhvervsevnetab, ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV);
    }
    if (template.field === 'endeligEetTilbagevirkende' || template.field === 'indregnMerErstatning') {
      return destination(APP_ROUTES.erhvervsevnetab, ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV);
    }
  }

  return SECTION_DEFAULT_DESTINATIONS[template.section];
};

/**
 * Materialiserer ét komplet katalogelement pr. produktionsdescriptor. `createInputCatalog` afviser både
 * dubletter, ukendte descriptors og manglende poster, så en ny felt-template kræver en eksplicit destination
 * ved katalogbygningen i stedet for at falde tilbage ved fokus-tidspunktet.
 */
export const createProductionFieldLocations = (
  fields: readonly AnyFieldDescriptor[]
): readonly StaticFieldLocation[] => Object.freeze(fields.map((field) => Object.freeze({
  field,
  destination: resolveTemplateDestination(field.template),
})));
