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
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UploadedDocumentFile } from '@/agent/agent.service';
import { AnalyzeSessionDocumentDto } from '@/sessions/dto/analyze-session-document.dto';
import { ClientSpeakerSelectionResponseDto } from '@/sessions/dto/client-speaker-selection-response.dto';
import { SelectClientSpeakerDto } from '@/sessions/dto/select-client-speaker.dto';
import { SessionAnalysisResponseDto } from '@/sessions/dto/session-analysis-response.dto';
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

  @Post(':sessionId/analysis')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '세션 문서 1차 Agent 분석 실행' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: AnalyzeSessionDocumentDto })
  @ApiOkResponse({ type: SessionAnalysisResponseDto })
  @ApiBadRequestResponse({ description: '파일 누락 또는 잘못된 요청입니다.' })
  @ApiNotFoundResponse({ description: '상담 세션을 찾을 수 없습니다.' })
  @ApiBadGatewayResponse({
    description: 'Agent가 유효하지 않은 분석 결과를 반환했습니다.',
  })
  @ApiServiceUnavailableResponse({
    description: '외부 Agent API를 사용할 수 없습니다.',
  })
  analyzeSessionDocument(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @UploadedFile() file: UploadedDocumentFile | undefined,
  ): Promise<SessionAnalysisResponseDto> {
    return this.sessionsService.analyzeSessionDocument(sessionId, file);
  }

  @Post(':sessionId/speaker-selection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '세션의 내담자 발화자 선택 및 2차 Agent 추출 실행' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiOkResponse({ type: ClientSpeakerSelectionResponseDto })
  @ApiBadRequestResponse({
    description: '1차 분석 미완료 또는 분석 결과에 없는 발화자를 선택했습니다.',
  })
  @ApiNotFoundResponse({ description: '상담 세션을 찾을 수 없습니다.' })
  @ApiBadGatewayResponse({
    description: 'Agent가 유효하지 않은 내담자 전사 결과를 반환했습니다.',
  })
  @ApiServiceUnavailableResponse({
    description: '외부 Agent API를 사용할 수 없습니다.',
  })
  selectClientSpeaker(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() selectClientSpeakerDto: SelectClientSpeakerDto,
  ): Promise<ClientSpeakerSelectionResponseDto> {
    return this.sessionsService.selectClientSpeaker(
      sessionId,
      selectClientSpeakerDto,
    );
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
