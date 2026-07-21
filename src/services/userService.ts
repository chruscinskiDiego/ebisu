import { DatabaseExecutionType, UserProfileUpdate } from '../agent/schemas/message.schema.ts';
import { initializeDataSource } from '../database/dataSource.ts';
import { UserEntity } from '../database/entities/user.entity.ts';
import {
  RequiredUserField,
  UserRepository,
} from '../database/repositories/userRepository.ts';

export type UserExecutionResult = {
  operation: DatabaseExecutionType;
  summary: string;
  user: UserEntity | null;
  missingUserFields: RequiredUserField[];
  affected: number;
};

const hasProfileUpdate = (update: UserProfileUpdate = {}): boolean => {
  return Object.values(update).some((value) => value !== undefined && value !== null && value !== '');
};

export class UserService {
  async execute(
    operation: DatabaseExecutionType,
    userProfileUpdate: UserProfileUpdate = {},
  ): Promise<UserExecutionResult> {
    const dataSource = await initializeDataSource();
    const repository = new UserRepository(dataSource);
    const shouldPersist =
      operation === 'insert' || operation === 'update' || hasProfileUpdate(userProfileUpdate);

    const user = shouldPersist
      ? await repository.upsertActiveUser(userProfileUpdate)
      : await repository.findActiveUser();

    const missingUserFields = repository.getMissingRequiredFields(user);

    return {
      operation,
      summary:
        missingUserFields.length > 0
          ? 'Ainda faltam alguns detalhes para personalizar melhor as respostas ao usuario.'
          : shouldPersist
            ? 'Preferencias do usuario atualizadas.'
            : 'Preferencias do usuario recuperadas.',
      user,
      missingUserFields,
      affected: shouldPersist ? 1 : 0,
    };
  }
}
