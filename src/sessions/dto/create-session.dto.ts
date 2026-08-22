import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @ApiPropertyOptional({
    description: '상담 세션 일시',
    example: '2026-08-22T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  sessionDate?: string;

  @ApiPropertyOptional({
    description: '상담 세션 메모',
    example: '초기 상담 진행',
  })
  @IsOptional()
  @IsString()
  summary?: string;
}
