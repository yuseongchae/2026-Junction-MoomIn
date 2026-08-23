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
  Res,
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
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { UploadedDocumentFile } from '@/agent/agent.service';
import { AnalyzeSessionDocumentDto } from '@/sessions/dto/analyze-session-document.dto';
import { ClientSpeakerSelectionResponseDto } from '@/sessions/dto/client-speaker-selection-response.dto';
import { KeywordDetailResponseDto } from '@/sessions/dto/keyword-detail-response.dto';
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

  @Get(':sessionId/analysis')
  @ApiOperation({ summary: '세션에 저장된 1차 분석 결과 조회' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiOkResponse({ type: SessionAnalysisResponseDto })
  @ApiNotFoundResponse({
    description: '상담 세션 또는 저장된 분석 결과를 찾을 수 없습니다.',
  })
  getAnalysis(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<SessionAnalysisResponseDto> {
    return this.sessionsService.getAnalysis(sessionId);
  }

  @Get(':sessionId/original-document')
  @ApiOperation({ summary: '세션의 원본 업로드 문서 조회' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiProduces('image/jpeg', 'image/png', 'image/heic', 'image/heif')
  @ApiOkResponse({
    description: '원본 문서 바이너리를 반환합니다.',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiNotFoundResponse({
    description: '상담 세션 또는 원본 문서를 찾을 수 없습니다.',
  })
  async getOriginalDocument(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Res() response: Response,
  ): Promise<void> {
    const originalDocument =
      await this.sessionsService.getOriginalDocument(sessionId);

    response.setHeader('Content-Type', originalDocument.mimeType);
    response.setHeader(
      'Content-Disposition',
      this.buildInlineContentDisposition(originalDocument.fileName),
    );
    response.setHeader(
      'Content-Length',
      String(originalDocument.contentLength),
    );
    response.send(originalDocument.buffer);
  }

  @Get(':sessionId/original-document/preview')
  @ApiOperation({ summary: '세션의 원본 업로드 문서 미리보기 조회' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiProduces('image/jpeg', 'image/png')
  @ApiOkResponse({
    description: '브라우저 표시용 미리보기 바이너리를 반환합니다.',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiNotFoundResponse({
    description: '상담 세션 또는 원본 문서를 찾을 수 없습니다.',
  })
  async getOriginalDocumentPreview(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Res() response: Response,
  ): Promise<void> {
    const previewDocument =
      await this.sessionsService.getOriginalDocumentPreview(sessionId);

    response.setHeader('Content-Type', previewDocument.mimeType);
    response.setHeader(
      'Content-Disposition',
      this.buildInlineContentDisposition(previewDocument.fileName),
    );
    response.setHeader(
      'Content-Length',
      String(previewDocument.contentLength),
    );
    response.send(previewDocument.buffer);
  }

  @Get(':sessionId/keywords/:keyword')
  @ApiOperation({ summary: '세션 분석 결과에서 특정 키워드 상세 조회' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiParam({ name: 'keyword', description: '조회할 키워드(URI 인코딩 허용)' })
  @ApiOkResponse({ type: KeywordDetailResponseDto })
  @ApiNotFoundResponse({
    description: '상담 세션 또는 요청한 키워드를 찾을 수 없습니다.',
  })
  getKeywordDetail(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('keyword') keyword: string,
  ): Promise<KeywordDetailResponseDto> {
    return this.sessionsService.getKeywordDetail(sessionId, keyword);
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

  private buildInlineContentDisposition(fileName: string): string {
    const encodedFileName = encodeURIComponent(fileName);

    return `inline; filename*=UTF-8''${encodedFileName}`;
  }
}
