import { PartialType } from '@nestjs/swagger';
import { CreateDocumentDto } from '@/documents/dto/create-document.dto';

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}
