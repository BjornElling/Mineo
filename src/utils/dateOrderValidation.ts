// Samme dag er en gyldig periode, så teksten siger «på eller efter», ikke blot «efter».
export const DATE_ORDER_ERROR_MESSAGE = 'Til-dato skal være på eller efter fra-dato';

/**
 * Det fælles kronologiske prædikat for EO's valideringsregler.
 * Samme dag er gyldig; kun en fra-dato efter til-dato er en rækkefølgefejl.
 */
export const hasDateOrderError = (
  fra: string | undefined,
  til: string | undefined,
): boolean => fra !== undefined && til !== undefined && fra > til;
