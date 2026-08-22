import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';
import { toFile } from 'openai/uploads';
import { AgentAnalyzeResponseDto } from '@/agent/dto/agent-analyze-response.dto';

const UPSTAGE_AGENT_BASE_URL = 'https://api.upstage.ai/v2';
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 60;

type UploadedDocumentFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
};

@Injectable()
export class AgentService {
  constructor(private readonly configService: ConfigService) {}

  async analyzeDocument(
    file: UploadedDocumentFile | undefined,
  ): Promise<AgentAnalyzeResponseDto> {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const agentId = this.configService.get<string>('AGENT_ID');
    const agentApiKey = this.configService.get<string>('AGENT_API_KEY');

    if (!agentId || !agentApiKey) {
      throw new InternalServerErrorException(
        'Agent integration is not configured',
      );
    }

    const client = new OpenAI({
      apiKey: agentApiKey,
      baseURL: UPSTAGE_AGENT_BASE_URL,
    });

    let uploadedFileId: string | null = null;

    try {
      const uploadedFile = await client.files.create({
        file: await toFile(
          file.buffer,
          this.getSafeFilename(file.originalname),
          file.mimetype
            ? { type: file.mimetype }
            : { type: 'application/octet-stream' },
        ),
        purpose: 'user_data',
      });
      uploadedFileId = uploadedFile.id;

      const response = await client.responses.create({
        model: agentId,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                file_id: uploadedFile.id,
              },
            ],
          },
        ],
      });

      const completedResponse = await this.pollUntilFinished(
        client,
        response.id,
      );

      return this.toResponseDto(completedResponse);
    } catch (error) {
      return this.handleAgentError(error);
    } finally {
      if (uploadedFileId) {
        await client.files.delete(uploadedFileId).catch(() => undefined);
      }
    }
  }

  private async pollUntilFinished(
    client: OpenAI,
    responseId: string,
  ): Promise<OpenAI.Responses.Response> {
    let attempts = 0;
    let currentResponse = await client.responses.retrieve(responseId);

    while (
      currentResponse.status === 'queued' ||
      currentResponse.status === 'in_progress'
    ) {
      if (attempts >= MAX_POLL_ATTEMPTS) {
        throw new ServiceUnavailableException(
          'Agent analysis timed out before completion',
        );
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      currentResponse = await client.responses.retrieve(responseId);
      attempts += 1;
    }

    return currentResponse;
  }

  private toResponseDto(
    response: OpenAI.Responses.Response,
  ): AgentAnalyzeResponseDto {
    const failureMessage =
      response.status === 'failed'
        ? (response.error ?? 'Agent analysis failed')
        : undefined;

    return {
      id: response.id,
      status: response.status ?? 'unknown',
      output:
        response.output?.map(
          (item) => item as unknown as Record<string, unknown>,
        ) ?? undefined,
      error: failureMessage as Record<string, unknown> | string | undefined,
    };
  }

  private handleAgentError(error: unknown): never {
    if (error instanceof APIError) {
      const message = this.getSafeErrorMessage(error);

      switch (error.status) {
        case 400:
          throw new BadRequestException(message);
        case 401:
          throw new UnauthorizedException('Agent authentication failed');
        case 403:
          throw new ForbiddenException('Agent access denied');
        case 404:
          throw new NotFoundException(message);
        case 429:
          throw new HttpException(
            'Agent rate limit exceeded',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        case 502:
          throw new BadGatewayException(
            'Agent API returned a bad gateway error',
          );
        case 503:
          throw new ServiceUnavailableException('Agent API is unavailable');
        default:
          throw new BadGatewayException(message);
      }
    }

    if (error instanceof BadRequestException) {
      throw error;
    }

    if (error instanceof UnauthorizedException) {
      throw error;
    }

    if (error instanceof ForbiddenException) {
      throw error;
    }

    if (error instanceof NotFoundException) {
      throw error;
    }

    if (error instanceof HttpException && error.getStatus() === 429) {
      throw error;
    }

    if (error instanceof ServiceUnavailableException) {
      throw error;
    }

    if (error instanceof InternalServerErrorException) {
      throw error;
    }

    throw new InternalServerErrorException(
      'Unexpected error occurred while analyzing the document',
    );
  }

  private getSafeErrorMessage(error: { message?: string }): string {
    const rawMessage =
      typeof error.message === 'string'
        ? error.message
        : 'Agent request failed';

    return rawMessage.replace(/up_[a-zA-Z0-9_-]+/g, '[REDACTED_AGENT_API_KEY]');
  }

  private getSafeFilename(originalname: string): string {
    const trimmedName = originalname.trim();

    if (!trimmedName) {
      return 'document';
    }

    return trimmedName.replace(/[^\w.\-()]/g, '_');
  }
}
