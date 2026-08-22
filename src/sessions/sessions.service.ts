import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentService, UploadedDocumentFile } from '@/agent/agent.service';
import { Client } from '@/clients/entities/client.entity';
import { ClientSpeakerSelectionResponseDto } from '@/sessions/dto/client-speaker-selection-response.dto';
import { CreateSessionDto } from '@/sessions/dto/create-session.dto';
import { SessionAnalysisResponseDto } from '@/sessions/dto/session-analysis-response.dto';
import { SessionResponseDto } from '@/sessions/dto/session-response.dto';
import { SelectClientSpeakerDto } from '@/sessions/dto/select-client-speaker.dto';
import { UpdateSessionDto } from '@/sessions/dto/update-session.dto';
import { Session } from '@/sessions/entities/session.entity';

@Injectable()
export class SessionsService {
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

  async analyzeSessionDocument(
    id: string,
    file: UploadedDocumentFile | undefined,
  ): Promise<SessionAnalysisResponseDto> {
    const session = await this.findEntityOrThrow(id);
    const analysisResult =
      await this.agentService.analyzeSessionTranscriptToJson(file);
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

    if (!speakers.length) {
      throw new BadGatewayException(
        'Agent analysis did not include identifiable speaker labels',
      );
    }

    const updatedSession = this.sessionsRepository.merge(session, {
      initialAnalysisResult: analysisResult,
      clientSpeakerLabel,
    });
    await this.sessionsRepository.save(updatedSession);

    return {
      sessionId: updatedSession.id,
      status: 'completed',
      clientSpeakerLabel,
      counselorSpeakerLabel,
      speakers,
      analysisResult,
    };
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

    const clientTranscript =
      await this.agentService.extractClientOnlyTranscript({
        analysisContext: session.initialAnalysisResult,
        clientSpeakerLabel: selectedSpeakerLabel,
      });

    if (clientTranscript.clientSpeakerLabel !== selectedSpeakerLabel) {
      throw new BadGatewayException(
        'Agent returned a different client speaker label',
      );
    }

    if (
      clientTranscript.clientUtterances.some(
        (utterance) => utterance.speakerLabel !== selectedSpeakerLabel,
      )
    ) {
      throw new BadGatewayException(
        'Agent returned utterances for speakers other than the selected client',
      );
    }

    return {
      sessionId: updatedSession.id,
      clientSpeakerLabel: selectedSpeakerLabel,
      status: 'completed',
      clientUtterances: clientTranscript.clientUtterances,
      clientUtteranceTotalWordCount:
        clientTranscript.clientUtteranceTotalWordCount,
      clientNameOrInitials: clientTranscript.clientNameOrInitials,
      counselorUtterances: clientTranscript.counselorUtterances,
      clientUtteranceKeywords: clientTranscript.clientUtteranceKeywords,
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
}
