import { ConfigService } from '@nestjs/config';
import { AgentService } from '@/agent/agent.service';

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    service = new AgentService({} as ConfigService);
  });

  it('joins multiple output_text items before parsing JSON', () => {
    const response = {
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: '{"client_utterances":[{"speakerLabel":"발화자 2"}],',
            },
            {
              type: 'output_text',
              text: '"counselor_utterances":[{"speakerLabel":"발화자 1"},{"speakerLabel":"발화자 1"}]}',
            },
          ],
        },
      ],
    };

    expect(
      (service as unknown as { parseJsonOutput: (value: unknown) => unknown })
        .parseJsonOutput(response),
    ).toEqual({
      client_utterances: [{ speakerLabel: '발화자 2' }],
      counselor_utterances: [
        { speakerLabel: '발화자 1' },
        { speakerLabel: '발화자 1' },
      ],
    });
  });

  it('builds a session transcript prompt that requests all counselor utterances', () => {
    const prompt = (
      service as unknown as { buildFullTranscriptAnalysisPrompt: () => string }
    ).buildFullTranscriptAnalysisPrompt();

    expect(prompt).toContain('client_utterances');
    expect(prompt).toContain('counselor_utterances');
    expect(prompt).toContain('Do not limit client_utterances or counselor_utterances to 3 items.');
  });
});
