import {
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoKravPaaTabtArbejdsfortjenesteField,
  eoTafBeregningsperiodeTilField,
  eoTafPeriodeLoseFeriedageField,
  eoUspecificeredeFerieFridageField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { eoStandardRowFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { projectEoSave } from '../../persistence/eoSaveProjection';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import { createValidationReader } from '../../inputCore/inputReader';
import { reduceInputCommand, type InputMutationCommand } from '../../inputCore/inputReducer';
import { createEmptySettledInput, type SettledInput } from '../../inputCore/settledInput';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../types/branded';

// BB-433: en afvist slutdato i beregningsperioden gør det umuligt at afgøre, om TAF opgøres i dage eller måneder.
// Ferieafsnittet skjules da – men det er ikke brugerens valg, og en tidligere afvist feriedato må ikke ryddes.
// Relevansen er `ubestemt`, ikke `irrelevant`; kun et reelt fravalg (fx TAF «Nej») rydder afvist råtekst.

const catalog = getProductionInputCatalog();
const apply = (input: SettledInput, command: InputMutationCommand<unknown, unknown>): SettledInput =>
  reduceInputCommand(input, command, catalog).input;
const settle = <T,>(field: FieldRef<T>, raw: string) => ({ kind: 'settleField', field, raw }) as InputMutationCommand<unknown, unknown>;
const rejectedAt = <T,>(input: SettledInput, field: FieldRef<T>) => input.rejectedInputs[serializeFieldAddress(field.address)];

/** Majperiode 2018, løn for maj og «Fuld løn under ferie» Nej: TAF opgøres i arbejdsdage, og ferien vises. */
const createArbejdsdageInput = (): SettledInput => {
  const eo = {
    ...createErstatningsopgoerelseInitialValues(),
    kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
    beregnesUdFra: 'Beregningsperiode' as const,
    tafBeregningsperiodeFra: toISODateString('2018-05-01'),
    tafBeregningsperiodeTil: toISODateString('2018-05-31'),
    fravaerPerioder: [{ id: 'ferie-1', fra: undefined, til: toISODateString('2018-05-04') }],
    tafPerioder: [{ id: 'taf-1', fra: toISODateString('2019-01-01'), til: toISODateString('2019-01-31'), loseFeriedage: undefined }],
    loenindkomstAnsaettelsesforhold: [{
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-1',
      loenperiode: 'maaned' as const,
      fuldLoenUnderFerie: 'Nej' as const,
      indtaegtsoplysningerTableData: [{
        id: 'std-1', col0_maaned: '5', col1_maaned: '2018', col0_uge: '', col1_uge: '',
        col0_dag: undefined, col1_dag: undefined, col2: { kind: 'number' as const, value: 30000 },
        col3: undefined, col4: undefined, col5: undefined, fpFvShSoBeloeb: undefined, pensionBeloeb: undefined,
      }],
    }],
  };
  return catalog.validateSettledInput({
    sections: { ...createEmptySettledInput().sections, erstatningsopgoerelse: eo },
    rejectedInputs: {},
  });
};

const ferieFra = eoFravaerPeriodeFraField.bind('ferie-1');
const ferieTil = eoFravaerPeriodeTilField.bind('ferie-1');
const loseDage = eoUspecificeredeFerieFridageField.bind();
const tafLoseDage = eoTafPeriodeLoseFeriedageField.bind('taf-1');
const periodeTil = eoTafBeregningsperiodeTilField.bind();

/** Udgangspunktet fra BB-433: afvist ferie-Fra, gyldig ferie-Til og afviste løse dage i begge tabeller. */
const createWithRejectedFerie = (): SettledInput => {
  let input = createArbejdsdageInput();
  input = apply(input, settle(ferieFra, '31-02-2018'));
  input = apply(input, settle(loseDage, '1,5'));
  input = apply(input, settle(tafLoseDage, '2,5'));
  expect(rejectedAt(input, ferieFra)?.raw).toBe('31-02-2018');
  expect(rejectedAt(input, loseDage)?.raw).toBe('1,5');
  expect(rejectedAt(input, tafLoseDage)?.raw).toBe('2,5');
  return input;
};

describe('ubestemt relevans bevarer afvist input (BB-433)', () => {
  it('en afvist slutdato skjuler ferien som ubestemt og rydder ikke dens afviste værdier', () => {
    const input = apply(createWithRejectedFerie(), settle(periodeTil, '31-02-2018'));

    const reader = createValidationReader(input, catalog);
    expect(rejectedAt(input, periodeTil)?.raw).toBe('31-02-2018');
    // Skjult og tavs som et irrelevant felt …
    expect([ferieFra, ferieTil].map((field) => reader.isRelevant(field))).toEqual([false, false]);
    expect([loseDage, tafLoseDage].map((field) => reader.isRelevant(field))).toEqual([false, false]);
    // … men ikke fravalgt.
    expect([ferieFra, ferieTil].map((field) => reader.relevanceStatus(field))).toEqual(['ubestemt', 'ubestemt']);
    expect([loseDage, tafLoseDage].map((field) => reader.relevanceStatus(field))).toEqual(['ubestemt', 'ubestemt']);
    expect(rejectedAt(input, ferieFra)?.raw).toBe('31-02-2018');
    expect(rejectedAt(input, loseDage)?.raw).toBe('1,5');
    expect(rejectedAt(input, tafLoseDage)?.raw).toBe('2,5');
    expect(reader.readCanonical(ferieTil)).toBe('2018-05-04');
    // Tilstanden er en lovlig færdig tilstand (relevans-invarianten afviser kun `irrelevant`).
    expect(() => catalog.validateSettledInput(input)).not.toThrow();
  });

  it('når slutdatoen rettes, kommer ferien frem igen med sin afviste Fra-dato', () => {
    let input = apply(createWithRejectedFerie(), settle(periodeTil, '31-02-2018'));
    input = apply(input, settle(periodeTil, '31-05-2018'));

    const reader = createValidationReader(input, catalog);
    expect([ferieFra, ferieTil].map((field) => reader.relevanceStatus(field))).toEqual(['relevant', 'relevant']);
    expect([loseDage, tafLoseDage].map((field) => reader.relevanceStatus(field))).toEqual(['relevant', 'relevant']);
    expect(rejectedAt(input, ferieFra)?.raw).toBe('31-02-2018');
    expect(rejectedAt(input, loseDage)?.raw).toBe('1,5');
    expect(rejectedAt(input, tafLoseDage)?.raw).toBe('2,5');
    expect(reader.readCanonical(ferieTil)).toBe('2018-05-04');
  });

  it('TAF «Nej» rydder fortsat afvist ferie – også mens slutdatoen er afvist (rydning til fast punkt)', () => {
    let input = apply(createWithRejectedFerie(), settle(periodeTil, '31-02-2018'));
    input = apply(input, {
      kind: 'setImmediateField', field: eoKravPaaTabtArbejdsfortjenesteField.bind(), value: 'Nej',
    } as InputMutationCommand<unknown, unknown>);

    const reader = createValidationReader(input, catalog);
    expect(reader.relevanceStatus(ferieFra)).toBe('irrelevant');
    expect(input.rejectedInputs).toEqual({});
    // Den gyldige ferie-Til bevares (§7.6) og kommer igen ved «Ja».
    expect(reader.readCanonical(ferieTil)).toBe('2018-05-04');
  });

  it('TAF «Nej» rydder afvist ferie direkte fra synlig tilstand (uændret relevansoprydning)', () => {
    const input = apply(createWithRejectedFerie(), {
      kind: 'setImmediateField', field: eoKravPaaTabtArbejdsfortjenesteField.bind(), value: 'Nej',
    } as InputMutationCommand<unknown, unknown>);

    expect(input.rejectedInputs).toEqual({});
  });

  it('en tom slutdato er ikke ubestemt: ferien er da irrelevant, og afvist råtekst ryddes', () => {
    // Uden en afvist årsag ville en skjult afvist feriedato spærre Gem usynligt; derfor kræver `ubestemt` afvist
    // råtekst i et felt, relevansen læste.
    let input = apply(createWithRejectedFerie(), settle(periodeTil, '31-02-2018'));
    input = apply(input, { kind: 'clearField', field: periodeTil } as InputMutationCommand<unknown, unknown>);

    const reader = createValidationReader(input, catalog);
    expect(reader.relevanceStatus(ferieFra)).toBe('irrelevant');
    expect(input.rejectedInputs).toEqual({});
  });

  it('relevans-invarianten afviser fortsat afvist råtekst i et irrelevant felt', () => {
    const input = createWithRejectedFerie();
    const eo = input.sections.erstatningsopgoerelse;
    if (eo === null) throw new Error('mangler erstatningsopgørelse');
    expect(() => catalog.validateSettledInput({
      sections: { ...input.sections, erstatningsopgoerelse: { ...eo, kravPaaTabtArbejdsfortjeneste: 'Nej' } },
      rejectedInputs: input.rejectedInputs,
    })).toThrow(/ikke relevant/);
  });

  it('en rød canonical værdi i et ubestemt felt bevares – og ryddes ved fravalg (§7.5 pkt. 2)', () => {
    let input = apply(createArbejdsdageInput(), settle(loseDage, '400'));
    // 400 er repræsenterbart og dermed canonical med en rød grænsefejl, ikke afvist råtekst.
    expect(createValidationReader(input, catalog).readCanonical(loseDage)).toBe(400);
    input = apply(input, settle(periodeTil, '31-02-2018'));
    expect(createValidationReader(input, catalog).relevanceStatus(loseDage)).toBe('ubestemt');
    expect(createValidationReader(input, catalog).readCanonical(loseDage)).toBe(400);

    const rettet = apply(input, settle(periodeTil, '31-05-2018'));
    expect(createValidationReader(rettet, catalog).readCanonical(loseDage)).toBe(400);

    const fravalgt = apply(input, {
      kind: 'setImmediateField', field: eoKravPaaTabtArbejdsfortjenesteField.bind(), value: 'Nej',
    } as InputMutationCommand<unknown, unknown>);
    expect(createValidationReader(fravalgt, catalog).readCanonical(loseDage)).toBeUndefined();
  });
});

describe('Gem-blokeringens rækkefølge med ubestemte felter (BB-433)', () => {
  const firstBlocking = (input: SettledInput) => {
    const outcome = projectEoSave(input, catalog);
    if (outcome.status !== 'blocked') throw new Error('Gem skulle være blokeret');
    return outcome.rejectedAddresses;
  };

  it('sender Gem til den synlige afviste slutdato, ikke til den skjulte ferie', () => {
    const input = apply(createWithRejectedFerie(), settle(periodeTil, '31-02-2018'));
    const addresses = firstBlocking(input);
    expect(addresses[0]).toBe(serializeFieldAddress(periodeTil.address));
    expect(addresses).toContain(serializeFieldAddress(ferieFra.address));
  });

  it('sender Gem til den afviste lønindkomstcelle, når løse dage er ubestemte', () => {
    const maaned = eoStandardRowFields.col0_maaned.bind('af-1', 'std-1');
    let input = apply(createArbejdsdageInput(), settle(loseDage, '1,5'));
    input = apply(input, settle(maaned, 'maj'));
    expect(createValidationReader(input, catalog).relevanceStatus(loseDage)).toBe('ubestemt');
    const addresses = firstBlocking(input);
    expect(addresses[0]).toBe(serializeFieldAddress(maaned.address));
    expect(addresses).toContain(serializeFieldAddress(loseDage.address));
  });
});
