import { ApiProperty } from '@nestjs/swagger';

export class KeywordDetailResponseDto {
  @ApiProperty({ example: '과제' })
  keyword: string;

  @ApiProperty({ example: 6 })
  count: number;

  @ApiProperty({
    example: [
      '지난주에 기록지 써보기로 했었죠. 해보셨어요?',
      '화요일에 어떤 일이 있었어요?',
    ],
    type: String,
    isArray: true,
  })
  contexts: string[];
}
