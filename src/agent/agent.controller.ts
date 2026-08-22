import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AgentAnalyzeResponseDto } from '@/agent/dto/agent-analyze-response.dto';
import { AnalyzeDocumentDto } from '@/agent/dto/analyze-document.dto';
import { AgentService } from '@/agent/agent.service';

type UploadedDocumentFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
};

@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('analyze')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '문서 분석 Agent 실행' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: AnalyzeDocumentDto })
  @ApiOkResponse({ type: AgentAnalyzeResponseDto })
  @ApiBadRequestResponse({ description: '잘못된 요청 또는 파일 누락' })
  @ApiUnauthorizedResponse({ description: 'Agent 인증 실패' })
  @ApiForbiddenResponse({ description: 'Agent 접근 권한 없음' })
  @ApiNotFoundResponse({ description: 'Agent 또는 리소스를 찾을 수 없음' })
  @ApiTooManyRequestsResponse({ description: 'Agent API 요청 제한 초과' })
  @ApiBadGatewayResponse({ description: '외부 Agent API 호출 실패' })
  @ApiServiceUnavailableResponse({ description: '외부 Agent API 사용 불가' })
  analyzeDocument(
    @UploadedFile() file: UploadedDocumentFile | undefined,
  ): Promise<AgentAnalyzeResponseDto> {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    return this.agentService.analyzeDocument(file);
  }
}
