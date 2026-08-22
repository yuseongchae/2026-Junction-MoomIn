import { ConfigService } from '@nestjs/config';
import { BadGatewayException } from '@nestjs/common';
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
              text: '{"client_utterances":[{"speaker_label":"발화자 2"}],',
            },
            {
              type: 'output_text',
              text: '"counselor_utterances":[{"speaker_label":"발화자 1"},{"speaker_label":"발화자 1"}]}',
            },
          ],
        },
      ],
    };

    expect(
      (
        service as unknown as { parseJsonOutput: (value: unknown) => unknown }
      ).parseJsonOutput(response),
    ).toEqual({
      client_utterances: [{ speaker_label: '발화자 2' }],
      counselor_utterances: [
        { speaker_label: '발화자 1' },
        { speaker_label: '발화자 1' },
      ],
    });
  });

  it('converts snake_case agent transcript response into internal camelCase model', () => {
    const parsedResponse = {
      client_speaker_label: '발화자 2',
      counselor_speaker_label: '발화자 1',
      client_name_or_initials: '서연',
      client_utterance_total_word_count: 120,
      client_utterances: [
        {
          page: 0,
          turn_index: 2,
          speaker_label: '발화자 2',
          utterance_text: '테스트 발화',
          timestamp_original: '',
        },
      ],
      counselor_utterances: [
        {
          page: 0,
          turn_index: 1,
          speaker_label: '발화자 1',
          utterance_text: '상담사 발화',
          timestamp_original: '',
        },
      ],
      client_utterance_keywords: [
        {
          keyword: '과제',
          count: 1,
        },
      ],
    };

    expect(
      (
        service as unknown as {
          toClientOnlyTranscriptResult: (
            response: Record<string, unknown>,
            fallback: {
              clientSpeakerLabel: string;
              counselorSpeakerLabel?: string;
            },
          ) => unknown;
        }
      ).toClientOnlyTranscriptResult(parsedResponse, {
        clientSpeakerLabel: '발화자 2',
        counselorSpeakerLabel: '발화자 1',
      }),
    ).toEqual({
      clientSpeakerLabel: '발화자 2',
      clientUtterances: [
        {
          page: 0,
          turnIndex: 2,
          speakerLabel: '발화자 2',
          utteranceText: '테스트 발화',
          timestampOriginal: undefined,
        },
      ],
      counselorUtterances: [
        {
          page: 0,
          turnIndex: 1,
          speakerLabel: '발화자 1',
          utteranceText: '상담사 발화',
          timestampOriginal: undefined,
        },
      ],
      clientUtteranceKeywords: [
        {
          keyword: '과제',
          count: 1,
        },
      ],
      clientUtteranceTotalWordCount: 120,
      clientNameOrInitials: '서연',
    });
  });

  it('falls back to requested client speaker label when agent top-level label is blank', () => {
    const parsedResponse = {
      client_speaker_label: '',
      client_utterances: [
        {
          page: 0,
          turn_index: 2,
          speaker_label: '',
          utterance_text: '테스트 발화',
          timestamp_original: '',
        },
      ],
      counselor_utterances: [],
      client_utterance_keywords: [],
    };

    expect(
      (
        service as unknown as {
          toClientOnlyTranscriptResult: (
            response: Record<string, unknown>,
            fallback: {
              clientSpeakerLabel: string;
              counselorSpeakerLabel?: string;
            },
          ) => unknown;
        }
      ).toClientOnlyTranscriptResult(parsedResponse, {
        clientSpeakerLabel: '발화자 2',
        counselorSpeakerLabel: '발화자 1',
      }),
    ).toEqual({
      clientSpeakerLabel: '발화자 2',
      clientUtterances: [
        {
          page: 0,
          turnIndex: 2,
          speakerLabel: '발화자 2',
          utteranceText: '테스트 발화',
          timestampOriginal: undefined,
        },
      ],
      counselorUtterances: [],
      clientUtteranceKeywords: [],
      clientUtteranceTotalWordCount: undefined,
      clientNameOrInitials: undefined,
    });
  });

  it('throws when client_utterances is missing or invalid', () => {
    expect(() =>
      (
        service as unknown as {
          toClientOnlyTranscriptResult: (
            response: Record<string, unknown>,
            fallback: {
              clientSpeakerLabel: string;
              counselorSpeakerLabel?: string;
            },
          ) => unknown;
        }
      ).toClientOnlyTranscriptResult(
        {
          client_speaker_label: '발화자 2',
        },
        {
          clientSpeakerLabel: '발화자 2',
        },
      ),
    ).toThrow(BadGatewayException);
  });

  it('builds a session transcript prompt that requests all counselor utterances', () => {
    const prompt = (
      service as unknown as { buildFullTranscriptAnalysisPrompt: () => string }
    ).buildFullTranscriptAnalysisPrompt();

    expect(prompt).toContain('client_utterances');
    expect(prompt).toContain('counselor_utterances');
    expect(prompt).toContain(
      'Do not limit client_utterances or counselor_utterances to 3 items.',
    );
  });

  it('builds a second-pass prompt that requests snake_case transcript fields', () => {
    const prompt = (
      service as unknown as {
        buildClientTranscriptExtractionPrompt: (
          analysisContext: Record<string, unknown>,
          clientSpeakerLabel: string,
        ) => string;
      }
    ).buildClientTranscriptExtractionPrompt(
      { client_speaker_label: '발화자 2' },
      '발화자 2',
    );

    expect(prompt).toContain(
      'Use snake_case field names in the JSON response.',
    );
    expect(prompt).toContain('client_speaker_label');
    expect(prompt).toContain('client_utterances');
    expect(prompt).toContain('counselor_utterances');
  });
});
