import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import heicConvert = require('heic-convert');
import { Repository } from 'typeorm';
import { AgentService } from '@/agent/agent.service';
import { Client } from '@/clients/entities/client.entity';
import { Document, DocumentStatus } from '@/documents/entities/document.entity';
import { Session } from '@/sessions/entities/session.entity';
import { SessionsService } from '@/sessions/sessions.service';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

jest.mock('heic-convert', () => jest.fn());

type MockRepository<T extends object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionsRepository: MockRepository<Session>;
  let clientsRepository: MockRepository<Client>;
  let documentsRepository: MockRepository<Document>;
  let configService: Partial<Record<keyof ConfigService, jest.Mock>>;
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
    documentsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('storage/original-documents'),
    };
    agentService = {
      analyzeSessionTranscriptToJson: jest.fn(),
    };
    jest.mocked(fs.mkdir).mockResolvedValue(undefined);
    jest.mocked(fs.writeFile).mockResolvedValue(undefined);
    jest.mocked(fs.readFile).mockResolvedValue(Buffer.from('image-binary'));
    jest.mocked(heicConvert).mockResolvedValue(Uint8Array.from([255, 216, 255]));

    service = new SessionsService(
      sessionsRepository as unknown as Repository<Session>,
      clientsRepository as unknown as Repository<Client>,
      documentsRepository as unknown as Repository<Document>,
      configService as unknown as ConfigService,
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

    it('returns keyword detail from stored initial analysis result', async () => {
      sessionsRepository.findOneBy!.mockResolvedValue({
        id: 'session-id',
        clientId: 'client-id',
        initialAnalysisResult: {
          client_utterance_keywords: [
            { keyword: '과제', count: '6' },
            { keyword: '생각', count: 3 },
          ],
          client_keyword_contexts: [
            {
              keyword: '과제',
              contexts: ['문맥 1', '문맥 2', '문맥 3'],
            },
          ],
        },
      });

      await expect(
        service.getKeywordDetail('session-id', encodeURIComponent('과제')),
      ).resolves.toEqual({
        keyword: '과제',
        count: 6,
        contexts: ['문맥 1', '문맥 2', '문맥 3'],
      });
    });

    it('returns keyword detail with empty contexts when only keyword count exists', async () => {
      sessionsRepository.findOneBy!.mockResolvedValue({
        id: 'session-id',
        clientId: 'client-id',
        initialAnalysisResult: {
          clientUtteranceKeywords: [{ keyword: '과제', count: 6 }],
        },
      });

      await expect(service.getKeywordDetail('session-id', '과제')).resolves.toEqual(
        {
          keyword: '과제',
          count: 6,
          contexts: [],
        },
      );
    });

    it('rejects keyword detail lookup when the keyword is missing', async () => {
      sessionsRepository.findOneBy!.mockResolvedValue({
        id: 'session-id',
        clientId: 'client-id',
        initialAnalysisResult: {
          client_utterance_keywords: [{ keyword: '과제', count: 6 }],
        },
      });

      await expect(
        service.getKeywordDetail('session-id', '없는키워드'),
      ).rejects.toBeInstanceOf(NotFoundException);
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
    documentsRepository.create!.mockReturnValue({
      id: 'document-id',
      sessionId: 'session-id',
      fileName: 'transcript.txt',
      mimeType: 'application/octet-stream',
      fileUrl: 'session-id/storage-key',
      status: DocumentStatus.UPLOADED,
    });
    documentsRepository.save!.mockResolvedValue({
      id: 'document-id',
      sessionId: 'session-id',
      fileName: 'transcript.txt',
      mimeType: 'application/octet-stream',
      fileUrl: 'session-id/storage-key',
      status: DocumentStatus.UPLOADED,
    });
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
    documentsRepository.create!.mockReturnValue({
      id: 'document-id',
      sessionId: 'session-id',
      fileName: 'transcript.txt',
      mimeType: 'application/octet-stream',
      fileUrl: 'session-id/storage-key',
      status: DocumentStatus.UPLOADED,
    });
    documentsRepository.save!.mockResolvedValue({
      id: 'document-id',
      sessionId: 'session-id',
      fileName: 'transcript.txt',
      mimeType: 'application/octet-stream',
      fileUrl: 'session-id/storage-key',
      status: DocumentStatus.UPLOADED,
    });
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
      documentType: 'transcript',
      clientSpeakerLabel: '발화자 2',
      counselorSpeakerLabel: '발화자 1',
      speakers: ['발화자 2', '발화자 1'],
      analysisResult,
    });
  });

  it('returns realtime note analysis without requiring speaker labels', async () => {
    const session = {
      id: 'session-id',
      clientId: 'client-id',
      initialAnalysisResult: null,
      clientSpeakerLabel: null,
    } as Session;
    const analysisResult = {
      document_type: 'realtime_note',
      counseling_date: '2026-04-15',
      full_original_text: '원문 전체',
      readable_structured_text: '보기 좋은 구조화 텍스트',
    };

    sessionsRepository.findOneBy!.mockResolvedValue(session);
    documentsRepository.create!.mockReturnValue({
      id: 'document-id',
      sessionId: 'session-id',
      fileName: 'note.txt',
      mimeType: 'application/octet-stream',
      fileUrl: 'session-id/storage-key',
      status: DocumentStatus.UPLOADED,
    });
    documentsRepository.save!.mockResolvedValue({
      id: 'document-id',
      sessionId: 'session-id',
      fileName: 'note.txt',
      mimeType: 'application/octet-stream',
      fileUrl: 'session-id/storage-key',
      status: DocumentStatus.UPLOADED,
    });
    agentService.analyzeSessionTranscriptToJson!.mockResolvedValue(
      analysisResult,
    );
    sessionsRepository.merge!.mockReturnValue({
      ...session,
      initialAnalysisResult: analysisResult,
      clientSpeakerLabel: null,
    });
    sessionsRepository.save!.mockResolvedValue({
      ...session,
      initialAnalysisResult: analysisResult,
      clientSpeakerLabel: null,
    });

    await expect(
      service.analyzeSessionDocument('session-id', {
        buffer: Buffer.from('note'),
        originalname: 'note.txt',
      }),
    ).resolves.toEqual({
      sessionId: 'session-id',
      status: 'completed',
      documentType: 'realtime_note',
      clientSpeakerLabel: null,
      counselorSpeakerLabel: null,
      speakers: [],
      analysisResult,
      counselingDate: '2026-04-15',
      fullOriginalText: '원문 전체',
      readableStructuredText: '보기 좋은 구조화 텍스트',
    });
  });

  it('gets stored realtime note analysis by session id', async () => {
    sessionsRepository.findOneBy!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
      initialAnalysisResult: {
        document_type: 'realtime_note',
        counseling_date: '2026-04-15',
        full_original_text: '원문 전체',
        readable_structured_text: '보기 좋은 구조화 텍스트',
      },
      clientSpeakerLabel: null,
    });

    await expect(service.getAnalysis('session-id')).resolves.toEqual({
      sessionId: 'session-id',
      status: 'completed',
      documentType: 'realtime_note',
      clientSpeakerLabel: null,
      counselorSpeakerLabel: null,
      speakers: [],
      analysisResult: {
        document_type: 'realtime_note',
        counseling_date: '2026-04-15',
        full_original_text: '원문 전체',
        readable_structured_text: '보기 좋은 구조화 텍스트',
      },
      counselingDate: '2026-04-15',
      fullOriginalText: '원문 전체',
      readableStructuredText: '보기 좋은 구조화 텍스트',
    });
  });

  it.each([
    ['image/jpeg'],
    ['image/png'],
    ['image/heic'],
    ['image/heif'],
  ])(
    'returns original document binary while preserving mime type %s',
    async (mimeType) => {
      sessionsRepository.findOneBy!.mockResolvedValue({
        id: 'session-id',
        clientId: 'client-id',
      });
      documentsRepository.find!.mockResolvedValue([
        {
          id: 'document-id',
          sessionId: 'session-id',
          fileName: `handwritten${mimeType === 'image/png' ? '.png' : '.heic'}`,
          mimeType,
          fileUrl: 'session-id/file-key',
          status: DocumentStatus.COMPLETED,
        },
      ]);
      jest.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('img'));

      await expect(service.getOriginalDocument('session-id')).resolves.toEqual({
        fileName:
          mimeType === 'image/png' ? 'handwritten.png' : 'handwritten.heic',
        mimeType,
        buffer: Buffer.from('img'),
        contentLength: 3,
      });
    },
  );

  it('converts heic original document to jpeg preview', async () => {
    sessionsRepository.findOneBy!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
    });
    documentsRepository.find!.mockResolvedValue([
      {
        id: 'document-id',
        sessionId: 'session-id',
        fileName: 'memo2.heic',
        mimeType: 'image/heic',
        fileUrl: 'session-id/file-key',
        status: DocumentStatus.COMPLETED,
      },
    ]);
    jest.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('real-heic'));
    jest
      .mocked(heicConvert)
      .mockResolvedValueOnce(Uint8Array.from([255, 216, 255, 224]));

    await expect(
      service.getOriginalDocumentPreview('session-id'),
    ).resolves.toEqual({
      fileName: 'memo2.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([255, 216, 255, 224]),
      contentLength: 4,
    });
    expect(heicConvert).toHaveBeenCalledWith({
      buffer: Buffer.from('real-heic'),
      format: 'JPEG',
      quality: 0.9,
    });
  });

  it('returns jpeg original document as-is for preview', async () => {
    jest.mocked(heicConvert).mockClear();
    sessionsRepository.findOneBy!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
    });
    documentsRepository.find!.mockResolvedValue([
      {
        id: 'document-id',
        sessionId: 'session-id',
        fileName: 'memo2.jpg',
        mimeType: 'image/jpeg',
        fileUrl: 'session-id/file-key',
        status: DocumentStatus.COMPLETED,
      },
    ]);
    jest.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('jpeg-binary'));

    await expect(
      service.getOriginalDocumentPreview('session-id'),
    ).resolves.toEqual({
      fileName: 'memo2.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('jpeg-binary'),
      contentLength: Buffer.byteLength('jpeg-binary'),
    });
    expect(heicConvert).not.toHaveBeenCalled();
  });

  it('rejects preview for unsupported original document type', async () => {
    sessionsRepository.findOneBy!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
    });
    documentsRepository.find!.mockResolvedValue([
      {
        id: 'document-id',
        sessionId: 'session-id',
        fileName: 'memo2.pdf',
        mimeType: 'application/pdf',
        fileUrl: 'session-id/file-key',
        status: DocumentStatus.COMPLETED,
      },
    ]);
    jest.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('pdf-binary'));

    await expect(
      service.getOriginalDocumentPreview('session-id'),
    ).rejects.toThrow('Original document preview is not supported for this file type');
  });

  it('rejects preview when heic conversion fails', async () => {
    sessionsRepository.findOneBy!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
    });
    documentsRepository.find!.mockResolvedValue([
      {
        id: 'document-id',
        sessionId: 'session-id',
        fileName: 'memo2.heic',
        mimeType: 'image/heic',
        fileUrl: 'session-id/file-key',
        status: DocumentStatus.COMPLETED,
      },
    ]);
    jest.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('real-heic'));
    jest.mocked(heicConvert).mockRejectedValueOnce(new Error('decode failed'));

    await expect(
      service.getOriginalDocumentPreview('session-id'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('rejects original document lookup when no stored document exists', async () => {
    sessionsRepository.findOneBy!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
    });
    documentsRepository.find!.mockResolvedValue([]);

    await expect(
      service.getOriginalDocument('session-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects original document lookup when storage file is missing', async () => {
    sessionsRepository.findOneBy!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
    });
    documentsRepository.find!.mockResolvedValue([
      {
        id: 'document-id',
        sessionId: 'session-id',
        fileName: 'handwritten.heic',
        mimeType: 'image/heic',
        fileUrl: 'session-id/file-key',
        status: DocumentStatus.COMPLETED,
      },
    ]);
    jest.mocked(fs.readFile).mockRejectedValueOnce({ code: 'ENOENT' });

    await expect(
      service.getOriginalDocument('session-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects original document lookup when storage read fails', async () => {
    sessionsRepository.findOneBy!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
    });
    documentsRepository.find!.mockResolvedValue([
      {
        id: 'document-id',
        sessionId: 'session-id',
        fileName: 'handwritten.heic',
        mimeType: 'image/heic',
        fileUrl: 'session-id/file-key',
        status: DocumentStatus.COMPLETED,
      },
    ]);
    jest.mocked(fs.readFile).mockRejectedValueOnce(new Error('permission denied'));

    await expect(
      service.getOriginalDocument('session-id'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
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

    it('returns only the selected client utterances from first-pass analysis', async () => {
    const session = {
      id: 'session-id',
      clientId: 'client-id',
      initialAnalysisResult: {
        client_speaker_label: 'B',
        counselor_speaker_label: 'A',
          client_name_or_initials: '서연',
          client_utterance_total_word_count: 3,
          client_utterances: [
            {
              page: 1,
              turn_index: 2,
              speaker_label: 'B',
              utterance_text: '잘 잤습니다.',
              timestamp_original: '00:04',
            },
            {
              page: 1,
              turn_index: 3,
              speaker_label: 'A',
              utterance_text: '오늘 어땠나요?',
              timestamp_original: '00:01',
            },
          ],
          counselor_utterances: [
            {
              page: 1,
              turn_index: 1,
              speaker_label: 'A',
              utterance_text: '오늘 어땠나요?',
              timestamp_original: '00:01',
            },
        ],
          client_utterance_keywords: [
            {
              keyword: '수면',
              count: 1,
            },
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

    it('rejects selection when the chosen speaker has no client utterances', async () => {
    const session = {
      id: 'session-id',
      clientId: 'client-id',
      initialAnalysisResult: {
        client_speaker_label: 'B',
        counselor_speaker_label: 'A',
          client_utterances: [
            {
              speaker_label: 'C',
              utterance_text: '다른 발화자입니다.',
            },
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

    await expect(
      service.selectClientSpeaker('session-id', {
        clientSpeakerLabel: 'B',
      }),
      ).rejects.toBeInstanceOf(BadRequestException);
  });

    it('returns an empty keyword array when client_utterance_keywords is missing', async () => {
      const session = {
        id: 'session-id',
        clientId: 'client-id',
        initialAnalysisResult: {
          client_speaker_label: 'B',
          counselor_speaker_label: 'A',
          client_utterances: [
            {
              speaker_label: 'B',
              utterance_text: '잘 잤습니다.',
            },
          ],
          counselor_utterances: [],
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
            speakerLabel: 'B',
            utteranceText: '잘 잤습니다.',
            page: undefined,
            turnIndex: undefined,
            timestampOriginal: undefined,
          },
        ],
        clientUtteranceTotalWordCount: undefined,
        clientNameOrInitials: undefined,
        counselorUtterances: [],
        clientUtteranceKeywords: [],
      });
    });

    it('maps client_utterance_keywords when keyword counts are numeric strings', async () => {
      const session = {
        id: 'session-id',
        clientId: 'client-id',
        initialAnalysisResult: {
          client_speaker_label: 'B',
          counselor_speaker_label: 'A',
          client_utterances: [
            {
              speaker_label: 'B',
              utterance_text: '잘 잤습니다.',
            },
          ],
          counselor_utterances: [],
          client_utterance_keywords: [
            {
              keyword: '과제',
              count: '6',
            },
            {
              keyword: '그냥',
              count: '6',
            },
            {
              keyword: '성적',
              count: '3',
            },
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
            speakerLabel: 'B',
            utteranceText: '잘 잤습니다.',
            page: undefined,
            turnIndex: undefined,
            timestampOriginal: undefined,
          },
        ],
        clientUtteranceTotalWordCount: undefined,
        clientNameOrInitials: undefined,
        counselorUtterances: [],
        clientUtteranceKeywords: [
          {
            keyword: '과제',
            count: 6,
          },
          {
            keyword: '그냥',
            count: 6,
          },
          {
            keyword: '성적',
            count: 3,
          },
        ],
      });
    });

    it('maps clientUtteranceKeywords when the stored analysis uses camelCase keys', async () => {
      const session = {
        id: 'session-id',
        clientId: 'client-id',
        initialAnalysisResult: {
          client_speaker_label: 'B',
          counselor_speaker_label: 'A',
          client_utterances: [
            {
              speaker_label: 'B',
              utterance_text: '잘 잤습니다.',
            },
          ],
          counselor_utterances: [],
          clientUtteranceKeywords: [
            {
              keyword: '과제',
              count: '6',
            },
            {
              keyword: '친구',
              count: 3,
            },
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
            speakerLabel: 'B',
            utteranceText: '잘 잤습니다.',
            page: undefined,
            turnIndex: undefined,
            timestampOriginal: undefined,
          },
        ],
        clientUtteranceTotalWordCount: undefined,
        clientNameOrInitials: undefined,
        counselorUtterances: [],
        clientUtteranceKeywords: [
          {
            keyword: '과제',
            count: 6,
          },
          {
            keyword: '친구',
            count: 3,
          },
        ],
      });
    });
});
