import { createSystemIssueEnvelope } from '../../utils/systemIssueReporter';

describe('systemIssueReporter', () => {
  it('udelader revision-nøglen når revision ikke findes', () => {
    const envelope = createSystemIssueEnvelope({
      code: 'test',
      area: 'runtime',
      context: 'test',
      userMessage: 'Testfejl',
    });

    expect('revision' in envelope).toBe(false);
  });

  it('medtager revision når den findes', () => {
    const envelope = createSystemIssueEnvelope({
      code: 'test',
      area: 'runtime',
      context: 'test',
      userMessage: 'Testfejl',
      revision: 'rev-1',
    });

    expect(envelope.revision).toBe('rev-1');
  });
});
