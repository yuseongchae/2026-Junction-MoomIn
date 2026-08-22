import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({
    description: '내담자 이름',
    example: '김무민',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  name: string;
}
