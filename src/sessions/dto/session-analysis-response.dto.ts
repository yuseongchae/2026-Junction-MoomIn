import { ApiProperty } from '@nestjs/swagger';

export class SessionAnalysisResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 'completed' })
  status: string;

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
}
