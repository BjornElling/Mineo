/**
 * Satser på arbejdsskadeområdet 2005 -> 2025
 *
 * Denne fil indeholder alle lovbestemte satser for erstatningsberegninger
 * efter Erstatningsansvarsloven (EAL) og Arbejdsskadesikringsloven (ASL).
 *
 * Struktur:
 * - Hver sats er et objekt med årstal som nøgler
 * - getSatserForYear() returnerer alle satser for et specifikt år
 */

// ===== ERSTATNINGSANSVARSLOVEN =====

// Godtgørelse for svie og smerte (§ 3, 1. pkt.)
export const svieSmertePrDag = {
  2025: 240,
  2024: 230,
  2023: 220,
  2022: 215,
  2021: 215,
  2020: 210,
  2019: 205,
  2018: 200,
  2017: 195,
  2016: 190,
  2015: 190,
  2014: 185,
  2013: 180,
  2012: 180,
  2011: 175,
  2010: 170,
  2009: 165,
  2008: 160,
  2007: 155,
  2006: 150,
  2005: 145,
};

// Maksimum for svie og smerte (§ 3, 3. pkt.)
export const svieSmerteMax = {
  2025: 92000,
  2024: 88500,
  2023: 85500,
  2022: 83000,
  2021: 82000,
  2020: 80000,
  2019: 78500,
  2018: 76500,
  2017: 75000,
  2016: 73500,
  2015: 72500,
  2014: 71500,
  2013: 70000,
  2012: 69000,
  2011: 67000,
  2010: 65500,
  2009: 63000,
  2008: 61000,
  2007: 59000,
  2006: 57500,
  2005: 56000,
};

// Maksimum for erhvervsevnetab (§ 13, stk. 1, 2. pkt.)
export const erhvervsevnetabMax = {
  2025: 11052000,
  2024: 10637000,
  2023: 10277500,
  2022: 9978000,
  2021: 9859500,
  2020: 9638000,
  2019: 9430500,
  2018: 9227500,
  2017: 9029000,
  2016: 8834500,
  2015: 8712500,
  2014: 8584000,
  2013: 8432000,
  2012: 8299000,
  2011: 8042000,
  2010: 7892000,
  2009: 7588500,
  2008: 7339000,
  2007: 7111500,
  2006: 6924500,
  2005: 6678500,
};

// Vejledende udtalelse om erhvervsevnetab (§ 10)
export const vejledendeUdtalelse = {
  2025: 25122,
  2024: 24390,
  2023: 23360,
  2022: 22870,
  2021: 20120,
  2020: 24690,
  2019: 24510,
  2018: 22280,
  2017: 23040,
  2016: 8600,
  2015: 9100,
  2014: 9000,
  2013: 8900,
  2012: 9500,
  2011: 8500,
  2010: 8500,
  2009: 7100,
  2008: 7000,
  2007: 6900,
  2006: 6900,
  2005: 5000,
};

// ===== ARBEJDSSKADESIKRINGSLOVEN =====

// Godtgørelse for varige mén (§ 18, stk. 3, 3. pkt.)
export const varigeMenPrGrad = {
  2025: 10530,
  2024: 10135,
  2023: 9790,
  2022: 9505,
  2021: 9395,
  2020: 9180,
  2019: 8985,
  2018: 8790,
  2017: 8600,
  2016: 8415,
  2015: 8300,
  2014: 8175,
  2013: 8035,
  2012: 7905,
  2011: 7660,
  2010: 7520,
  2009: 7230,
  2008: 6990,
  2007: 6775,
  2006: 6595,
  2005: 6450,
};

// Maksimum årsløn (§ 24, stk. 10)
export const aarslonMax = {
  2025: 632000,
  2024: 608000,
  2023: 588000,
  2022: 570000,
  2021: 564000,
  2020: 551000,
  2019: 539000,
  2018: 527000,
  2017: 516000,
  2016: 505000,
  2015: 498000,
  2014: 491000,
  2013: 482000,
  2012: 474000,
  2011: 459000,
  2010: 451000,
  2009: 434000,
  2008: 419000,
  2007: 407000,
  2006: 396000,
  2005: 387000,
};

// Minimum årsløn (§ 24, stk. 10)
export const aarslonMin = {
  2025: 267000,
  2023: 219000,
  2022: 213000,
  2021: 210000,
  2020: 206000,
  2019: 201000,
  2018: 197000,
  2017: 193000,
  2016: 189000,
  2015: 186000,
  2014: 183000,
  2013: 180000,
  2012: 177000,
  2011: 172000,
  2010: 168000,
  2009: 162000,
  2008: 157000,
  2007: 152000,
  2006: 148000,
  2005: 145000,
};

// Minimum årsløn (skader før 1.7.2024)
export const aarslonMinFoer20240701 = {
  2024: 227000,
};

// Minimum årsløn (skader fra 1.7.2024)
export const aarslonMinFra20240701 = {
  2024: 257000,
};

// Overgangsbeløb (§ 19, stk. 1)
export const overgangsbeloeb = {
  2025: 198500,
  2024: 191000,
  2023: 184500,
  2022: 179000,
  2021: 177000,
  2020: 173000,
  2019: 169000,
  2018: 165500,
  2017: 162000,
  2016: 158500,
  2015: 156500,
  2014: 154000,
  2013: 151500,
  2012: 149000,
  2011: 144500,
  2010: 141500,
  2009: 136000,
  2008: 131500,
  2007: 127500,
  2006: 124000,
  2005: 121500,
};

// Reguleringsprocent for erhvervsevnetab
export const reguleringsprocentErhvervsevnetab = {
  2023: 60.1,
  2022: 55.4,
  2021: 53.6,
  2020: 50.1,
  2019: 46.9,
  2018: 43.7,
  2017: 40.6,
  2016: 37.6,
  2015: 35.7,
  2014: 33.7,
  2013: 31.3,
  2012: 29.2,
  2011: 25.2,
  2010: 22.9,
  2009: 18.2,
  2008: 14.3,
  2007: 10.8,
  2006: 7.9,
  2005: 5.5,
};

// Reguleringsprocent for erhvervsevnetab (før 2024)
export const reguleringsprocentErhvervsevnetabFoer2024 = {
  2024: 65.7,
};

// Reguleringsprocent for erhvervsevnetab (fra 2024)
export const reguleringsprocentErhvervsevnetabFra2024 = {
  2025: 3.9,
  2024: 0,
};

// ===== DIVERSE =====

// Beløbsgrænse for fri proces - enlig
export const friProcesEnlig = {
  2025: 385000,
  2024: 371000,
  2023: 358000,
  2022: 348000,
  2021: 344000,
  2020: 336000,
  2019: 329000,
  2018: 322000,
  2017: 315000,
  2016: 308000,
  2015: 304000,
  2014: 299000,
  2013: 294000,
  2012: 289000,
  2011: 280000,
  2010: 275000,
  2009: 264000,
  2008: 256000,
  2007: 248000,
  2006: 242000,
  2005: 236000,
};

// Beløbsgrænse for fri proces - samlevende
export const friProcesSamlevende = {
  2025: 490000,
  2024: 471000,
  2023: 455000,
  2022: 442000,
  2021: 437000,
  2020: 427000,
  2019: 418000,
  2018: 409000,
  2017: 400000,
  2016: 391000,
  2015: 386000,
  2014: 380000,
  2013: 374000,
  2012: 368000,
  2011: 356000,
  2010: 350000,
  2009: 336000,
  2008: 325000,
  2007: 315000,
  2006: 307000,
  2005: 300000,
};

// Beløbsgrænse for fri proces - tillæg per barn under 18 år
export const friProcesBarn = {
  2025: 67000,
  2024: 64000,
  2023: 62000,
  2022: 60000,
  2021: 60000,
  2020: 58000,
  2019: 57000,
  2018: 56000,
  2017: 55000,
  2016: 53000,
  2015: 53000,
  2014: 52000,
  2013: 51000,
  2012: 50000,
  2011: 49000,
  2010: 48000,
  2009: 46000,
  2008: 44000,
  2007: 43000,
  2006: 42000,
  2005: 41000,
};

// Reguleringssats (EAL § 15, stk. 1 / ASL § 25, stk. 1-2)
export const reguleringssats = {
  2025: 3.9,
  2024: 3.5,
  2023: 3.0,
  2022: 1.2,
  2021: 2.3,
  2020: 2.2,
  2019: 2.2,
  2018: 2.2,
  2017: 2.2,
  2016: 1.4,
  2015: 1.5,
  2014: 1.8,
  2013: 1.6,
  2012: 3.2,
  2011: 1.9,
  2010: 4.0,
  2009: 3.4,
  2008: 3.2,
  2007: 2.7,
  2006: 2.3,
  2005: 2.2,
};

// ===== REFERENCER =====

// Erstatningsansvarsloven
export const ealReference = {
  2025: 'Bkg. 1347/2024',
  2024: 'Bkg. 1390/2023',
  2023: 'Bkg. 1488/2022',
  2022: 'Bkg. 2173/2021',
  2021: 'Bkg. 1839/2020',
  2020: 'Bkg. 1130/2019',
  2019: 'Bkg. 1379/2018',
  2018: 'Bkg. 1233/2017',
  2017: 'Bkg. 1416/2016',
  2016: 'BKg. 1393/2015',
  2015: 'Bkg. 1185/2014',
  2014: 'Bkg. 1167/2013',
  2013: 'Bkg. 1059/2012',
  2012: 'Bkg. 1119/2011',
  2011: 'Bkg. 1298/2010',
  2010: 'Bkg. 1127/2009',
  2009: 'Bkg. 1110/2008',
  2008: 'Bkg. 1420/2007',
  2007: 'Bkg. 1090/2006',
  2006: 'Bkg. 1076/2005',
  2005: 'Bkg. 1158/2004',
};

// Arbejdsskadesikringsloven
export const aslReference = {
  2025: 'Vejl. 9915/2023',
  2024: 'Vejl. 9822/2023',
  2023: 'Vejl. 10142/2022',
  2022: 'Vejl. 9866/2021',
  2021: 'Vejl. 9737/2020',
  2020: 'Vejl. 9922/2019',
  2019: 'Bkg. 1232/2018',
  2018: 'Bkg. 1175/2017',
  2017: 'Bkg. 1273/2016',
  2016: 'BKg. 1220/2015',
  2015: 'Bkg. 1114/2014',
  2014: 'Bkg. 1151/2013',
  2013: 'Bkg. 991/2012',
  2012: 'Bkg. 1105/2011',
  2011: 'Bkg. 1215/2010',
  2010: 'Bkg. 1017/2009',
  2009: 'Bkg. 1050/2008',
  2008: 'Bkg. 1241/2007',
  2007: 'Bkg. 1047/2006',
  2006: 'Bkg. 989/2005',
  2005: 'Bkg. 1033/2004',
};

// Kapitalisering
export const kapitalisering = {
  2025: 'Vejl. 10029/2024',
  2006: 'Bkg. 1068/2003',
  2005: 'Bkg. 1068/2004',
};

// Kapitalisering (skade fra 1.1.2011)
export const kapitaliseringSkadeFra2011 = {
  2024: 'Vejl. 9820/2023 og 9376/2024',
  2023: 'Vejl. 10141/2022',
  2022: 'Vejl. 9864/2021',
  2021: 'Vejl. 9741/2020',
  2020: 'Vejl. 9921/2019',
  2019: 'Bkg. 1233/2018',
  2018: 'Bkg. 1156/2017',
  2017: 'Bkg. 1275/2016',
  2016: 'Bkg. 1664/2015',
  2015: 'Bkg. 1275/2014 og 199/2015',
  2014: 'Bkg. 1202/2013',
  2013: 'Bkg. 990/2012',
  2012: 'Bkg. 1358/2011',
  2011: 'Bkg. 1220/2010',
};

// Kapitalisering (skade før 1.1.2011)
export const kapitaliseringSkadeFoer2011 = {
  2024: 'Vejl. 9871/2020 og 9376/2024',
  2023: 'Vejl. 9871/2020',
  2022: 'Vejl. 9871/2020',
  2021: 'Vejl. 9871/2020',
  2020: 'Bkg. 1700/2015',
  2019: 'Bkg. 1700/2015',
  2018: 'Bkg. 1700/2015',
  2017: 'Bkg. 1700/2015',
  2016: 'Bkg. 1700/2015',
  2015: 'Bkg. 1403/2011 og 198/2015',
  2014: 'Bkg. 1403/2011',
  2013: 'Bkg. 1403/2011',
  2012: 'Bkg. 1403/2011',
  2011: 'Bkg. 1221/2010',
};

// Kapitalisering (skade fra 1.7.2007)
export const kapitaliseringSkadeFra2007 = {
  2010: 'Bkg. 1022/2009',
  2009: 'Bkg. 1047/2008 og 440/2009',
  2008: 'Bkg. 1263/2007',
  2007: 'Bkg. 678/2007',
};

// Kapitalisering (skade før 1.7.2007)
export const kapitaliseringSkadeFoer2007 = {
  2010: 'Bkg. 449/2009',
  2009: 'Bkg. 1068/2003 og 449/2009',
  2008: 'Bkg. 1068/2003',
  2007: 'Bkg. 1068/2003',
};

// Fri proces
export const friProcesReference = {
  2025: 'Bkg. 1338/2024',
  2024: 'Bkg. 1521/2023',
  2023: 'Bkg. 1479/2022',
  2022: 'Bkg. 2124/2021',
  2021: 'Bkg. 1840/2020',
  2020: 'Bkg. 1504/2019',
  2019: 'Bkg. 1372/2018',
  2018: 'Bkg. 1462/2017',
  2017: 'Bkg. 1671/2016',
  2016: 'Bkg. 1435/2015',
  2015: 'Bkg. 1270/2014',
  2014: 'Bkg. 1245/2013',
  2013: 'Bkg. 1084/2012',
  2012: 'Bkg. 1153/2011',
  2011: 'Bkg. 1428/2010',
  2010: 'Bkg. 1236/2009',
  2009: 'Bkg. 1116/2008',
  2008: 'Bkg. 1468/2007',
  2007: 'Bkg. 1295/2006',
  2006: 'Bkg. 1097/2005',
  2005: 'Bkg. 1116/2004',
};

// Reguleringssatser
export const reguleringssatsReference = {
  2025: 'Bkg. 983/2024',
  2024: 'Bkg. 1101/2023',
  2023: 'Bkg. 1204/2022',
  2022: 'Bkg. 1713/2021',
  2021: 'Bkg. 1210/2020',
  2020: 'Bkg. 855/2019',
  2019: 'Bkg. 1058/2018',
  2018: 'Bkg. 1015/2017',
  2017: 'Bkg. 1135/2016',
  2016: 'Bkg. 988/2015',
  2015: 'Bkg. 942/2014',
  2014: 'Bkg. 1046/2013',
  2013: 'Bkg. 870/2012',
  2012: 'Bkg. 937/2011',
  2011: 'Bkg. 1013/2010',
  2010: 'Bkg. 809/2009',
  2009: 'Bkg. 851/2008',
  2008: 'Bkg. 1021/2007',
  2007: 'Bkg. 874/2006',
  2006: 'Bkg. 793/2005',
  2005: 'Bkg. 877/2004',
};

// ===== HJÆLPEFUNKTIONER =====

/**
 * Returnerer alle satser for et bestemt år
 *
 * Robust over for manglende år i datatabellerne.
 * Hvis et opslag mangler for det ønskede år, returneres 0 (for tal) eller '' (for tekst).
 *
 * @param {number} year - Årstal at hente satser for
 * @returns {Object} Dictionary med alle satser struktureret efter kategori
 */
export const getSatserForYear = (year) => {
  const num = (dict) => (dict[year] !== undefined ? dict[year] : null);
  const txt = (dict) => dict[year] || '';

  return {
    eal: {
      svieSmertePrDag: num(svieSmertePrDag),
      svieSmerteMax: num(svieSmerteMax),
      erhvervsevnetabMax: num(erhvervsevnetabMax),
      vejledendeUdtalelse: num(vejledendeUdtalelse),
    },
    asl: {
      varigeMenPrGrad: num(varigeMenPrGrad),
      aarslonMax: num(aarslonMax),
      aarslonMin: num(aarslonMin),
      aarslonMinFoer2024: num(aarslonMinFoer20240701),
      aarslonMinFra2024: num(aarslonMinFra20240701),
      overgangsbelob: num(overgangsbeloeb),
      reguleringProcentErhvervsevnetab: num(reguleringsprocentErhvervsevnetab),
      reguleringProcentErhvervsevnetabFoer2024: num(reguleringsprocentErhvervsevnetabFoer2024),
      reguleringProcentErhvervsevnetabFra2024: num(reguleringsprocentErhvervsevnetabFra2024),
    },
    diverse: {
      friProcesEnlig: num(friProcesEnlig),
      friProcesSamlevende: num(friProcesSamlevende),
      friProcesBarn: num(friProcesBarn),
      reguleringssats: num(reguleringssats),
    },
    referencer: {
      ealReference: txt(ealReference),
      aslReference: txt(aslReference),
      kapitalisering: txt(kapitalisering),
      kapitaliseringSkadeFra2011: txt(kapitaliseringSkadeFra2011),
      kapitaliseringSkadeFoer2011: txt(kapitaliseringSkadeFoer2011),
      kapitaliseringSkadeFra2007: txt(kapitaliseringSkadeFra2007),
      kapitaliseringSkadeFoer2007: txt(kapitaliseringSkadeFoer2007),
      friProcesReference: txt(friProcesReference),
      reguleringssatsReference: txt(reguleringssatsReference),
    },
  };
};
