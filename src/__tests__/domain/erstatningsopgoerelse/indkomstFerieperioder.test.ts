import { resolveIndkomstFerieperioder } from '../../../domain/erstatningsopgoerelse/helpers/indkomstFerieperioder';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('resolveIndkomstFerieperioder', () => {
  const base = {
    beregnesUdFra: 'Beregningsperiode' as const,
    tafBeregningsperiodeFra: iso('2019-01-15'),
    tafBeregningsperiodeTil: iso('2020-01-14'),
    tafPerioder: [{ id: 't1', fra: iso('2018-06-01'), til: iso('2018-12-31'), loseFeriedage: undefined }],
  };

  it('bruger hver ferietabel kun i sin egen periode', () => {
    expect(resolveIndkomstFerieperioder({
      ...base,
      ferieperioder: [{ id: 'taf', fra: iso('2018-12-20'), til: iso('2019-01-31') }],
      fravaerPerioder: [{ id: 'bp', fra: iso('2019-01-10'), til: iso('2019-02-05') }],
    })).toEqual([
      { id: 'bp', fra: iso('2019-01-15'), til: iso('2019-02-05') },
      { id: 'taf', fra: iso('2018-12-20'), til: iso('2018-12-31') },
    ]);
  });

  it('uden beregningsperiode gælder kun TAF-afsnittets ferie i TAF-perioderne', () => {
    expect(resolveIndkomstFerieperioder({
      ...base,
      beregnesUdFra: 'Angivet dagsløn',
      ferieperioder: [{ id: 'taf', fra: iso('2018-07-01'), til: iso('2018-07-14') }, { id: 'uden', fra: iso('2019-07-01'), til: iso('2019-07-14') }],
      fravaerPerioder: [{ id: 'bp', fra: iso('2019-01-20'), til: iso('2019-01-25') }],
    })).toEqual([{ id: 'taf', fra: iso('2018-07-01'), til: iso('2018-07-14') }]);
  });

  it('springer ufuldstændige og omvendte rækker over', () => {
    expect(resolveIndkomstFerieperioder({
      ...base,
      ferieperioder: [{ id: 'a', fra: iso('2018-07-14'), til: iso('2018-07-01') }, { id: 'b', fra: iso('2018-07-01'), til: undefined }],
      fravaerPerioder: [],
    })).toEqual([]);
  });
});
