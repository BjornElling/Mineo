import React from "react";
import jspreadsheet from "jspreadsheet-ce";
import "jspreadsheet-ce/dist/jspreadsheet.css";
import "jsuites/dist/jsuites.css";

const AarsloenTable = React.forwardRef(({ loenperiode, satser }, ref) => {
  const wrapperRef = React.useRef(null);
  const tableRef = React.useRef(null);
  const isReady = React.useRef(false);

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
   *  Funktion: Generér formler til en række
   * ----------------------------------------------------------- */
  const formulasForRow = React.useCallback(
    (rowIndex) => {
      const r = rowIndex + 1;

      const ferie = pctToDecimal(satser?.ferie);
      const frit = pctToDecimal(satser?.fritvalg);
      const sh = pctToDecimal(satser?.sh);
      const bede = pctToDecimal(satser?.bededag);
      const pens = pctToDecimal(satser?.pension);

      const totalPct = ferie + frit + sh + bede;

      const fmt = (v) => v.toString().replace(".", ",");

      return {
        ferieberet: `=SUM(C${r}:G${r})`,
        tillaeg: totalPct > 0 ? `=H${r}*${fmt(totalPct)}` : "",
        pension: pens > 0 ? `=(H${r}+I${r})*${fmt(pens)}` : "",
        samlet: `=H${r}+I${r}+J${r}+K${r}`,
      };
    },
    [satser, pctToDecimal]
  );

  /** -----------------------------------------------------------
   *  Funktion: Definér kolonner
   * ----------------------------------------------------------- */
  const getColumns = React.useCallback((periode) => {
    const PERIOD = {
      maaned: [
        { title: "Måned", type: "numeric", width: 80, align: "center" },
        { title: "År", type: "numeric", width: 80, align: "center" },
      ],
      uge: [
        { title: "Uge fra", type: "text", width: 90, align: "center" },
        { title: "Uge til", type: "text", width: 90, align: "center" },
      ],
      dag: [
        { title: "Dato fra", type: "text", width: 110, align: "center" },
        { title: "Dato til", type: "text", width: 110, align: "center" },
      ],
    };

    const LON = [
      { title: "Lønpost 1", type: "numeric", width: 100, align: "right", mask: "#.##0,00" },
      { title: "Lønpost 2", type: "numeric", width: 100, align: "right", mask: "#.##0,00" },
      { title: "Lønpost 3", type: "numeric", width: 100, align: "right", mask: "#.##0,00" },
      { title: "Lønpost 4", type: "numeric", width: 100, align: "right", mask: "#.##0,00" },
      { title: "Lønpost 5", type: "numeric", width: 100, align: "right", mask: "#.##0,00" },

      // De 4 beregnede kolonner
      { title: "Ferieberet.\nløn", type: "numeric", width: 110, align: "right", readOnly: true, cssClass: "readonly" },
      { title: "FP/FV/SH/SO/St.B.", type: "numeric", width: 110, align: "right", readOnly: true, cssClass: "readonly" },
      { title: "Arb.g.\nPension", type: "numeric", width: 110, align: "right", readOnly: true, cssClass: "readonly" },

      { title: "ATP", type: "numeric", width: 90, align: "right", mask: "#.##0,00" },

      { title: "Samlet løn", type: "numeric", width: 120, align: "right", readOnly: true, cssClass: "readonly" },
    ];

    return [...PERIOD[periode], ...LON];
  }, []);

  /** -----------------------------------------------------------
   *  INITIALISERING — KUN 1 GANG
   * ----------------------------------------------------------- */
  React.useEffect(() => {
    if (!wrapperRef.current || tableRef.current) return;

    const columns = getColumns(loenperiode);

    const initRows = [0, 1].map((i) => {
      const f = formulasForRow(i);
      return ["", "", "", "", "", "", "", f.ferieberet, f.tillaeg, f.pension, "", f.samlet];
    });

    tableRef.current = jspreadsheet(wrapperRef.current, {
      data: initRows,
      columns,
      columnResize: false,
      allowInsertColumn: false,
      allowManualInsertColumn: false,
      allowInsertRow: true,
      allowDeleteRow: true,
      columnSorting: false,
      tableWidth: "100%",
      tableHeight: "400px",

      /** ► Fix: TAB må ikke lave nye kolonner */
      onkeydown: (evt) => {
        if (evt.key === "Tab") {
          const t = tableRef.current;
          if (!t) return;

          const [x, y] = t.selectedCell || [0, 0];
          const lastCol = t.options.columns.length - 1;
          const lastRow = t.getData().length - 1;

          if (x === lastCol) {
            evt.preventDefault();
            const nr = Math.min(y + 1, lastRow);
            t.setSelectedCells([[0, nr]]);
          }
        }
      },

      /** ► Auto-tilføj ny række */
      onafterchanges: (ignored, cell, x, y) => {
        if (!isReady.current) return;
        const t = tableRef.current;
        if (!t) return;

        const all = t.getData();
        if (!Array.isArray(all)) return;

        const last = all.length - 1;

        const row = all[y] || [];
        const slice = row.slice ? row.slice(0, 11) : [];

        const hasData = slice.some((c, idx) => {
          if ([7, 8, 9, 11].includes(idx)) return false;
          return c !== "" && c !== null && c !== undefined;
        });

        if (y === last && hasData) {
          const nr = last + 1;
          const f = formulasForRow(nr);

          t.insertRow(1, false);
          t.setValueFromCoords(7, nr, f.ferieberet, false);
          t.setValueFromCoords(8, nr, f.tillaeg, false);
          t.setValueFromCoords(9, nr, f.pension, false);
          t.setValueFromCoords(11, nr, f.samlet, false);
        }
      },
    });

    isReady.current = true;
  }, []);

  /** -----------------------------------------------------------
   *  OPDATER FORMLER NÅR SATSER ÆNDRES
   * ----------------------------------------------------------- */
  React.useEffect(() => {
    const t = tableRef.current;
    if (!t || !isReady.current) return;

    const rows = t.getData();
    rows.forEach((row, idx) => {
      const f = formulasForRow(idx);
      t.setValueFromCoords(7, idx, f.ferieberet, false);
      t.setValueFromCoords(8, idx, f.tillaeg, false);
      t.setValueFromCoords(9, idx, f.pension, false);
      t.setValueFromCoords(11, idx, f.samlet, false);
    });
  }, [satser, formulasForRow]);

  /** -----------------------------------------------------------
   *  SKIFT AF LØNPERIODE = GENOPRET TABEL
   * ----------------------------------------------------------- */
  React.useEffect(() => {
    if (!tableRef.current || !isReady.current) return;

    const t = tableRef.current;
    const newCols = getColumns(loenperiode);
    const old = t.getData();

    const rebuilt = old.map((r) => {
      const row = new Array(newCols.length).fill("");
      for (let i = 2; i < Math.min(12, r.length); i++) {
        row[i] = r[i];
      }
      return row;
    });

    wrapperRef.current.innerHTML = "";
    isReady.current = false;

    tableRef.current = jspreadsheet(wrapperRef.current, {
      data: rebuilt,
      columns: newCols,
      columnResize: false,
      allowInsertColumn: false,
      allowInsertRow: true,
      allowDeleteRow: true,
      columnSorting: false,
      tableWidth: "100%",
      tableHeight: "400px",
    });

    isReady.current = true;
  }, [loenperiode, getColumns]);

  /** -----------------------------------------------------------
   *  SORTERING via ref
   * ----------------------------------------------------------- */
  React.useImperativeHandle(ref, () => ({
    sortTable: () => {
      const t = tableRef.current;
      if (!t) return;

      const data = t.getData();
      const sorted = data
        .map((r, i) => ({ r, i }))
        .sort((a, b) => {
          const ap = a.r[0] || a.r[1];
          const bp = b.r[0] || b.r[1];
          const alon = a.r.slice(2, 7).some((v) => v !== "");
          const blon = b.r.slice(2, 7).some((v) => v !== "");

          const ac = ap ? 1 : alon ? 2 : 3;
          const bc = bp ? 1 : blon ? 2 : 3;

          return ac !== bc ? ac - bc : a.i - b.i;
        })
        .map((x) => x.r);

      t.setData(sorted);

      sorted.forEach((r, idx) => {
        const f = formulasForRow(idx);
        t.setValueFromCoords(7, idx, f.ferieberet, false);
        t.setValueFromCoords(8, idx, f.tillaeg, false);
        t.setValueFromCoords(9, idx, f.pension, false);
        t.setValueFromCoords(11, idx, f.samlet, false);
      });
    },
  }));

  return (
    <div style={{ width: "100%", fontFamily: "Ubuntu, sans-serif" }}>
      <div ref={wrapperRef} />

      <style>
        {`
          /* Centrer headers */
          .jexcel > thead > tr > td {
            text-align: center !important;
          }

          /* Beregnede celler: ingen fokus, ingen klik, ingen tab */
          td.readonly {
            pointer-events: none !important;
            user-select: none !important;
            opacity: 0.9;
            background-color: #f3f3f3 !important;
          }

          /* Fast kolonnebredde */
          .jexcel_container td {
            max-width: inherit !important;
            overflow: hidden !important;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        `}
      </style>
    </div>
  );
});

AarsloenTable.displayName = "AarsloenTable";
export default AarsloenTable;
