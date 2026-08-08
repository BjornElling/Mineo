export const DATE_ORDER_ERROR_MESSAGE = 'Til-dato skal være efter fra-dato';

/**
 * Det fælles kronologiske prædikat for EO's valideringsregler.
 * Samme dag er gyldig; kun en fra-dato efter til-dato er en rækkefølgefejl.
 */
export const hasDateOrderError = (
  fra: string | undefined,
  til: string | undefined,
): boolean => fra !== undefined && til !== undefined && fra > til;
