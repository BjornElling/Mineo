import { z } from 'zod';
import { formatZodIssues } from '../../utils/zodIssueFormatting';
import { rentekravRowSchema, renteberegningSchema, satserSchema } from '../../schemas/formSchemas';

const issuesFrom = (schema: z.ZodType, input: unknown): z.core.$ZodIssue[] => {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('Testfixture skulle have givet Zod-fejl');
  return result.error.issues;
};

describe('formatZodIssues', () => {
  it('formaterer enkelt issue med dotted path', () => {
    const issues = issuesFrom(renteberegningSchema, {
      rentekravRows: [{ id: 'r1', enhed: 'timer' }],
    });

    expect(issues[0]?.path).toEqual(['rentekravRows', 0, 'enhed']);
    expect(formatZodIssues(issues, 10)).toBe(
      `rentekravRows.0.enhed: ${issues[0]?.message}`,
    );
  });

  it('tom path → (root)', () => {
    const issues = issuesFrom(satserSchema, null);

    expect(issues[0]?.path).toEqual([]);
    expect(formatZodIssues(issues, 10)).toBe(`(root): ${issues[0]?.message}`);
  });

  it('flere issues adskilles med newline', () => {
    const issues = issuesFrom(rentekravRowSchema, {
      id: 7,
      tillaegstid: 'ikke-et-tal',
      enhed: 'timer',
    });

    expect(issues).toHaveLength(3);
    expect(formatZodIssues(issues, 10)).toBe(
      issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'),
    );
  });

  it('trunkerer til max antal', () => {
    const issues = issuesFrom(rentekravRowSchema, {
      id: 7,
      tillaegstid: 'ikke-et-tal',
      enhed: 'timer',
    });

    expect(formatZodIssues(issues, 2)).toBe(
      issues.slice(0, 2).map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'),
    );
    expect(formatZodIssues(issues, 2)).not.toContain(issues[2]?.message ?? '');
  });

  it('symbol-segment bruger description fra et faktisk ZodIssue path', () => {
    const sym = Symbol('mySymbol');
    const issues = issuesFrom(z.object({ [sym]: z.string() }), {});

    expect(issues[0]?.path).toEqual([sym]);
    expect(formatZodIssues(issues, 10)).toBe(`mySymbol: ${issues[0]?.message}`);
  });

  it('symbol uden description bruger symbol fra et faktisk ZodIssue path', () => {
    const sym = Symbol();
    const issues = issuesFrom(z.object({ [sym]: z.string() }), {});

    expect(issues[0]?.path).toEqual([sym]);
    expect(formatZodIssues(issues, 10)).toBe(`symbol: ${issues[0]?.message}`);
  });

  it('tom issue-liste → tom streng', () => {
    expect(formatZodIssues([], 10)).toBe('');
  });
});
