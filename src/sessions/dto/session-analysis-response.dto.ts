import { ApiProperty } from '@nestjs/swagger';

export class SessionAnalysisResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 'completed' })
  status: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'string' },
    example: ['A', 'B'],
  })
  availableSpeakerLabels: string[];

  @ApiProperty({
    description: '1차 Agent 분석에서 파싱한 JSON 결과',
    type: 'object',
    additionalProperties: true,
  })
  analysisResult: Record<string, unknown>;
}
