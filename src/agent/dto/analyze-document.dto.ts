import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeDocumentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: '분석할 문서 파일',
  })
  file: string;
}
