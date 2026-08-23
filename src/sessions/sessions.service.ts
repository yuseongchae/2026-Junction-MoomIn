import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentService, UploadedDocumentFile } from '@/agent/agent.service';
import { Client } from '@/clients/entities/client.entity';
import { ClientSpeakerSelectionResponseDto } from '@/sessions/dto/client-speaker-selection-response.dto';
import { CreateSessionDto } from '@/sessions/dto/create-session.dto';
import { KeywordDetailResponseDto } from '@/sessions/dto/keyword-detail-response.dto';
import { SessionAnalysisResponseDto } from '@/sessions/dto/session-analysis-response.dto';
import { SessionResponseDto } from '@/sessions/dto/session-response.dto';
import { SelectClientSpeakerDto } from '@/sessions/dto/select-client-speaker.dto';
import { UpdateSessionDto } from '@/sessions/dto/update-session.dto';
import { Session } from '@/sessions/entities/session.entity';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    private readonly agentService: AgentService,
  ) {}

  async create(
    clientId: string,
    createSessionDto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    await this.findClientOrThrow(clientId);

    const session = this.sessionsRepository.create({
      clientId,
      sessionDate: createSessionDto.sessionDate
        ? new Date(createSessionDto.sessionDate)
        : null,
      summary: createSessionDto.summary ?? null,
      clientSpeakerLabel: null,
      initialAnalysisResult: null,
    });
    const savedSession = await this.sessionsRepository.save(session);

    return this.toResponse(savedSession);
  }

  async findAllByClient(clientId: string): Promise<SessionResponseDto[]> {
    await this.findClientOrThrow(clientId);

    const sessions = await this.sessionsRepository.find({
      where: { clientId },
      order: { sessionDate: 'DESC', createdAt: 'DESC' },
    });

    return sessions.map((session) => this.toResponse(session));
  }

  async findOne(id: string): Promise<SessionResponseDto> {
    const session = await this.findEntityOrThrow(id);

    return this.toResponse(session);
  }

  async getAnalysis(id: string): Promise<SessionAnalysisResponseDto> {
    const session = await this.findEntityOrThrow(id);

    if (!session.initialAnalysisResult) {
      throw new NotFoundException(
        `Analysis result for session with id ${id} not found`,
      );
    }

    return this.toAnalysisResponse(session.id, session.initialAnalysisResult);
  }

  async getKeywordDetail(
    sessionId: string,
    keyword: string,
  ): Promise<KeywordDetailResponseDto> {
    const session = await this.findEntityOrThrow(sessionId);

    if (!session.initialAnalysisResult) {
      throw new NotFoundException(
        `Analysis result for session with id ${sessionId} not found`,
      );
    }

    const normalizedKeyword = this.normalizeKeywordParam(keyword);
    const analysisResult = session.initialAnalysisResult;
    const keywords = this.getArrayField(analysisResult, [
      'client_utterance_keywords',
      'clientUtteranceKeywords',
    ]);
    const contexts = this.getArrayField(analysisResult, [
      'client_keyword_contexts',
      'clientKeywordContexts',
    ]);

    const keywordInfo = this.findKeywordInfo(keywords, normalizedKeyword);

    if (!keywordInfo) {
      throw new NotFoundException(
        `Keyword ${normalizedKeyword} was not found for session with id ${sessionId}`,
      );
    }

    const contextInfo = this.findKeywordContextInfo(contexts, normalizedKeyword);

    return {
      keyword: normalizedKeyword,
      count: keywordInfo.count,
      contexts: contextInfo?.contexts ?? [],
    };
  }

  async analyzeSessionDocument(
    id: string,
    file: UploadedDocumentFile | undefined,
  ): Promise<SessionAnalysisResponseDto> {
    const session = await this.findEntityOrThrow(id);
    const requestTag = `session:${session.id}:analysis`;
    const analysisResult =
      await this.agentService.analyzeSessionTranscriptToJson(file, {
        requestTag,
      });
    const clientSpeakerLabel = this.getStringField(
      analysisResult,
      'client_speaker_label',
    );
    const counselorSpeakerLabel = this.getStringField(
      analysisResult,
      'counselor_speaker_label',
    );
    const documentType = this.getStringField(analysisResult, 'document_type');
    const speakers = this.collectSpeakerLabels(analysisResult, {
      clientSpeakerLabel,
      counselorSpeakerLabel,
    });

    if (documentType !== 'realtime_note' && !speakers.length) {
      throw new BadGatewayException(
        'Agent analysis did not include identifiable speaker labels',
      );
    }

    const updatedSession = this.sessionsRepository.merge(session, {
      initialAnalysisResult: analysisResult,
      clientSpeakerLabel,
    });
    this.logger.warn(
      `=== DB SAVE PRE === ${JSON.stringify({
        requestTag,
        sessionId: session.id,
        ...this.summarizeAnalysisKeywordFields(analysisResult),
      })}`,
    );
    const savedSession = await this.sessionsRepository.save(updatedSession);
    this.logger.warn(
      `=== DB SAVE POST === ${JSON.stringify({
        requestTag,
        sessionId: savedSession.id,
        ...this.summarizeAnalysisKeywordFields(
          savedSession.initialAnalysisResult ?? undefined,
        ),
      })}`,
    );

    return this.toAnalysisResponse(savedSession.id, analysisResult);
  }

  async selectClientSpeaker(
    id: string,
    selectClientSpeakerDto: SelectClientSpeakerDto,
  ): Promise<ClientSpeakerSelectionResponseDto> {
    const session = await this.findEntityOrThrow(id);

    if (!session.initialAnalysisResult) {
      throw new BadRequestException(
        'First analysis has not completed for this session',
      );
    }

    const selectedSpeakerLabel =
      selectClientSpeakerDto.clientSpeakerLabel.trim();
    const clientSpeakerLabelFromAnalysis = this.getStringField(
      session.initialAnalysisResult,
      'client_speaker_label',
    );
    const counselorSpeakerLabelFromAnalysis = this.getStringField(
      session.initialAnalysisResult,
      'counselor_speaker_label',
    );
    const speakers = this.collectSpeakerLabels(session.initialAnalysisResult, {
      clientSpeakerLabel: clientSpeakerLabelFromAnalysis,
      counselorSpeakerLabel: counselorSpeakerLabelFromAnalysis,
    });

    if (!speakers.includes(selectedSpeakerLabel)) {
      throw new BadRequestException(
        'Selected speaker was not found in the analyzed transcript',
      );
    }

    const updatedSession = this.sessionsRepository.merge(session, {
      clientSpeakerLabel: selectedSpeakerLabel,
    });
    await this.sessionsRepository.save(updatedSession);

      const analysisResult = session.initialAnalysisResult;
      const clientUtterances = this.toTranscriptUtterances(
        this.getArrayField(analysisResult, [
          'client_utterances',
          'clientUtterances',
        ]),
      ).filter((utterance) => utterance.speakerLabel === selectedSpeakerLabel);
      const counselorUtterances = this.toTranscriptUtterances(
        this.getArrayField(analysisResult, [
          'counselor_utterances',
          'counselorUtterances',
        ]),
      );

      if (!clientUtterances.length) {
        throw new BadRequestException(
          'Selected speaker does not have any utterances in the analyzed transcript',
        );
      }

    return {
      sessionId: updatedSession.id,
      clientSpeakerLabel: selectedSpeakerLabel,
      status: 'completed',
        clientUtterances,
        clientUtteranceTotalWordCount: this.getNumberField(
          analysisResult,
          'client_utterance_total_word_count',
        ),
        clientNameOrInitials:
          this.getStringField(
            analysisResult,
            'client_name_or_initials',
          ) ?? undefined,
        counselorUtterances,
        clientUtteranceKeywords: this.toClientUtteranceKeywords(
          this.getArrayField(analysisResult, [
            'client_utterance_keywords',
            'clientUtteranceKeywords',
          ]),
        ),
    };
  }

  async update(
    id: string,
    updateSessionDto: UpdateSessionDto,
  ): Promise<SessionResponseDto> {
    const session = await this.findEntityOrThrow(id);
    const updatedSession = this.sessionsRepository.merge(session, {
      sessionDate:
        updateSessionDto.sessionDate !== undefined
          ? updateSessionDto.sessionDate
            ? new Date(updateSessionDto.sessionDate)
            : null
          : session.sessionDate,
      summary:
        updateSessionDto.summary !== undefined
          ? (updateSessionDto.summary ?? null)
          : session.summary,
    });
    const savedSession = await this.sessionsRepository.save(updatedSession);

    return this.toResponse(savedSession);
  }

  async remove(id: string): Promise<void> {
    const session = await this.findEntityOrThrow(id);
    await this.sessionsRepository.remove(session);
  }

  async findEntityOrThrow(id: string): Promise<Session> {
    const session = await this.sessionsRepository.findOneBy({ id });

    if (!session) {
      throw new NotFoundException(`Session with id ${id} not found`);
    }

    return session;
  }

  private async findClientOrThrow(clientId: string): Promise<Client> {
    const client = await this.clientsRepository.findOneBy({ id: clientId });

    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    return client;
  }

  private toResponse(session: Session): SessionResponseDto {
    return {
      id: session.id,
      clientId: session.clientId,
      sessionDate: session.sessionDate,
      summary: session.summary,
      clientSpeakerLabel: session.clientSpeakerLabel ?? null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private toAnalysisResponse(
    sessionId: string,
    analysisResult: Record<string, unknown>,
  ): SessionAnalysisResponseDto {
    const documentType = this.getStringField(analysisResult, 'document_type');
    const clientSpeakerLabel = this.getStringField(
      analysisResult,
      'client_speaker_label',
    );
    const counselorSpeakerLabel = this.getStringField(
      analysisResult,
      'counselor_speaker_label',
    );
    const speakers = this.collectSpeakerLabels(analysisResult, {
      clientSpeakerLabel,
      counselorSpeakerLabel,
    });
    const counselingDate = this.getStringField(analysisResult, 'counseling_date');
    const fullOriginalText = this.getStringField(
      analysisResult,
      'full_original_text',
    );
    const readableStructuredText = this.getStringField(
      analysisResult,
      'readable_structured_text',
    );

    return {
      sessionId,
      status: 'completed',
      clientSpeakerLabel,
      counselorSpeakerLabel,
      speakers,
      analysisResult,
      ...(documentType ? { documentType } : {}),
      ...(counselingDate ? { counselingDate } : {}),
      ...(fullOriginalText ? { fullOriginalText } : {}),
      ...(readableStructuredText ? { readableStructuredText } : {}),
    };
  }

  private collectSpeakerLabels(
    analysisResult: Record<string, unknown>,
    knownLabels?: {
      clientSpeakerLabel: string | null;
      counselorSpeakerLabel: string | null;
    },
  ): string[] {
    const speakerLabels = new Set<string>();

    for (const label of [
      knownLabels?.clientSpeakerLabel,
      knownLabels?.counselorSpeakerLabel,
    ]) {
      if (typeof label === 'string' && label.trim()) {
        speakerLabels.add(label.trim());
      }
    }

    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }

      if (!value || typeof value !== 'object') {
        return;
      }

      const record = value as Record<string, unknown>;

      if (
        typeof record.speakerLabel === 'string' &&
        record.speakerLabel.trim()
      ) {
        speakerLabels.add(record.speakerLabel.trim());
      }

      if (Array.isArray(record.speakers)) {
        for (const speaker of record.speakers) {
          if (typeof speaker === 'string' && speaker.trim()) {
            speakerLabels.add(speaker.trim());
            continue;
          }

          if (!speaker || typeof speaker !== 'object') {
            continue;
          }

          const rawSpeaker = speaker as Record<string, unknown>;

          for (const candidate of [
            rawSpeaker.speakerLabel,
            rawSpeaker.speaker_label,
            rawSpeaker.speaker,
            rawSpeaker.name,
          ]) {
            if (typeof candidate === 'string' && candidate.trim()) {
              speakerLabels.add(candidate.trim());
            }
          }
        }
      }

      Object.values(record).forEach(visit);
    };

    visit(analysisResult);

    return [...speakerLabels];
  }

  private getStringField(
    source: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = source[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    return null;
  }

  private getNumberField(
    source: Record<string, unknown>,
    key: string,
  ): number | undefined {
    const value = source[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return undefined;
  }

  private toTranscriptUtterances(
    source: unknown,
  ): ClientSpeakerSelectionResponseDto['clientUtterances'] {
    if (!Array.isArray(source)) {
      return [];
    }

    return source.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const rawUtterance = item as Record<string, unknown>;
      const speakerLabel = this.getNonEmptyString(rawUtterance.speaker_label);
      const utteranceText = this.getNonEmptyString(rawUtterance.utterance_text);

      if (!speakerLabel || !utteranceText) {
        return [];
      }

      return [
        {
          page:
            typeof rawUtterance.page === 'number' &&
            Number.isFinite(rawUtterance.page)
              ? rawUtterance.page
              : undefined,
          turnIndex:
            typeof rawUtterance.turn_index === 'number' &&
            Number.isFinite(rawUtterance.turn_index)
              ? rawUtterance.turn_index
              : undefined,
          speakerLabel,
          utteranceText,
          timestampOriginal: this.getNonEmptyString(
            rawUtterance.timestamp_original,
          ),
        },
      ];
    });
  }

  private toClientUtteranceKeywords(
    source: unknown,
  ): ClientSpeakerSelectionResponseDto['clientUtteranceKeywords'] {
    if (!Array.isArray(source)) {
      return [];
    }

    return source.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const rawKeyword = item as Record<string, unknown>;
      const keyword = this.getNonEmptyString(rawKeyword.keyword);
      const count = this.getFiniteNumber(rawKeyword.count);

      if (!keyword || count === undefined) {
        return [];
      }

      return [
        {
          keyword,
          count,
        },
      ];
    });
  }

  private getArrayField(
    source: Record<string, unknown>,
    keys: string[],
  ): unknown[] | undefined {
    for (const key of keys) {
      const value = source[key];

      if (Array.isArray(value)) {
        return value;
      }
    }

    return undefined;
  }

  private getFiniteNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private getNonEmptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private normalizeKeywordParam(keyword: string): string {
    try {
      return decodeURIComponent(keyword).trim();
    } catch {
      return keyword.trim();
    }
  }

  private findKeywordInfo(
    source: unknown[] | undefined,
    keyword: string,
  ): { keyword: string; count: number } | undefined {
    if (!source) {
      return undefined;
    }

    for (const item of source) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const rawKeyword = item as Record<string, unknown>;
      const normalizedKeyword = this.getNonEmptyString(rawKeyword.keyword);
      const count = this.getFiniteNumber(rawKeyword.count);

      if (normalizedKeyword === keyword && count !== undefined) {
        return {
          keyword: normalizedKeyword,
          count,
        };
      }
    }

    return undefined;
  }

  private findKeywordContextInfo(
    source: unknown[] | undefined,
    keyword: string,
  ): { keyword: string; contexts: string[] } | undefined {
    if (!source) {
      return undefined;
    }

    for (const item of source) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const rawContext = item as Record<string, unknown>;
      const normalizedKeyword = this.getNonEmptyString(rawContext.keyword);

      if (normalizedKeyword !== keyword) {
        continue;
      }

      return {
        keyword: normalizedKeyword,
        contexts: this.toStringArray(
          rawContext.contexts ?? rawContext.context_list ?? rawContext.items,
        ),
      };
    }

    return undefined;
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      const normalized = this.getNonEmptyString(item);

      return normalized ? [normalized] : [];
    });
  }

  private summarizeAnalysisKeywordFields(
    source: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    return {
      client_utterance_keywords: this.describeArrayField(
        source?.client_utterance_keywords ?? source?.clientUtteranceKeywords,
      ),
      client_keyword_contexts: this.describeArrayField(
        source?.client_keyword_contexts ?? source?.clientKeywordContexts,
      ),
    };
  }

  private describeArrayField(value: unknown): {
    exists: boolean;
    length: number | null;
    value: unknown;
  } {
    if (!Array.isArray(value)) {
      return {
        exists: value !== undefined,
        length: null,
        value,
      };
    }

    return {
      exists: true,
      length: value.length,
      value,
    };
  }
}
