/**
 * Navigation-mapping for EOInspektion rows til Beregning-fanen
 *
 * Dette modul håndterer mapping fra EoRowId til navigation-targets (sider/faner/sektioner)
 * for at understøtte klikbare links i Beregning-fanen.
 */

// Bevidst ingen EoRowId-union her: navigationen accepterer string-input for at undgå runtime-nedbrud.

/**
 * SectionId angiver et scroll-mål i UI'et: værdien skrives som `sectionId` på
 * NavigationTarget og bruges af `scrollToSection` til at finde det tilsvarende
 * `data-section-id`-element.
 *
 * VIGTIGT: Hver værdi der faktisk sættes som `sectionId` herunder, SKAL svare til
 * et `data-section-id`-attribut i UI'et (primært EOOplysningerTab.tsx samt
 * Stamdata.tsx og LoenindkomstTab.tsx). Bemærk at ikke alle medlemmer p.t. bruges
 * som scroll-mål: rækker i fanerne `erstatningsopgoerelse`/`offentligeYdelser`
 * navigerer kun til fanen (uden `sectionId`) og scroller derefter direkte til
 * selve kontrol-rækken. De medlemmer bevares for at dokumentere de mulige sektioner
 * og holde navnerummet i sync med builder-sektionsnøglerne.
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
  | 'sygeferiegodtgoerelse'
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
 * Exhaustive mapping fra EoRowId til NavigationTarget
 *
 * VIGTIGT:
 * - Ukendte IDs returnerer altid 'unsupported' (ingen runtime-crash)
 * - Mapping er bevidst tolerant for at undgå at blokere visning i Beregning-fanen
 * - TypeScript kan ikke håndhæve exhaustiveness her pga. string-input
 *
 * @param rowId - EoRowId fra builder-funktioner
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
  if (rowId === 'stamdata.skadedato') {
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
      sectionTitle: 'Svie- og smertegodtgørelse',
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
      sectionTitle: 'Indkomstgrundlag',
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

  if (rowId.startsWith('sfgg.')) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'loenindkomst',
      sectionId: 'loenindkomst',
      tabName: 'Lønindkomst',
      sectionTitle: 'Ansættelsesforhold',
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
  // MIDLERTIDIGT EET KONSISTENS-ADVARSLER
  // ============================================================================

  if (rowId === 'midlertidigtEetKonsistens.ydelerUdenAfgorelse') {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      sectionId: 'aes',
      tabName: 'EO oplysninger',
      sectionTitle: 'AES-afgørelser',
    };
  }

  if (rowId === 'midlertidigtEetKonsistens.afgorelseUdenYdelser') {
    return {
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'offentlige_ydelser',
      tabName: 'Offentlige ydelser',
      sectionTitle: 'Offentlige ydelser',
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
