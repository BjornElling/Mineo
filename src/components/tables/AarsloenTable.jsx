import React from "react";
import { Box } from "@mui/material";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import TableAmountInput from "../inputs/table/TableAmountInput";
import TableIntegerInput from "../inputs/table/TableIntegerInput";
import TableYearInput from "../inputs/table/TableYearInput";
import TableWeekInput from "../inputs/table/TableWeekInput";
import TableDateInput from "../inputs/table/TableDateInput";

const AarsloenTable = ({ loenperiode, satser, tableData, onTableDataChange }) => {
  // Default tabeldata
  const defaultTableData = [
    { id: 0, col0: "", col1: "", col2: "", col3: "", col4: "", col5: "", col6: "", col10: "" },
    { id: 1, col0: "", col1: "", col2: "", col3: "", col4: "", col5: "", col6: "", col10: "" },
  ];

  // Intern state til visning under indtastning
  const [internalTableData, setInternalTableData] = React.useState(tableData || defaultTableData);

  // Synkroniser intern state med props når props ændres (fx ved genindlæsning)
  React.useEffect(() => {
    if (tableData) {
      setInternalTableData(tableData);
    }
  }, [tableData]);

  // Funktion til at gemme til persistence (kun ved blur)
  const persistTableData = onTableDataChange || (() => {});

  // State for sortering
  const [sortColumn, setSortColumn] = React.useState(null);
  const [sortDirection, setSortDirection] = React.useState("asc"); // 'asc' eller 'desc'

  // Refs til alle input-felter for tab-navigation
  const inputRefs = React.useRef({});

  /** -----------------------------------------------------------
   *  Funktion: procentstreng → decimaltal
   * ----------------------------------------------------------- */
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

  /** -----------------------------------------------------------
   *  Funktion: Formatér tal til dansk format (tusindtalsseparator og 2 decimaler)
   * ----------------------------------------------------------- */
  const formatNumber = (num) => {
    if (!num && num !== 0) return "";
    const rounded = Math.round(num * 100) / 100;
    const [int, dec] = rounded.toFixed(2).split(".");
    const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formatted},${dec}`;
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

  /** -----------------------------------------------------------
   *  Funktion: Sortér tabel efter kolonne
   * ----------------------------------------------------------- */
  const handleSort = React.useCallback(
    (columnIndex) => {
      const newDirection = sortColumn === columnIndex && sortDirection === "asc" ? "desc" : "asc";
      setSortColumn(columnIndex);
      setSortDirection(newDirection);

      const sorted = [...internalTableData].sort((a, b) => {
        const colKey = `col${columnIndex}`;
        let aVal = a[colKey] || "";
        let bVal = b[colKey] || "";

        // Hvis det er en berregnet kolonne (7, 8, 9, 11), beregn værdierne først
        if ([7, 8, 9, 11].includes(columnIndex)) {
          const aCalc = calculateRow(a);
          const bCalc = calculateRow(b);
          aVal = aCalc[colKey] || 0;
          bVal = bCalc[colKey] || 0;
        }

        // Konverter til tal hvis muligt
        const aNum = parseFloat(String(aVal).replace(/\./g, "").replace(",", "."));
        const bNum = parseFloat(String(bVal).replace(/\./g, "").replace(",", "."));

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return newDirection === "asc" ? aNum - bNum : bNum - aNum;
        }

        // Ellers sammenlign som strenge
        return newDirection === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });

      setInternalTableData(sorted);
      persistTableData(sorted);
    },
    [internalTableData, sortColumn, sortDirection, calculateRow, persistTableData]
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

  /** -----------------------------------------------------------
   *  Funktion: Håndter onBlur (gem saneret værdi til persistence)
   * ----------------------------------------------------------- */
  const handleFieldBlur = React.useCallback((rowId, colKey, value) => {
    // Ved blur: opdater med den sanerede værdi og gem til persistence
    const newData = internalTableData.map((row) =>
      row.id === rowId ? { ...row, [colKey]: value } : row
    );
    setInternalTableData(newData);
    persistTableData(newData);
  }, [internalTableData, persistTableData]);

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

  /** -----------------------------------------------------------
   *  Rendering
   * ----------------------------------------------------------- */
  const headers = getHeaders();

  return (
    <Box sx={{ overflow: "auto" }}>
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
                <td style={{ padding: 0, border: "1px solid #e0e0e0", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {loenperiode === "maaned" && (
                    <TableIntegerInput
                      key={`${row.id}-col0-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-0`] = el)}
                      value={row.col0}
                      onChange={(e) => handleInputChange(row.id, "col0", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col0", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 0)}
                      minValue={1}
                      maxValue={12}
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                  {loenperiode === "uge" && (
                    <TableWeekInput
                      key={`${row.id}-col0-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-0`] = el)}
                      value={row.col0}
                      onChange={(e) => handleInputChange(row.id, "col0", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col0", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 0)}
                      minYear={2005}
                      maxYear={2030}
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                  {loenperiode === "dag" && (
                    <TableDateInput
                      key={`${row.id}-col0-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-0`] = el)}
                      value={row.col0}
                      onChange={(e) => handleInputChange(row.id, "col0", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col0", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 0)}
                      minDate="2005-01-01"
                      maxDate={row.col1 && row.col1.length === 10 ? row.col1.split("-").reverse().join("-") : "2030-12-31"}
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                </td>

                {/* Kolonne 1: År/Uge til/Dato til */}
                <td style={{ padding: 0, border: "1px solid #e0e0e0", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {loenperiode === "maaned" && (
                    <TableYearInput
                      key={`${row.id}-col1-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-1`] = el)}
                      value={row.col1}
                      onChange={(e) => handleInputChange(row.id, "col1", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col1", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 1)}
                      minYear={2005}
                      maxYear={2030}
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                  {loenperiode === "uge" && (
                    <TableWeekInput
                      key={`${row.id}-col1-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-1`] = el)}
                      value={row.col1}
                      onChange={(e) => handleInputChange(row.id, "col1", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col1", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 1)}
                      minYear={2005}
                      maxYear={2030}
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                  {loenperiode === "dag" && (
                    <TableDateInput
                      key={`${row.id}-col1-${loenperiode}`}
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-1`] = el)}
                      value={row.col1}
                      onChange={(e) => handleInputChange(row.id, "col1", e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, "col1", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, 1)}
                      minDate={row.col0 && row.col0.length === 10 ? row.col0.split("-").reverse().join("-") : "2005-01-01"}
                      maxDate="2030-12-31"
                      sx={{ fontSize: "11px" }}
                    />
                  )}
                </td>

                {/* Kolonne 2-6: Lønposter */}
                {[2, 3, 4, 5, 6].map((colIdx) => (
                  <td key={colIdx} style={{ padding: 0, border: "1px solid #e0e0e0", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <TableAmountInput
                      inputRef={(el) => (inputRefs.current[`${rowIdx}-${colIdx}`] = el)}
                      value={row[`col${colIdx}`]}
                      onChange={(e) => handleInputChange(row.id, `col${colIdx}`, e.target.value)}
                      onBlur={(e) => handleFieldBlur(row.id, `col${colIdx}`, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
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
                <td style={{ padding: 0, border: "1px solid #e0e0e0", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <TableAmountInput
                    inputRef={(el) => (inputRefs.current[`${rowIdx}-10`] = el)}
                    value={row.col10}
                    onChange={(e) => handleInputChange(row.id, "col10", e.target.value)}
                    onBlur={(e) => handleFieldBlur(row.id, "col10", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, rowIdx, 10)}
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
export default AarsloenTable;
