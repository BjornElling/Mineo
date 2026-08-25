export const RENTE_CALCULATION_PRINCIPLES = [
  'Rente beregnes i henhold til renteloven.',
  'Som beregningsprincip anvendes 365 årlige rentedage (366 i skudår).',
  // Tillægssatsen vælges på RENTEDATOEN, ikke på forfaldsdatoen (jf. renteberegning-contract.md §2.10).
  // Teksten sagde tidligere «forfaldsdato» og var derfor uenig med beregningen for krav, hvis
  // tillægstid flytter rentedatoen hen over 01-03-2013.
  'Rentesatsen udgør nationalbankens udlånsrente + 8 % (ved rentedato før 01-03-2013 dog + 7 %)',
  'Der beregnes ikke renters rente.',
] as const;
