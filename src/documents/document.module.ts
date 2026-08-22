import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '@/documents/entities/document.entity';
import { DocumentsController } from '@/documents/documents.controller';
import { DocumentsService } from '@/documents/documents.service';
import { SessionDocumentsController } from '@/documents/session-documents.controller';
import { Session } from '@/sessions/entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document, Session])],
  controllers: [SessionDocumentsController, DocumentsController],
  providers: [DocumentsService],
  exports: [TypeOrmModule, DocumentsService],
})
export class DocumentModule {}
