import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AgentService } from '@/agent/agent.service';
import { Client } from '@/clients/entities/client.entity';
import { Session } from '@/sessions/entities/session.entity';
import { SessionsService } from '@/sessions/sessions.service';

type MockRepository<T extends object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionsRepository: MockRepository<Session>;
  let clientsRepository: MockRepository<Client>;
  let agentService: Partial<Record<keyof AgentService, jest.Mock>>;

  beforeEach(() => {
    sessionsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
      merge: jest.fn(),
    };
    clientsRepository = {
      findOneBy: jest.fn(),
    };
    agentService = {
      analyzeSessionTranscriptToJson: jest.fn(),
      extractClientOnlyTranscript: jest.fn(),
    };

    service = new SessionsService(
      sessionsRepository as unknown as Repository<Session>,
      clientsRepository as unknown as Repository<Client>,
      agentService as unknown as AgentService,
    );
  });

  it('creates a session for an existing client', async () => {
    const sessionDate = '2026-08-22T10:00:00.000Z';
    const createdAt = new Date('2026-08-22T10:00:00.000Z');
    const updatedAt = new Date('2026-08-22T10:00:00.000Z');

    clientsRepository.findOneBy!.mockResolvedValue({ id: 'client-id' });
    sessionsRepository.create!.mockReturnValue({
      clientId: 'client-id',
      sessionDate: new Date(sessionDate),
      summary: '초기 상담',
      clientSpeakerLabel: null,
      initialAnalysisResult: null,
    });
    sessionsRepository.save!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
      sessionDate: new Date(sessionDate),
      summary: '초기 상담',
      clientSpeakerLabel: null,
      createdAt,
      updatedAt,
    });

    await expect(
      service.create('client-id', {
        sessionDate,
        summary: '초기 상담',
      }),
    ).resolves.toEqual({
      id: 'session-id',
      clientId: 'client-id',
      sessionDate: new Date(sessionDate),
      summary: '초기 상담',
      clientSpeakerLabel: null,
      createdAt,
      updatedAt,
    });
  });

  it('rejects session creation for a nonexistent client', async () => {
    clientsRepository.findOneBy!.mockResolvedValue(null);

    await expect(
      service.create('missing-client', { summary: '초기 상담' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gets sessions for a client', async () => {
    const sessions = [
      {
        id: 'session-id',
        clientId: 'client-id',
        sessionDate: new Date('2026-08-22T10:00:00.000Z'),
        summary: '초기 상담',
        createdAt: new Date('2026-08-22T10:00:00.000Z'),
        updatedAt: new Date('2026-08-22T10:00:00.000Z'),
      },
    ] as Session[];

    clientsRepository.findOneBy!.mockResolvedValue({ id: 'client-id' });
    sessionsRepository.find!.mockResolvedValue(sessions);

    await expect(service.findAllByClient('client-id')).resolves.toEqual([
      {
        id: 'session-id',
        clientId: 'client-id',
        sessionDate: new Date('2026-08-22T10:00:00.000Z'),
        summary: '초기 상담',
        clientSpeakerLabel: null,
        createdAt: new Date('2026-08-22T10:00:00.000Z'),
        updatedAt: new Date('2026-08-22T10:00:00.000Z'),
      },
    ]);
  });

  it('stores first analysis result and returns available speakers', async () => {
    const session = {
      id: 'session-id',
      clientId: 'client-id',
      initialAnalysisResult: null,
      clientSpeakerLabel: null,
    } as Session;
    const analysisResult = {
      client_speaker_label: '발화자 2',
      counselor_speaker_label: '발화자 1',
      transcript: [
        { speakerLabel: '발화자 1', utteranceText: '오늘 어땠나요?' },
        { speakerLabel: '발화자 2', utteranceText: '잘 잤습니다.' },
      ],
    };

    sessionsRepository.findOneBy!.mockResolvedValue(session);
    agentService.analyzeSessionTranscriptToJson!.mockResolvedValue(
      analysisResult,
    );
    sessionsRepository.merge!.mockReturnValue({
      ...session,
      initialAnalysisResult: analysisResult,
      clientSpeakerLabel: '발화자 2',
    });
    sessionsRepository.save!.mockResolvedValue({
      ...session,
      initialAnalysisResult: analysisResult,
      clientSpeakerLabel: '발화자 2',
    });

    await expect(
      service.analyzeSessionDocument('session-id', {
        buffer: Buffer.from('transcript'),
        originalname: 'transcript.txt',
      }),
    ).resolves.toEqual({
      sessionId: 'session-id',
      status: 'completed',
      clientSpeakerLabel: '발화자 2',
      counselorSpeakerLabel: '발화자 1',
      speakers: ['발화자 2', '발화자 1'],
      analysisResult,
    });
  });

  it('stores parsed client speaker label even without explicit speakers array', async () => {
    const session = {
      id: 'session-id',
      clientId: 'client-id',
      initialAnalysisResult: null,
      clientSpeakerLabel: null,
    } as Session;
    const analysisResult = {
      document_type: 'transcript',
      client_speaker_label: '발화자 2',
      counselor_speaker_label: '발화자 1',
    };

    sessionsRepository.findOneBy!.mockResolvedValue(session);
    agentService.analyzeSessionTranscriptToJson!.mockResolvedValue(
      analysisResult,
    );
    sessionsRepository.merge!.mockReturnValue({
      ...session,
      initialAnalysisResult: analysisResult,
      clientSpeakerLabel: '발화자 2',
    });
    sessionsRepository.save!.mockResolvedValue({
      ...session,
      initialAnalysisResult: analysisResult,
      clientSpeakerLabel: '발화자 2',
    });

    await expect(
      service.analyzeSessionDocument('session-id', {
        buffer: Buffer.from('transcript'),
        originalname: 'transcript.txt',
      }),
    ).resolves.toEqual({
      sessionId: 'session-id',
      status: 'completed',
      clientSpeakerLabel: '발화자 2',
      counselorSpeakerLabel: '발화자 1',
      speakers: ['발화자 2', '발화자 1'],
      analysisResult,
    });
  });

  it('rejects speaker selection when first analysis is missing', async () => {
    sessionsRepository.findOneBy!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
      initialAnalysisResult: null,
      clientSpeakerLabel: null,
    });

    await expect(
      service.selectClientSpeaker('session-id', {
        clientSpeakerLabel: 'B',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects speaker selection when the speaker label is absent', async () => {
    sessionsRepository.findOneBy!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
      initialAnalysisResult: {
        client_speaker_label: 'A',
        counselor_speaker_label: 'B',
      },
      clientSpeakerLabel: null,
    });

    await expect(
      service.selectClientSpeaker('session-id', {
        clientSpeakerLabel: 'C',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns only the selected client utterances after agent extraction', async () => {
    const session = {
      id: 'session-id',
      clientId: 'client-id',
      initialAnalysisResult: {
        client_speaker_label: 'B',
        counselor_speaker_label: 'A',
        transcript: [
          { speakerLabel: 'A', utteranceText: '오늘 어땠나요?' },
          { speakerLabel: 'B', utteranceText: '잘 잤습니다.' },
        ],
      },
      clientSpeakerLabel: null,
    } as unknown as Session;

    sessionsRepository.findOneBy!.mockResolvedValue(session);
    sessionsRepository.merge!.mockReturnValue({
      ...session,
      clientSpeakerLabel: 'B',
    });
    sessionsRepository.save!.mockResolvedValue({
      ...session,
      clientSpeakerLabel: 'B',
    });
    agentService.extractClientOnlyTranscript!.mockResolvedValue({
      clientSpeakerLabel: 'B',
      clientUtterances: [
        {
          page: 1,
          turnIndex: 2,
          speakerLabel: 'B',
          utteranceText: '잘 잤습니다.',
          timestampOriginal: '00:04',
        },
      ],
      counselorUtterances: [
        {
          page: 1,
          turnIndex: 1,
          speakerLabel: 'A',
          utteranceText: '오늘 어땠나요?',
          timestampOriginal: '00:01',
        },
      ],
      clientUtteranceKeywords: [
        {
          keyword: '수면',
          count: 1,
        },
      ],
      clientUtteranceTotalWordCount: 3,
      clientNameOrInitials: '서연',
    });

    await expect(
      service.selectClientSpeaker('session-id', {
        clientSpeakerLabel: 'B',
      }),
    ).resolves.toEqual({
      sessionId: 'session-id',
      clientSpeakerLabel: 'B',
      status: 'completed',
      clientUtterances: [
        {
          page: 1,
          turnIndex: 2,
          speakerLabel: 'B',
          utteranceText: '잘 잤습니다.',
          timestampOriginal: '00:04',
        },
      ],
      clientUtteranceTotalWordCount: 3,
      clientNameOrInitials: '서연',
      counselorUtterances: [
        {
          page: 1,
          turnIndex: 1,
          speakerLabel: 'A',
          utteranceText: '오늘 어땠나요?',
          timestampOriginal: '00:01',
        },
      ],
      clientUtteranceKeywords: [
        {
          keyword: '수면',
          count: 1,
        },
      ],
    });
  });

  it('rejects mixed-speaker utterances from the agent', async () => {
    const session = {
      id: 'session-id',
      clientId: 'client-id',
      initialAnalysisResult: {
        client_speaker_label: 'B',
        counselor_speaker_label: 'A',
      },
      clientSpeakerLabel: null,
    } as unknown as Session;

    sessionsRepository.findOneBy!.mockResolvedValue(session);
    sessionsRepository.merge!.mockReturnValue({
      ...session,
      clientSpeakerLabel: 'B',
    });
    sessionsRepository.save!.mockResolvedValue({
      ...session,
      clientSpeakerLabel: 'B',
    });
    agentService.extractClientOnlyTranscript!.mockResolvedValue({
      clientSpeakerLabel: 'B',
      clientUtterances: [
        {
          speakerLabel: 'A',
          utteranceText: '오늘 어땠나요?',
        },
      ],
      counselorUtterances: [],
      clientUtteranceKeywords: [],
    });

    await expect(
      service.selectClientSpeaker('session-id', {
        clientSpeakerLabel: 'B',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
