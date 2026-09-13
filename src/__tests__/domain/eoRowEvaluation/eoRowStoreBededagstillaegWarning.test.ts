/**
 * Advarsel om fravalgt Store Bededagstillæg – synlighed i «Fejl og advarsler».
 *
 * **Fejlformen, testen findes for.** Advarslen blev først lagt i `erstatningsopgoerelseValidator` som en
 * `ValidationError` med `severity: 'warning'`. Den nåede aldrig brugeren: «Fejl og advarsler» på
 * EO-beregningsfanen fodres udelukkende af `collectAllEoRows`, mens validatorens warnings kun blev til
 * ikke-blokerende snapshot-invarianter, som intet UI læser. Værnet måler derfor advarslen gennem
 * RÆKKE-kanalen – den samme kilde, boksen faktisk viser – og ikke gennem validatoren.
 *
 * Advarslen dækker begge lønudviklingsflader (udviklerbeslutning 2026-09-13): ansættelsesforholdene ved
 * «Beregningsperiode» og EO-oplysningernes angivne løn ved «Angivet månedsløn»/«Angivet dagsløn».
 */
import { buildEoIndkomstRows } from '../../../domain/eoRowEvaluation/eoRowIndkomstRows';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { resolveEoIssueFocusTarget } from '../../../domain/eoRowEvaluation/eoRowIssueCatalog';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import {
  eoAngivetLoenFields,
  eoEmploymentFields,
} from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const ADVARSEL =
  'Der vil sædvanligvis være krav på Store Bededagstillæg fra 1. januar 2024 ved almindelig løn på helligdage.';

const makeValues = () => {
  const values = createErstatningsopgoerelseInitialValues();
  values.kravPaaTabtArbejdsfortjeneste = 'Ja';
  values.beregnesUdFra = 'Beregningsperiode';
  values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-03-31'), loseFeriedage: undefined }];
  values.loenindkomstAnsaettelsesforhold = [{
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'af-1',
    loenPaaHelligdage: 'Almindelig løn',
    beregnStoreBededagstillaeg: false,
  }];
  return values;
};

const warningRowIds = (values: ReturnType<typeof makeValues>): readonly string[] =>
  buildEoIndkomstRows(values, iso('2024-01-01'), {})
    .filter((row) => row.status === 'warning' && row.displayValue.includes('Store Bededagstillæg'))
    .map((row) => row.id);

describe('buildEoIndkomstRows – advarsel ved fravalgt Store Bededagstillæg', () => {
  it('advarer pr. ansættelsesforhold når TAF-perioden når ind i 2024', () => {
    const values = makeValues();

    const row = buildEoIndkomstRows(values, iso('2024-01-01'), {})
      .find((candidate) => candidate.id === 'loenindkomst.af-1.storeBededagstillaegFravalgt');

    expect(row).toBeDefined();
    expect(row?.status).toBe('warning');
    expect(row?.displayValue).toBe(`Advarsel (${ADVARSEL})`);
    expect(row?.summaryDisplay).toBe('messageOnly');
  });

  it('advarer ikke, når togglen er valgt til', () => {
    const values = makeValues();
    values.loenindkomstAnsaettelsesforhold[0].beregnStoreBededagstillaeg = true;

    expect(warningRowIds(values)).toEqual([]);
  });

  it('advarer ikke ved SH-udbetaling eller ingen løn på helligdage', () => {
    const shValues = makeValues();
    shValues.loenindkomstAnsaettelsesforhold[0].loenPaaHelligdage = 'SH-udbetaling';
    const ingenValues = makeValues();
    ingenValues.loenindkomstAnsaettelsesforhold[0].loenPaaHelligdage = 'Ingen';

    expect(warningRowIds(shValues)).toEqual([]);
    expect(warningRowIds(ingenValues)).toEqual([]);
  });

  it('advarer ikke, når hele TAF-perioden ligger før 1. januar 2024', () => {
    const values = makeValues();
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2023-11-01'), til: iso('2023-12-31'), loseFeriedage: undefined }];

    expect(warningRowIds(values)).toEqual([]);
  });

  it('advarer også, når ansættelsesforholdet samtidig har en blokerende reguleringsfejl', () => {
    // Advarslen står FØR de tidlige returns i reguleringsgrenen med vilje: rettes fejlen først,
    // må brugeren ikke kunne nå at downloade uden nogensinde at have set advarslen.
    const values = makeValues();
    values.loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag = undefined;

    const rows = buildEoIndkomstRows(values, iso('2024-01-01'), {});
    expect(rows.find((row) => row.id === 'loenindkomst.af-1.regulering.valgt')?.status).toBe('error');
    expect(warningRowIds(values)).toEqual(['loenindkomst.af-1.storeBededagstillaegFravalgt']);
  });

  it('advarer for hvert ansættelsesforhold med fravalgt tillæg', () => {
    const values = makeValues();
    values.loenindkomstAnsaettelsesforhold = [
      { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-1', loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: false },
      { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-2', loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: true },
      { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-3', loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: false },
    ];

    expect(warningRowIds(values)).toEqual([
      'loenindkomst.af-1.storeBededagstillaegFravalgt',
      'loenindkomst.af-3.storeBededagstillaegFravalgt',
    ]);
  });

  it('advarer på EO-oplysningernes angivne løn ved Angivet månedsløn', () => {
    const values = makeValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenPaaHelligdage: 'Almindelig løn',
      beregnStoreBededagstillaeg: false,
    };

    expect(warningRowIds(values)).toEqual([
      'taf.beregningsgrundlag.loenudvikling.eo-angivet-loen.storeBededagstillaegFravalgt',
    ]);
  });

  it('advarer ikke på angivet løn, når togglen dér er valgt til', () => {
    const values = makeValues();
    values.beregnesUdFra = 'Angivet dagsløn';
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenPaaHelligdage: 'Almindelig løn',
      beregnStoreBededagstillaeg: true,
    };

    expect(warningRowIds(values)).toEqual([]);
  });
});

describe('advarslens fokusmål og vej til «Fejl og advarsler»', () => {
  it('peger på selve togglen – ansættelsesforholdets og den angivne løns', () => {
    expect(resolveEoIssueFocusTarget({
      id: 'loenindkomst.af-1.storeBededagstillaegFravalgt',
      label: 'Advarsel',
      displayValue: `Advarsel (${ADVARSEL})`,
      status: 'warning',
      summaryDisplay: 'messageOnly',
    })).toEqual({ kind: 'fieldAddress', address: eoEmploymentFields.beregnStoreBededagstillaeg.bind('af-1').address });

    expect(resolveEoIssueFocusTarget({
      id: 'taf.beregningsgrundlag.loenudvikling.eo-angivet-loen.storeBededagstillaegFravalgt',
      label: 'Advarsel',
      displayValue: `Advarsel (${ADVARSEL})`,
      status: 'warning',
      summaryDisplay: 'messageOnly',
    })).toEqual({ kind: 'fieldAddress', address: eoAngivetLoenFields.beregnStoreBededagstillaeg.bind().address });
  });

  it('når frem som en ikke-blokerende advarsel gennem aggregatoren', () => {
    // Den ene test, der beviser hele kæden: aggregatoren er præcis den kilde, EO-beregningsfanens
    // «Fejl og advarsler» læser, og den kræver et fokusmål af enhver advarsel, der når frem.
    const values = makeValues();

    const { warnings, errors } = collectAllEoRows(STAMDATA_INITIAL_VALUES, EMPTY_FIELD_ISSUE_SET, values, EMPTY_FIELD_ISSUE_SET);

    const warning = warnings.find((row) => row.id === 'loenindkomst.af-1.storeBededagstillaegFravalgt');
    expect(warning).toBeDefined();
    expect(warning?.summaryText).toBe(ADVARSEL);
    expect(warning?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: eoEmploymentFields.beregnStoreBededagstillaeg.bind('af-1').address,
    });
    expect(errors.map((row) => row.id)).not.toContain('loenindkomst.af-1.storeBededagstillaegFravalgt');
  });
});
