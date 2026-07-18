/**
 * Ren download-gate-beslutning for Forsørgertab-siden.
 *
 * Greenfield (§3.4/§5.4/§1.10, Fase 3 Forsørgertab-slice): gaten afledes af den ENE reader-projektion
 * (`buildForsoergertabReaderProjection`), som sidevisningen allerede afspejler. Snapshottets egen
 * `pdfGate` bærer den dependency-specifikke blokering (§1.10) UÆNDRET fra legacy: den blokerer på røde
 * feltfejl (via de reader-afledte `fieldErrors`, som projektionen fører ind i snapshottet) og på
 * manglende PDF-klar EAL-/ASL-del. Gaten videregiver derfor blot snapshottets gate-resultat — samme
 * sandhedstabel som før migreringen.
 *
 * Funktionen er uden React, så beslutningen kan unit-testes direkte og ikke afhænger af monterede inputfelter.
 */

import type { DocumentDownloadGateResult } from '../../document/layout/documentGateTypes';
import type { ForsoergertabReaderProjection } from './forsoergertabReaderProjection';

export const evaluateForsoergertabDownloadGate = (
  projection: ForsoergertabReaderProjection
): DocumentDownloadGateResult => projection.snapshot.pdfGate;
