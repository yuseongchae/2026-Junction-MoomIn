import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSessionDto } from '@/sessions/dto/create-session.dto';
import { SessionResponseDto } from '@/sessions/dto/session-response.dto';
import { SessionsService } from '@/sessions/sessions.service';

@ApiTags('sessions')
@Controller('clients/:clientId/sessions')
export class ClientSessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @ApiOperation({ summary: '내담자 상담 세션 생성' })
  @ApiParam({ name: 'clientId', format: 'uuid' })
  @ApiCreatedResponse({ type: SessionResponseDto })
  @ApiNotFoundResponse({ description: '내담자를 찾을 수 없습니다.' })
  create(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
    @Body() createSessionDto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    return this.sessionsService.create(clientId, createSessionDto);
  }

  @Get()
  @ApiOperation({ summary: '내담자별 상담 세션 목록 조회' })
  @ApiParam({ name: 'clientId', format: 'uuid' })
  @ApiOkResponse({ type: SessionResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: '내담자를 찾을 수 없습니다.' })
  findAll(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
  ): Promise<SessionResponseDto[]> {
    return this.sessionsService.findAllByClient(clientId);
  }
}
