import { createEoBeregningsgrundlagCommitOverride } from '../../../domain/erstatningsopgoerelse/angivetLoenBeregningsgrundlagCommit';
import { eoAngivetLoenFields } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { eoBeregnesUdFraField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { reduceInputCommand } from '../../../inputCore/inputReducer';
import { createEmptySettledInput } from '../../../inputCore/settledInput';
import { readCanonicalAtAddress } from '../../../inputCore/structuralAccessors';

const catalog = getProductionInputCatalog();
const location = {
  locationId: 'erstatningsopgoerelse.beregnesUdFra',
  route: '/erstatningsopgoerelse',
  tabKey: 'eo-oplysninger',
} as const;

const override = createEoBeregningsgrundlagCommitOverride({
  field: eoBeregnesUdFraField.bind(),
  storeBededagField: eoAngivetLoenFields.beregnStoreBededagstillaeg.bind(),
  location,
});

const readBasis = (input: ReturnType<typeof createEmptySettledInput>) =>
  readCanonicalAtAddress(input.sections, eoBeregnesUdFraField.bind().address);

const readToggle = (input: ReturnType<typeof createEmptySettledInput>) =>
  readCanonicalAtAddress(input.sections, eoAngivetLoenFields.beregnStoreBededagstillaeg.bind().address);

describe('EO-beregningsgrundlagets Store Bededag-default', () => {
  it('sætter toggle=true ved Angivet månedsløn i samme transaktion', () => {
    const result = reduceInputCommand(
      createEmptySettledInput(),
      override('Angivet månedsløn').command,
      catalog
    ).input;

    expect(readBasis(result)).toBe('Angivet månedsløn');
    expect(readToggle(result)).toBe(true);
  });

  it('sætter toggle=false ved Angivet dagsløn i samme transaktion', () => {
    const result = reduceInputCommand(
      createEmptySettledInput(),
      override('Angivet dagsløn').command,
      catalog
    ).input;

    expect(readBasis(result)).toBe('Angivet dagsløn');
    expect(readToggle(result)).toBe(false);
  });

  it('bevarer toggle-værdien når beregningsperiode vælges og rækken skjules', () => {
    const month = reduceInputCommand(
      createEmptySettledInput(),
      override('Angivet månedsløn').command,
      catalog
    ).input;
    const result = reduceInputCommand(
      month,
      override('Beregningsperiode').command,
      catalog
    ).input;

    expect(readBasis(result)).toBe('Beregningsperiode');
    expect(readToggle(result)).toBe(true);
  });
});
