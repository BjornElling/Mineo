import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { createAarsloenInitialValues } from '../../domain/aarsloen/aarsloenInitialValues';
import { createRenteberegningInitialValues } from '../../domain/renteberegning/renteberegningInitialValues';
import { getProductionInputCatalog, productionInputFields } from '../../inputCore/catalog/productionCatalog';
import { clearField, reduceInputCommand } from '../../inputCore/inputReducer';
import { createEmptySettledInput } from '../../inputCore/settledInput';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { SectionKey } from '../../inputCore/fieldAddress';
import { deepEqual } from '../../utils/deepEqual';

/**
 * VÆRN (BF-025): en testfixture må ikke være RIGERE end den sag, produktionen faktisk laver.
 *
 * Der findes to konstruktioner af "en ny, tom sektion":
 *  1. `createEmpty<Sektion>Section` + det persisterede schemas defaults — den LEVENDE. Reduceren kalder den,
 *     første gang brugeren rører et felt på en side, og det er den tilstand, alle domænemotorer møder.
 *  2. `create<Sektion>InitialValues` — en ældre fabrik, som INGEN produktionssti kalder, men som ~110
 *     testfiler bygger deres fixture med.
 *
 * Hvor de to er uenige, tester suiten en tilstand, produktionen aldrig er i — og produktionen er i en
 * tilstand, ingen test måler. Det var præcis fælden i BF-025: fabrikken satte
 * `eoAngivetLoenLoenudvikling.loenPaaHelligdage`, den levende sektion gjorde ikke, og motorens fail-closed
 * ramte derfor kun brugeren.
 *
 * Testen forbyder ikke uenighed — nogle afvigelser er bevidste designvalg for en NY sag. Den kræver, at hver
 * afvigelse står EKSPLICIT nedenfor med sin begrundelse, så den er set og valgt frem for opstået.
 */

type AnyDescriptor = FieldDescriptor<unknown>;

const catalog = getProductionInputCatalog();

/** Sektionen som reduceren materialiserer den ved brugerens første berøring af siden. */
const materializeLiveSection = (section: SectionKey): Record<string, unknown> => {
  const anchor = (productionInputFields as readonly AnyDescriptor[])
    .filter((descriptor) => descriptor.template.section === section)
    .find((descriptor) => descriptor.template.path.every((segment) => segment.kind === 'property'));
  if (anchor === undefined) throw new Error(`Sektionen ${section} har intet statisk ankerfelt`);
  const result = reduceInputCommand(createEmptySettledInput(), clearField(anchor.bind()), catalog);
  const value = (result.input.sections as Record<string, unknown>)[section];
  if (value === null || typeof value !== 'object') throw new Error(`Sektionen ${section} blev ikke materialiseret`);
  return value as Record<string, unknown>;
};

const differingKeys = (
  live: Record<string, unknown>,
  fixture: Record<string, unknown>
): readonly string[] => [...new Set([...Object.keys(live), ...Object.keys(fixture)])]
  .filter((key) => !deepEqual(live[key], fixture[key]))
  .sort();

/**
 * Bevidste afvigelser mellem den levende sektion og den fabrik, testfixturene bruger.
 *
 * Hver post er et sted, hvor et krav om "ny sag" ikke er udtrykt i det persisterede schema. De hører
 * hjemme i den LEVENDE konstruktion; indtil de er flyttet dertil, er de opført her, så listen både
 * dokumenterer gælden og forhindrer, at den vokser ubemærket.
 */
const ACCEPTEREDE_AFVIGELSER: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  erstatningsopgoerelse: {
    kravPaaOevrigeErstatningskrav:
      'Ny sag starter med øvrige krav skjult; schema-defaulten "Ja" gælder kun sanering af ældre .eo.',
    svieSmertePerioder: 'Fabrikken sår en pladsholderrække; greenfield-rækkepladsholdere er virtuelle.',
    tafPerioder: 'Som svieSmertePerioder.',
    ferieperioder: 'Som svieSmertePerioder.',
    fravaerPerioder: 'Som svieSmertePerioder.',
    oevrigeKravPerioder: 'Som svieSmertePerioder.',
    eoAngivetLoenLoenudvikling:
      'Fabrikken lægger AppSettings-afledte standardvalg oveni (bl.a. offentligLoenType og overenskomstfilter).',
    indsaetUdkastStempel:
      'AppSettings-afledt. Den levende sektion læser ikke AppSettings, så brugerens standardvalg slår '
      + 'ikke igennem på en ny sag — noteret som åbent forhold i docs/brugerfund-der-skal-rettes.md (BF-025).',
  },
  aarsloen: {},
  renteberegning: {
    rentekravRows: 'Fabrikken sår en pladsholderrække; greenfield-rækkepladsholdere er virtuelle.',
  },
};

const CASES: ReadonlyArray<Readonly<{ section: SectionKey; fixture: () => Record<string, unknown> }>> = [
  {
    section: 'erstatningsopgoerelse',
    fixture: () => createErstatningsopgoerelseInitialValues() as unknown as Record<string, unknown>,
  },
  { section: 'aarsloen', fixture: () => createAarsloenInitialValues() as unknown as Record<string, unknown> },
  {
    section: 'renteberegning',
    fixture: () => createRenteberegningInitialValues() as unknown as Record<string, unknown>,
  },
];

describe('fixture-paritet: den gamle new-case-fabrik afviger kun der, hvor det er erklæret', () => {
  it.each(CASES.map(({ section, fixture }) => [section, fixture] as const))('%s', (section, fixture) => {
    const afvigende = differingKeys(materializeLiveSection(section), fixture());
    const erklaerede = Object.keys(ACCEPTEREDE_AFVIGELSER[section] ?? {}).sort();

    expect(
      afvigende,
      `Felter hvor testfixturen og den levende sektion er uenige for ${section}. `
      + 'Ret enten den levende konstruktion, eller erklær afvigelsen i ACCEPTEREDE_AFVIGELSER med en begrundelse.'
    ).toEqual(erklaerede);
  });

  it('BF-025-feltet er IKKE længere en afvigelse (regressionslås)', () => {
    const live = materializeLiveSection('erstatningsopgoerelse');
    const angivetLoen = live.eoAngivetLoenLoenudvikling as Record<string, unknown>;
    const fixtureAngivetLoen = createErstatningsopgoerelseInitialValues()
      .eoAngivetLoenLoenudvikling as unknown as Record<string, unknown>;

    expect(angivetLoen.loenPaaHelligdage).toBe('Almindelig løn');
    expect(fixtureAngivetLoen.loenPaaHelligdage).toBe(angivetLoen.loenPaaHelligdage);
  });

  it('måler faktisk noget (ikke grøn af tomhed)', () => {
    expect(Object.keys(materializeLiveSection('erstatningsopgoerelse')).length).toBeGreaterThan(30);
  });
});
