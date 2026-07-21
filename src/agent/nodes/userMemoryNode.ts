import { GraphState } from "../schemas/message.schema";
import { UserService } from "../../services/userService.ts";

const formatUserExecutionResult = (
    result: Awaited<ReturnType<UserService['execute']>>,
): string => {
    return JSON.stringify({
        operation: result.operation,
        summary: result.summary,
        affected: result.affected,
        missingUserFields: result.missingUserFields,
        user: result.user
            ? {
                id: result.user.id,
                name: result.user.name,
                type: result.user.type,
                investmentHorizon: result.user.investmentHorizon,
                investmentStrategy: result.user.investmentStrategy,
            }
            : null,
    });
};

export const createUserMemoryNode = () => {
    const userService = new UserService();

    return async (state: GraphState): Promise<Partial<GraphState>> => {
        try {
            const result = await userService.execute(
                state.intention === 'userDatabaseExecution'
                    ? state.databaseExecutionType ?? 'update'
                    : 'select',
                state.userProfileUpdate ?? {},
            );

            return {
                activeUser: result.user
                    ? {
                        id: result.user.id,
                        name: result.user.name,
                        type: result.user.type,
                        investmentHorizon: result.user.investmentHorizon,
                        investmentStrategy: result.user.investmentStrategy,
                    }
                    : undefined,
                missingUserFields: result.missingUserFields,
                databaseExecutionResult:
                    state.intention === 'userDatabaseExecution' || result.missingUserFields.length > 0
                        ? formatUserExecutionResult(result)
                        : state.databaseExecutionResult,
            };
        } catch (error: any) {
            return {
                error: `Falha ao processar o perfil unico do usuario no Postgres: ${error.message}`,
            };
        }
    };
};
