import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDocumentDto } from '@/documents/dto/create-document.dto';
import { DocumentResponseDto } from '@/documents/dto/document-response.dto';
import { UpdateDocumentDto } from '@/documents/dto/update-document.dto';
import { Document, DocumentStatus } from '@/documents/entities/document.entity';
import { Session } from '@/sessions/entities/session.entity';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentsRepository: Repository<Document>,
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
  ) {}

  async create(
    sessionId: string,
    createDocumentDto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    await this.findSessionOrThrow(sessionId);

    const document = this.documentsRepository.create({
      sessionId,
      fileName: createDocumentDto.fileName,
      fileUrl: createDocumentDto.fileUrl ?? null,
      mimeType: createDocumentDto.mimeType ?? null,
      status: createDocumentDto.status ?? DocumentStatus.UPLOADED,
    });
    const savedDocument = await this.documentsRepository.save(document);

    return this.toResponse(savedDocument);
  }

  async findAllBySession(sessionId: string): Promise<DocumentResponseDto[]> {
    await this.findSessionOrThrow(sessionId);

    const documents = await this.documentsRepository.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
    });

    return documents.map((document) => this.toResponse(document));
  }

  async findOne(id: string): Promise<DocumentResponseDto> {
    const document = await this.findEntityOrThrow(id);

    return this.toResponse(document);
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.findEntityOrThrow(id);
    const updatedDocument = this.documentsRepository.merge(document, {
      fileName:
        updateDocumentDto.fileName !== undefined
          ? updateDocumentDto.fileName
          : document.fileName,
      fileUrl:
        updateDocumentDto.fileUrl !== undefined
          ? (updateDocumentDto.fileUrl ?? null)
          : document.fileUrl,
      mimeType:
        updateDocumentDto.mimeType !== undefined
          ? (updateDocumentDto.mimeType ?? null)
          : document.mimeType,
      status:
        updateDocumentDto.status !== undefined
          ? updateDocumentDto.status
          : document.status,
    });
    const savedDocument = await this.documentsRepository.save(updatedDocument);

    return this.toResponse(savedDocument);
  }

  async remove(id: string): Promise<void> {
    const document = await this.findEntityOrThrow(id);
    await this.documentsRepository.remove(document);
  }

  async findEntityOrThrow(id: string): Promise<Document> {
    const document = await this.documentsRepository.findOneBy({ id });

    if (!document) {
      throw new NotFoundException(`Document with id ${id} not found`);
    }

    return document;
  }

  private async findSessionOrThrow(sessionId: string): Promise<Session> {
    const session = await this.sessionsRepository.findOneBy({ id: sessionId });

    if (!session) {
      throw new NotFoundException(`Session with id ${sessionId} not found`);
    }

    return session;
  }

  private toResponse(document: Document): DocumentResponseDto {
    return {
      id: document.id,
      sessionId: document.sessionId,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      mimeType: document.mimeType,
      status: document.status,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}
