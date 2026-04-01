// Compat wrapper:
// Rækkevalidering er et domæneansvar og ejes af indkomstRowValidation.
// Debug-laget re-eksporterer kun for eksisterende imports.
export {
  buildStandardLoenCellErrors,
  buildOffentligeYdelserCellErrors,
  getStandardLoenErrorRowIdSet,
  getOffentligeYdelserErrorRowIdSet,
} from '../erstatningsopgoerelse/validation/indkomstRowValidation';
