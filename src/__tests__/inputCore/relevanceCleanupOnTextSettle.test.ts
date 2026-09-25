import {
  eoKravPaaSvieSmerteGodtgoerelseField,
  eoNummerField,
  eoSvieSmerteTidligereTotalField,
  eoTafPeriodeLoseFeriedageField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { eoStandardRowFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
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

// §7.5 pkt. 2: en ændring, der skjuler et felt med en aktiv rød fejl, rydder feltet i samme transaktion. Reglen
// sad før kun på valg (`setImmediateField`), men relevans kan også følge et tekstfelt eller en tabels indhold.
// Uden rydningen efterlod indtastningen råtekst i et skjult felt, og relevans-invarianten afviste tilstanden
// med en undtagelse – indtastningen kunne slet ikke gennemføres.

const catalog = getProductionInputCatalog();
const apply = (input: SettledInput, command: InputMutationCommand<unknown, unknown>): SettledInput =>
  reduceInputCommand(input, command, catalog).input;
const settle = <T,>(field: FieldRef<T>, raw: string) => ({ kind: 'settleField', field, raw }) as InputMutationCommand<unknown, unknown>;
const rejectedAt = <T,>(input: SettledInput, field: FieldRef<T>) => input.rejectedInputs[serializeFieldAddress(field.address)];

describe('rydning af skjulte røde felter ved en tekstindtastning (§7.5 pkt. 2)', () => {
  it('rydder «Svie/smerte-krav i tidligere …», når «Nummer» rettes fra 2 til 1', () => {
    let input = apply(createEmptySettledInput(), {
      kind: 'setImmediateField', field: eoKravPaaSvieSmerteGodtgoerelseField.bind(), value: 'Ja',
    } as InputMutationCommand<unknown, unknown>);
    input = apply(input, settle(eoNummerField.bind(), '2'));
    input = apply(input, settle(eoSvieSmerteTidligereTotalField.bind(), '1,2,3'));
    expect(rejectedAt(input, eoSvieSmerteTidligereTotalField.bind())?.raw).toBe('1,2,3');

    input = apply(input, settle(eoNummerField.bind(), '1'));

    expect(rejectedAt(input, eoSvieSmerteTidligereTotalField.bind())).toBeUndefined();
    expect(createValidationReader(input, catalog).readCanonical(eoNummerField.bind())).toBe('1');
  });

  it('rydder en rød «Løse ferie-/feriefridage», når en indtastning under Lønindkomst skifter TAF til måneder (BB-247)', () => {
    // Beregningsperiode + et ansættelsesforhold uden fuld løn under ferie med løn i perioden: arbejdsdage.
    const eo = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      beregnesUdFra: 'Beregningsperiode' as const,
      tafBeregningsperiodeFra: toISODateString('2023-01-01'),
      tafBeregningsperiodeTil: toISODateString('2023-12-31'),
      tafPerioder: [{ id: 'taf-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-31'), loseFeriedage: undefined }],
      loenindkomstAnsaettelsesforhold: [{
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-1',
        loenperiode: 'maaned' as const,
        fuldLoenUnderFerie: 'Nej' as const,
        indtaegtsoplysningerTableData: [{
          id: 'std-1', col0_maaned: '6', col1_maaned: '2023', col0_uge: '', col1_uge: '',
          col0_dag: undefined, col1_dag: undefined, col2: { kind: 'number' as const, value: 30000 },
          col3: undefined, col4: undefined, col5: undefined, fpFvShSoBeloeb: undefined, pensionBeloeb: undefined,
        }],
      }],
    };
    let input = catalog.validateSettledInput({
      sections: { ...createEmptySettledInput().sections, erstatningsopgoerelse: eo },
      rejectedInputs: {},
    });
    const loseFeriedage = eoTafPeriodeLoseFeriedageField.bind('taf-1');
    input = apply(input, settle(loseFeriedage, '1,5'));
    expect(rejectedAt(input, loseFeriedage)?.raw).toBe('1,5');

    // Uden løn i beregningsperioden gælder lønindkomstens overstyring ikke længere: TAF opgøres i måneder,
    // og løse feriedage skjules.
    input = apply(input, { kind: 'clearField', field: eoStandardRowFields.col2.bind('af-1', 'std-1') } as InputMutationCommand<unknown, unknown>);

    expect(rejectedAt(input, loseFeriedage)).toBeUndefined();
    expect(createValidationReader(input, catalog).isRelevant(loseFeriedage)).toBe(false);
  });
});
