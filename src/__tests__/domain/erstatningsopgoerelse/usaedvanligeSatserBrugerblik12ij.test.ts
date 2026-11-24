import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import {
  buildAnciennitetstillaegOverTrinloenBesked,
  resolveAnciennitetstillaegOverTrinloenAdvarsler,
} from '../../../domain/erstatningsopgoerelse/anciennitetstillaegRules';
import { resolveLoentrinetsLoen } from '../../../domain/erstatningsopgoerelse/forhoejetGrundloenRules';
import { resolveLoenudviklingKilde } from '../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveLoenudviklingFieldWarnings } from '../../../domain/erstatningsopgoerelse/loenudviklingFieldWarnings';
import {
  buildSfggManuelDagssatsBesked,
  resolveSfggManuelDagssatsAdvarsler,
  resolveSfggRegistreretDagloen,
} from '../../../domain/erstatningsopgoerelse/engines/sfggWarnings';
import { eoSfggManuelDagssatsField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { eoAngivetLoenFields, eoEmploymentFields } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { asSfggAmount as amount, createSfggEmployment, createSfggIngenRow, sfggIso as iso } from '../../utils/sfggTestSupport';

// KL, løntrin 1, gruppe 0, månedsløn på 01-01-2012: 15.564,58 kr. (jf. td020KlOffentligLoenHistoriskDownstream).
const KL_TRIN_1_MAANEDSLOEN = 15564.58;
const STAMDATA = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2012-01-01') };

const buildAnciennitetCase = (
  sats: number,
  per: 'Time' | 'Måned',
  loenType: 'Månedsløn' | 'Timeløn' = 'Månedsløn',
): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.kravPaaTabtArbejdsfortjeneste = 'Ja';
  values.beregnesUdFra = 'Beregningsperiode';
  values.tafBeregningsperiodeTil = iso('2012-01-01');
  values.loenindkomstAnsaettelsesforhold = [{
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'af-kl',
    harOverenskomst: true,
    overenskomstId: 'kl-overenskomst',
    loenudviklingBeregningsgrundlag: 'Overenskomst',
    offentligLoenType: loenType,
    offentligLoenTrin: 1,
    offentligLoenGruppe: 0,
    harAnciennitetstillaegEfterSkadedatoen: true,
    anciennitetstillaegDato: iso('2012-06-01'),
    anciennitetstillaegSats: amount(sats),
    anciennitetstillaegSatsAngivesPer: per,
  }];
  return values;
};

describe('resolveAnciennitetstillaegOverTrinloenAdvarsler (BB-446)', () => {
  it('sammenligner med overenskomsttabellens trinløn på reguleringsdatoen', () => {
    const values = buildAnciennitetCase(1, 'Måned');
    expect(resolveLoentrinetsLoen(values, resolveLoenudviklingKilde(values)[0]!, STAMDATA.skadedato))
      .toEqual({ beloeb: KL_TRIN_1_MAANEDSLOEN, enhed: 'Måned' });
  });

  it('advarer først, når et månedstillæg overstiger trinlønnen', () => {
    expect(resolveAnciennitetstillaegOverTrinloenAdvarsler(buildAnciennitetCase(KL_TRIN_1_MAANEDSLOEN, 'Måned'), STAMDATA))
      .toEqual([]);
    const [advarsel, ...rest] = resolveAnciennitetstillaegOverTrinloenAdvarsler(buildAnciennitetCase(15564.59, 'Måned'), STAMDATA);
    expect(rest).toEqual([]);
    expect(advarsel?.ownerKey).toBe('af-kl');
    expect(advarsel?.cells[0]?.address).toEqual(eoEmploymentFields.anciennitetstillaegSats.bind('af-kl').address);
    expect(advarsel?.cellMessage).toBe(
      'Anciennitetstillægget (15.564,59 kr./måned) er større end løntrinnets løn (15.564,58 kr./måned) – kontrollér sats og enhed',
    );
    expect(advarsel?.summaryMessage).toBe(advarsel?.cellMessage);
  });

  it('omregner et timetillæg med motorens faktor 160,33 før sammenligningen', () => {
    // 97,07 × 160,33 = 15.563,23 (under); 97,08 × 160,33 = 15.564,84 (over).
    expect(resolveAnciennitetstillaegOverTrinloenAdvarsler(buildAnciennitetCase(97.07, 'Time'), STAMDATA)).toEqual([]);
    expect(resolveAnciennitetstillaegOverTrinloenAdvarsler(buildAnciennitetCase(97.08, 'Time'), STAMDATA)[0]?.cellMessage)
      .toBe('Anciennitetstillægget (15.564,84 kr./måned) er større end løntrinnets løn (15.564,58 kr./måned) – kontrollér sats og enhed');
  });

  it('sammenligner i timer ved timeløn', () => {
    const values = buildAnciennitetCase(30000, 'Måned', 'Timeløn');
    const trinloen = resolveLoentrinetsLoen(values, resolveLoenudviklingKilde(values)[0]!, STAMDATA.skadedato);
    expect(trinloen?.enhed).toBe('Time');
    expect(resolveAnciennitetstillaegOverTrinloenAdvarsler(values, STAMDATA)[0]?.cellMessage)
      .toBe(buildAnciennitetstillaegOverTrinloenBesked(187.11, trinloen!));
    expect(buildAnciennitetstillaegOverTrinloenBesked(187.11, trinloen!)).toContain('(187,11 kr./time)');
  });

  it('advarer ikke uden en opslåelig trinløn eller med tillægget slået fra', () => {
    const udenTrin = buildAnciennitetCase(1_000_000, 'Time');
    udenTrin.loenindkomstAnsaettelsesforhold[0]!.offentligLoenTrin = undefined;
    expect(resolveAnciennitetstillaegOverTrinloenAdvarsler(udenTrin, STAMDATA)).toEqual([]);

    const privat = buildAnciennitetCase(1_000_000, 'Time');
    privat.loenindkomstAnsaettelsesforhold[0]!.overenskomstId = 'ukendt-privat';
    expect(resolveAnciennitetstillaegOverTrinloenAdvarsler(privat, STAMDATA)).toEqual([]);

    const slaaetFra = buildAnciennitetCase(1_000_000, 'Time');
    slaaetFra.loenindkomstAnsaettelsesforhold[0]!.harAnciennitetstillaegEfterSkadedatoen = false;
    expect(resolveAnciennitetstillaegOverTrinloenAdvarsler(slaaetFra, STAMDATA)).toEqual([]);
  });

  it('peger på den angivne løns sats og giver en gul ring', () => {
    const values = buildAnciennitetCase(1_000_000, 'Time');
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = amount(31000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2012-01-01');
    values.eoAngivetLoenLoenudvikling = { ...values.eoAngivetLoenLoenudvikling, ...values.loenindkomstAnsaettelsesforhold[0] };
    const address = eoAngivetLoenFields.anciennitetstillaegSats.bind().address;
    expect(resolveAnciennitetstillaegOverTrinloenAdvarsler(values, STAMDATA)[0]?.cells[0]?.address).toEqual(address);
    expect([...resolveLoenudviklingFieldWarnings(values, STAMDATA, 0).values()].map((warning) => warning.message))
      .toContain('Anciennitetstillægget (160.330.000,00 kr./måned) er større end løntrinnets løn (15.564,58 kr./måned) – kontrollér sats og enhed');
  });
});

const buildDagssatsCase = (dagssats: number | undefined): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.kravPaaTabtArbejdsfortjeneste = 'Ja';
  // Januar 2024: 23 hverdage, heraf nytårsdag – 22 arbejdsdage.
  values.loenindkomstAnsaettelsesforhold = [createSfggEmployment({
    indtaegtsoplysningerTableData: [{
      id: 'loen-jan-2024',
      col0_maaned: '1',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: amount(22000),
      col3: undefined,
      col4: undefined,
      col5: undefined,
    }],
  })];
  values.sfggAnsaettelsesforhold = [{
    ...createSfggIngenRow('af-1'),
    sfggBeregningskilde: 'Manuelt angivet',
    sfggManuelDagssats: dagssats === undefined ? undefined : amount(dagssats),
  }];
  return values;
};

describe('resolveSfggManuelDagssatsAdvarsler (BB-450)', () => {
  it('opgør en dags løn som lønrækkernes løn delt med deres arbejdsdage', () => {
    const values = buildDagssatsCase(1);
    expect(resolveSfggRegistreretDagloen(values.loenindkomstAnsaettelsesforhold[0]!, [])).toBe(1000);
    // Ferie trækkes fra dagene som i SFGG-referencesatsen: 15.–19. januar giver 17 dage.
    expect(resolveSfggRegistreretDagloen(
      values.loenindkomstAnsaettelsesforhold[0]!,
      [{ id: 'ferie', fra: iso('2024-01-15'), til: iso('2024-01-19') }],
    )).toBe(1294.12);
  });

  it('advarer først, når dagssatsen er højere end en dags løn', () => {
    expect(resolveSfggManuelDagssatsAdvarsler(buildDagssatsCase(1000))).toEqual([]);
    const advarsler = resolveSfggManuelDagssatsAdvarsler(buildDagssatsCase(23000));
    expect(advarsler).toEqual([{ employmentId: 'af-1', dagssats: 23000, dagloen: 1000 }]);
    expect(buildSfggManuelDagssatsBesked(advarsler[0]!))
      .toBe('Dagssatsen (23.000,00 kr.) er højere end en dags løn (1.000,00 kr.) – kontrollér beløbet');
    expect(resolveSfggManuelDagssatsAdvarsler(buildDagssatsCase(1000.01))).toHaveLength(1);
  });

  it('advarer ikke uden lønrækker, uden sats eller ved en anden kilde', () => {
    const udenLoen = buildDagssatsCase(23000);
    udenLoen.loenindkomstAnsaettelsesforhold[0]!.indtaegtsoplysningerTableData = [];
    expect(resolveSfggManuelDagssatsAdvarsler(udenLoen)).toEqual([]);
    expect(resolveSfggManuelDagssatsAdvarsler(buildDagssatsCase(undefined))).toEqual([]);
    const ferieloven = buildDagssatsCase(23000);
    ferieloven.sfggAnsaettelsesforhold[0]!.sfggBeregningskilde = 'Ferieloven';
    expect(resolveSfggManuelDagssatsAdvarsler(ferieloven)).toEqual([]);
  });

  it('giver dagssatsfeltet en gul ring', () => {
    const warnings = resolveLoenudviklingFieldWarnings(buildDagssatsCase(23000), STAMDATA_INITIAL_VALUES, 0);
    expect(warnings.get(serializeFieldAddress(eoSfggManuelDagssatsField.bind('af-1').address))?.message)
      .toBe('Dagssatsen (23.000,00 kr.) er højere end en dags løn (1.000,00 kr.) – kontrollér beløbet');
  });
});
