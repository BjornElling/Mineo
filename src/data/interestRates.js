/**
 * Rentesatser hentet fra tidligere Python-projekt.
 *
 * Filen eksporterer to datasæt:
 * - referenceRates: Nationalbankens udlånsrente (nyeste først)
 * - surchargeRates: Tillægssats jf. renteloven
 */

// Dato-afgrænsninger for renteberegning
export const MIN_CALCULATION_DATE = '2005-01-01'; // Tidligste dato for renteberegning
export const CURRENT_YEAR = new Date().getFullYear(); // Nuværende år (dynamisk)
export const MAX_CALCULATION_YEAR = CURRENT_YEAR + 5; // Maksimalt 5 år frem i tiden

export const referenceRates = [
  { effectiveDate: '01-07-2025', rate: '1,75 %' },
  { effectiveDate: '01-01-2025', rate: '2,75 %' },
  { effectiveDate: '01-07-2024', rate: '3,50 %' },
  { effectiveDate: '01-01-2024', rate: '3,75 %' },
  { effectiveDate: '01-07-2023', rate: '3,25 %' },
  { effectiveDate: '01-01-2023', rate: '1,90 %' },
  { effectiveDate: '01-07-2022', rate: '-0,45 %' },
  { effectiveDate: '01-01-2022', rate: '-0,45 %' },
  { effectiveDate: '01-07-2021', rate: '-0,35 %' },
  { effectiveDate: '01-01-2021', rate: '0,05 %' },
  { effectiveDate: '01-07-2020', rate: '0,05 %' },
  { effectiveDate: '01-01-2020', rate: '0,05 %' },
  { effectiveDate: '01-07-2019', rate: '0,05 %' },
  { effectiveDate: '01-01-2019', rate: '0,05 %' },
  { effectiveDate: '01-07-2018', rate: '0,05 %' },
  { effectiveDate: '01-01-2018', rate: '0,05 %' },
  { effectiveDate: '01-07-2017', rate: '0,05 %' },
  { effectiveDate: '01-01-2017', rate: '0,05 %' },
  { effectiveDate: '01-07-2016', rate: '0,05 %' },
  { effectiveDate: '01-01-2016', rate: '0,05 %' },
  { effectiveDate: '01-07-2015', rate: '0,05 %' },
  { effectiveDate: '01-01-2015', rate: '0,20 %' },
  { effectiveDate: '01-07-2014', rate: '0,20 %' },
  { effectiveDate: '01-01-2014', rate: '0,20 %' },
  { effectiveDate: '01-07-2013', rate: '0,20 %' },
  { effectiveDate: '01-01-2013', rate: '0,20 %' },
  { effectiveDate: '01-07-2012', rate: '0,45 %' },
  { effectiveDate: '01-01-2012', rate: '0,70 %' },
  { effectiveDate: '01-07-2011', rate: '1,30 %' },
  { effectiveDate: '01-01-2011', rate: '1,05 %' },
  { effectiveDate: '01-07-2010', rate: '1,05 %' },
  { effectiveDate: '01-01-2010', rate: '1,20 %' },
  { effectiveDate: '01-07-2009', rate: '1,55 %' },
  { effectiveDate: '01-01-2009', rate: '3,75 %' },
  { effectiveDate: '01-07-2008', rate: '4,35 %' },
  { effectiveDate: '01-01-2008', rate: '4,25 %' },
  { effectiveDate: '01-07-2007', rate: '4,25 %' },
  { effectiveDate: '01-01-2007', rate: '3,75 %' },
  { effectiveDate: '01-07-2006', rate: '3,00 %' },
  { effectiveDate: '01-01-2006', rate: '2,40 %' },
  { effectiveDate: '01-07-2005', rate: '2,15 %' },
  { effectiveDate: '01-01-2005', rate: '2,15 %' },
];

export const surchargeRates = [
  { effectiveDate: '01-03-2013', rate: '8,00 %' },
  { effectiveDate: '01-08-2002', rate: '7,00 %' },
];

export const getInterestRates = () => ({
  referenceRates,
  surchargeRates,
});

export default {
  referenceRates,
  surchargeRates,
};
