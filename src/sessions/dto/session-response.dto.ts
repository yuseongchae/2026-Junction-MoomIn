import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  clientId: string;

  @ApiPropertyOptional()
  sessionDate: Date | null;

  @ApiPropertyOptional()
  summary: string | null;

  @ApiPropertyOptional()
  clientSpeakerLabel: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
