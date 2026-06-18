/**
 * jsPDF-sidegeometri (eneste isolationspunkt for internal.pageSize)
 *
 * jsPDF eksponerer sidebredde/-højde via `internal.pageSize`. Adgangen er bevidst
 * isoleret her, så internal-coupling ikke lækker ud i resten af systemet. Modulet
 * afhænger kun af npm-pakken `jspdf` (tilladt fra dokument-kernen) — ikke af
 * PDF-kanalens adapter. Både PDF-kanalens `createJsPdfAdapter` og den fælles
 * tabel-renderer læser geometrien herfra.
 *
 * Hvis jsPDF introducerer et offentligt API (fx getWidth()/getHeight()), rettes det ét sted.
 */

import type jsPDF from 'jspdf';

export const getJsPdfPageSize = (doc: jsPDF): Readonly<{ width: number; height: number }> => {
  // NOTE: Bevidst brug af internal API — se modulkommentar.
  const pageSize = doc.internal?.pageSize;
  if (!pageSize || typeof pageSize.width !== 'number' || typeof pageSize.height !== 'number') {
    throw new Error('jsPDF internal.pageSize er ikke tilgængeligt eller har ugyldig struktur — mulig version-inkompatibilitet');
  }
  return pageSize;
};
