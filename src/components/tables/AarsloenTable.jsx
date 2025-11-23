import React from "react";
import { Box } from "@mui/material";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import TableAmountInput from "../inputs/table/TableAmountInput";
import TableIntegerInput from "../inputs/table/TableIntegerInput";
import TableYearInput from "../inputs/table/TableYearInput";
import TableWeekInput from "../inputs/table/TableWeekInput";
import TableDateInput from "../inputs/table/TableDateInput";
import { MIN_YEAR, MAX_YEAR, MIN_SKADESDATO } from "../../config/dateRanges";

// Initial tom række - indeholder nu ALLE periodetyper
const initialRow = {
  id: null,
  // Månedsløn
  col0_maaned: "",
  col1_maaned: "",
  // Ugeløn
  col0_uge: "",
  col1_uge: "",
  // Dagsløn
  col0_dag: "",
  col1_dag: "",
  // Fælles kolonner (lønposter og ATP)
  col2: "",
  col3: "",
  col4: "",
  col5: "",
  col6: "",
  col10: ""
};

// Tjek om en række er tom (tjekker ALLE kolonner)
const isRowEmpty = (row) => {
  return !row.col0_maaned && !row.col1_maaned &&
         !row.col0_uge && !row.col1_uge &&
         !row.col0_dag && !row.col1_dag &&
         !row.col2 && !row.col3 && !row.col4 && !row.col5 && !row.col6 && !row.col10;
};

// Generer unikt ID
let rowIdCounter = 0;
const generateRowId = () => {
  rowIdCounter += 1;
  return `row_${Date.now()}_${rowIdCounter}`;
};

/**
 * Konverter tableData fra .eo-fil format (col0, col1) til internt format (col0_maaned, col0_uge, etc.)
 *
 * VIGTIGT: Denne funktion bruges KUN ved indlæsning fra .eo fil!
 * SessionStorage gemmer data i fuldt internt format, så denne konvertering er ikke nødvendig der.
 *
 * @param {Array} fileData - Data i .eo fil-format (col0, col1)
 * @param {string} loenperiode - Aktuel lønperiode fra filen ('maaned', 'uge', 'dag')
 * @param {Array} existingData - Eksisterende intern data (optional) - bruges til merge
 */
const convertFromFileFormat = (fileData, loenperiode, existingData = null) => {
  if (!fileData || !Array.isArray(fileData)) return null;

  return fileData.map((row, index) => {
    // Start med initialRow eller eksisterende row (for at bevare andre periode-kolonner)
    const baseRow = existingData && existingData[index]
      ? { ...existingData[index] }
      : { ...initialRow };

    return {
      ...baseRow,
      id: row.id || baseRow.id || generateRowId(),
      // Map col0 og col1 til den rigtige periode-kolonne (overskriver kun denne periode)
      [`col0_${loenperiode}`]: row.col0 || "",
      [`col1_${loenperiode}`]: row.col1 || "",
      // Kopier de fælles kolonner
      col2: row.col2 || "",
      col3: row.col3 || "",
      col4: row.col4 || "",
      col5: row.col5 || "",
      col6: row.col6 || "",
      col10: row.col10 || "",
    };
  });
};

/**
 * Konverter tableData fra internt format til .eo-fil format
 *
 * VIGTIGT: Denne funktion bruges KUN ved gemning til .eo fil!
 * Den konverterer fuldt internt format til fil-format med kun aktive kolonner.
 * SessionStorage modtager data i fuldt internt format uden denne konvertering.
 *
 * @param {Array} internalData - Data i fuldt internt format
 * @param {string} loenperiode - Aktuel lønperiode ('maaned', 'uge', 'dag')
 */
const convertToFileFormat = (internalData, loenperiode) => {
  if (!internalData || !Array.isArray(internalData)) return [];

  return internalData.map(row => ({
    id: row.id,
    col0: row[`col0_${loenperiode}`] || "",
    col1: row[`col1_${loenperiode}`] || "",
    col2: row.col2 || "",
    col3: row.col3 || "",
    col4: row.col4 || "",
    col5: row.col5 || "",
    col6: row.col6 || "",
    col10: row.col10 || "",
  }));
};

const AarsloenTable = ({ loenperiode, satser, tableData, onTableDataChange }) => {
  // Default tabeldata
  const defaultTableData = [
    { ...initialRow, id: generateRowId() }
  ];

  // Wrapper funktion til persistence
  // VIGTIGT: Vi gemmer FULDT format til sessionStorage (alle periode-kolonner)
  // Kun ved gem til .eo fil skal vi bruge convertToFileFormat
  const persistTableData = React.useCallback((internalData) => {
    if (!onTableDataChange) return;

    // Gem internt format DIREKTE til sessionStorage (bevarer alle periode-kolonner)
    onTableDataChange(internalData);
  }, [onTableDataChange]);

  // Automatisk håndtering af rækker ved props-ændringer
  const manageRows = React.useCallback((rows) => {
    let newRows = [...rows];

    // Fjern tomme rækker (bortset fra den sidste)
    newRows = newRows.filter((row, index) => {
      const isEmpty = isRowEmpty(row);
      const isLastRow = index === newRows.length - 1;
      return !isEmpty || isLastRow;
    });

    // Sørg for at der altid er mindst én række
    if (newRows.length === 0) {
      newRows = [{ ...initialRow, id: generateRowId() }];
    }

    // Tjek om den sidste række er tom - hvis ikke, tilføj en ny tom række
    const lastRow = newRows[newRows.length - 1];
    if (!isRowEmpty(lastRow)) {
      newRows.push({ ...initialRow, id: generateRowId() });
    }

    return newRows;
  }, []);

  // Intern state til visning under indtastning
  const [internalTableData, setInternalTableData] = React.useState(() => {
    // Hvis der er tableData fra props, brug det direkte (er nu i fuldt format fra sessionStorage)
    if (tableData && tableData.length > 0) {
      return manageRows(tableData);
    }
    return manageRows(defaultTableData);
  });

  // Synkroniser intern state med props når tableData ændres
  React.useEffect(() => {
    if (tableData && tableData.length > 0) {
      // tableData er nu i fuldt internt format fra sessionStorage
      const managedData = manageRows(tableData);
      setInternalTableData(managedData);
    }
  }, [tableData, manageRows]);

  // Håndter rækkehåndtering når loenperiode ændres
  React.useEffect(() => {
    setInternalTableData((currentData) => {
      const managedData = manageRows(currentData);
      persistTableData(managedData);
      return managedData;
    });
  }, [loenperiode, manageRows, persistTableData]);

  // State for sortering
  const [sortColumn, setSortColumn] = React.useState(null);
  const [sortDirection, setSortDirection] = React.useState("asc");

  // State for fejl-highlight
  const [errorCell, setErrorCell] = React.useState(null);

  // Refs til alle input-felter
  const inputRefs = React.useRef({});

  // Track fejl-status for alle celler
  const cellErrors = React.useRef({});

  /**
   * Callback til at registrere fejl-status fra input-komponenter
   */
  const handleErrorChange = React.useCallback((rowIdx, colIdx, hasError) => {
    const key = `${rowIdx}-${colIdx}`;
    if (hasError) {
      cellErrors.current[key] = true;
    } else {
      delete cellErrors.current[key];
    }
  }, []);

  /**
   * Konverter procentstreng til decimaltal
   */
  const pctToDecimal = React.useCallback((pct) => {
    if (!pct) return 0;
    const clean = pct.replace("%", "").replace(",", ".").trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num / 100;
  }, []);

  /** -----------------------------------------------------------
   *  Funktion: Beregn værdier for en række
   * ----------------------------------------------------------- */
  const calculateRow = React.useCallback(
    (row) => {
      const ferie = pctToDecimal(satser?.ferie);
      const frit = pctToDecimal(satser?.fritvalg);
      const sh = pctToDecimal(satser?.sh);
      const bede = pctToDecimal(satser?.bededag);
      const pens = pctToDecimal(satser?.pension);

      const totalPct = ferie + frit + sh + bede;

      // Parse lønposter (col2-col6) som tal
      const parseValue = (val) => {
        if (!val) return 0;
        const clean = String(val).replace(/\./g, "").replace(",", ".");
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
      };

      const lon1 = parseValue(row.col2);
      const lon2 = parseValue(row.col3);
      const lon3 = parseValue(row.col4);
      const lon4 = parseValue(row.col5);
      const lon5 = parseValue(row.col6);
      const atp = parseValue(row.col10);

      // Beregninger
      const ferieberet = lon1 + lon2 + lon3 + lon4 + lon5; // Kolonne 7
      const tillaeg = totalPct > 0 ? ferieberet * totalPct : 0; // Kolonne 8
      const pension = pens > 0 ? (ferieberet + tillaeg) * pens : 0; // Kolonne 9
      const samlet = ferieberet + tillaeg + pension + atp; // Kolonne 11

      return {
        col7: ferieberet,
        col8: tillaeg,
        col9: pension,
        col11: samlet,
      };
    },
    [satser, pctToDecimal]
  );

  /**
   * Formatér tal til dansk format (tusindtalsseparator og 2 decimaler)
   */
  const formatNumber = (num) => {
    if (!num && num !== 0) return "";
    const rounded = Math.round(num * 100) / 100;
    const [int, dec] = rounded.toFixed(2).split(".");
    const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formatted},${dec}`;
  };

  /**
   * Konverter dansk dato (dd-mm-åååå) til ISO-format (åååå-mm-dd)
   */
  const toISODate = (danishDate) => {
    if (!danishDate || danishDate.length !== 10) return null;
    const parts = danishDate.split("-");
    if (parts.length !== 3) return null;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  /** -----------------------------------------------------------
   *  Funktion: Hent kolonneoverskrifter baseret på lønperiode
   * ----------------------------------------------------------- */
  const getHeaders = React.useCallback(() => {
    const PERIOD = {
      maaned: ["Måned", "År"],
      uge: ["Uge fra", "Uge til"],
      dag: ["Dato fra", "Dato til"],
    };

    return [
      ...PERIOD[loenperiode],
      "Lønpost 1",
      "Lønpost 2",
      "Lønpost 3",
      "Lønpost 4",
      "Lønpost 5",
      "Ferieberet.\nløn",
      "FP/FV/SH/SO/St.B.",
      "Arb.g.\nPension",
      "ATP",
      "Samlet løn",
    ];
  }, [loenperiode]);

  /**
   * Tjek om der er fejl i nogen af cellerne
   */
  const checkForErrors = React.useCallback(() => {
    for (const key in cellErrors.current) {
      if (cellErrors.current[key]) {
        const [rowIdx, colIdx] = key.split('-').map(Number);
        return { row: rowIdx, col: colIdx };
      }
    }
    return null;
  }, []);

  /**
   * Flash fejl-celle visuelt
   */
  const flashErrorCell = React.useCallback((rowIdx, colIdx) => {
    const ref = inputRefs.current[`${rowIdx}-${colIdx}`];
    if (!ref) return;

    setErrorCell({ row: rowIdx, col: colIdx });

    ref.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      setErrorCell(null);
    }, 2000);
  }, []);

  /**
   * Sortér tabel efter kolonne
   */
  const handleSort = React.useCallback(
    (columnIndex) => {
      const errorLocation = checkForErrors();
      if (errorLocation) {
        console.warn(`Sortering blokeret - ret først fejl i række ${errorLocation.row + 1}, kolonne ${errorLocation.col}`);
        flashErrorCell(errorLocation.row, errorLocation.col);
        return;
      }

      const newDirection = sortColumn === columnIndex && sortDirection === "asc" ? "desc" : "asc";
      setSortColumn(columnIndex);
      setSortDirection(newDirection);

      setInternalTableData((currentData) => {
        const sorted = [...currentData].sort((a, b) => {
          let aVal, bVal;

          // Håndter beregnede kolonner først (de findes ikke i row-data)
          if ([7, 8, 9, 11].includes(columnIndex)) {
            const aCalc = calculateRow(a);
            const bCalc = calculateRow(b);
            aVal = aCalc[`col${columnIndex}`] ?? 0;
            bVal = bCalc[`col${columnIndex}`] ?? 0;
          } else if (columnIndex === 0 || columnIndex === 1) {
            // For kolonne 0 og 1: brug den periode-specifikke kolonne
            const periodKey = `col${columnIndex}_${loenperiode}`;
            aVal = a[periodKey] || "";
            bVal = b[periodKey] || "";
          } else {
            // For de andre kolonner (2-6, 10): brug standard colKey
            const colKey = `col${columnIndex}`;
            aVal = a[colKey] || "";
            bVal = b[colKey] || "";
          }

          const aEmpty = !aVal || String(aVal).trim() === "";
          const bEmpty = !bVal || String(bVal).trim() === "";

          if (aEmpty && bEmpty) return 0;
          if (aEmpty) return 1;
          if (bEmpty) return -1;

          if (columnIndex === 0 || columnIndex === 1) {
            if (loenperiode === "dag") {
              const parseDate = (dateStr) => {
                if (!dateStr) return "";
                const parts = dateStr.split("-");
                if (parts.length === 3) {
                  return `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                return "";
              };
              aVal = parseDate(aVal);
              bVal = parseDate(bVal);
              return newDirection === "asc"
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
            }
            else if (loenperiode === "uge") {
              const parseWeek = (weekStr) => {
                if (!weekStr) return "";
                const parts = weekStr.split("/");
                if (parts.length === 2) {
                  return `${parts[1]}-${parts[0].padStart(2, "0")}`;
                }
                return "";
              };
              aVal = parseWeek(aVal);
              bVal = parseWeek(bVal);
              return newDirection === "asc"
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
            }
          }

          const aNum = parseFloat(String(aVal).replace(/\./g, "").replace(",", "."));
          const bNum = parseFloat(String(bVal).replace(/\./g, "").replace(",", "."));

          if (!isNaN(aNum) && !isNaN(bNum)) {
            return newDirection === "asc" ? aNum - bNum : bNum - aNum;
          }

          return newDirection === "asc"
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
        });

        setTimeout(() => persistTableData(sorted), 0);
        return sorted;
      });
    },
    [sortColumn, sortDirection, calculateRow, persistTableData, loenperiode, getHeaders, checkForErrors, flashErrorCell]
  );

  /** -----------------------------------------------------------
   *  Funktion: Håndter ændringer i input-felter (kun lokal state)
   * ----------------------------------------------------------- */
  const handleInputChange = React.useCallback((rowId, colKey, value) => {
    // Opdater kun intern state under indtastning - gem til persistence sker ved blur
    setInternalTableData((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [colKey]: value } : row))
    );
  }, []);

  /**
   * Håndter onBlur (gem saneret værdi til persistence og håndter rækker)
   */
  const handleFieldBlur = React.useCallback((rowId, colKey, value) => {
    // Ved blur: opdater med den sanerede værdi
    let newData = internalTableData.map((row) =>
      row.id === rowId ? { ...row, [colKey]: value } : row
    );

    // Håndter automatisk rækkehåndtering
    newData = manageRows(newData);

    setInternalTableData(newData);
    persistTableData(newData);
  }, [internalTableData, persistTableData, manageRows]);

  /** -----------------------------------------------------------
   *  Funktion: Tab-navigation
   * ----------------------------------------------------------- */
  const handleKeyDown = React.useCallback(
    (evt, rowIndex, colIndex) => {
      if (evt.key !== "Tab") return;

      evt.preventDefault();
      evt.stopPropagation();

      // Redigerbare kolonner (springer readonly kolonner 7, 8, 9, 11 over)
      const editableColumns = [0, 1, 2, 3, 4, 5, 6, 10];

      const findNextEditable = (currentRow, currentCol, forward) => {
        let nextRow = currentRow;
        let nextCol = currentCol;

        if (forward) {
          // Find næste redigerbare kolonne i samme række
          const currentEditableIndex = editableColumns.indexOf(currentCol);
          if (currentEditableIndex < editableColumns.length - 1) {
            // Gå til næste kolonne i samme række
            nextCol = editableColumns[currentEditableIndex + 1];
          } else {
            // Gå til første kolonne i næste række
            nextRow = (currentRow + 1) % internalTableData.length;
            nextCol = editableColumns[0];
          }
        } else {
          // Baglæns
          const currentEditableIndex = editableColumns.indexOf(currentCol);
          if (currentEditableIndex > 0) {
            // Gå til forrige kolonne i samme række
            nextCol = editableColumns[currentEditableIndex - 1];
          } else {
            // Gå til sidste kolonne i forrige række
            nextRow = (currentRow - 1 + internalTableData.length) % internalTableData.length;
            nextCol = editableColumns[editableColumns.length - 1];
          }
        }

        return [nextRow, nextCol];
      };

      const [nextRow, nextCol] = findNextEditable(rowIndex, colIndex, !evt.shiftKey);
      const nextRef = inputRefs.current[`${nextRow}-${nextCol}`];

      if (nextRef) {
        // Brug setTimeout for at sikre fokus sker efter event er helt færdig
        setTimeout(() => {
          nextRef.focus();
          nextRef.select();
        }, 0);
      }
    },
    [internalTableData]
  );

  /**
   * Generer cell-styling med fejl-animation
   */
  const getCellStyle = (rowIdx, colIdx, baseStyle = {}) => ({
    ...baseStyle,
    animation: errorCell?.row === rowIdx && errorCell?.col === colIdx
      ? "errorFlash 0.5s ease-in-out 3"
      : "none"
  });

  /** -----------------------------------------------------------
   *  Rendering
   * ----------------------------------------------------------- */
  const headers = getHeaders();

  return (
    <Box sx={{ overflow: "auto" }}>
      <style>
        {`
          @keyframes errorFlash {
            0%, 100% { background-color: transparent; }
            50% { background-color: rgba(211, 47, 47, 0.2); }
          }
        `}
      </style>
      <table
        style={{
          borderCollapse: "collapse",
          fontSize: "11px",
          width: "930px",
          tableLayout: "fixed",
        }}
      >
        {/* Definer faste kolonnebredder - alle 77.5px */}
        <colgroup>
          <col style={{ width: "77.5px" }} />
          <col style={{ width: "77.5px" }} />
          <col style={{ width: "77.5px" }} />
          <col style={{ width: "77.5px" }} />
          <col style={{ width: "77.5px" }} />
          <col style={{ width: "77.5px" }} />
          <col style={{ width: "77.5px" }} />
          <col style={{ width: "77.5px" }} />
          <col style={{ width: "77.5px" }} />
          <col style={{ width: "77.5px" }} />
          <col style={{ width: "77.5px" }} />
          <col style={{ width: "77.5px" }} />
        </colgroup>

        {/* Header række */}
        <thead>
          <tr style={{ backgroundColor: "#e0e0e0" }}>
            {headers.map((header, idx) => (
              <th
                key={idx}
                style={{
                  padding: "8px 4px",
                  border: "1px solid #e0e0e0",
                  fontWeight: "bold",
                  textAlign: "center",
                  width: "100px",
                  cursor: "pointer",
                  whiteSpace: "pre-line",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  position: "relative",
                }}
                onClick={() => handleSort(idx)}
              >
                {header}
                <SwapVertIcon
                  sx={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    fontSize: "14px",
                    color: sortColumn === idx ? "#1976d2" : "rgba(0, 0, 0, 0.3)",
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>

        {/* Data rækker */}
        <tbody>
          {internalTableData.map((row, rowIdx) => {
            const calculated = calculateRow(row);

            return (
              <tr
                key={row.id}
                style={{
                  backgroundColor: rowIdx % 2 === 0 ? "#ffffff" : "#f5f5f5",
                }}
              >
                {/* Kolonne 0: Måned/Uge fra/Dato fra */}
                <td style={getCellStyle(rowIdx, 0, {
                  padding: 0,
                  border: "1px solid #e0e0e0",
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                })}>
                  {loenperiode === "maaned" && (
                    <TableIntegerInput
                      key={`${row.id}-col0-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-0`] = el)}
                      value={row.col0_maaned}
                      onChange={(e) => handleInputChange(row.id, "col0_maaned", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col0_maaned", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 0)}
                      onErrorChange={(hasError) => handleErrorChange(rowIdx, 0, hasError)}
                      minValue={1}
                      maxValue={12}
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                  {loenperiode === "uge" && (
                    <TableWeekInput
                      key={`${row.id}-col0-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-0`] = el)}
                      value={row.col0_uge}
                      onChange={(e) => handleInputChange(row.id, "col0_uge", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col0_uge", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 0)}
                      onErrorChange={(hasError) => handleErrorChange(rowIdx, 0, hasError)}
                      minYear={MIN_YEAR}
                      maxYear={MAX_YEAR}
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                  {loenperiode === "dag" && (
                    <TableDateInput
                      key={`${row.id}-col0-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-0`] = el)}
                      value={row.col0_dag}
                      onChange={(e) => handleInputChange(row.id, "col0_dag", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col0_dag", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 0)}
                      onErrorChange={(hasError) => handleErrorChange(rowIdx, 0, hasError)}
                      minDate={MIN_SKADESDATO}
                      maxDate={toISODate(row.col1_dag) || `${MAX_YEAR}-12-31`}
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                </td>

                {/* Kolonne 1: År/Uge til/Dato til */}
                <td style={getCellStyle(rowIdx, 1, {
                  padding: 0,
                  border: "1px solid #e0e0e0",
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                })}>
                  {loenperiode === "maaned" && (
                    <TableYearInput
                      key={`${row.id}-col1-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-1`] = el)}
                      value={row.col1_maaned}
                      onChange={(e) => handleInputChange(row.id, "col1_maaned", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col1_maaned", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 1)}
                      onErrorChange={(hasError) => handleErrorChange(rowIdx, 1, hasError)}
                      minYear={MIN_YEAR}
                      maxYear={MAX_YEAR}
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                  {loenperiode === "uge" && (
                    <TableWeekInput
                      key={`${row.id}-col1-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-1`] = el)}
                      value={row.col1_uge}
                      onChange={(e) => handleInputChange(row.id, "col1_uge", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col1_uge", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 1)}
                      onErrorChange={(hasError) => handleErrorChange(rowIdx, 1, hasError)}
                      minYear={MIN_YEAR}
                      maxYear={MAX_YEAR}
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                  {loenperiode === "dag" && (
                    <TableDateInput
                      key={`${row.id}-col1-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-1`] = el)}
                      value={row.col1_dag}
                      onChange={(e) => handleInputChange(row.id, "col1_dag", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col1_dag", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 1)}
                      onErrorChange={(hasError) => handleErrorChange(rowIdx, 1, hasError)}
                      minDate={toISODate(row.col0_dag) || MIN_SKADESDATO}
                      maxDate={`${MAX_YEAR}-12-31`}
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                </td>

                {/* Kolonne 2-6: Lønposter */}
                {[2, 3, 4, 5, 6].map((colIdx) => (
                  <td key={colIdx} style={getCellStyle(rowIdx, colIdx, {
                    padding: 0,
                    border: "1px solid #e0e0e0",
                    textAlign: "right",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  })}>
                    <TableAmountInput
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-${colIdx}`] = el)}
                      value={row[`col${colIdx}`]}
                      onChange={(e) => handleInputChange(row.id, `col${colIdx}`, e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, `col${colIdx}`, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                      onErrorChange={(hasError) => handleErrorChange(rowIdx, colIdx, hasError)}
                      placeholder=""
                      sx={{ fontSize: "11px" }}
                    />
                  </td>
                ))}

                {/* Kolonne 7: Ferieberettiget løn (BEREGNET) */}
                <td
                  style={{
                    padding: "4px",
                    border: "1px solid #e0e0e0",
                    textAlign: "right",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: calculated.col7 === 0 ? "rgba(0, 0, 0, 0.4)" : "inherit",
                  }}
                >
                  {formatNumber(calculated.col7)}
                </td>

                {/* Kolonne 8: Tillæg (BEREGNET) */}
                <td
                  style={{
                    padding: "4px",
                    border: "1px solid #e0e0e0",
                    textAlign: "right",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: calculated.col8 === 0 ? "rgba(0, 0, 0, 0.4)" : "inherit",
                  }}
                >
                  {formatNumber(calculated.col8)}
                </td>

                {/* Kolonne 9: Pension (BEREGNET) */}
                <td
                  style={{
                    padding: "4px",
                    border: "1px solid #e0e0e0",
                    textAlign: "right",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: calculated.col9 === 0 ? "rgba(0, 0, 0, 0.4)" : "inherit",
                  }}
                >
                  {formatNumber(calculated.col9)}
                </td>

                {/* Kolonne 10: ATP */}
                <td style={getCellStyle(rowIdx, 10, {
                  padding: 0,
                  border: "1px solid #e0e0e0",
                  textAlign: "right",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                })}>
                  <TableAmountInput
                    inputRef={(el) => (inputRefs.current[`${rowIdx}-10`] = el)}
                    value={row.col10}
                    onChange={(e) => handleInputChange(row.id, "col10", e.target.value)}
                    onBlur={(e) => handleFieldBlur(row.id, "col10", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, rowIdx, 10)}
                    onErrorChange={(hasError) => handleErrorChange(rowIdx, 10, hasError)}
                    placeholder=""
                    sx={{ fontSize: "11px" }}
                  />
                </td>

                {/* Kolonne 11: Samlet løn (BEREGNET) */}
                <td
                  style={{
                    padding: "4px",
                    border: "1px solid #e0e0e0",
                    textAlign: "right",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: calculated.col11 === 0 ? "rgba(0, 0, 0, 0.4)" : "inherit",
                  }}
                >
                  {formatNumber(calculated.col11)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Box>
  );
};

AarsloenTable.displayName = "AarsloenTable";

// Eksporter konverteringsfunktioner til brug ved gem/hent .eo fil
export { convertFromFileFormat, convertToFileFormat };

export default AarsloenTable;
