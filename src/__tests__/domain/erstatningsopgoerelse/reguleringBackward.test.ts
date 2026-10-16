import { byggReguleringsResultat } from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringFormRegistry';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { collectLoenudviklingCoverageIssues } from '../../../domain/erstatningsopgoerelse/loenudviklingReguleringsdatoIssues';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('historisk regulering og nedre dækningsgrænse', () => {
  it('SBLON2: 40.000 kr. pr. januar 2025 nedreguleres til historiske år', () => {
    const result = byggReguleringsResultat({ strategi: 'statistik', label: 'SBLON2',
      statistikModel: 'SBLON2 (Danmarks Statistik)', reguleringsdato: iso('2025-01-01'),
      tafRanges: [{ fra: iso('2022-03-01'), til: iso('2025-12-31') }] });
    // Indeks 111,9 / 115,7 / 119,6 over basis 125,4, afrundet til to decimaler.
    expect(result.segmenter.map((segment) => segment.deltaPct)).toEqual([-10.77, -7.74, -4.63, 0]);
  });

  it('KRL nedregulerer til et tidligere dateret indeks', () => {
    const result = byggReguleringsResultat({ strategi: 'krl', label: 'KTO (kommuner)',
      krlSatstabelId: 'KTO (kommuner)', reguleringsdato: iso('2002-04-01'),
      tafRanges: [{ fra: iso('2001-04-01'), til: iso('2001-04-30') }] });
    // (104,0662 / 106,1566 − 1) × 100 = −1,969166… %.
    expect(result.segmenter[0].deltaPct).toBe(-1.97);
  });

  it.each(['bygge-anlaeg', 'kl-overenskomst'])('%s: Store Bededag ændrer kun sin egen historiske komponent', (overenskomstId) => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = { kind: 'number', value: 40_000 };
    values.angivetMaanedsloenOpreguleresFraDato = iso('2025-01-01');
    values.tafPerioder = [{ id: 't', fra: iso('2023-01-01'), til: iso('2025-01-01'), loseFeriedage: 0 }];
    Object.assign(values.eoAngivetLoenLoenudvikling, { loenudviklingBeregningsgrundlag: 'Overenskomst',
      overenskomstId, offentligLoenType: 'Månedsløn', offentligLoenTrin: 1, offentligLoenGruppe: 0,
      loenPaaHelligdage: 'Almindelig løn', feriePct: 12.5 });
    const run = (enabled: boolean) => {
      values.eoAngivetLoenLoenudvikling.beregnStoreBededagstillaeg = enabled;
      return buildLoenudviklingModel(values, STAMDATA_INITIAL_VALUES, TAF_BEREGNES_SOM.MAANEDER, null,
        { tafRanges: [{ fra: iso('2023-01-01'), til: iso('2025-01-01') }] });
    };
    const off = run(false).beregnedeSegmenter;
    const on = run(true).beregnedeSegmenter;
    for (const segment of off) {
      const counterpart = on.find((entry) => entry.fra === segment.fra);
      expect(segment.regulering?.periodComponents).toBeDefined();
      expect(counterpart?.regulering?.periodComponents?.baseValue).toBe(segment.regulering?.periodComponents?.baseValue);
      expect(counterpart?.regulering?.periodComponents?.pensionPct).toBe(segment.regulering?.periodComponents?.pensionPct);
    }
    expect(off[0].deltaPct).toBeLessThan(0);
    expect(on[0].deltaPct).toBeLessThan(0);
  });

  const setupCoverage = () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.kravPaaTabtArbejdsfortjeneste = 'Ja';
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeTil = iso('2024-01-01');
    values.tafPerioder = [{ id: 't', fra: iso('2010-01-01'), til: iso('2025-01-01'), loseFeriedage: 0 }];
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    Object.assign(employment, { loenudviklingBeregningsgrundlag: 'Overenskomst', overenskomstId: 'bygge-anlaeg' });
    values.loenindkomstAnsaettelsesforhold = [employment];
    return { values, employment };
  };

  it('markerer reguleringsvalg ved TAF-start før dækning og datoens kildefelt ved basis før dækning', () => {
    const { values, employment } = setupCoverage();
    const collect = () => collectLoenudviklingCoverageIssues(values, STAMDATA_INITIAL_VALUES);
    expect(collect().map((issue) => issue.field.descriptor.id)).toEqual(['eo.loenindkomstAnsaettelsesforhold.loenudviklingBeregningsgrundlag']);
    employment.saerligFraDatoRegulering = iso('2010-01-01');
    expect(collect().map((issue) => issue.field.descriptor.id)).toContain('eo.loenindkomstAnsaettelsesforhold.saerligFraDatoRegulering');
    employment.saerligFraDatoRegulering = undefined;
    values.tafBeregningsperiodeTil = iso('2010-01-01');
    expect(collect().map((issue) => issue.field.descriptor.id)).toContain('eo.tafBeregningsperiodeTil');
  });

  it.each(['Manuelt angivet', 'Manuel procentsats'] as const)('%s giver rød ring ved TAF før reguleringsdatoen', (basis) => {
    const { values, employment } = setupCoverage();
    employment.loenudviklingBeregningsgrundlag = basis;
    const issues = collectLoenudviklingCoverageIssues(values, STAMDATA_INITIAL_VALUES);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('Vælg en anden reguleringsform for at nedregulere');
  });

  it('referenceperiodens slutdato før kildens dækning giver rød ring på SFGG-datoen', () => {
    const { values, employment } = setupCoverage();
    employment.ansatPaaSkadestidspunktet = true;
    values.tafPerioder[0].fra = iso('2024-01-02');
    values.sfggAnsaettelsesforhold = [{ ansaettelsesforholdId: employment.id,
      sfggBeregningskilde: 'Ferieloven', sfggReferenceperiodeFra: iso('2010-01-01'),
      sfggReferenceperiodeTil: iso('2010-12-31'), sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggManuelDagssats: undefined, sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej', sfggSatsvalg: undefined, sfggAlleredeBetaltBeloeb: undefined }];
    const issues = collectLoenudviklingCoverageIssues(values, STAMDATA_INITIAL_VALUES);
    expect(issues.map((issue) => issue.field.descriptor.id)).toEqual(['eo.sfggAnsaettelsesforhold.sfggReferenceperiodeTil']);
  });

  it('angivet løn binder en for tidlig basisdato til sit synlige datofelt', () => {
    const { values } = setupCoverage();
    values.beregnesUdFra = 'Angivet dagsløn';
    values.angivetDagsloenOpreguleresFraDato = iso('2010-01-01');
    values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Overenskomst';
    values.eoAngivetLoenLoenudvikling.overenskomstId = 'bygge-anlaeg';
    const issues = collectLoenudviklingCoverageIssues(values, STAMDATA_INITIAL_VALUES);
    expect(issues.map((issue) => issue.field.descriptor.id)).toContain('eo.angivetDagsloenOpreguleresFraDato');
  });
});
