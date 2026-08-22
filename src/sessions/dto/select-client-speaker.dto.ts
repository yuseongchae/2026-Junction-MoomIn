import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SelectClientSpeakerDto {
  @ApiProperty({
    description: '내담자로 선택한 발화자 라벨',
    example: '발화자 2',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  speakerLabel: string;
}
