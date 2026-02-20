export interface PersistedData<T = unknown> {
  version: string;
  timestamp: number;
  data: T;
}
