import { DataSource, Repository } from 'typeorm';
import { UserEntity, UserEntitySchema } from '../entities/user.entity.ts';
import type { UserProfileUpdate } from '../../agent/schemas/message.schema.ts';

export const REQUIRED_USER_FIELDS = [
  'name',
  'type',
  'investmentHorizon',
  'investmentStrategy',
] as const;

export type RequiredUserField = (typeof REQUIRED_USER_FIELDS)[number];

export class UserRepository {
  private readonly repository: Repository<UserEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(UserEntitySchema);
  }

  async findActiveUser(): Promise<UserEntity | null> {
    const [activeUser] = await this.repository.find({
      order: {
        id: 'ASC',
      },
      take: 1,
    });

    return activeUser ?? null;
  }

  async upsertActiveUser(update: UserProfileUpdate = {}): Promise<UserEntity> {
    const activeUser = await this.findActiveUser();

    const user = this.repository.create({
      ...activeUser,
      ...update,
    });

    return this.repository.save(user);
  }

  getMissingRequiredFields(user: UserEntity | null): RequiredUserField[] {
    return REQUIRED_USER_FIELDS.filter((field) => !user?.[field]);
  }
}
