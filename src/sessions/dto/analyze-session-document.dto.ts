import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeSessionDocumentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: '1차 분석할 전사 문서 파일',
  })
  file: string;
}
