import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClientUtteranceDto {
  @ApiPropertyOptional({ example: 1 })
  page?: number;

  @ApiPropertyOptional({ example: 2 })
  turnIndex?: number;

  @ApiProperty({ example: '발화자 2' })
  speakerLabel: string;

  @ApiProperty({ example: '그냥 비슷했어요. 별일 없었어요.' })
  utteranceText: string;

  @ApiPropertyOptional({ example: '00:04' })
  timestampOriginal?: string;
}

export class ClientSpeakerSelectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: '발화자 2' })
  clientSpeakerLabel: string;

  @ApiProperty({ example: 'completed' })
  status: string;

  @ApiProperty({ type: ClientUtteranceDto, isArray: true })
  clientUtterances: ClientUtteranceDto[];
}
