import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { buildErstatningsopgoerelsePdfModel, ensureMoneyOre } from '../../../domain/erstatningsopgoerelse/eoPdfModel';

const iso = (value: string) => toISODateString(value);

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(ERSTATNINGSOPGOERELSE_INITIAL_VALUES);
  return { ...base, ...patch };
};

const makeStamdata = (patch: Partial<StamdataValues>): StamdataValues => {
  const base = structuredClone(STAMDATA_INITIAL_VALUES);
  return { ...base, ...patch };
};

describe('buildErstatningsopgoerelsePdfModel', () => {
  it('enforcer MoneyOre invariants', () => {
    expect(ensureMoneyOre(0)).toBe(0);
    expect(() => ensureMoneyOre(Number.NaN)).toThrow('MoneyOre skal være et heltal');
    expect(() => ensureMoneyOre(12.5)).toThrow('MoneyOre skal være et heltal');
  });

  it('bygger model med tomme sektioner uden at fejle', () => {
    const eoValues = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.samlet.totalOre).toBe(0);
    expect(model.oevrigeKrav.entries.length).toBe(0);
    expect(model.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre).toBe(0);
  });

  it('beregner svie/smerte total i øre', () => {
    const eoValues = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-10'),
      tidligereSsMax: 'Nej',
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld',
      svieSmerteTidligereTotal: asAmountValue(0),
      svieSmerteAktuelPeriode: asAmountValue(0),
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    // 10 dage * 250 kr = 2.500 kr = 250.000 øre
    expect(model.svieSmerte.totalOre).toBe(250000);
    expect(model.svieSmerte.satserPerDag.status).toBe('ok');
  });

  it('markerer svie/smerte-satser som ikke beregnelige uden perioder', () => {
    const eoValues = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      tidligereSsMax: 'Nej',
      svieSmertePerioder: [],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.svieSmerte.satserPerDag.status).toBe('not_calculable');
  });

  it('summerer øvrige krav i øre', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: asAmountValue(1234.5) },
        { id: '2', dato: iso('2024-03-01'), udgiftTil: 'Test 2', beloeb: asAmountValue(10) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.oevrigeKrav.totalOre).toBe(124450);
    expect(model.samlet.oevrigeKravOre).toBe(124450);
  });

  it('afviser øvrige krav med manglende beløb', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: undefined },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Øvrige krav er ikke fuldt udfyldt');
  });

  it('afviser øvrige krav med manglende dato', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: undefined, udgiftTil: 'Test', beloeb: asAmountValue(100) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Øvrige krav er ikke fuldt udfyldt');
  });

  it('afviser øvrige krav med negativt beløb', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: asAmountValue(-1) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Ugyldigt input til PDF: Skal være større end 0');
  });

  it('afviser beløb med flere end 2 decimaler', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: asAmountValue(1.005) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Beløb har flere end 2 decimaler');
  });

  it('afviser delvist udfyldt svie/smerte-periode', () => {
    const eoValues = makeValues({
      tidligereSsMax: 'Nej',
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: undefined, tilstand: 'sygemeldt' },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Svie/smerte-periode er ikke fuldt udfyldt');
  });

  it('afviser TAF-periode med kun fra', () => {
    const eoValues = makeValues({
      tafPerioder: [
        { id: '1', fra: iso('2024-01-01'), til: undefined, loseFeriedage: undefined },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('TAF-periode mangler fra/til');
  });

  it('afviser overlappende svie/smerte-perioder', () => {
    const eoValues = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-02-01'),
      tidligereSsMax: 'Nej',
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' },
        { id: '2', fra: iso('2024-01-05'), til: iso('2024-01-20'), tilstand: 'sygemeldt' },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Svie/smerte-perioder overlapper');
  });

  it('afrunder TAF-indtægter før øre-konvertering', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(1000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-01'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '03-01-2024',
          ydelse: asAmountValue(100),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: 'ASL-årslønsmaksimum',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const entries = model.tabtArbejdsfortjeneste.tafIndtaegter?.entries ?? [];

    expect(entries.length).toBe(1);
    expect(entries[0].amountOre).toBe(3333);
  });

  it('beregner loenudvikling uden regulering, naar alle ansaettelsesforhold er sat til Ingen', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-02'), til: iso('2024-01-02'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '02-01-2024',
          tilDato: '02-01-2024',
          ydelse: asAmountValue(100),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;

    expect(loenudvikling).not.toBeNull();
    expect(loenudvikling?.loenudviklingLabel).toBe('Ingen');
    expect(loenudvikling?.loenudviklingTotal.status).toBe('ok');
    expect(loenudvikling?.loenudviklingTotal.status === 'ok' ? loenudvikling.loenudviklingTotal.value : null).toBe(100000);
    expect(loenudvikling?.beregnedeSegmenter).toHaveLength(1);
    expect(loenudvikling?.beregnedeSegmenter[0]?.deltaPct).toBe(0);
  });
});
