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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ClientsService } from '@/clients/clients.service';
import { ClientResponseDto } from '@/clients/dto/client-response.dto';
import { CreateClientDto } from '@/clients/dto/create-client.dto';
import { UpdateClientDto } from '@/clients/dto/update-client.dto';

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @ApiOperation({ summary: '내담자 생성' })
  @ApiCreatedResponse({ type: ClientResponseDto })
  create(@Body() createClientDto: CreateClientDto): Promise<ClientResponseDto> {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  @ApiOperation({ summary: '내담자 목록 조회' })
  @ApiOkResponse({ type: ClientResponseDto, isArray: true })
  findAll(): Promise<ClientResponseDto[]> {
    return this.clientsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '내담자 단건 조회' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiNotFoundResponse({ description: '내담자를 찾을 수 없습니다.' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ClientResponseDto> {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '내담자 수정' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiNotFoundResponse({ description: '내담자를 찾을 수 없습니다.' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateClientDto: UpdateClientDto,
  ): Promise<ClientResponseDto> {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '내담자 삭제' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: '내담자를 삭제했습니다.' })
  @ApiNotFoundResponse({ description: '내담자를 찾을 수 없습니다.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.clientsService.remove(id);
  }
}
