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
import { DocumentsService } from '@/documents/documents.service';
import { CreateDocumentDto } from '@/documents/dto/create-document.dto';
import { DocumentResponseDto } from '@/documents/dto/document-response.dto';

@ApiTags('documents')
@Controller('sessions/:sessionId/documents')
export class SessionDocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @ApiOperation({ summary: '상담 세션 문서 메타데이터 생성' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiCreatedResponse({ type: DocumentResponseDto })
  @ApiNotFoundResponse({ description: '상담 세션을 찾을 수 없습니다.' })
  create(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() createDocumentDto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.create(sessionId, createDocumentDto);
  }

  @Get()
  @ApiOperation({ summary: '상담 세션별 문서 목록 조회' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiOkResponse({ type: DocumentResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: '상담 세션을 찾을 수 없습니다.' })
  findAll(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<DocumentResponseDto[]> {
    return this.documentsService.findAllBySession(sessionId);
  }
}
