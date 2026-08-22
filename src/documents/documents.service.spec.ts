import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateDocumentDto } from '@/documents/dto/create-document.dto';
import { Document, DocumentStatus } from '@/documents/entities/document.entity';
import { DocumentsService } from '@/documents/documents.service';
import { Session } from '@/sessions/entities/session.entity';

type MockRepository<T extends object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('DocumentsService', () => {
  let service: DocumentsService;
  let documentsRepository: MockRepository<Document>;
  let sessionsRepository: MockRepository<Session>;

  beforeEach(() => {
    documentsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
      merge: jest.fn(),
    };
    sessionsRepository = {
      findOneBy: jest.fn(),
    };

    service = new DocumentsService(
      documentsRepository as unknown as Repository<Document>,
      sessionsRepository as unknown as Repository<Session>,
    );
  });

  it('creates a document for an existing session', async () => {
    const dto: CreateDocumentDto = {
      fileName: 'counseling-note.pdf',
      fileUrl: 'https://example.com/files/counseling-note.pdf',
      mimeType: 'application/pdf',
      status: DocumentStatus.UPLOADED,
    };
    const createdAt = new Date('2026-08-22T10:00:00.000Z');
    const updatedAt = new Date('2026-08-22T10:00:00.000Z');

    sessionsRepository.findOneBy!.mockResolvedValue({ id: 'session-id' });
    documentsRepository.create!.mockReturnValue({
      sessionId: 'session-id',
      ...dto,
    });
    documentsRepository.save!.mockResolvedValue({
      id: 'document-id',
      sessionId: 'session-id',
      ...dto,
      createdAt,
      updatedAt,
    });

    await expect(service.create('session-id', dto)).resolves.toEqual({
      id: 'document-id',
      sessionId: 'session-id',
      fileName: dto.fileName,
      fileUrl: dto.fileUrl,
      mimeType: dto.mimeType,
      status: dto.status,
      createdAt,
      updatedAt,
    });
  });

  it('rejects document creation for a nonexistent session', async () => {
    sessionsRepository.findOneBy!.mockResolvedValue(null);

    await expect(
      service.create('missing-session', {
        fileName: 'counseling-note.pdf',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gets documents for a session', async () => {
    sessionsRepository.findOneBy!.mockResolvedValue({ id: 'session-id' });
    documentsRepository.find!.mockResolvedValue([
      {
        id: 'document-id',
        sessionId: 'session-id',
        fileName: 'counseling-note.pdf',
        fileUrl: 'https://example.com/files/counseling-note.pdf',
        mimeType: 'application/pdf',
        status: DocumentStatus.UPLOADED,
        createdAt: new Date('2026-08-22T10:00:00.000Z'),
        updatedAt: new Date('2026-08-22T10:00:00.000Z'),
      },
    ] as Document[]);

    await expect(service.findAllBySession('session-id')).resolves.toEqual([
      {
        id: 'document-id',
        sessionId: 'session-id',
        fileName: 'counseling-note.pdf',
        fileUrl: 'https://example.com/files/counseling-note.pdf',
        mimeType: 'application/pdf',
        status: DocumentStatus.UPLOADED,
        createdAt: new Date('2026-08-22T10:00:00.000Z'),
        updatedAt: new Date('2026-08-22T10:00:00.000Z'),
      },
    ]);
  });
});
