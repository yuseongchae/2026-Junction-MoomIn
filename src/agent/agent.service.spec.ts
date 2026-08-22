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

  it('parses JSON wrapped in markdown code fences', () => {
    const response = {
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: '```json\n{"client_utterances":[],"counselor_utterances":[]}\n```',
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
      client_utterances: [],
      counselor_utterances: [],
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

  it('converts camelCase agent transcript response into internal camelCase model', () => {
    const parsedResponse = {
      clientSpeakerLabel: '발화자 2',
      counselorSpeakerLabel: '발화자 1',
      clientNameOrInitials: '서연',
      clientUtteranceTotalWordCount: 120,
      clientUtterances: [
        {
          page: 0,
          turnIndex: 2,
          speakerLabel: '발화자 2',
          utteranceText: '테스트 발화',
          timestampOriginal: '',
        },
      ],
      counselorUtterances: [
        {
          page: 0,
          turnIndex: 1,
          speakerLabel: '발화자 1',
          utteranceText: '상담사 발화',
          timestampOriginal: '',
        },
      ],
      clientUtteranceKeywords: [
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

  it('converts the provided transcript response shape successfully', () => {
    const parsedResponse = {
      document_type: 'transcript',
      session_number: '',
      counseling_date: '',
      counseling_location: '',
      client_speaker_label: '',
      counseling_start_time: '',
      client_name_or_initials: '서연',
      counselor_speaker_label: '',
      client_utterance_total_word_count: 120,
      client_utterances: [
        {
          page: 0,
          turn_index: 2,
          speaker_label: '',
          utterance_text: '그냥 비슷했어요. 별일 없었어요.',
          timestamp_original: '',
        },
      ],
      counselor_utterances: [
        {
          page: 0,
          turn_index: 1,
          speaker_label: '',
          utterance_text: '서연 씨, 한 주 어떻게 지냈어요?',
          timestamp_original: '',
        },
      ],
      client_utterance_keywords: [
        {
          keyword: '과제',
          count: 6,
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
          utteranceText: '그냥 비슷했어요. 별일 없었어요.',
          timestampOriginal: undefined,
        },
      ],
      counselorUtterances: [
        {
          page: 0,
          turnIndex: 1,
          speakerLabel: '발화자 1',
          utteranceText: '서연 씨, 한 주 어떻게 지냈어요?',
          timestampOriginal: undefined,
        },
      ],
      clientUtteranceKeywords: [
        {
          keyword: '과제',
          count: 6,
        },
      ],
      clientUtteranceTotalWordCount: 120,
      clientNameOrInitials: '서연',
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

  it('throws when client_utterances is not an array', () => {
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
          client_utterances: 'not-an-array',
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

    it('builds a second-pass prompt with the current fixed JSON structure', () => {
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
        'Analyze the following counseling transcript analysis result.',
      );
      expect(prompt).toContain(
        'The client speaker label is "발화자 2".',
      );
    expect(prompt).toContain('client_utterances');
    expect(prompt).toContain('counselor_utterances');
      expect(prompt).toContain('"speaker_label": "발화자 2"');
      expect(prompt).toContain('"utterance_text": "..."');
      expect(prompt).toContain('Transcript analysis result:');
  });
});
