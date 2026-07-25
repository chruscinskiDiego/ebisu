import { GraphState } from "../schemas/message.schema";
import { UserService } from "../../services/userService.ts";
import {
    appendUnique,
    findWorkflowTaskByRoute,
    USER_MEMORY_TASK_ROUTE,
} from "../taskRouting.ts";

const hasProfileUpdate = (update: GraphState['userProfileUpdate'] = {}): boolean => {
    return Object.values(update).some((value) => value !== undefined && value !== null && value !== '');
};

const getErrorMessage = (error: unknown): string => {
    if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string'
    ) {
        return error.message;
    }

    return String(error);
};

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
            const userTask = findWorkflowTaskByRoute(state, USER_MEMORY_TASK_ROUTE);
            const result = await userService.execute(
                state.intention === 'userDatabaseExecution'
                    ? state.databaseExecutionType ?? userTask?.databaseExecutionType ?? 'update'
                    : userTask?.databaseExecutionType
                        ? userTask.databaseExecutionType
                    : 'select',
                state.userProfileUpdate ?? {},
            );
            const shouldExposeUserResult =
                state.intention === 'userDatabaseExecution' ||
                state.workflowTasks?.some((task) => task.intention === 'userDatabaseExecution') ||
                hasProfileUpdate(state.userProfileUpdate) ||
                result.missingUserFields.length > 0;
            const formattedResult = formatUserExecutionResult(result);

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
                userExecutionResult: shouldExposeUserResult
                    ? formattedResult
                    : state.userExecutionResult,
                databaseExecutionResult:
                    state.intention === 'userDatabaseExecution' || result.missingUserFields.length > 0
                        ? formattedResult
                        : state.databaseExecutionResult,
                completedWorkflowTasks:
                    shouldExposeUserResult
                        ? appendUnique(state.completedWorkflowTasks, USER_MEMORY_TASK_ROUTE)
                        : state.completedWorkflowTasks,
                workflowExecutionResults:
                    shouldExposeUserResult
                        ? [...(state.workflowExecutionResults ?? []), formattedResult]
                        : state.workflowExecutionResults,
            };
        } catch (error: unknown) {
            return {
                error: `Falha ao processar o perfil unico do usuario no Postgres: ${getErrorMessage(error)}`,
            };
        }
    };
};
