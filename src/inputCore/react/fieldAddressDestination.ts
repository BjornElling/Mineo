import type { FieldAddress, SectionKey } from '../fieldAddress';
import { APP_ROUTES, getRouteForPageKey, PAGE_DEFAULT_TAB } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';
import { ERHVERVSEVNETAB_TAB_KEYS } from '../../domain/erhvervsevnetab/eetIssueNavigation';

// Den ENE afbildning fra en strukturel feltadresse til den flade, brugeren skal se den på (§3.2/§3.7).
//
// Både save-blocking-fokus og undo/redo-navigation har brug for "hvor bor dette felt?". Afbildningen udledes
// af adressens STRUKTUR — sektion, første collection/property og feltnavn — ikke af string-præfikser på
// feltnavne, som den afløste legacy-routing gjorde.
//
// ⚠️ HELE fane-afbildningen er EKSPLICIT. Den tidligere version faldt tilbage til sidens standardfane for alt,
// den ikke genkendte, hvilket gjorde to reelle fejl usynlige: `eoBilagSelection.*` blev sendt til
// EO-oplysninger (feltet bor på Beregning), og ALLE ikke-EO-sektioner fik kun standardfanen, selv om fx
// Erhvervsevnetab har redigerbare felter på Differencekrav-fanen. En tavs fallback er derfor forbudt her:
// `resolveFieldAddressTab` returnerer `undefined` for et ukendt felt, og `fieldAddressDestination`-
// completeness-testen fejler, hvis et felt i produktionskataloget ikke har en destination. Tilføjer man et
// felt på en ny fane, fejler testen — ikke brugerens navigation.

export type FieldAddressDestination = Readonly<{
  /** Sektionen, der ejer feltet (bruges til fane-opslag). */
  pageKey: SectionKey;
  /** Route feltet vises på. */
  route: string;
  /** Fane feltet bor på, eller `undefined` hvis siden ikke har faner. */
  tabKey?: string;
}>;

/**
 * EO-collections → fane. Nye felter i en KENDT collection routes korrekt uden at nogen liste opdateres;
 * det er hele pointen i at nøgle på struktur frem for feltnavn.
 */
const EO_TAB_BY_COLLECTION: Readonly<Record<string, string>> = Object.freeze({
  // Lønindkomst-fanen: ansættelsesforholdene og deres nestede tabeller + sygeferiegodtgørelsen
  // (`loenindkomst/SygeferiegodtgoerelseSection.tsx`).
  loenindkomstAnsaettelsesforhold: EO_TAB_KEYS.LOENINDKOMST,
  sfggAnsaettelsesforhold: EO_TAB_KEYS.LOENINDKOMST,
  offentligeYdelserRows: EO_TAB_KEYS.OFFENTLIGE_YDELSER,
  // EO-oplysninger-fanen: alle periodetabeller under `eoOplysninger/sections/`.
  tafPerioder: EO_TAB_KEYS.EO_OPLYSNINGER,
  ferieperioder: EO_TAB_KEYS.EO_OPLYSNINGER,
  fravaerPerioder: EO_TAB_KEYS.EO_OPLYSNINGER,
  svieSmertePerioder: EO_TAB_KEYS.EO_OPLYSNINGER,
  oevrigeKravPerioder: EO_TAB_KEYS.EO_OPLYSNINGER,
});

/** EO nested properties → fane. */
const EO_TAB_BY_PROPERTY: Readonly<Record<string, string>> = Object.freeze({
  loenindkomst: EO_TAB_KEYS.LOENINDKOMST,
  offentligeYdelser: EO_TAB_KEYS.OFFENTLIGE_YDELSER,
  // Bilagsvalgene redigeres på Beregning-fanen, IKKE på EO-oplysninger. Bemærk at `eoBilagSelection`s felter
  // hedder fx `loenindkomst` og `offentligeYdelser`: en feltnavns-baseret afbildning ville sende dem til de
  // forkerte faner. Derfor slås property op FØR feltnavnet.
  eoBilagSelection: EO_TAB_KEYS.BEREGNING,
  // "Angivet løn"-grundlaget redigeres på EO-oplysninger (`eoOplysninger/sections/IndtaegtFoerSkadenSection.tsx`),
  // ikke på Lønindkomst — trods navneligheden med ansættelsesforholdenes løn-felter.
  eoAngivetLoenLoenudvikling: EO_TAB_KEYS.EO_OPLYSNINGER,
});

/**
 * EO top-level felter, der bor på en ANDEN fane end standardfanen (EO-oplysninger). Listen er udledt af de
 * faktiske `EditorLocation`-erklæringer på de to ikke-default-faner, ikke af feltnavne-mønstre:
 * `OffentligeYdelserTab.tsx` og `EOberegningTab.tsx:445`.
 *
 * (`sygedagpengeFra`/`sygedagpengeTil` hører bevidst IKKE til her: de er transient hjælpe-state i
 * `OffentligeYdelserTab`, ikke persisterede katalogfelter, og har derfor ingen feltadresse.)
 */
const EO_TAB_BY_FIELD: Readonly<Record<string, string>> = Object.freeze({
  offentligeYdelserKommentarer: EO_TAB_KEYS.OFFENTLIGE_YDELSER,
  midlertidigtEetFraEetSiden: EO_TAB_KEYS.OFFENTLIGE_YDELSER,
  eoBilagLoenindkomstOgOffentligeYdelserIndgaar: EO_TAB_KEYS.BEREGNING,
});

/**
 * Erhvervsevnetabs top-level felter, der IKKE bor på standardfanen (EET-oplysninger).
 * `beregningsdato`, `koen` og `ealEetPct` bor på standardfanen og listes derfor ikke.
 */
const EET_TAB_BY_FIELD: Readonly<Record<string, string>> = Object.freeze({
  endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV,
  indregnMerErstatningVedForhoejetPensionsalder: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV,
});

/**
 * `eetDifferencekravBilagSelection`s otte toggles er IKKE på samme fane, så en property-baseret afbildning
 * ville sende én af dem til den forkerte fane. `visUdvidetSpecifikation` redigeres på Løbende ydelser
 * (`EetLoebendeYdelserTab.tsx:47`); de øvrige på Differencekrav (`EetDifferencekravTab.tsx:68-73`). Derfor
 * er netop denne property nøglet pr. FELT.
 */
const EET_BILAG_TAB_BY_FIELD: Readonly<Record<string, string>> = Object.freeze({
  visUdvidetSpecifikation: ERHVERVSEVNETAB_TAB_KEYS.LOEBENDE_YDELSER,
  loebendeYdelser: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV,
  kapitalisering: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV,
  eetEfterEal: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV,
  proformaKapitalisering: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV,
  merErstatningPensionsalder: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV,
  visUdvidetSpecifikationLoebendeYdelserBilag: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV,
});

/**
 * EO's fane udledes af adressens struktur, i den rækkefølge segmenterne står i stien.
 *
 * ⚠️ Rækkefølgen er betydende, og den må ikke ændres til "collection før property". `eoAngivetLoenLoenudvikling`
 * indeholder collections, der har SAMME navn som ansættelsesforholdenes (`loenudviklingManuelTableData`), men
 * bor på en anden fane. Det YDERSTE segment ejer destinationen — derfor slås det FØRSTE segment op, uanset
 * om det er en property eller en collection. Falder vi tilbage til feltnavnet, sker det først til sidst.
 */
const resolveEoTab = (address: FieldAddress): string | undefined => {
  const outermost = address.path[0];
  if (outermost !== undefined) {
    return outermost.kind === 'entity'
      ? EO_TAB_BY_COLLECTION[outermost.collection]
      : EO_TAB_BY_PROPERTY[outermost.name];
  }

  return EO_TAB_BY_FIELD[address.field] ?? PAGE_DEFAULT_TAB.erstatningsopgoerelse;
};

const resolveErhvervsevnetabTab = (address: FieldAddress): string | undefined => {
  const outermost = address.path[0];
  if (outermost?.kind === 'entity' && outermost.collection === 'aslAfgoerelser') {
    return ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER;
  }
  if (outermost?.kind === 'property' && outermost.name === 'eetDifferencekravBilagSelection') {
    return EET_BILAG_TAB_BY_FIELD[address.field];
  }
  return EET_TAB_BY_FIELD[address.field] ?? PAGE_DEFAULT_TAB.erhvervsevnetab;
};

/**
 * EO-ejede felter, der OGSÅ redigeres på en anden sides fane.
 *
 * Forliget om ansvarsgrad hører til EO-sektionen, men de samme tre felter renderes både på EO-oplysninger og på
 * Erhvervsevnetabs Differencekrav-fane (`EetDifferencekravTab.tsx:76-78`). Sektionen alene kan derfor ikke
 * afgøre destinationen — ligesom for `faellesAarsloen` skal brugerens aktuelle side afgøre det, så et blokeret
 * save ikke river brugeren fra Differencekrav over til EO-oplysninger.
 */
const CONTEXT_SHARED_EO_FIELDS: Readonly<Record<string, Readonly<{ route: string; tabKey: string }>>> =
  Object.freeze({
    forligAnsvarsgradProcent: { route: APP_ROUTES.erhvervsevnetab, tabKey: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV },
    forligAnsvarsgradBroek: { route: APP_ROUTES.erhvervsevnetab, tabKey: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV },
    forligDato: { route: APP_ROUTES.erhvervsevnetab, tabKey: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV },
  });

/**
 * Den alternative destination for et kontekst-delt felt, HVIS brugeren står på den anden side. Ellers
 * `undefined`, så feltets egen sektion afgør destinationen som normalt.
 */
const resolveContextSharedDestination = (
  address: FieldAddress,
  currentPathname: string
): FieldAddressDestination | undefined => {
  if (address.section !== 'erstatningsopgoerelse' || address.path.length > 0) return undefined;
  const alternative = CONTEXT_SHARED_EO_FIELDS[address.field];
  if (alternative === undefined || currentPathname !== alternative.route) return undefined;
  return Object.freeze({ pageKey: address.section, route: alternative.route, tabKey: alternative.tabKey });
};

/**
 * Fanen for en adresse, eller `undefined` hvis sektionen ikke har faner.
 *
 * Eksporteret, så completeness-testen kan afgøre, om hvert produktionsfelt får en destination — uden at
 * gentage afbildningen. Bemærk at kontekst-delte felter (se ovenfor) afgøres i
 * `resolveFieldAddressDestination`, fordi de kræver brugerens aktuelle side.
 */
export const resolveFieldAddressTab = (address: FieldAddress): string | undefined => {
  switch (address.section) {
    case 'erstatningsopgoerelse':
      return resolveEoTab(address);
    case 'erhvervsevnetab':
      return resolveErhvervsevnetabTab(address);
    case 'faellesAarsloen':
      // Delt sektion uden egen route; fanen afgøres af kontekst-routen i `resolveFieldAddressDestination`.
      return undefined;
    default:
      return PAGE_DEFAULT_TAB[address.section as keyof typeof PAGE_DEFAULT_TAB] as string | undefined;
  }
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

  // Kontekst-delte felter først: står brugeren på den anden sides fane, bliver de der (jf. `faellesAarsloen`).
  const contextShared = resolveContextSharedDestination(address, currentPathname);
  if (contextShared !== undefined) return contextShared;

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
  const tabKey = resolveFieldAddressTab(address);

  return Object.freeze({
    pageKey: section,
    route,
    ...(tabKey === undefined ? {} : { tabKey }),
  });
};
