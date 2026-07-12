import { z } from 'zod';

export const eetIssueSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['error', 'warning']),
  message: z.string().min(1),
}).strict().readonly();

export type EetIssue = z.infer<typeof eetIssueSchema>;
