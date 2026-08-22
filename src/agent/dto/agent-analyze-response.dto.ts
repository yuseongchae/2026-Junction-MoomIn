import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgentAnalyzeResponseDto {
  @ApiProperty({
    description: 'Upstage Responses API 응답 ID',
    example: 'resp_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Agent 작업 상태',
    example: 'completed',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Agent 단계별 출력 결과',
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: true,
    },
  })
  output?: Record<string, unknown>[];

  @ApiPropertyOptional({
    description: '실패 시 Agent가 반환한 오류 또는 실패 메시지',
    oneOf: [
      {
        type: 'object',
        additionalProperties: true,
      },
      {
        type: 'string',
      },
    ],
  })
  error?: Record<string, unknown> | string;
}
