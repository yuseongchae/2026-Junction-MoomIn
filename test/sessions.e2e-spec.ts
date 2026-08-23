import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { SessionsController } from '@/sessions/sessions.controller';
import { SessionsService } from '@/sessions/sessions.service';
import { configureApp } from '@/configure-app';

describe('SessionsController (e2e)', () => {
  let app: INestApplication<App>;
  const sessionsService = {
    findOne: jest.fn(),
    getAnalysis: jest.fn(),
    getOriginalDocument: jest.fn(),
    getOriginalDocumentPreview: jest.fn(),
    getKeywordDetail: jest.fn(),
    analyzeSessionDocument: jest.fn(),
    selectClientSpeaker: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        {
          provide: SessionsService,
          useValue: sessionsService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    jest.clearAllMocks();
  });

  it('POST /api/sessions/:sessionId/analysis accepts multipart file upload', async () => {
    sessionsService.analyzeSessionDocument.mockResolvedValue({
      sessionId: '11111111-1111-1111-1111-111111111111',
      status: 'completed',
      clientSpeakerLabel: '발화자 2',
      counselorSpeakerLabel: '발화자 1',
      speakers: ['발화자 1', '발화자 2'],
      analysisResult: {
        client_speaker_label: '발화자 2',
        counselor_speaker_label: '발화자 1',
      },
    });

    await request(app.getHttpServer())
      .post('/api/sessions/11111111-1111-1111-1111-111111111111/analysis')
      .attach('file', Buffer.from('A: 안녕하세요\nB: 반갑습니다'), 'sample.txt')
      .expect(200)
      .expect({
        sessionId: '11111111-1111-1111-1111-111111111111',
        status: 'completed',
        clientSpeakerLabel: '발화자 2',
        counselorSpeakerLabel: '발화자 1',
        speakers: ['발화자 1', '발화자 2'],
        analysisResult: {
          client_speaker_label: '발화자 2',
          counselor_speaker_label: '발화자 1',
        },
      });
  });

  it('GET /api/sessions/:sessionId/analysis returns stored realtime note analysis', async () => {
    sessionsService.getAnalysis.mockResolvedValue({
      sessionId: '11111111-1111-1111-1111-111111111111',
      status: 'completed',
      documentType: 'realtime_note',
      clientSpeakerLabel: null,
      counselorSpeakerLabel: null,
      speakers: [],
      counselingDate: '2026-04-15',
      fullOriginalText: '원문 전체',
      readableStructuredText: '구조화 텍스트',
      analysisResult: {
        document_type: 'realtime_note',
        full_original_text: '원문 전체',
        readable_structured_text: '구조화 텍스트',
      },
    });

    await request(app.getHttpServer())
      .get('/api/sessions/11111111-1111-1111-1111-111111111111/analysis')
      .expect(200)
      .expect({
        sessionId: '11111111-1111-1111-1111-111111111111',
        status: 'completed',
        documentType: 'realtime_note',
        clientSpeakerLabel: null,
        counselorSpeakerLabel: null,
        speakers: [],
        counselingDate: '2026-04-15',
        fullOriginalText: '원문 전체',
        readableStructuredText: '구조화 텍스트',
        analysisResult: {
          document_type: 'realtime_note',
          full_original_text: '원문 전체',
          readable_structured_text: '구조화 텍스트',
        },
      });
  });

  it('GET /api/sessions/:sessionId/original-document returns binary image', async () => {
    sessionsService.getOriginalDocument.mockResolvedValue({
      fileName: '상담일지.heic',
      mimeType: 'image/heic',
      buffer: Buffer.from('image-bytes'),
      contentLength: Buffer.byteLength('image-bytes'),
    });

    await request(app.getHttpServer())
      .get(
        '/api/sessions/11111111-1111-1111-1111-111111111111/original-document',
      )
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect('Content-Type', 'image/heic')
      .expect(
        'Content-Disposition',
        "inline; filename*=UTF-8''%EC%83%81%EB%8B%B4%EC%9D%BC%EC%A7%80.heic",
      )
      .expect((response) => {
        expect(Buffer.isBuffer(response.body)).toBe(true);
        expect(response.body.equals(Buffer.from('image-bytes'))).toBe(true);
      });
  });

  it('GET /api/sessions/:sessionId/original-document rejects invalid uuid', async () => {
    await request(app.getHttpServer())
      .get('/api/sessions/invalid-uuid/original-document')
      .expect(400);
  });

  it('GET /api/sessions/:sessionId/original-document/preview returns jpeg binary', async () => {
    sessionsService.getOriginalDocumentPreview.mockResolvedValue({
      fileName: 'memo2.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([255, 216, 255, 224]),
      contentLength: 4,
    });

    await request(app.getHttpServer())
      .get(
        '/api/sessions/11111111-1111-1111-1111-111111111111/original-document/preview',
      )
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect('Content-Type', 'image/jpeg')
      .expect('Content-Disposition', "inline; filename*=UTF-8''memo2.jpg")
      .expect((response) => {
        expect(Buffer.isBuffer(response.body)).toBe(true);
        expect(response.body.equals(Buffer.from([255, 216, 255, 224]))).toBe(
          true,
        );
      });
  });

  it('GET /api/sessions/:sessionId/original-document/preview rejects invalid uuid', async () => {
    await request(app.getHttpServer())
      .get('/api/sessions/invalid-uuid/original-document/preview')
      .expect(400);
  });

  it('POST /api/sessions/:sessionId/speaker-selection validates request body', async () => {
    await request(app.getHttpServer())
      .post(
        '/api/sessions/11111111-1111-1111-1111-111111111111/speaker-selection',
      )
      .send({})
      .expect(400);
  });

  it('POST /api/sessions/:sessionId/speaker-selection returns client-only transcript', async () => {
    sessionsService.selectClientSpeaker.mockResolvedValue({
      sessionId: '11111111-1111-1111-1111-111111111111',
      clientSpeakerLabel: 'B',
      status: 'completed',
      clientUtteranceTotalWordCount: 4,
      clientNameOrInitials: '서연',
      clientUtterances: [
        {
          page: 1,
          turnIndex: 2,
          speakerLabel: 'B',
          utteranceText: '잘 잤습니다.',
          timestampOriginal: '00:04',
        },
        {
          page: 1,
          turnIndex: 4,
          speakerLabel: 'B',
          utteranceText: '사이가 요즘은 괜찮아요.',
          timestampOriginal: '00:14',
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
          keyword: '관계',
          count: 1,
        },
      ],
    });

    await request(app.getHttpServer())
      .post(
        '/api/sessions/11111111-1111-1111-1111-111111111111/speaker-selection',
      )
      .send({
        clientSpeakerLabel: 'B',
      })
      .expect(200)
      .expect({
        sessionId: '11111111-1111-1111-1111-111111111111',
        clientSpeakerLabel: 'B',
        status: 'completed',
        clientUtteranceTotalWordCount: 4,
        clientNameOrInitials: '서연',
        clientUtterances: [
          {
            page: 1,
            turnIndex: 2,
            speakerLabel: 'B',
            utteranceText: '잘 잤습니다.',
            timestampOriginal: '00:04',
          },
          {
            page: 1,
            turnIndex: 4,
            speakerLabel: 'B',
            utteranceText: '사이가 요즘은 괜찮아요.',
            timestampOriginal: '00:14',
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
            keyword: '관계',
            count: 1,
          },
        ],
      });
  });

    it('GET /api/sessions/:sessionId/keywords/:keyword returns keyword detail', async () => {
      sessionsService.getKeywordDetail.mockResolvedValue({
        keyword: '과제',
        count: 6,
        contexts: ['문맥 1', '문맥 2'],
      });

      await request(app.getHttpServer())
        .get(
          '/api/sessions/11111111-1111-1111-1111-111111111111/keywords/%EA%B3%BC%EC%A0%9C',
        )
        .expect(200)
        .expect({
          keyword: '과제',
          count: 6,
          contexts: ['문맥 1', '문맥 2'],
        });
    });

  afterEach(async () => {
    await app.close();
  });
});
