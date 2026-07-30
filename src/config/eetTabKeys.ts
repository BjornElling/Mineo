/** Kanoniske fane-nøgler for Erhvervsevnetab. */
export const ERHVERVSEVNETAB_TAB_KEYS = {
  EET_OPLYSNINGER: 'eet-oplysninger',
  LOEBENDE_YDELSER: 'loebende-ydelser',
  KAPITALISERING: 'kapitalisering',
  EET_EAL: 'eet-eal',
  DIFFERENCEKRAV: 'differencekrav',
} as const;

export type ErhvervsevnetabTabKey =
  (typeof ERHVERVSEVNETAB_TAB_KEYS)[keyof typeof ERHVERVSEVNETAB_TAB_KEYS];
