export type RetsinfoLink = Readonly<{
  label: string;
  url: string;
}>;

export type YearlyRetsinfoLinks = Record<number, readonly RetsinfoLink[]>;

const ltaUrl = (year: number, number: number): string => `https://www.retsinformation.dk/eli/lta/${year}/${number}`;
const retsinfoUrl = (year: number, number: number): string => `https://www.retsinformation.dk/eli/retsinfo/${year}/${number}`;

const bkg = (number: number, year: number, label = `Bkg. ${number}/${year}`): RetsinfoLink => ({
  label,
  url: ltaUrl(year, number),
});

const vejl = (number: number, year: number, label = `Vejl. ${number}/${year}`): RetsinfoLink => ({
  label,
  url: retsinfoUrl(year, number),
});

export const ealReferenceLinks: YearlyRetsinfoLinks = {
  2026: [bkg(1428, 2025)],
  2025: [bkg(1347, 2024)],
  2024: [bkg(1390, 2023)],
  2023: [bkg(1488, 2022)],
  2022: [bkg(2173, 2021)],
  2021: [bkg(1839, 2020)],
  2020: [bkg(1130, 2019)],
  2019: [bkg(1379, 2018)],
  2018: [bkg(1233, 2017)],
  2017: [bkg(1416, 2016)],
  2016: [bkg(1393, 2015)],
  2015: [bkg(1185, 2014)],
  2014: [bkg(1167, 2013)],
  2013: [bkg(1059, 2012)],
  2012: [bkg(1119, 2011)],
  2011: [bkg(1298, 2010)],
  2010: [bkg(1127, 2009)],
  2009: [bkg(1110, 2008)],
  2008: [bkg(1420, 2007)],
  2007: [bkg(1090, 2006)],
  2006: [bkg(1076, 2005)],
  2005: [bkg(1158, 2004)],
};

export const aslReferenceLinks: YearlyRetsinfoLinks = {
  2026: [vejl(10058, 2025)],
  2025: [vejl(9915, 2023)],
  2024: [vejl(9822, 2023)],
  2023: [vejl(10142, 2022)],
  2022: [vejl(9866, 2021)],
  2021: [vejl(9737, 2020)],
  2020: [vejl(9922, 2019)],
  2019: [bkg(1232, 2018)],
  2018: [bkg(1157, 2017)],
  2017: [bkg(1273, 2016)],
  2016: [bkg(1220, 2015)],
  2015: [bkg(1114, 2014)],
  2014: [bkg(1151, 2013)],
  2013: [bkg(991, 2012)],
  2012: [bkg(1105, 2011)],
  2011: [bkg(1215, 2010)],
  2010: [bkg(1017, 2009)],
  2009: [bkg(1050, 2008)],
  2008: [bkg(1241, 2007)],
  2007: [bkg(1047, 2006)],
  2006: [bkg(989, 2005)],
  2005: [bkg(1033, 2004)],
};

export const kapitaliseringLinks: YearlyRetsinfoLinks = {
  2026: [vejl(10056, 2025)],
  2025: [vejl(10029, 2024)],
  2006: [bkg(1068, 2003)],
  2005: [bkg(1068, 2003)],
};

export const kapitaliseringSkadeFra2011Links: YearlyRetsinfoLinks = {
  2024: [vejl(9820, 2023), vejl(9376, 2024, '9376/2024')],
  2023: [vejl(10141, 2022)],
  2022: [vejl(9864, 2021)],
  2021: [vejl(9741, 2020)],
  2020: [vejl(9921, 2019)],
  2019: [bkg(1233, 2018)],
  2018: [bkg(1156, 2017)],
  2017: [bkg(1275, 2016)],
  2016: [bkg(1664, 2015)],
  2015: [bkg(1275, 2014), bkg(199, 2015, '199/2015')],
  2014: [bkg(1202, 2013)],
  2013: [bkg(990, 2012)],
  2012: [bkg(1358, 2011)],
  2011: [bkg(1220, 2010)],
};

export const kapitaliseringSkadeFoer2011Links: YearlyRetsinfoLinks = {
  2024: [vejl(9871, 2020), vejl(9376, 2024, '9376/2024')],
  2023: [vejl(9871, 2020)],
  2022: [vejl(9871, 2020)],
  2021: [vejl(9871, 2020)],
  2020: [bkg(1700, 2015)],
  2019: [bkg(1700, 2015)],
  2018: [bkg(1700, 2015)],
  2017: [bkg(1700, 2015)],
  2016: [bkg(1700, 2015)],
  2015: [bkg(1403, 2011), bkg(198, 2015, '198/2015')],
  2014: [bkg(1403, 2011)],
  2013: [bkg(1403, 2011)],
  2012: [bkg(1403, 2011)],
  2011: [bkg(1221, 2010)],
};

export const kapitaliseringSkadeFra2007Links: YearlyRetsinfoLinks = {
  2010: [bkg(1022, 2009)],
  2009: [bkg(1047, 2008), bkg(440, 2009, '440/2009')],
  2008: [bkg(1263, 2007)],
  2007: [bkg(678, 2007)],
};

export const kapitaliseringSkadeFoer2007Links: YearlyRetsinfoLinks = {
  2010: [bkg(449, 2009)],
  2009: [bkg(1068, 2003), bkg(449, 2009, '449/2009')],
  2008: [bkg(1068, 2003)],
  2007: [bkg(1068, 2003)],
};

export const friProcesReferenceLinks: YearlyRetsinfoLinks = {
  2026: [bkg(1360, 2025)],
  2025: [bkg(1338, 2024)],
  2024: [bkg(1521, 2023)],
  2023: [bkg(1479, 2022)],
  2022: [bkg(2124, 2021)],
  2021: [bkg(1840, 2020)],
  2020: [bkg(1504, 2019)],
  2019: [bkg(1372, 2018)],
  2018: [bkg(1462, 2017)],
  2017: [bkg(1671, 2016)],
  2016: [bkg(1435, 2015)],
  2015: [bkg(1270, 2014)],
  2014: [bkg(1245, 2013)],
  2013: [bkg(1084, 2012)],
  2012: [bkg(1153, 2011)],
  2011: [bkg(1428, 2010)],
  2010: [bkg(1236, 2009)],
  2009: [bkg(1116, 2008)],
  2008: [bkg(1468, 2007)],
  2007: [bkg(1295, 2006)],
  2006: [bkg(1097, 2005)],
  2005: [bkg(1116, 2004)],
};

export const reguleringssatsReferenceLinks: YearlyRetsinfoLinks = {
  2026: [bkg(1056, 2025)],
  2025: [bkg(983, 2024)],
  2024: [bkg(1101, 2023)],
  2023: [bkg(1204, 2022)],
  2022: [bkg(1713, 2021)],
  2021: [bkg(1210, 2020)],
  2020: [bkg(855, 2019)],
  2019: [bkg(1058, 2018)],
  2018: [bkg(1015, 2017)],
  2017: [bkg(1135, 2016)],
  2016: [bkg(988, 2015)],
  2015: [bkg(942, 2014)],
  2014: [bkg(1046, 2013)],
  2013: [bkg(870, 2012)],
  2012: [bkg(937, 2011)],
  2011: [bkg(1013, 2010)],
  2010: [bkg(809, 2009)],
  2009: [bkg(851, 2008)],
  2008: [bkg(1021, 2007)],
  2007: [bkg(874, 2006)],
  2006: [bkg(793, 2005)],
  2005: [bkg(877, 2004)],
};
