import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { Session } from '@/sessions/entities/session.entity';
import { SessionsService } from '@/sessions/sessions.service';

type MockRepository<T extends object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionsRepository: MockRepository<Session>;
  let clientsRepository: MockRepository<Client>;

  beforeEach(() => {
    sessionsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
      merge: jest.fn(),
    };
    clientsRepository = {
      findOneBy: jest.fn(),
    };

    service = new SessionsService(
      sessionsRepository as unknown as Repository<Session>,
      clientsRepository as unknown as Repository<Client>,
    );
  });

  it('creates a session for an existing client', async () => {
    const sessionDate = '2026-08-22T10:00:00.000Z';
    const createdAt = new Date('2026-08-22T10:00:00.000Z');
    const updatedAt = new Date('2026-08-22T10:00:00.000Z');

    clientsRepository.findOneBy!.mockResolvedValue({ id: 'client-id' });
    sessionsRepository.create!.mockReturnValue({
      clientId: 'client-id',
      sessionDate: new Date(sessionDate),
      summary: '초기 상담',
    });
    sessionsRepository.save!.mockResolvedValue({
      id: 'session-id',
      clientId: 'client-id',
      sessionDate: new Date(sessionDate),
      summary: '초기 상담',
      createdAt,
      updatedAt,
    });

    await expect(
      service.create('client-id', {
        sessionDate,
        summary: '초기 상담',
      }),
    ).resolves.toEqual({
      id: 'session-id',
      clientId: 'client-id',
      sessionDate: new Date(sessionDate),
      summary: '초기 상담',
      createdAt,
      updatedAt,
    });
  });

  it('rejects session creation for a nonexistent client', async () => {
    clientsRepository.findOneBy!.mockResolvedValue(null);

    await expect(
      service.create('missing-client', { summary: '초기 상담' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gets sessions for a client', async () => {
    const sessions = [
      {
        id: 'session-id',
        clientId: 'client-id',
        sessionDate: new Date('2026-08-22T10:00:00.000Z'),
        summary: '초기 상담',
        createdAt: new Date('2026-08-22T10:00:00.000Z'),
        updatedAt: new Date('2026-08-22T10:00:00.000Z'),
      },
    ] as Session[];

    clientsRepository.findOneBy!.mockResolvedValue({ id: 'client-id' });
    sessionsRepository.find!.mockResolvedValue(sessions);

    await expect(service.findAllByClient('client-id')).resolves.toEqual([
      {
        id: 'session-id',
        clientId: 'client-id',
        sessionDate: new Date('2026-08-22T10:00:00.000Z'),
        summary: '초기 상담',
        createdAt: new Date('2026-08-22T10:00:00.000Z'),
        updatedAt: new Date('2026-08-22T10:00:00.000Z'),
      },
    ]);
  });
});
