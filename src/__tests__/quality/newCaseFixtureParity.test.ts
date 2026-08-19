import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { createAarsloenInitialValues } from '../../domain/aarsloen/aarsloenInitialValues';
import { createRenteberegningInitialValues } from '../../domain/renteberegning/renteberegningInitialValues';
import { createProductionNewCaseSeed } from '../../domain/newCaseSeed';
import { getProductionInputCatalog, productionInputFields } from '../../inputCore/catalog/productionCatalog';
import { clearField, reduceInputCommand } from '../../inputCore/inputReducer';
import { createEmptySettledInput } from '../../inputCore/settledInput';
import { createNewCaseInput } from '../../inputCore/runtime/newCaseInput';
import { DEFAULT_APP_SETTINGS } from '../../settings/appSettingsSchema';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { SectionKey } from '../../inputCore/fieldAddress';
import { deepEqual } from '../../utils/deepEqual';

/**
 * VÆRN: en testfixture må ikke være RIGERE end den sag, produktionen faktisk laver.
 *
 * En sektion får sin første værdi ét af to steder:
 *  1. NY-SAGS-SEEDEN, som `createNewCaseInput` anvender ved bootstrap og `Slet alt`. Den ejer de krav om "sådan
 *     starter en ny sag", der ikke kan udtrykkes i det persisterede schema – bl.a. brugerens programindstillinger.
 *  2. `createEmpty<Sektion>Section` + schemaets defaults, som reduceren materialiserer, første gang brugeren
 *     rører et felt på en side, hvis sektion ikke er seedet.
 *
 * Begge er LEVENDE. Ved siden af dem står `create<Sektion>InitialValues` – fabrikker, ingen produktionssti
 * kalder, men som ~110 testfiler bygger deres fixture med. Hvor fabrikken og den levende sag er uenige, tester
 * suiten en tilstand, produktionen aldrig er i, og produktionen er i en tilstand, ingen test måler. Det var
 * præcis den fælde.
 *
 * Testen forbyder ikke uenighed – den kræver, at hver afvigelse står EKSPLICIT nedenfor med sin begrundelse,
 * så den er set og valgt frem for opstået.
 */

type AnyDescriptor = FieldDescriptor<unknown>;

const catalog = getProductionInputCatalog();

/** Sagen som produktionen bootstrapper den: den tomme baseline med domænets ny-sags-seed lagt oveni. */
const newCaseInput = createNewCaseInput(catalog, createProductionNewCaseSeed(DEFAULT_APP_SETTINGS));

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

/** Sektionen som brugeren møder den på en helt ny sag – seedet, hvis den er det; ellers først-berørt. */
const liveSection = (section: SectionKey): Record<string, unknown> => {
  const seeded = (newCaseInput.sections as Record<string, unknown>)[section];
  if (seeded !== null && typeof seeded === 'object') return seeded as Record<string, unknown>;
  return materializeLiveSection(section);
};

/**
 * Sammenligningen sker på den PERSISTEREDE form. Den levende sag er round-trippet gennem envelopen (som enhver
 * commit er det), hvor JSON dropper `undefined`-nøgler; fabrikkens `schema.parse` beholder dem, når input
 * nævnte dem eksplicit. Forskellen er ikke en uenighed om værdier – kun om en fraværende værdi staves
 * "mangler nøgle" eller "nøgle med undefined" – og den ville drukne de ægte fund.
 */
const asPersisted = (value: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

const differingKeys = (
  liveValue: Record<string, unknown>,
  fixtureValue: Record<string, unknown>
): readonly string[] => {
  const live = asPersisted(liveValue);
  const fixture = asPersisted(fixtureValue);
  return [...new Set([...Object.keys(live), ...Object.keys(fixture)])]
    .filter((key) => !deepEqual(live[key], fixture[key]))
    .sort();
};

/**
 * Bevidste afvigelser mellem den levende sag og den fabrik, testfixturene bruger.
 *
 * Efter at ny-sags-defaults har fået ét sandt sted, er der kun ÉN grund tilbage: greenfields pladsholderrække
 * er virtuel og findes ikke i den persisterede sag, mens fixturene har brug for en materialiseret række at
 * skrive i. Enhver anden afvigelse er en fabrik, der har fået sin egen mening om, hvad en ny sag er.
 */
const ACCEPTEREDE_AFVIGELSER: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  erstatningsopgoerelse: {
    svieSmertePerioder: 'Fabrikken sår en pladsholderrække; greenfield-rækkepladsholdere er virtuelle.',
    tafPerioder: 'Som svieSmertePerioder.',
    ferieperioder: 'Som svieSmertePerioder.',
    fravaerPerioder: 'Som svieSmertePerioder.',
    oevrigeKravPerioder: 'Som svieSmertePerioder.',
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
    const afvigende = differingKeys(liveSection(section), fixture());
    const erklaerede = Object.keys(ACCEPTEREDE_AFVIGELSER[section] ?? {}).sort();

    expect(
      afvigende,
      `Felter hvor testfixturen og den levende sag er uenige for ${section}. `
      + 'Ret enten den levende konstruktion, eller erklær afvigelsen i ACCEPTEREDE_AFVIGELSER med en begrundelse.'
    ).toEqual(erklaerede);
  });

  it('det tidligere afvigende felt er IKKE længere en afvigelse (regressionslås)', () => {
    const live = materializeLiveSection('erstatningsopgoerelse');
    const angivetLoen = live.eoAngivetLoenLoenudvikling as Record<string, unknown>;
    const fixtureAngivetLoen = createErstatningsopgoerelseInitialValues()
      .eoAngivetLoenLoenudvikling as unknown as Record<string, unknown>;

    expect(angivetLoen.loenPaaHelligdage).toBe('Almindelig løn');
    expect(fixtureAngivetLoen.loenPaaHelligdage).toBe(angivetLoen.loenPaaHelligdage);
  });

  it('måler faktisk noget (ikke grøn af tomhed)', () => {
    expect(Object.keys(liveSection('erstatningsopgoerelse')).length).toBeGreaterThan(25);
  });

  it('måler den SEEDEDE sag, ikke kun den først-berørte sektion (mutationstest)', () => {
    // Mutationen rammer måle-mekanismen: EO-sektionen SKAL komme fra seeden på en ny sag. Falder målingen
    // tilbage til den først-berørte sektion, ville et settings-afledt felt se ud som om det slog igennem,
    // fordi fabrikken og fallbacken deler schemaets default.
    const seeded = (newCaseInput.sections as Record<string, unknown>).erstatningsopgoerelse;
    expect(seeded).not.toBeNull();
    expect((seeded as Record<string, unknown>).kravPaaOevrigeErstatningskrav).toBe('Skjul');
    expect(materializeLiveSection('erstatningsopgoerelse').kravPaaOevrigeErstatningskrav).toBe('Ja');
  });
});
