import {
  LOENPERIODE_LABELS,
  SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_LABELS,
} from '../../schemas/formSchemas/enumLabels';
import { loenperiodeEnum, svieSmerteDelvisSygemeldingSatsEnum } from '../../schemas/formSchemas/enumSchemas';
import {
  DOCUMENT_BREVHOVED_LABELS,
  DOCUMENT_BREVHOVED_TYPES,
} from '../../document/layout/documentBrevhoved';

/**
 * Etiket-tabellerne skal være FULDT dækkende og følge enummets egen rækkefølge.
 *
 * Grunden til at det testes: etiketterne stod tidligere skrevet i hånden på hver flade der
 * viste enummet – for svie/smerte-satsen også i rækkeevaluerings-laget, hvor teksten ender i
 * et bilag. Typen fanger en manglende NØGLE, men ikke at en flades liste er ude af trit med
 * enummets rækkefølge, og heller ikke at en label er tom.
 */

describe('enum-etiketter er fuldt dækkende', () => {
  it('LOENPERIODE_LABELS dækker hver enum-værdi i enummets rækkefølge', () => {
    expect(LOENPERIODE_LABELS.options.map((option) => option.value)).toEqual(loenperiodeEnum.options);
    expect(Object.keys(LOENPERIODE_LABELS.labels).sort()).toEqual([...loenperiodeEnum.options].sort());
  });

  it('SVIE_SMERTE_..._LABELS dækker hver enum-værdi i enummets rækkefølge', () => {
    expect(SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_LABELS.options.map((option) => option.value)).toEqual(
      svieSmerteDelvisSygemeldingSatsEnum.options
    );
  });

  it('DOCUMENT_BREVHOVED_LABELS dækker hver brevhoved-type', () => {
    expect(Object.keys(DOCUMENT_BREVHOVED_LABELS).sort()).toEqual([...DOCUMENT_BREVHOVED_TYPES].sort());
  });

  it('ingen etiket er tom eller kun mellemrum', () => {
    const allLabels = [
      ...Object.values(LOENPERIODE_LABELS.labels),
      ...Object.values(SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_LABELS.labels),
      ...Object.values(DOCUMENT_BREVHOVED_LABELS),
    ];
    expect(allLabels.filter((label) => label.trim() === '')).toEqual([]);
  });

  it('«dag» hedder Dato for brugeren – etiketten er ikke afledelig af værdien', () => {
    // Præcis den slags gør tabellen nødvendig: en generisk «kapitalisér værdien»-regel ville
    // give «Dag», og den forkerte etiket ville have set rimelig ud i et review.
    expect(LOENPERIODE_LABELS.labels.dag).toBe('Dato');
    expect(LOENPERIODE_LABELS.labels.maaned).toBe('Måned');
    expect(LOENPERIODE_LABELS.labels.uge).toBe('Uge');
  });
});
