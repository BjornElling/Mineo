import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { buildSfggPeriode } from '../../../domain/erstatningsopgoerelse/engines/sfggPeriodisering';
import {
  asSfggAmount as asAmount,
  createSfggEmployment as createEmployment,
  sfggIso as iso,
} from '../../utils/sfggTestSupport';

describe('buildSfggPeriode', () => {
  const base = {
    tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }],
    firstExcludedDate: null,
    employmentHadFirstExcludedDate: false,
    capReachedDate: null,
    ansaettelsesophorDate: null,
    foerstEfterSygeloen: false,
    employment: createEmployment(),
    ferieperioder: [] as ErstatningsopgoerelseValues['ferieperioder'],
  };

  it('uden afkortninger fratrækker kun ferie fra visningsperioden', () => {
    const periode = buildSfggPeriode({
      ...base,
      ferieperioder: [{ id: 'ferie-1', fra: iso('2024-01-10'), til: iso('2024-01-12') }],
    });
    expect(periode.afkortninger).toEqual([]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-31') }]);
    expect(periode.eligibleRanges).toEqual([
      { fra: iso('2024-01-01'), til: iso('2024-01-09') },
      { fra: iso('2024-01-13'), til: iso('2024-01-31') },
    ]);
  });

  it('fjerner første sygedag og registrerer foersteSygedag-afkortning', () => {
    const periode = buildSfggPeriode({
      ...base,
      firstExcludedDate: iso('2024-01-01'),
      employmentHadFirstExcludedDate: true,
    });
    expect(periode.afkortninger).toEqual([{ aarsag: 'foersteSygedag' }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-02'), til: iso('2024-01-31') }]);
  });

  it('registrerer ikke foersteSygedag når ansættelsesforholdet ikke havde den udeladte dag', () => {
    const periode = buildSfggPeriode({
      ...base,
      firstExcludedDate: iso('2024-01-01'),
      employmentHadFirstExcludedDate: false,
    });
    expect(periode.afkortninger).toEqual([]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-31') }]);
  });

  it('klipper ved 4-måneders-loftet og registrerer cap4mdr med dato', () => {
    const periode = buildSfggPeriode({ ...base, capReachedDate: iso('2024-01-15') });
    expect(periode.afkortninger).toEqual([{ aarsag: 'cap4mdr', dato: iso('2024-01-15') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-15') }]);
  });

  it('klipper ved ansættelsesophør og registrerer ansaettelsesophoer med dato', () => {
    const periode = buildSfggPeriode({ ...base, ansaettelsesophorDate: iso('2024-01-20') });
    expect(periode.afkortninger).toEqual([{ aarsag: 'ansaettelsesophoer', dato: iso('2024-01-20') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-20') }]);
  });

  it('angiver kun loftet når det nås før eller samtidig med ophør, men klipper ved begge', () => {
    const periode = buildSfggPeriode({
      ...base,
      capReachedDate: iso('2024-01-10'),
      ansaettelsesophorDate: iso('2024-01-20'),
    });
    expect(periode.afkortninger).toEqual([{ aarsag: 'cap4mdr', dato: iso('2024-01-10') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-10') }]);
  });

  it('angiver ophør når det ligger før loftet', () => {
    const periode = buildSfggPeriode({
      ...base,
      capReachedDate: iso('2024-01-25'),
      ansaettelsesophorDate: iso('2024-01-15'),
    });
    expect(periode.afkortninger).toEqual([{ aarsag: 'ansaettelsesophoer', dato: iso('2024-01-15') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-15') }]);
  });

  it('fratrækker arbejdsgiverbetalt sygeløn og registrerer sygeloen når der er overlap', () => {
    const employment = createEmployment({
      loenperiode: 'maaned',
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    });
    const periode = buildSfggPeriode({ ...base, foerstEfterSygeloen: true, employment });
    expect(periode.afkortninger).toEqual([{ aarsag: 'sygeloen' }]);
    expect(periode.visningsperiode).toEqual([]);
  });

  it('registrerer ikke sygeloen når der ikke er sygelønsoverlap', () => {
    const periode = buildSfggPeriode({ ...base, foerstEfterSygeloen: true });
    expect(periode.afkortninger).toEqual([]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-31') }]);
  });

  it('angiver loftet når det nås præcis samtidig med ophør (samme dato)', () => {
    // Grænsetilfældet cap === ophør: den gensidige udelukkelse (`capReachedDate <= ansaettelsesophorDate`)
    // skal lade loftet vinde, ikke ophøret.
    const periode = buildSfggPeriode({
      ...base,
      capReachedDate: iso('2024-01-15'),
      ansaettelsesophorDate: iso('2024-01-15'),
    });
    expect(periode.afkortninger).toEqual([{ aarsag: 'cap4mdr', dato: iso('2024-01-15') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-15') }]);
  });

  it('registrerer ikke sygeloen når sygelønsperioden først ligger efter loft-klippet', () => {
    // Sygelønnen (20.-31. jan) overlapper KUN den oprindelige periode, ikke den loft-klippede
    // (1.-15. jan). Overlap-tjekket sker bevidst EFTER klippet, så der må ikke registreres en
    // sygeloen-afkortning. Fanger en regression, der flytter overlap-tjekket før loft-klippet.
    const employment = createEmployment({
      loenperiode: 'dag',
      indtaegtsoplysningerTableData: [{
        id: 'loen-sen-jan-2024',
        col0_maaned: '',
        col1_maaned: '',
        col0_uge: '',
        col1_uge: '',
        col0_dag: iso('2024-01-20'),
        col1_dag: iso('2024-01-31'),
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    });
    const periode = buildSfggPeriode({
      ...base,
      capReachedDate: iso('2024-01-15'),
      foerstEfterSygeloen: true,
      employment,
    });
    expect(periode.afkortninger).toEqual([{ aarsag: 'cap4mdr', dato: iso('2024-01-15') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-15') }]);
  });

  it('bevarer rækkefølgen første-sygedag → loft → sygeløn i afkortnings-listen', () => {
    const employment = createEmployment({
      loenperiode: 'maaned',
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    });
    const periode = buildSfggPeriode({
      ...base,
      firstExcludedDate: iso('2024-01-01'),
      employmentHadFirstExcludedDate: true,
      capReachedDate: iso('2024-01-20'),
      foerstEfterSygeloen: true,
      employment,
    });
    expect(periode.afkortninger.map((a) => a.aarsag)).toEqual(['foersteSygedag', 'cap4mdr', 'sygeloen']);
  });

  it('bevarer huller mellem delvise sygelønsperioder på tværs af diskontinuerte TAF-perioder', () => {
    const employment = createEmployment({
      loenperiode: 'dag',
      indtaegtsoplysningerTableData: [
        {
          id: 'loen-1',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '',
          col1_uge: '',
          col0_dag: iso('2024-01-03'),
          col1_dag: iso('2024-01-05'),
          col2: asAmount(1000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
        {
          id: 'loen-2',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '',
          col1_uge: '',
          col0_dag: iso('2024-01-22'),
          col1_dag: iso('2024-01-23'),
          col2: asAmount(1000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    });

    const periode = buildSfggPeriode({
      ...base,
      tafRanges: [
        { fra: iso('2024-01-01'), til: iso('2024-01-10') },
        { fra: iso('2024-01-20'), til: iso('2024-01-31') },
      ],
      foerstEfterSygeloen: true,
      employment,
    });

    expect(periode.afkortninger).toEqual([{ aarsag: 'sygeloen' }]);
    expect(periode.visningsperiode).toEqual([
      { fra: iso('2024-01-01'), til: iso('2024-01-02') },
      { fra: iso('2024-01-06'), til: iso('2024-01-10') },
      { fra: iso('2024-01-20'), til: iso('2024-01-21') },
      { fra: iso('2024-01-24'), til: iso('2024-01-31') },
    ]);
    expect(periode.eligibleRanges).toEqual(periode.visningsperiode);
  });
});
