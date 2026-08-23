import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionAnalysisResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 'completed' })
  status: string;

  @ApiPropertyOptional({
    example: 'realtime_note',
    description: 'Agent가 판별한 문서 유형',
  })
  documentType?: string;

  @ApiProperty({
    example: '발화자 2',
    nullable: true,
  })
  clientSpeakerLabel: string | null;

  @ApiProperty({
    example: '발화자 1',
    nullable: true,
  })
  counselorSpeakerLabel: string | null;

  @ApiProperty({
    type: 'array',
    items: { type: 'string' },
    example: ['발화자 1', '발화자 2'],
  })
  speakers: string[];

  @ApiProperty({
    description: '1차 Agent 분석에서 파싱한 JSON 결과',
    type: 'object',
    additionalProperties: true,
  })
  analysisResult: Record<string, unknown>;

  @ApiPropertyOptional({
    example: '2026-04-15',
    description: '상담 날짜',
  })
  counselingDate?: string;

  @ApiPropertyOptional({
    example: '원문 전체 텍스트',
    description: 'realtime_note 문서의 원문 텍스트',
  })
  fullOriginalText?: string;

  @ApiPropertyOptional({
    example: '가독성을 높여 구조화한 텍스트',
    description: 'realtime_note 문서의 구조화된 표시용 텍스트',
  })
  readableStructuredText?: string;
}
