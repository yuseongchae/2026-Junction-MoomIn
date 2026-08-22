import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { SessionResponseDto } from '@/sessions/dto/session-response.dto';
import { UpdateSessionDto } from '@/sessions/dto/update-session.dto';
import { SessionsService } from '@/sessions/sessions.service';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get(':id')
  @ApiOperation({ summary: '상담 세션 단건 조회' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiNotFoundResponse({ description: '상담 세션을 찾을 수 없습니다.' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SessionResponseDto> {
    return this.sessionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '상담 세션 수정' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiNotFoundResponse({ description: '상담 세션을 찾을 수 없습니다.' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateSessionDto: UpdateSessionDto,
  ): Promise<SessionResponseDto> {
    return this.sessionsService.update(id, updateSessionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '상담 세션 삭제' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: '상담 세션을 삭제했습니다.' })
  @ApiNotFoundResponse({ description: '상담 세션을 찾을 수 없습니다.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.sessionsService.remove(id);
  }
}
