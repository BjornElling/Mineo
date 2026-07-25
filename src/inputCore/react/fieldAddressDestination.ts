import type { FieldAddress, SectionKey } from '../fieldAddress';
import { APP_ROUTES, getRouteForPageKey, PAGE_DEFAULT_TAB } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';

// Den ENE afbildning fra en strukturel feltadresse til den flade, brugeren skal se den på (§3.2/§3.7).
//
// Både save-blocking-fokus og undo/redo-navigation har brug for "hvor bor dette felt?". Afbildningen udledes af
// adressens STRUKTUR (sektion + første path-led), ikke af string-præfikser på feltnavne, som den afløste
// legacy-routing gjorde. Et nyt felt i en kendt collection routes derfor korrekt uden at nogen liste opdateres.

export type FieldAddressDestination = Readonly<{
  /** Sektionen, der ejer feltet (bruges til fane-opslag). */
  pageKey: SectionKey;
  /** Route feltet vises på. */
  route: string;
  /** Fane feltet bor på, eller `undefined` hvis siden ikke har faner. */
  tabKey?: string;
}>;

/** Første entity-collection i adressens sti, fx `loenindkomstAnsaettelsesforhold`. */
const firstCollection = (address: FieldAddress): string | undefined => {
  for (const segment of address.path) {
    if (segment.kind === 'entity') return segment.collection;
  }
  return undefined;
};

/** Første property-led i adressens sti (nested objekter). */
const firstProperty = (address: FieldAddress): string | undefined => {
  for (const segment of address.path) {
    if (segment.kind === 'property') return segment.name;
  }
  return undefined;
};

/**
 * EO's faner udledes af adressens struktur: hvilken collection/property feltet ligger i, ellers feltnavnet for
 * de få top-level felter, der hører til en anden fane end standardfanen.
 */
const resolveEoTab = (address: FieldAddress): string => {
  const collection = firstCollection(address);
  if (collection === 'loenindkomstAnsaettelsesforhold') return EO_TAB_KEYS.LOENINDKOMST;
  if (collection === 'offentligeYdelserRows') return EO_TAB_KEYS.OFFENTLIGE_YDELSER;

  const property = firstProperty(address);
  if (property === 'loenindkomst') return EO_TAB_KEYS.LOENINDKOMST;
  if (property === 'offentligeYdelser') return EO_TAB_KEYS.OFFENTLIGE_YDELSER;

  if (address.field === 'sygedagpengeFra' || address.field === 'sygedagpengeTil'
    || address.field === 'offentligeYdelserKommentarer' || address.field === 'midlertidigtEetFraEetSiden') {
    return EO_TAB_KEYS.OFFENTLIGE_YDELSER;
  }

  return PAGE_DEFAULT_TAB.erstatningsopgoerelse;
};

/**
 * Hvor skal brugeren sendes hen for at se feltet på `address`?
 *
 * `faellesAarsloen` er en DELT sektion uden egen route: den vises under forsørgertab eller erhvervsevnetab,
 * afhængigt af hvor brugeren står. Derfor indgår `currentPathname` — står brugeren på forsørgertab, bliver de der.
 */
export const resolveFieldAddressDestination = (
  address: FieldAddress,
  currentPathname: string
): FieldAddressDestination => {
  const section = address.section;

  if (section === 'faellesAarsloen') {
    const route = currentPathname === APP_ROUTES.forsoergertab
      ? APP_ROUTES.forsoergertab
      : APP_ROUTES.erhvervsevnetab;
    return Object.freeze({
      pageKey: section,
      route,
      ...(route === APP_ROUTES.erhvervsevnetab ? { tabKey: PAGE_DEFAULT_TAB.erhvervsevnetab } : {}),
    });
  }

  const route = getRouteForPageKey(section) ?? currentPathname;

  if (section === 'erstatningsopgoerelse') {
    return Object.freeze({ pageKey: section, route, tabKey: resolveEoTab(address) });
  }

  const defaultTab = PAGE_DEFAULT_TAB[section as keyof typeof PAGE_DEFAULT_TAB] as string | undefined;
  return Object.freeze({
    pageKey: section,
    route,
    ...(defaultTab === undefined ? {} : { tabKey: defaultTab }),
  });
};
