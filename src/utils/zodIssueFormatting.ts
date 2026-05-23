type ZodLikeIssue = {
  path: Array<string | number | symbol>;
  message: string;
};

export const formatZodIssues = (issues: ZodLikeIssue[], max: number): string => {
  return issues
    .slice(0, max)
    .map((issue) => {
      const path = issue.path.length > 0
        ? issue.path
          .map((segment) => (typeof segment === 'symbol' ? (segment.description ?? 'symbol') : String(segment)))
          .join('.')
        : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
};
