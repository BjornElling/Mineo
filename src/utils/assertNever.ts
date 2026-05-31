/**
 * Udtømmendeheds-tjek for switch-sætninger.
 *
 * Bruges som default case i switch for at sikre compile-time exhaustiveness.
 * Kaster altid en fejl ved runtime hvis kaldt (hvilket aldrig bør ske).
 *
 * @example
 * switch (method) {
 *   case 'a': return handleA();
 *   case 'b': return handleB();
 *   default: return assertNever(method);
 * }
 */
export const assertNever = (value: never): never => {
  throw new Error(`Uventet værdi: ${String(value)}`);
};
