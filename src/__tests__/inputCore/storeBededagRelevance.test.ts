import { createEvaluationSourceToken, createInputRevision, createSettingsRevision } from '../../inputCore/evaluationSource';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { eoAngivetLoenFields, eoEmploymentFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { createInputEvaluation, createValidationReader } from '../../inputCore/inputReader';
import { createEmptySettledInput } from '../../inputCore/settledInput';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString as iso } from '../../types/branded';

const catalog = getProductionInputCatalog();
const fixture = () => {
  const eo = createErstatningsopgoerelseInitialValues();
  eo.kravPaaTabtArbejdsfortjeneste = 'Ja';
  eo.beregnesUdFra = 'Beregningsperiode';
  eo.tafBeregningsperiodeTil = iso('2023-12-31');
  eo.loenindkomstAnsaettelsesforhold = [{ ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af',
    loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: true,
    loenudviklingBeregningsgrundlag: 'Statistik' }];
  return eo;
};
const readerFor = (eo: ReturnType<typeof fixture>) => {
  const input = catalog.validateSettledInput({ sections: { ...createEmptySettledInput().sections, erstatningsopgoerelse: eo }, rejectedInputs: {} });
  const validation = createValidationReader(input, catalog);
  const { reader } = createInputEvaluation({ input, catalog, sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)) });
  return { isRelevant: validation.isRelevant, read: <T,>(field: Parameters<typeof reader.read<T>>[0]) => reader.read(field) };
};

describe('storeBededagRelevance', () => {
  it('skjuler Statistik før 2024 og bevarer gemt true, som bliver aktivt når datoen ændres', () => {
    const eo = fixture();
    const field = eoEmploymentFields.beregnStoreBededagstillaeg.bind('af');
    expect(readerFor(eo).isRelevant(field)).toBe(false);
    expect(readerFor(eo).read(field)).toEqual({ status: 'usable', value: false });
    expect(eo.loenindkomstAnsaettelsesforhold[0].beregnStoreBededagstillaeg).toBe(true);
    eo.tafBeregningsperiodeTil = iso('2024-01-01');
    expect(readerFor(eo).isRelevant(field)).toBe(true);
    expect(readerFor(eo).read(field)).toEqual({ status: 'usable', value: true });
    eo.loenindkomstAnsaettelsesforhold[0].tillaegAngivesSom = 'beloeb';
    expect(readerFor(eo).isRelevant(field)).toBe(false);
    expect(readerFor(eo).read(field)).toEqual({ status: 'usable', value: false });
  });

  it('bruger den særlige reguleringsdato og kræver almindelig helligdagsløn', () => {
    const eo = fixture();
    const af = eo.loenindkomstAnsaettelsesforhold[0];
    const field = eoEmploymentFields.beregnStoreBededagstillaeg.bind('af');
    af.saerligFraDatoRegulering = iso('2024-01-01');
    expect(readerFor(eo).isRelevant(field)).toBe(true);
    af.loenPaaHelligdage = 'SH-udbetaling';
    expect(readerFor(eo).isRelevant(field)).toBe(false);
  });

  it.each(['Statistik', 'KRL satstabel', 'KL-lønaftaler', 'Manuel procentsats'] as const)(
    'angivet løn + %s læser ikke den skjulte toggle', (reguleringsform) => {
      const eo = fixture();
      eo.beregnesUdFra = 'Angivet månedsløn';
      eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = reguleringsform;
      eo.eoAngivetLoenLoenudvikling.beregnStoreBededagstillaeg = true;
      const field = eoAngivetLoenFields.beregnStoreBededagstillaeg.bind();
      expect(readerFor(eo).isRelevant(field)).toBe(false);
      expect(readerFor(eo).read(field)).toEqual({ status: 'usable', value: false });
    });

  it.each(['Overenskomst', 'Manuelt angivet'] as const)('viser den virksomme knap for angivet løn + %s', (reguleringsform) => {
    const eo = fixture();
    eo.beregnesUdFra = 'Angivet månedsløn';
    eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = reguleringsform;
    expect(readerFor(eo).isRelevant(eoAngivetLoenFields.beregnStoreBededagstillaeg.bind())).toBe(true);
  });
});
