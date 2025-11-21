import React from "react";
import { Box } from "@mui/material";
import SwapVertIcon from "@mui/icons-material/SwapVert";

const AarsloenTable = ({ loenperiode, satser }) => {
  // State for tabeldata (2 rækker til at starte med)
  const [tableData, setTableData] = React.useState([
    { id: 0, col0: "", col1: "", col2: "", col3: "", col4: "", col5: "", col6: "", col10: "" },
    { id: 1, col0: "", col1: "", col2: "", col3: "", col4: "", col5: "", col6: "", col10: "" },
  ]);

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

      const sorted = [...tableData].sort((a, b) => {
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

      setTableData(sorted);
    },
    [tableData, sortColumn, sortDirection, calculateRow]
  );

  /** -----------------------------------------------------------
   *  Funktion: Håndter ændringer i input-felter
   * ----------------------------------------------------------- */
  const handleInputChange = React.useCallback((rowId, colKey, value) => {
    setTableData((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [colKey]: value } : row))
    );
  }, []);

  /** -----------------------------------------------------------
   *  Funktion: Håndter onBlur (trigger beregninger)
   * ----------------------------------------------------------- */
  const handleInputBlur = React.useCallback(() => {
    // Trigger re-render for at opdatere beregninger
    setTableData((prev) => [...prev]);
  }, []);

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
            nextRow = (currentRow + 1) % tableData.length;
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
            nextRow = (currentRow - 1 + tableData.length) % tableData.length;
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
    [tableData]
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
                }}
                onClick={() => handleSort(idx)}
              >
                {header}
                <SwapVertIcon
                  sx={{
                    verticalAlign: "middle",
                    ml: 0.5,
                    opacity: sortColumn === idx ? 1 : 0.3,
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>

        {/* Data rækker */}
        <tbody>
          {tableData.map((row, rowIdx) => {
            const calculated = calculateRow(row);

            return (
              <tr
                key={row.id}
                style={{
                  backgroundColor: rowIdx % 2 === 0 ? "#ffffff" : "#f5f5f5",
                }}
              >
                {/* Kolonne 0 */}
                <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "center", overflow: "hidden" }}>
                  <input
                    ref={(el) => (inputRefs.current[`${rowIdx}-0`] = el)}
                    type="text"
                    value={row.col0}
                    onChange={(e) => handleInputChange(row.id, "col0", e.target.value)}
                    onBlur={handleInputBlur}
                    onKeyDown={(e) => handleKeyDown(e, rowIdx, 0)}
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      backgroundColor: "transparent",
                      textAlign: "center",
                      fontSize: "inherit",
                    }}
                  />
                </td>

                {/* Kolonne 1 */}
                <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "center", overflow: "hidden" }}>
                  <input
                    ref={(el) => (inputRefs.current[`${rowIdx}-1`] = el)}
                    type="text"
                    value={row.col1}
                    onChange={(e) => handleInputChange(row.id, "col1", e.target.value)}
                    onBlur={handleInputBlur}
                    onKeyDown={(e) => handleKeyDown(e, rowIdx, 1)}
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      backgroundColor: "transparent",
                      textAlign: "center",
                      fontSize: "inherit",
                    }}
                  />
                </td>

                {/* Kolonne 2-6: Lønposter */}
                {[2, 3, 4, 5, 6].map((colIdx) => (
                  <td key={colIdx} style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "right", overflow: "hidden" }}>
                    <input
                      ref={(el) => (inputRefs.current[`${rowIdx}-${colIdx}`] = el)}
                      type="text"
                      value={row[`col${colIdx}`]}
                      onChange={(e) => handleInputChange(row.id, `col${colIdx}`, e.target.value)}
                      onBlur={handleInputBlur}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                      style={{
                        width: "100%",
                        border: "none",
                        outline: "none",
                        backgroundColor: "transparent",
                        textAlign: "right",
                          fontSize: "inherit",
                      }}
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
                  }}
                >
                  {formatNumber(calculated.col9)}
                </td>

                {/* Kolonne 10: ATP */}
                <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "right", overflow: "hidden" }}>
                  <input
                    ref={(el) => (inputRefs.current[`${rowIdx}-10`] = el)}
                    type="text"
                    value={row.col10}
                    onChange={(e) => handleInputChange(row.id, "col10", e.target.value)}
                    onBlur={handleInputBlur}
                    onKeyDown={(e) => handleKeyDown(e, rowIdx, 10)}
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      backgroundColor: "transparent",
                      textAlign: "right",
                    }}
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
