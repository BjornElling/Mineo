/**
 * Navigation-mapping for EODebug rows til Beregning-fanen
 *
 * Dette modul håndterer mapping fra DebugRowId til navigation-targets (sider/faner/sektioner)
 * for at understøtte klikbare links i Beregning-fanen.
 */

// Intentionally no DebugRowId union here: navigation accepts string input to avoid runtime crashes.

/**
 * SectionId er canonical - bruges både i NavigationTarget OG data-section-id attributes
 *
 * VIGTIGT: Denne type skal holdes synkroniseret med data-section-id attributes i EOOplysningerTab.tsx
 */
export type SectionId =
  | 'stamdata'
  | 'erstatningsopgoerelse'
  | 'forlig'
  | 'aes'
  | 'loenindkomst'
  | 'offentlige-ydelser'
  | 'sviesmerte'
  | 'taf-beregningsgrundlag'
  | 'taf'
  | 'oevrige-krav'
  | 'saerlige-kommentarer'
  | 'bilagsnumre';

/**
 * Navigation-target med discriminated union for type-sikkerhed
 *
 * - 'erstatningsopgoerelse-tab': Navigation til fane i Erstatningsopgørelse-siden
 * - 'stamdata-page': Navigation til Stamdata-siden
 * - 'unsupported': Ingen navigation tilgængelig (fx sammensatte felter)
 */
export type NavigationTarget =
  | {
      kind: 'erstatningsopgoerelse-tab';
      tabId: 'eo_oplysninger' | 'loenindkomst' | 'offentlige_ydelser';
      sectionId?: SectionId;
      tabName: string; // Fanenavn (fx "EO oplysninger")
      sectionTitle: string; // ContentBox overskrift (fx "Forlig", "AES-afgørelser")
    }
  | {
      kind: 'stamdata-page';
      pageName: string; // Sidenavn (fx "Stamdata")
      sectionTitle: string; // ContentBox overskrift (fx "Sagsinfo", "Skadelidte")
    }
  | {
      kind: 'unsupported';
      displayPath: string;
      reason: string;
    };

/**
 * Exhaustive mapping fra DebugRowId til NavigationTarget
 *
 * VIGTIGT:
 * - Ukendte IDs returnerer altid 'unsupported' (ingen runtime-crash)
 * - Mapping er bevidst tolerant for at undgå at blokere visning i Beregning-fanen
 * - TypeScript kan ikke håndhæve exhaustiveness her pga. string-input
 *
 * @param rowId - DebugRowId fra builder-funktioner
 * @returns NavigationTarget med kind, path og metadata
 */
export const getNavigationTargetFromRowId = (rowId: string): NavigationTarget => {
  // ============================================================================
  // STAMDATA ROWS
  // ============================================================================

  if (rowId === 'stamdata.journalnr') {
    return { kind: 'stamdata-page', pageName: 'Stamdata', sectionTitle: 'Sagsinfo' };
  }
  if (rowId === 'stamdata.advokatSagsbehandler') {
    return { kind: 'stamdata-page', pageName: 'Stamdata', sectionTitle: 'Sagsinfo' };
  }
  if (rowId === 'stamdata.skadelidte') {
    return { kind: 'stamdata-page', pageName: 'Stamdata', sectionTitle: 'Skadelidte' };
  }
  if (rowId === 'stamdata.skadestype') {
    return { kind: 'stamdata-page', pageName: 'Stamdata', sectionTitle: 'Skadelidte' };
  }
  if (rowId === 'stamdata.skadesdato') {
    return { kind: 'stamdata-page', pageName: 'Stamdata', sectionTitle: 'Skadelidte' };
  }

  // ============================================================================
  // ERSTATNINGSOPGØRELSE TOP-LEVEL (uden sektion)
  // ============================================================================

  if (rowId.startsWith('erstatningsopgoerelse.')) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      tabName: 'EO oplysninger',
      sectionTitle: 'Erstatningsopgørelse',
    };
  }

  // ============================================================================
  // LØNINDKOMST TAB
  // ============================================================================

  if (rowId.startsWith('loenindkomst.')) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'loenindkomst',
      sectionId: 'loenindkomst',
      tabName: 'Lønindkomst',
      sectionTitle: 'Lønindkomst',
    };
  }

  // ============================================================================
  // OFFENTLIGE YDELSER TAB
  // ============================================================================

  if (rowId.startsWith('offentligeYdelser.')) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'offentlige_ydelser',
      tabName: 'Offentlige ydelser',
      sectionTitle: 'Offentlige ydelser',
    };
  }

  // ============================================================================
  // FORLIG SEKTION
  // ============================================================================

  if (rowId.startsWith('forlig.')) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      sectionId: 'forlig',
      tabName: 'EO oplysninger',
      sectionTitle: 'Forlig',
    };
  }

  // ============================================================================
  // AES SEKTION
  // ============================================================================

  if (rowId.startsWith('aes.')) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      sectionId: 'aes',
      tabName: 'EO oplysninger',
      sectionTitle: 'AES-afgørelser',
    };
  }

  // ============================================================================
  // SVIE/SMERTE SEKTION
  // ============================================================================

  if (rowId.startsWith('sviesmerte.')) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      sectionId: 'sviesmerte',
      tabName: 'EO oplysninger',
      sectionTitle: 'Svie/smerte godtgørelse',
    };
  }

  // ============================================================================
  // TAF BEREGNINGSGRUNDLAG SEKTION
  // ============================================================================

  if (rowId.startsWith('taf.beregningsgrundlag.')) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      sectionId: 'taf-beregningsgrundlag',
      tabName: 'EO oplysninger',
      sectionTitle: 'Indtægt før skaden',
    };
  }

  // ============================================================================
  // TAF PERIODER SEKTION
  // ============================================================================

  if (rowId.startsWith('taf.')) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      sectionId: 'taf',
      tabName: 'EO oplysninger',
      sectionTitle: 'Tabt arbejdsfortjeneste',
    };
  }

  // ============================================================================
  // ØVRIGE KRAV SEKTION
  // ============================================================================

  if (rowId.startsWith('oevrigekrav.')) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      sectionId: 'oevrige-krav',
      tabName: 'EO oplysninger',
      sectionTitle: 'Øvrige erstatningskrav',
    };
  }

  // ============================================================================
  // SÆRLIGE KOMMENTARER SEKTION
  // ============================================================================

  if (rowId === 'saerligekommentarer') {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      sectionId: 'saerlige-kommentarer',
      tabName: 'EO oplysninger',
      sectionTitle: 'Eventuelle særlige kommentarer',
    };
  }

  // ============================================================================
  // BILAGSNUMRE SEKTION
  // ============================================================================

  if (rowId.startsWith('bilagsnumre.')) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      sectionId: 'bilagsnumre',
      tabName: 'EO oplysninger',
      sectionTitle: 'Bilagsnumre',
    };
  }

  // ============================================================================
  // UKENDT ID - THROW I DEV, FALLBACK I PRODUCTION
  // ============================================================================

  return {
    kind: 'unsupported',
    displayPath: rowId,
    reason: `Navigation ikke implementeret for ${rowId}`,
  };
};
