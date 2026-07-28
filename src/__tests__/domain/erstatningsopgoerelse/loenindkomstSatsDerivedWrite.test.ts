import { buildProductionInputCatalog, productionDerivedWrites } from '../../../inputCore/catalog/productionCatalog';
import { loenindkomstSatsDerivedWrite } from '../../../domain/erstatningsopgoerelse/control/loenindkomstSatsDerivedWrite';
import {
  eoEmploymentFields,
  eoLoenindkomstAnsaettelsesforholdCollection,
} from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { stamdataSkadedatoField } from '../../../inputCore/catalog/stamdataDescriptors';
import { eoTafBeregningsperiodeTilField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  insertRow,
  reduceInputCommand,
  replaceCase,
  setImmediateField,
  settleField,
} from '../../../inputCore/inputReducer';
import { createEmptySettledInput, type SettledInput } from '../../../inputCore/settledInput';
import type { CollectionRef } from '../../../inputCore/fieldAddress';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

/**
 * De overenskomstbundne satser er AFLEDTE felter (GM-F02): de materialiseres i samme reducerede kandidat som
 * det styrende valg, ikke af en React-effect efter render.
 *
 * Testene her måler den ægte produktionsregel gennem den ægte reducer. Det centrale krav er, at ÉN command
 * bærer både årsag og konsekvens: gjorde den ikke det, ville brugerens ene oplevede handling kræve to
 * undo-trin, og et undo af satsen kunne straks blive skrevet tilbage, fordi det styrende valg stadig var
 * aktivt.
 */

const catalog = buildProductionInputCatalog();
const employments = eoLoenindkomstAnsaettelsesforholdCollection.template as CollectionRef;

/**
 * Baseline med en anvendt reguleringsdato. Ved `beregnesUdFra: 'Beregningsperiode'` (defaultet) udledes
 * datoen af beregningsperiodens sluttidspunkt — uden den låser ingen overenskomst nogen sats, og reglen har
 * intet at udlede.
 */
const seedCase = (employment: Record<string, unknown> = {}): SettledInput => {
  const withSkadedato = reduceInputCommand(
    createEmptySettledInput(),
    settleField(stamdataSkadedatoField.bind(), '01-06-2024'),
    catalog
  ).input;
  const withPeriode = reduceInputCommand(
    withSkadedato,
    settleField(eoTafBeregningsperiodeTilField.bind(), '30-06-2024'),
    catalog
  ).input;
  return reduceInputCommand(
    withPeriode,
    insertRow(employments, {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-1',
      loenPaaHelligdage: 'Almindelig løn',
      ...employment,
    }),
    catalog
  ).input;
};

/** Et ansættelsesforhold med overenskomst slået til, men uden de låste satser materialiseret. */
const seedEmployment = (): SettledInput => seedCase({ harOverenskomst: true });

const readEmployment = (input: SettledInput) =>
  input.sections.erstatningsopgoerelse?.loenindkomstAnsaettelsesforhold.find((af) => af.id === 'af-1');

describe('loenindkomstSatsDerivedWrite', () => {
  it('er erklæret på produktionskataloget', () => {
    // Et værn, hvis mål ikke er tilkoblet, er grønt af tomhed. Denne assertion er den levende binding
    // mellem reglen og den runtime, der faktisk kører den.
    expect(productionDerivedWrites).toContain(loenindkomstSatsDerivedWrite);
    expect(catalog.derivedWrites.map((rule) => rule.id)).toContain('erstatningsopgoerelse.loenindkomstSatser');
  });

  it('materialiserer de låste satser i SAMME reduktion som valget af overenskomst', () => {
    const seeded = seedEmployment();
    expect(readEmployment(seeded)?.fritvalgPct).toBeUndefined();

    const after = reduceInputCommand(
      seeded,
      settleField(eoEmploymentFields.overenskomstId.bind('af-1'), 'bygge-anlaeg'),
      catalog
    ).input;

    const af = readEmployment(after);
    // bygge-anlaeg låser fritvalg til 0 % per 2024; Store Bededagstillægget følger loven fra 2024.
    expect(af?.overenskomstId).toBe('bygge-anlaeg');
    expect(af?.fritvalgPct).toBe(0);
    expect(af?.storeBededagPct).toBeGreaterThan(0);
  });

  it('følger et skift i Løn på helligdage i samme reduktion', () => {
    const withOverenskomst = reduceInputCommand(
      seedEmployment(),
      settleField(eoEmploymentFields.overenskomstId.bind('af-1'), 'bygge-anlaeg'),
      catalog
    ).input;
    expect(readEmployment(withOverenskomst)?.storeBededagPct).toBeGreaterThan(0);

    const after = reduceInputCommand(
      withOverenskomst,
      setImmediateField(eoEmploymentFields.loenPaaHelligdage.bind('af-1'), 'SH-udbetaling'),
      catalog
    ).input;

    // Store Bededagstillægget gælder kun, når helligdagen betales som almindelig løn.
    expect(readEmployment(after)?.storeBededagPct).toBe(0);
  });

  it('kan ikke efterlade en afvigelse: en manuelt indtastet sats overskrives af den låste værdi', () => {
    // Dette er hele grunden til, at en separat "afvigelses"-regel er unødvendig for de LÅSTE felter: efter
    // commit KAN feltet ikke afvige fra overenskomstens sats, uanset hvad der forsøges skrevet.
    const withOverenskomst = reduceInputCommand(
      seedEmployment(),
      settleField(eoEmploymentFields.overenskomstId.bind('af-1'), 'bygge-anlaeg'),
      catalog
    ).input;

    const attempted = reduceInputCommand(
      withOverenskomst,
      settleField(eoEmploymentFields.fritvalgPct.bind('af-1'), '3,5'),
      catalog
    );

    // Reduktionen er en no-op: kandidaten er identisk med udgangspunktet, fordi den afledte skrivning
    // gendanner den låste værdi inde i samme kandidat.
    expect(attempted.changed).toBe(false);
    expect(readEmployment(attempted.input)?.fritvalgPct).toBe(0);
  });

  it('rører ikke satserne, når feltet ikke er låst af en overenskomst', () => {
    const seeded = seedCase({ harOverenskomst: false });

    const after = reduceInputCommand(
      seeded,
      settleField(eoEmploymentFields.fritvalgPct.bind('af-1'), '3,5'),
      catalog
    ).input;

    // Uden overenskomst er satsen brugerens egen; den afledte regel må ikke gøre den til sin.
    expect(readEmployment(after)?.fritvalgPct).toBe(3.5);
  });

  it('reparerer en indlæst sag, hvor en sats afviger fra den låste værdi', () => {
    // DETTE er den evidens, der bærer, at afvigelsesreglen for de LÅSTE satser kan fjernes: en gammel eller
    // manipuleret `.eo` kan bære en forkert sats, men `replaceCase` går gennem samme reducer, så afvigelsen
    // er væk, før nogen consumer ser tilstanden. Uden dette ville et hul opstå netop ved load — den vej,
    // ingen brugerhandling passerer.
    const clean = reduceInputCommand(
      seedEmployment(),
      settleField(eoEmploymentFields.overenskomstId.bind('af-1'), 'bygge-anlaeg'),
      catalog
    ).input;
    const lockedFritvalg = readEmployment(clean)?.fritvalgPct;

    const eo = clean.sections.erstatningsopgoerelse;
    if (eo === null || eo === undefined) throw new Error('fixture mangler EO-sektionen');
    const tampered = {
      sections: {
        ...clean.sections,
        erstatningsopgoerelse: {
          ...eo,
          loenindkomstAnsaettelsesforhold: eo.loenindkomstAnsaettelsesforhold.map((af) => ({
            ...af,
            fritvalgPct: 3.5,
            storeBededagPct: 9.9,
          })),
        },
      },
      rejectedInputs: clean.rejectedInputs,
    };

    const loaded = reduceInputCommand(clean, replaceCase(tampered), catalog).input;
    const af = readEmployment(loaded);
    expect(af?.fritvalgPct).toBe(lockedFritvalg);
    expect(af?.storeBededagPct).not.toBe(9.9);
  });

  it('spejler satserne ned i den manuelle basisrække uden at oprette en række', () => {
    const withOverenskomst = reduceInputCommand(
      seedEmployment(),
      settleField(eoEmploymentFields.overenskomstId.bind('af-1'), 'bygge-anlaeg'),
      catalog
    ).input;
    const manual = reduceInputCommand(
      withOverenskomst,
      settleField(eoEmploymentFields.loenudviklingBeregningsgrundlag.bind('af-1'), 'Manuelt angivet'),
      catalog
    ).input;

    const af = readEmployment(manual);
    const baseRow = af?.loenudviklingManuelTableData[0];
    if (baseRow === undefined) {
      // Fandtes ingen basisrække i udgangspunktet, må reglen IKKE opfinde en: rækkens id ville komme fra en
      // RNG, og både idempotensen og brugerens rækkesæt ville blive uforudsigelige.
      expect(af?.loenudviklingManuelTableData).toEqual([]);
      return;
    }
    expect(baseRow.fritvalg).toBe(af?.fritvalgPct);
    expect(baseRow.agPension).toBe(af?.pensionPct);
  });
});
