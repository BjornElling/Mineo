import { productionInputFields } from '../../../inputCore/catalog/productionCatalog';
import {
  resolveFieldAddressDestination,
  resolveFieldAddressTab,
} from '../../../inputCore/react/fieldAddressDestination';
import { PAGE_DEFAULT_TAB } from '../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../config/eoTabKeys';
import { ERHVERVSEVNETAB_TAB_KEYS } from '../../../domain/erhvervsevnetab/eetIssueNavigation';
import type { FieldAddress } from '../../../inputCore/fieldAddress';

// F4: destinationstabellen skal være KOMPLET, ikke en heuristik med tavs fallback.
//
// Den afløste version faldt tilbage til sidens standardfane for alt, den ikke genkendte. Det gjorde to reelle
// fejl usynlige: `eoBilagSelection.*` blev sendt til EO-oplysninger, selv om felterne bor på Beregning, og ALLE
// ikke-EO-sektioner fik kun standardfanen, selv om Erhvervsevnetab har redigerbare felter på Differencekrav.
//
// Denne test er værnet: den itererer over det FAKTISKE produktionskatalog, så et nyt felt på en ny fane får
// testen til at fejle i stedet for at sende brugeren til den forkerte fane.

/** Sektioner med faner. En adresse i disse sektioner SKAL resolve til en fane. */
const TABBED_SECTIONS = new Set(Object.keys(PAGE_DEFAULT_TAB));

/** Bygger en repræsentativ adresse fra et descriptors template (entity-id'er er irrelevante for fanen). */
const templateToAddress = (template: {
  section: string;
  path: readonly { kind: string; name?: string; collection?: string }[];
  field: string;
}): FieldAddress => ({
  section: template.section as FieldAddress['section'],
  path: template.path.map((segment) => segment.kind === 'property'
    ? { kind: 'property' as const, name: segment.name as string }
    : { kind: 'entity' as const, collection: segment.collection as string, entityId: 'row-1' }),
  field: template.field,
});

describe('fieldAddressDestination: komplet dækning af produktionskataloget', () => {
  const addresses = productionInputFields.map((descriptor) => ({
    id: descriptor.id,
    address: templateToAddress(descriptor.template as never),
  }));

  it('dækker hvert felt i produktionskataloget (ingen tavs fallback)', () => {
    // `faellesAarsloen` er den ENE undtagelse: en delt sektion uden egen route, hvis fane afgøres af
    // kontekst-routen i `resolveFieldAddressDestination`. Alle øvrige fanebærende sektioner skal have en fane.
    const missing = addresses.filter(({ address }) =>
      address.section !== 'faellesAarsloen'
      && TABBED_SECTIONS.has(address.section)
      && resolveFieldAddressTab(address) === undefined);

    expect(missing.map((entry) => entry.id)).toEqual([]);
  });

  it('giver hvert felt en route', () => {
    const withoutRoute = addresses.filter(({ address }) =>
      resolveFieldAddressDestination(address, '/stamdata').route === '');

    expect(withoutRoute.map((entry) => entry.id)).toEqual([]);
  });

  it('sender eoBilagSelection-felterne til Beregning-fanen, ikke til EO-oplysninger', () => {
    // Den konkrete F4-fejl. Bemærk at felterne HEDDER fx `loenindkomst` og `offentligeYdelser`; en
    // feltnavns-baseret afbildning ville sende dem til Lønindkomst-/Offentlige ydelser-fanerne.
    const bilagFields = addresses.filter(({ id }) => id.startsWith('eo.eoBilagSelection.'));
    expect(bilagFields.length).toBeGreaterThan(0);

    for (const { id, address } of bilagFields) {
      expect(resolveFieldAddressTab(address), id).toBe(EO_TAB_KEYS.BEREGNING);
    }
  });

  it('sender EETs differencekrav-felter til Differencekrav-fanen', () => {
    const differencekravFields = [
      'endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft',
      'indregnMerErstatningVedForhoejetPensionsalder',
    ];

    for (const field of differencekravFields) {
      const address: FieldAddress = { section: 'erhvervsevnetab', path: [], field };
      expect(resolveFieldAddressTab(address), field).toBe(ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV);
    }
  });

  it('respekterer at ét bilag-toggle bor på Løbende ydelser, ikke på Differencekrav', () => {
    // `visUdvidetSpecifikation` redigeres på Løbende ydelser (`EetLoebendeYdelserTab.tsx:47`), mens de øvrige
    // toggles i samme nested property bor på Differencekrav. En property-baseret afbildning ville ramme forkert.
    const onLoebende: FieldAddress = {
      section: 'erhvervsevnetab',
      path: [{ kind: 'property', name: 'eetDifferencekravBilagSelection' }],
      field: 'visUdvidetSpecifikation',
    };
    const onDifferencekrav: FieldAddress = {
      section: 'erhvervsevnetab',
      path: [{ kind: 'property', name: 'eetDifferencekravBilagSelection' }],
      field: 'kapitalisering',
    };

    expect(resolveFieldAddressTab(onLoebende)).toBe(ERHVERVSEVNETAB_TAB_KEYS.LOEBENDE_YDELSER);
    expect(resolveFieldAddressTab(onDifferencekrav)).toBe(ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV);
  });

  it('router en nested tabelcelle efter sit YDERSTE ansættelsesforhold, ikke efter den indre tabel', () => {
    const nestedCell: FieldAddress = {
      section: 'erstatningsopgoerelse',
      path: [
        { kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold', entityId: 'af-1' },
        { kind: 'entity', collection: 'indtaegtsoplysningerTableData', entityId: 'row-1' },
      ],
      field: 'col0_maaned',
    };

    expect(resolveFieldAddressTab(nestedCell)).toBe(EO_TAB_KEYS.LOENINDKOMST);
  });

  it('holder et KONTEKST-DELT forligsfelt på den EET-fane, brugeren står på', () => {
    // De tre forligsfelter ejes af EO-sektionen, men renderes OGSÅ på EETs Differencekrav-fane
    // (`EetDifferencekravTab.tsx:76-78`). Sektionen alene må derfor ikke afgøre destinationen: står brugeren
    // på Differencekrav, ville et blokeret save ellers rive dem over til EO-oplysninger.
    for (const field of ['forligAnsvarsgradProcent', 'forligAnsvarsgradBroek', 'forligDato']) {
      const address: FieldAddress = { section: 'erstatningsopgoerelse', path: [], field };

      const fromEet = resolveFieldAddressDestination(address, '/erhvervsevnetab');
      expect(fromEet.route, field).toBe('/erhvervsevnetab');
      expect(fromEet.tabKey, field).toBe(ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV);

      // Står brugeren andre steder, gælder feltets egen sektion som normalt.
      const fromElsewhere = resolveFieldAddressDestination(address, '/stamdata');
      expect(fromElsewhere.route, field).toBe('/erstatningsopgoerelse');
      expect(fromElsewhere.tabKey, field).toBe(EO_TAB_KEYS.EO_OPLYSNINGER);
    }
  });

  it('sender sygeferiegodtgørelsens rækker til Lønindkomst-fanen', () => {
    const sfggCell: FieldAddress = {
      section: 'erstatningsopgoerelse',
      path: [{ kind: 'entity', collection: 'sfggAnsaettelsesforhold', entityId: 'af-1' }],
      field: 'sfggManuelDagssats',
    };

    expect(resolveFieldAddressTab(sfggCell)).toBe(EO_TAB_KEYS.LOENINDKOMST);
  });
});
