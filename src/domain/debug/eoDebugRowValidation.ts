// Compat wrapper:
// Rækkevalidering er et domæneansvar og ejes af indkomstRowValidation.
// Debug-laget re-eksporterer kun for eksisterende imports.
export {
  buildAarsloenCellErrors,
  buildOffentligeYdelserCellErrors,
  getAarsloenErrorRowIdSet,
  getOffentligeYdelserErrorRowIdSet,
} from '../erstatningsopgoerelse/indkomstRowValidation';
