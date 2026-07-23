import { PartialType } from '@nestjs/swagger';
import { CreateGroupActivityDto } from './create-group-activity.dto';

export class UpdateGroupActivityDto extends PartialType(CreateGroupActivityDto) {}
