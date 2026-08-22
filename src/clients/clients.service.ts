import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientResponseDto } from '@/clients/dto/client-response.dto';
import { CreateClientDto } from '@/clients/dto/create-client.dto';
import { UpdateClientDto } from '@/clients/dto/update-client.dto';
import { Client } from '@/clients/entities/client.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
  ) {}

  async create(createClientDto: CreateClientDto): Promise<ClientResponseDto> {
    const client = this.clientsRepository.create(createClientDto);
    const savedClient = await this.clientsRepository.save(client);

    return this.toResponse(savedClient);
  }

  async findAll(): Promise<ClientResponseDto[]> {
    const clients = await this.clientsRepository.find({
      order: { createdAt: 'DESC' },
    });

    return clients.map((client) => this.toResponse(client));
  }

  async findOne(id: string): Promise<ClientResponseDto> {
    const client = await this.findEntityOrThrow(id);

    return this.toResponse(client);
  }

  async update(
    id: string,
    updateClientDto: UpdateClientDto,
  ): Promise<ClientResponseDto> {
    const client = await this.findEntityOrThrow(id);
    const updatedClient = this.clientsRepository.merge(client, updateClientDto);
    const savedClient = await this.clientsRepository.save(updatedClient);

    return this.toResponse(savedClient);
  }

  async remove(id: string): Promise<void> {
    const client = await this.findEntityOrThrow(id);
    await this.clientsRepository.remove(client);
  }

  async findEntityOrThrow(id: string): Promise<Client> {
    const client = await this.clientsRepository.findOneBy({ id });

    if (!client) {
      throw new NotFoundException(`Client with id ${id} not found`);
    }

    return client;
  }

  private toResponse(client: Client): ClientResponseDto {
    return {
      id: client.id,
      name: client.name,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }
}
