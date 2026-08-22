import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';
import { toFile } from 'openai/uploads';
import { AgentAnalyzeResponseDto } from '@/agent/dto/agent-analyze-response.dto';

const UPSTAGE_AGENT_BASE_URL = 'https://api.upstage.ai/v2';
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 60;

export type UploadedDocumentFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
};

type JsonObject = Record<string, unknown>;

export type ClientOnlyTranscriptUtterance = {
  page?: number;
  turnIndex?: number;
  speakerLabel: string;
  utteranceText: string;
  timestampOriginal?: string;
};

export type ClientUtteranceKeyword = {
  keyword: string;
  count: number;
};

export type ClientOnlyTranscriptResult = {
  clientSpeakerLabel: string;
  clientUtterances: ClientOnlyTranscriptUtterance[];
  counselorUtterances: ClientOnlyTranscriptUtterance[];
  clientUtteranceKeywords: ClientUtteranceKeyword[];
  clientUtteranceTotalWordCount?: number;
  clientNameOrInitials?: string;
};

type AnalyzeFileOptions = {
  prompt?: string;
};

@Injectable()
export class AgentService {
  constructor(private readonly configService: ConfigService) {}

  async analyzeDocument(
    file: UploadedDocumentFile | undefined,
  ): Promise<AgentAnalyzeResponseDto> {
    const completedResponse = await this.analyzeFile(file);

    return this.toResponseDto(completedResponse);
  }

  async analyzeDocumentToJson(
    file: UploadedDocumentFile | undefined,
  ): Promise<JsonObject> {
    const completedResponse = await this.analyzeFile(file);

    return this.parseJsonOutput(completedResponse);
  }

  async analyzeSessionTranscriptToJson(
    file: UploadedDocumentFile | undefined,
  ): Promise<JsonObject> {
    const completedResponse = await this.analyzeFile(file, {
      prompt: this.buildFullTranscriptAnalysisPrompt(),
    });

    return this.parseJsonOutput(completedResponse);
  }

  async extractClientOnlyTranscript(params: {
    analysisContext: JsonObject;
    clientSpeakerLabel: string;
  }): Promise<ClientOnlyTranscriptResult> {
    const completedResponse = await this.runTextPrompt(
      this.buildClientTranscriptExtractionPrompt(
        params.analysisContext,
        params.clientSpeakerLabel,
      ),
    );
    const parsedResponse = this.parseJsonOutput(completedResponse);

    return this.toClientOnlyTranscriptResult(parsedResponse, {
      clientSpeakerLabel: params.clientSpeakerLabel,
      counselorSpeakerLabel: this.asOptionalString(
        params.analysisContext.counselor_speaker_label,
      ),
    });
  }

  private async analyzeFile(
    file: UploadedDocumentFile | undefined,
    options?: AnalyzeFileOptions,
  ): Promise<OpenAI.Responses.Response> {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const { agentId, client } = this.createAgentClient();
    let uploadedFileId: string | null = null;

    try {
      const uploadedFile = await client.files.create({
        file: await toFile(
          file.buffer,
          this.getSafeFilename(file.originalname),
          file.mimetype
            ? { type: file.mimetype }
            : { type: 'application/octet-stream' },
        ),
        purpose: 'user_data',
      });
      uploadedFileId = uploadedFile.id;

      const response = await client.responses.create({
        model: agentId,
        input: [
          {
            role: 'user',
            content: [
              ...(options?.prompt
                ? [
                    {
                      type: 'input_text' as const,
                      text: options.prompt,
                    },
                  ]
                : []),
              {
                type: 'input_file',
                file_id: uploadedFile.id,
              },
            ],
          },
        ],
      });

      const completedResponse = await this.pollUntilFinished(
        client,
        response.id,
      );

      return completedResponse;
    } catch (error) {
      return this.handleAgentError(error);
    } finally {
      if (uploadedFileId) {
        await client.files.delete(uploadedFileId).catch(() => undefined);
      }
    }
  }

  private async runTextPrompt(
    prompt: string,
  ): Promise<OpenAI.Responses.Response> {
    const { agentId, client } = this.createAgentClient();

    try {
      const response = await client.responses.create({
        model: agentId,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: prompt,
              },
            ],
          },
        ],
      });

      return await this.pollUntilFinished(client, response.id);
    } catch (error) {
      return this.handleAgentError(error);
    }
  }

  private createAgentClient(): { agentId: string; client: OpenAI } {
    const agentId = this.configService.get<string>('AGENT_ID');
    const agentApiKey = this.configService.get<string>('AGENT_API_KEY');

    if (!agentId || !agentApiKey) {
      throw new InternalServerErrorException(
        'Agent integration is not configured',
      );
    }

    return {
      agentId,
      client: new OpenAI({
        apiKey: agentApiKey,
        baseURL: UPSTAGE_AGENT_BASE_URL,
      }),
    };
  }

  private async pollUntilFinished(
    client: OpenAI,
    responseId: string,
  ): Promise<OpenAI.Responses.Response> {
    let attempts = 0;
    let currentResponse = await client.responses.retrieve(responseId);

    while (
      currentResponse.status === 'queued' ||
      currentResponse.status === 'in_progress'
    ) {
      if (attempts >= MAX_POLL_ATTEMPTS) {
        throw new ServiceUnavailableException(
          'Agent analysis timed out before completion',
        );
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      currentResponse = await client.responses.retrieve(responseId);
      attempts += 1;
    }

    return currentResponse;
  }

  private toResponseDto(
    response: OpenAI.Responses.Response,
  ): AgentAnalyzeResponseDto {
    const failureMessage =
      response.status === 'failed'
        ? (response.error ?? 'Agent analysis failed')
        : undefined;

    return {
      id: response.id,
      status: response.status ?? 'unknown',
      output:
        response.output?.map(
          (item) => item as unknown as Record<string, unknown>,
        ) ?? undefined,
      error: failureMessage as Record<string, unknown> | string | undefined,
    };
  }

  private parseJsonOutput(response: OpenAI.Responses.Response): JsonObject {
    const outputText = this.extractOutputText(response);

    try {
      const parsed = JSON.parse(outputText) as unknown;

      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new BadGatewayException('Agent response JSON must be an object');
      }

      return parsed as JsonObject;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException('Failed to parse Agent response JSON');
    }
  }

  private extractOutputText(response: OpenAI.Responses.Response): string {
    const outputItems =
      (response.output as unknown as Array<Record<string, unknown>>) ?? [];
    const textParts: string[] = [];

    for (const outputItem of outputItems) {
      const contents = outputItem.content;

      if (!Array.isArray(contents)) {
        continue;
      }

      for (const contentItem of contents) {
        if (!contentItem || typeof contentItem !== 'object') {
          continue;
        }

        const rawContentItem = contentItem as Record<string, unknown>;

        if (
          rawContentItem.type === 'output_text' &&
          typeof rawContentItem.text === 'string'
        ) {
          textParts.push(rawContentItem.text);
        }
      }
    }

    if (textParts.length > 0) {
      return textParts.join('');
    }

    throw new BadGatewayException(
      'Agent response did not include JSON text output',
    );
  }

  private buildFullTranscriptAnalysisPrompt(): string {
    return [
      'Analyze the uploaded counseling transcript and return JSON only.',
      'Do not wrap the JSON in markdown.',
      'Return the full transcript extraction, not a summary.',
      'You must include every utterance from the client speaker in client_utterances.',
      'You must include every utterance from the counselor speaker in counselor_utterances.',
      'Do not return representative samples only.',
      'Do not limit client_utterances or counselor_utterances to 3 items.',
      'Do not truncate utterance arrays.',
      'Preserve the original utterance text and source metadata when available.',
      'Expected keys include: document_type, session_number, counseling_date, counseling_location, client_speaker_label, counselor_speaker_label, client_utterances, counselor_utterances.',
    ].join('\n\n');
  }

  private buildClientTranscriptExtractionPrompt(
    analysisContext: JsonObject,
    clientSpeakerLabel: string,
  ): string {
    return [
      'You will receive the completed first-pass transcript analysis for a counseling session.',
      `The counselor selected "${clientSpeakerLabel}" as the client speaker.`,
      'Return JSON only. Do not wrap the JSON in markdown.',
      'Extract ONLY the utterances spoken by the selected client speaker.',
      'Also include the counselor utterances separately in counselor_utterances.',
      'Do not summarize, paraphrase, normalize, or rewrite the transcript text.',
      'Use snake_case field names in the JSON response.',
      'Preserve original metadata when available: page, turn_index, speaker_label, utterance_text, timestamp_original.',
      'Respond with exactly this JSON shape:',
      '{"client_speaker_label":"string","counselor_speaker_label":"string","client_name_or_initials":"string","client_utterance_total_word_count":1,"client_utterances":[{"page":1,"turn_index":2,"speaker_label":"string","utterance_text":"string","timestamp_original":"string"}],"counselor_utterances":[{"page":1,"turn_index":1,"speaker_label":"string","utterance_text":"string","timestamp_original":"string"}],"client_utterance_keywords":[{"keyword":"string","count":1}]}',
      'First-pass analysis JSON:',
      JSON.stringify(analysisContext),
    ].join('\n\n');
  }

  private toClientOnlyTranscriptResult(
    parsedResponse: JsonObject,
    fallback: {
      clientSpeakerLabel: string;
      counselorSpeakerLabel?: string;
    },
  ): ClientOnlyTranscriptResult {
    const clientSpeakerLabel =
      this.asOptionalString(parsedResponse.client_speaker_label) ??
      fallback.clientSpeakerLabel;
    const counselorSpeakerLabel =
      this.asOptionalString(parsedResponse.counselor_speaker_label) ??
      fallback.counselorSpeakerLabel;
    const clientUtterances = parsedResponse.client_utterances;
    const counselorUtterances = parsedResponse.counselor_utterances;

    if (!Array.isArray(clientUtterances)) {
      throw new BadGatewayException(
        'Agent returned an invalid client transcript structure',
      );
    }

    return {
      clientSpeakerLabel,
      clientUtterances: clientUtterances.map((utterance) =>
        this.toClientOnlyTranscriptUtterance(utterance, clientSpeakerLabel),
      ),
      counselorUtterances: Array.isArray(counselorUtterances)
        ? counselorUtterances.map((utterance) =>
            this.toClientOnlyTranscriptUtterance(
              utterance,
              counselorSpeakerLabel,
            ),
          )
        : [],
      clientUtteranceKeywords: this.toClientUtteranceKeywords(
        parsedResponse.client_utterance_keywords,
      ),
      clientUtteranceTotalWordCount: this.asOptionalNumber(
        parsedResponse.client_utterance_total_word_count,
      ),
      clientNameOrInitials: this.asOptionalString(
        parsedResponse.client_name_or_initials,
      ),
    };
  }

  private toClientOnlyTranscriptUtterance(
    utterance: unknown,
    fallbackSpeakerLabel?: string,
  ): ClientOnlyTranscriptUtterance {
    if (
      !utterance ||
      Array.isArray(utterance) ||
      typeof utterance !== 'object'
    ) {
      throw new BadGatewayException(
        'Agent returned an invalid client utterance item',
      );
    }

    const rawUtterance = utterance as JsonObject;
    const speakerLabel =
      this.asOptionalString(rawUtterance.speaker_label) ??
      this.asOptionalString(rawUtterance.speakerLabel) ??
      fallbackSpeakerLabel;
    const utteranceText =
      this.asOptionalString(rawUtterance.utterance_text) ??
      this.asOptionalString(rawUtterance.utteranceText);

    if (
      typeof speakerLabel !== 'string' ||
      !speakerLabel.trim() ||
      typeof utteranceText !== 'string' ||
      !utteranceText.trim()
    ) {
      throw new BadGatewayException(
        'Agent returned an invalid client utterance payload',
      );
    }

    const page = this.asOptionalNumber(rawUtterance.page);
    const turnIndex =
      this.asOptionalNumber(rawUtterance.turn_index) ??
      this.asOptionalNumber(rawUtterance.turnIndex);
    const timestampOriginal =
      this.asOptionalString(rawUtterance.timestamp_original) ??
      this.asOptionalString(rawUtterance.timestampOriginal);

    return {
      page,
      turnIndex,
      speakerLabel: speakerLabel.trim(),
      utteranceText,
      timestampOriginal,
    };
  }

  private toClientUtteranceKeywords(value: unknown): ClientUtteranceKeyword[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => {
      if (!item || Array.isArray(item) || typeof item !== 'object') {
        throw new BadGatewayException(
          'Agent returned an invalid client keyword item',
        );
      }

      const rawItem = item as JsonObject;
      const keyword = this.asOptionalString(rawItem.keyword);
      const count = this.asOptionalNumber(rawItem.count);

      if (!keyword || count === undefined) {
        throw new BadGatewayException(
          'Agent returned an invalid client keyword payload',
        );
      }

      return {
        keyword,
        count,
      };
    });
  }

  private asOptionalNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return undefined;
  }

  private asOptionalString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    return undefined;
  }

  private handleAgentError(error: unknown): never {
    if (error instanceof APIError) {
      const message = this.getSafeErrorMessage(error);

      switch (error.status) {
        case 400:
          throw new BadRequestException(message);
        case 401:
          throw new UnauthorizedException('Agent authentication failed');
        case 403:
          throw new ForbiddenException('Agent access denied');
        case 404:
          throw new NotFoundException(message);
        case 429:
          throw new HttpException(
            'Agent rate limit exceeded',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        case 502:
          throw new BadGatewayException(
            'Agent API returned a bad gateway error',
          );
        case 503:
          throw new ServiceUnavailableException('Agent API is unavailable');
        default:
          throw new BadGatewayException(message);
      }
    }

    if (error instanceof BadRequestException) {
      throw error;
    }

    if (error instanceof UnauthorizedException) {
      throw error;
    }

    if (error instanceof ForbiddenException) {
      throw error;
    }

    if (error instanceof NotFoundException) {
      throw error;
    }

    if (error instanceof HttpException && error.getStatus() === 429) {
      throw error;
    }

    if (error instanceof ServiceUnavailableException) {
      throw error;
    }

    if (error instanceof InternalServerErrorException) {
      throw error;
    }

    throw new InternalServerErrorException(
      'Unexpected error occurred while analyzing the document',
    );
  }

  private getSafeErrorMessage(error: { message?: string }): string {
    const rawMessage =
      typeof error.message === 'string'
        ? error.message
        : 'Agent request failed';

    return rawMessage.replace(/up_[a-zA-Z0-9_-]+/g, '[REDACTED_AGENT_API_KEY]');
  }

  private getSafeFilename(originalname: string): string {
    const trimmedName = originalname.trim();

    if (!trimmedName) {
      return 'document';
    }

    return trimmedName.replace(/[^\w.\-()]/g, '_');
  }
}
