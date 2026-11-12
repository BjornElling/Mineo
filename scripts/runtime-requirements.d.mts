export type RuntimeRequirements = Readonly<{ node: string; npm: string; packageManagerVersion: string }>;

export declare const readRuntimeRequirements: () => RuntimeRequirements;
export declare const upgradeInstructions: (requirements: RuntimeRequirements) => string;
export declare const assertSupportedNode: () => void;
