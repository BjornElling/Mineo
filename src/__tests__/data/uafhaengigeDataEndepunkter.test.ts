import {
  getKapitaliseringsTabelData,
  kapitaliseringsTabelDataById,
} from '../../data/kapitalisering/kapitaliseringsTabeller';
import {
  assertOffentligLoenDataIntegritet,
  getOffentligLoenForDato,
} from '../../data/offentligLoenLookup';
import { assertOverenskomstSatserNyesteFoerst } from '../../data/overenskomstRates';
import type { OverenskomstId, OverenskomstPeriodeSats } from '../../data/overenskomstRates';
import { toLoentrin } from '../../data/offentligLoenTypes';
import type { OffentligLoenRegulering } from '../../data/offentligLoenTypes';
import { toDanishDateString } from '../../types/branded';

const d = (value: string) => toDanishDateString(value);

const requireKapitaliseringstabel = (id: string) => {
  const tabel = getKapitaliseringsTabelData(id);
  if (!tabel) throw new Error(`Testfixture mangler kapitaliseringstabel ${id}`);
  return tabel;
};

const findAldersraekke = <T extends Readonly<{ alder: number }>>(
  tabeller: Readonly<Record<string, readonly T[]>>,
  tabelnavn: string,
  alder: number,
): T => {
  const tabel = tabeller[tabelnavn];
  if (!tabel) throw new Error(`Testfixture mangler tabel ${tabelnavn}`);
  const raekke = tabel.find((entry) => entry.alder === alder);
  if (!raekke) throw new Error(`Testfixture mangler alder ${alder} i tabel ${tabelnavn}`);
  return raekke;
};

describe('TD-020 – uafhængige dataendepunkter', () => {
  it('registrerer alle 35 kapitaliseringstabeller med deres PDF-kilde', () => {
    // Dette er en uafhængig mængde fra katalogets afledte Object.keys-kontrol. Den
    // fanger en bortfaldet tabel eller en ny tabel uden registrering i index.ts.
    const forventedeIds = [
      '10029/2024',
      '10056/2025',
      '10141/2022',
      '10183/2025',
      '1022/2009',
      '10253/2026',
      '1047/2008',
      '1068/2003',
      '1156/2017',
      '1202/2013',
      '1220/2010',
      '1221/2010',
      '1233/2018',
      '1263/2007',
      '1275/2014',
      '1275/2016',
      '1358/2011',
      '1403/2011',
      '1663/2015',
      '1664/2015',
      '1700/2015',
      '198/2015',
      '199/2015',
      '229/2014',
      '440/2009',
      '449/2009',
      '678/2007',
      '9376/2024',
      '9741/2020',
      '9820/2023',
      '9864/2021',
      '9870/2020',
      '9871/2020',
      '990/2012',
      '9921/2019',
    ];

    expect(Object.keys(kapitaliseringsTabelDataById).sort()).toEqual(forventedeIds.sort());
    expect(Object.values(kapitaliseringsTabelDataById).map((entry) => entry.kildePdfFil).sort())
      .toEqual([
        'Bkg. 1022 2009.pdf',
        'Bkg. 1047 2008.pdf',
        'Bkg. 1068 2003.pdf',
        'Bkg. 1156 2017.pdf',
        'Bkg. 1202 2013.pdf',
        'Bkg. 1220 2010.pdf',
        'Bkg. 1221 2010.pdf',
        'Bkg. 1233 2018.pdf',
        'Bkg. 1263 2007.pdf',
        'Bkg. 1275 2014.pdf',
        'Bkg. 1275 2016.pdf',
        'Bkg. 1358 2011.pdf',
        'Bkg. 1403 2011.pdf',
        'Bkg. 1663 2015.pdf',
        'Bkg. 1664 2015.pdf',
        'Bkg. 1700 2015.pdf',
        'Bkg. 198 2015.pdf',
        'Bkg. 199 2015.pdf',
        'Bkg. 229 2014.pdf',
        'Bkg. 440 2009.pdf',
        'Bkg. 449 2009.pdf',
        'Bkg. 678 2007.pdf',
        'Bkg. 990 2012.pdf',
        'Vejl. 10029 2024.pdf',
        'Vejl. 10056 2025.pdf',
        'Vejl. 10141 2022.pdf',
        'Vejl. 10183 2025.pdf',
        'Vejl. 10253 2026.pdf',
        'Vejl. 9376 2024.pdf',
        'Vejl. 9741 2020.pdf',
        'Vejl. 9820 2023.pdf',
        'Vejl. 9864 2021.pdf',
        'Vejl. 9870 2020.pdf',
        'Vejl. 9871 2020.pdf',
        'Vejl. 9921 2019.pdf',
      ]);
  });

  it('fastholder literal-endepunkter fra nyeste kapitaliserings-PDF', () => {
    // Facit er kopieret fra den committede kildefil Vejl. 10056 2025.pdf.
    const tabel = requireKapitaliseringstabel('10056/2025');

    expect(tabel).toMatchObject({
      kapitaliseringsId: '10056/2025',
      kapitaliseringsType: 'vejl',
      gyldigFra: '2026-01-01',
      gyldigTil: '2026-12-31',
      kildePdfFil: 'Vejl. 10056 2025.pdf',
    });
    expect(findAldersraekke(tabel.erhvervsevnetabTabeller, 'A', 5))
      .toEqual({ alder: 5, faktor: 64.938 });
    expect(findAldersraekke(tabel.erhvervsevnetabTabeller, 'A', 56))
      .toEqual({ alder: 56, faktor: 9.282 });
    expect(tabel.saerfaktorUnderToAarTilFpPerSkadesinterval).toEqual([
      { skadedatoFra: '2021-01-01', faktor: 1.246 },
      { skadedatoFra: '2011-01-01', faktor: 1.246 },
      { skadedatoFra: '2007-07-01', faktor: 1.168 },
    ]);
  });

  it('fastholder literal-endepunkter i en historisk kapitaliserings-PDF', () => {
    // Facit er kopieret fra den committede kildefil Vejl. 9921 2019.pdf.
    const tabel = requireKapitaliseringstabel('9921/2019');

    expect(tabel).toMatchObject({
      kapitaliseringsId: '9921/2019',
      kapitaliseringsType: 'vejl',
      gyldigFra: '2020-01-01',
      gyldigTil: '2020-12-30',
      kildePdfFil: 'Vejl. 9921 2019.pdf',
    });
    expect(findAldersraekke(tabel.erhvervsevnetabTabeller, 'A', 5))
      .toEqual({ alder: 5, faktor: 42.388 });
    expect(findAldersraekke(tabel.erhvervsevnetabTabeller, 'A', 58))
      .toEqual({ alder: 58, faktor: 5.944 });
    expect(findAldersraekke(tabel.erhvervsevnetabTabeller, 'B', 57))
      .toEqual({ alder: 57, faktor: 5.977 });
    expect(findAldersraekke(tabel.erhvervsevnetabTabeller, 'B', 64))
      .toEqual({ alder: 64, faktor: 1.846 });
    expect(findAldersraekke(tabel.forsoergertabTabeller, 'C', 65))
      .toEqual({ alder: 65, faktorerPraHeleAar: [0.618, 1.226] });
  });

  it('fastholder de kønsopdelte tabeller og de begrundet udeladte tabeller i ældste PDF', () => {
    // Facit er kopieret fra den committede kildefil Bkg. 1068 2003.pdf.
    const tabel = requireKapitaliseringstabel('1068/2003');

    expect(tabel).toMatchObject({
      kapitaliseringsId: '1068/2003',
      kapitaliseringsType: 'bkg',
      gyldigFra: '2004-01-01',
      gyldigTil: '2009-06-30',
      kildePdfFil: 'Bkg. 1068 2003.pdf',
    });
    expect(tabel.erhvervsevnetabTabeller).toEqual({});
    expect(tabel.erhvervsevnetabKoensopdelteTabeller.A?.map((raekke) => raekke.alder))
      .toEqual(Array.from({ length: 58 }, (_, index) => index + 5));
    expect(findAldersraekke(tabel.erhvervsevnetabKoensopdelteTabeller, 'A', 5))
      .toEqual({ alder: 5, maendFaktor: 10.443, kvinderFaktor: 10.453 });
    expect(findAldersraekke(tabel.erhvervsevnetabKoensopdelteTabeller, 'A', 34))
      .toEqual({ alder: 34, maendFaktor: 9.771, kvinderFaktor: 9.834 });
    expect(findAldersraekke(tabel.erhvervsevnetabKoensopdelteTabeller, 'A', 62))
      .toEqual({ alder: 62, maendFaktor: 2.742, kvinderFaktor: 2.753 });
    // Tabel B og C gælder løbende ydelser efter lov om sikring mod følger af arbejdsskade (skader før 2004).
    expect(Object.keys(tabel.erhvervsevnetabKoensopdelteTabeller)).toEqual(['A']);
    expect(tabel.udeladteKildetabeller).toEqual({
      B: 'skader-foer-2004',
      C: 'skader-foer-2004',
      F: 'afloesningsbeloeb',
      G: 'afloesningsbeloeb',
      H: 'varigt-men',
    });
    expect(tabel.erhvervsevnetabTabelvalg).toEqual([
      { skadedatoFra: '2004-01-01', foedselsdatoFra: '1900-01-01', foedselsdatoTil: null, tabel: 'A' },
    ]);
    expect(tabel.forsoergertabTabelvalg).toEqual([
      { skadedatoFra: '2004-01-01', koensopdelt: true, tabelMaend: 'D', tabelKvinder: 'E' },
    ]);
    expect(findAldersraekke(tabel.forsoergertabTabellerMaend, 'D', 18))
      .toEqual({ alder: 18, faktorerPraHeleAar: [0.957, 1.827, 2.618, 3.336, 3.989, 4.582, 5.12, 5.61, 6.054, 6.458] });
    expect(findAldersraekke(tabel.forsoergertabTabellerMaend, 'D', 66))
      .toEqual({ alder: 66, faktorerPraHeleAar: [0.948] });
    expect(findAldersraekke(tabel.forsoergertabTabellerKvinder, 'E', 18))
      .toEqual({ alder: 18, faktorerPraHeleAar: [0.957, 1.828, 2.619, 3.337, 3.989, 4.583, 5.122, 5.611, 6.056, 6.461] });
    expect(findAldersraekke(tabel.forsoergertabTabellerKvinder, 'E', 66))
      .toEqual({ alder: 66, faktorerPraHeleAar: [0.951] });
  });

  it('fastholder særfaktoren for ≤ 2 år til folkepension i hver bekendtgørelse som trykt i PDF\'en', () => {
    // Facit er afskrevet fra kilde-PDF'ernes paragraf om tilskadekomne, der er «2 år eller mindre fra at
    // nå folkepensionsalderen». 1068/2003 og 449/2009 har ingen sådan paragraf (tabellerne er «uden
    // omsætningsmulighed» de sidste 2 år), og ingen bekendtgørelse har en særfaktor for skader før
    // 1. juli 2007. 1202/2013 trykker «1,2514» og registreres som skrevet; BEK 229/2014 retter den til
    // «1,251» fra 15. marts 2014.
    const facit: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
      '1068/2003': [],
      '449/2009': [],
      '678/2007': [['2007-07-01', 1.164]],
      '1263/2007': [['2007-07-01', 1.164]],
      '1047/2008': [['2007-07-01', 1.16]],
      '440/2009': [['2007-07-01', 1.16]],
      '1022/2009': [['2007-07-01', 1.168]],
      '1221/2010': [['2007-07-01', 1.168]],
      '1403/2011': [['2007-07-01', 1.168]],
      '198/2015': [['2007-07-01', 1.168]],
      '1700/2015': [['2007-07-01', 1.168]],
      '9871/2020': [['2007-07-01', 1.168]],
      '1220/2010': [['2011-01-01', 1.254]],
      '1358/2011': [['2011-01-01', 1.254]],
      '990/2012': [['2011-01-01', 1.254]],
      '1202/2013': [['2011-01-01', 1.2514]],
      '229/2014': [['2011-01-01', 1.251]],
      '1275/2014': [['2011-01-01', 1.251]],
      '199/2015': [['2011-01-01', 1.251]],
      '1663/2015': [['2011-01-01', 1.251]],
      '1664/2015': [['2011-01-01', 1.246]],
      '1275/2016': [['2011-01-01', 1.246]],
      '1156/2017': [['2011-01-01', 1.246]],
      '1233/2018': [['2011-01-01', 1.246]],
      '9921/2019': [['2011-01-01', 1.245]],
      '9870/2020': [['2011-01-01', 1.245]],
    };
    for (const [id, forventet] of Object.entries(facit)) {
      const faktiske = requireKapitaliseringstabel(id).saerfaktorUnderToAarTilFpPerSkadesinterval
        .map((entry) => [entry.skadedatoFra, entry.faktor] as const);
      expect(faktiske, id).toEqual(forventet);
    }
  });

  it('fastholder de ældste offentlige lønendpoints fra lokale Excel-kilder', () => {
    // Facit er fra KL-2012-01-01.xls og RLTN-2012-01-01.xls, som er kilderne til
    // de auto-genererede runtimefiler under src/data/KL/ og src/data/RLTN/.
    expect(getOffentligLoenForDato('KL', d('15-01-2012'), toLoentrin(1), 0)).toEqual({
      overenskomstType: 'KL',
      effectiveDate: '01-01-2012',
      loentrin: 1,
      loengruppe: 0,
      maanedsLoen: 15564.58,
      timeLoen: 97.08,
    });
    expect(getOffentligLoenForDato('RLTN', d('15-01-2012'), toLoentrin(1), 0)).toEqual({
      overenskomstType: 'RLTN',
      effectiveDate: '01-01-2012',
      loentrin: 1,
      loengruppe: 0,
      maanedsLoen: 15557.5,
      timeLoen: 97.03,
    });
  });

  it('dækker offentlig lønsats-guardens ugyldige dato-partition med literal fixture', () => {
    // Brandet omgås kun her for at ramme guardens runtime-partition med ugyldig ekstern data.
    const ugyldig: OffentligLoenRegulering = {
      effectiveDate: 'ikke-en-dato' as OffentligLoenRegulering['effectiveDate'],
      entries: [],
    };

    expect(() => assertOffentligLoenDataIntegritet([ugyldig], 'Test-KL'))
      .toThrow(/ugyldig fraDato/);
  });

  it('dækker privat overenskomst-guards ugyldige dato-partition med literal fixture', () => {
    // Brandet omgås kun her for at ramme den samme fail-closed grænse ved load af ekstern data.
    const ugyldig: OverenskomstPeriodeSats = {
      fraDato: 'ikke-en-dato' as OverenskomstPeriodeSats['fraDato'],
      grundloen: 100,
      shSoSats: null,
      fritvalg: null,
      agPension: null,
      sfgg: null,
      sfggFaglKbh: null,
      sfggFaglProv: null,
      sfggUfaglKbh: null,
      sfggUfaglProv: null,
    };

    expect(() => assertOverenskomstSatserNyesteFoerst([ugyldig], 'testkilde' as OverenskomstId))
      .toThrow(/ugyldig fraDato/);
  });
});
