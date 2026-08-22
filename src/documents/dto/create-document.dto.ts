import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentStatus } from '@/documents/entities/document.entity';

export class CreateDocumentDto {
  @ApiProperty({
    description: '문서 파일명',
    example: 'counseling-note.pdf',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiPropertyOptional({
    description: '문서 접근 URL 또는 저장 위치 식별자',
    example: 'https://example.com/files/counseling-note.pdf',
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional({
    description: '문서 MIME 타입',
    example: 'application/pdf',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimeType?: string;

  @ApiPropertyOptional({
    description: '문서 처리 상태',
    enum: DocumentStatus,
    default: DocumentStatus.UPLOADED,
  })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}
