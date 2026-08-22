import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { CreateSessionDto } from '@/sessions/dto/create-session.dto';
import { SessionResponseDto } from '@/sessions/dto/session-response.dto';
import { UpdateSessionDto } from '@/sessions/dto/update-session.dto';
import { Session } from '@/sessions/entities/session.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
  ) {}

  async create(
    clientId: string,
    createSessionDto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    await this.findClientOrThrow(clientId);

    const session = this.sessionsRepository.create({
      clientId,
      sessionDate: createSessionDto.sessionDate
        ? new Date(createSessionDto.sessionDate)
        : null,
      summary: createSessionDto.summary ?? null,
    });
    const savedSession = await this.sessionsRepository.save(session);

    return this.toResponse(savedSession);
  }

  async findAllByClient(clientId: string): Promise<SessionResponseDto[]> {
    await this.findClientOrThrow(clientId);

    const sessions = await this.sessionsRepository.find({
      where: { clientId },
      order: { sessionDate: 'DESC', createdAt: 'DESC' },
    });

    return sessions.map((session) => this.toResponse(session));
  }

  async findOne(id: string): Promise<SessionResponseDto> {
    const session = await this.findEntityOrThrow(id);

    return this.toResponse(session);
  }

  async update(
    id: string,
    updateSessionDto: UpdateSessionDto,
  ): Promise<SessionResponseDto> {
    const session = await this.findEntityOrThrow(id);
    const updatedSession = this.sessionsRepository.merge(session, {
      sessionDate:
        updateSessionDto.sessionDate !== undefined
          ? updateSessionDto.sessionDate
            ? new Date(updateSessionDto.sessionDate)
            : null
          : session.sessionDate,
      summary:
        updateSessionDto.summary !== undefined
          ? (updateSessionDto.summary ?? null)
          : session.summary,
    });
    const savedSession = await this.sessionsRepository.save(updatedSession);

    return this.toResponse(savedSession);
  }

  async remove(id: string): Promise<void> {
    const session = await this.findEntityOrThrow(id);
    await this.sessionsRepository.remove(session);
  }

  async findEntityOrThrow(id: string): Promise<Session> {
    const session = await this.sessionsRepository.findOneBy({ id });

    if (!session) {
      throw new NotFoundException(`Session with id ${id} not found`);
    }

    return session;
  }

  private async findClientOrThrow(clientId: string): Promise<Client> {
    const client = await this.clientsRepository.findOneBy({ id: clientId });

    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    return client;
  }

  private toResponse(session: Session): SessionResponseDto {
    return {
      id: session.id,
      clientId: session.clientId,
      sessionDate: session.sessionDate,
      summary: session.summary,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
