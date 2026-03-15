export type EetIssue = Readonly<{
  id: string;
  severity: 'error' | 'warning';
  message: string;
}>;
