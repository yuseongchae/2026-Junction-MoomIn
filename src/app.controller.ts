import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from '@/app.service';

@ApiTags('health')
@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '서버 헬스 체크' })
  @ApiOkResponse({
    description: '서버가 정상 실행 중입니다.',
    schema: {
      example: {
        status: 'ok',
        message: 'Moomin backend is running',
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
