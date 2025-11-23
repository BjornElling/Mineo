import { convertFromFileFormat, convertToFileFormat } from '../components/tables/AarsloenTable';

/**
 * Konverter årsløn-data før gemning til .eo fil
 *
 * Konverterer tableData fra fuldt internt format (col0_maaned, col0_uge, col0_dag)
 * til fil-format med kun de aktive kolonner (col0, col1) baseret på loenperiode
 *
 * @param {Object} aarslonData - Data fra 'aarslon' sektion i sessionStorage
 * @returns {Object} Konverteret data klar til .eo fil
 */
export const convertAarslonForFile = (aarslonData) => {
  if (!aarslonData) return aarslonData;

  const { tableData, loenperiode, ...rest } = aarslonData;

  // Hvis der ikke er tableData, returner uændret
  if (!tableData || !Array.isArray(tableData)) {
    return aarslonData;
  }

  // Konverter tableData til fil-format (kun aktive kolonner)
  const convertedTableData = convertToFileFormat(tableData, loenperiode || 'maaned');

  return {
    ...rest,
    loenperiode,
    tableData: convertedTableData,
  };
};

/**
 * Konverter årsløn-data efter indlæsning fra .eo fil
 *
 * Konverterer tableData fra fil-format (col0, col1)
 * til fuldt internt format (col0_maaned, col0_uge, col0_dag)
 *
 * @param {Object} aarslonData - Data fra .eo fil
 * @returns {Object} Konverteret data klar til sessionStorage
 */
export const convertAarslonFromFile = (aarslonData) => {
  if (!aarslonData) return aarslonData;

  const { tableData, loenperiode, ...rest } = aarslonData;

  // Hvis der ikke er tableData, returner uændret
  if (!tableData || !Array.isArray(tableData)) {
    return aarslonData;
  }

  // Konverter tableData fra fil-format til internt format
  const convertedTableData = convertFromFileFormat(tableData, loenperiode || 'maaned');

  return {
    ...rest,
    loenperiode,
    tableData: convertedTableData,
  };
};
