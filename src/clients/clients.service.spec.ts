import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ClientsService } from '@/clients/clients.service';
import { Client } from '@/clients/entities/client.entity';

type MockRepository<T extends object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('ClientsService', () => {
  let service: ClientsService;
  let clientsRepository: MockRepository<Client>;

  beforeEach(() => {
    clientsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      merge: jest.fn(),
    };

    service = new ClientsService(
      clientsRepository as unknown as Repository<Client>,
    );
  });

  it('creates a client', async () => {
    const createdAt = new Date('2026-08-22T00:00:00.000Z');
    const updatedAt = new Date('2026-08-22T00:00:00.000Z');
    const client = {
      id: 'client-id',
      name: '김무민',
      createdAt,
      updatedAt,
    } as Client;

    clientsRepository.create!.mockReturnValue(client);
    clientsRepository.save!.mockResolvedValue(client);

    await expect(service.create({ name: '김무민' })).resolves.toEqual({
      id: 'client-id',
      name: '김무민',
      createdAt,
      updatedAt,
    });
  });

  it('gets a client by id', async () => {
    const client = {
      id: 'client-id',
      name: '김무민',
      createdAt: new Date('2026-08-22T00:00:00.000Z'),
      updatedAt: new Date('2026-08-22T00:00:00.000Z'),
    } as Client;

    clientsRepository.findOneBy!.mockResolvedValue(client);

    await expect(service.findOne('client-id')).resolves.toEqual({
      id: client.id,
      name: client.name,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    });
  });

  it('throws when client does not exist', async () => {
    clientsRepository.findOneBy!.mockResolvedValue(null);

    await expect(service.findOne('missing-client')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
