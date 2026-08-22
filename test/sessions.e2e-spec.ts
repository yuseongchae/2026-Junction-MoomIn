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
      availableSpeakerLabels: ['A', 'B'],
      analysisResult: {
        speakers: ['A', 'B'],
      },
    });

    await request(app.getHttpServer())
      .post('/api/sessions/11111111-1111-1111-1111-111111111111/analysis')
      .attach('file', Buffer.from('A: 안녕하세요\nB: 반갑습니다'), 'sample.txt')
      .expect(200)
      .expect({
        sessionId: '11111111-1111-1111-1111-111111111111',
        status: 'completed',
        availableSpeakerLabels: ['A', 'B'],
        analysisResult: {
          speakers: ['A', 'B'],
        },
      });
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
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
