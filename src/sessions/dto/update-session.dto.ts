import { PartialType } from '@nestjs/swagger';
import { CreateSessionDto } from '@/sessions/dto/create-session.dto';

export class UpdateSessionDto extends PartialType(CreateSessionDto) {}
