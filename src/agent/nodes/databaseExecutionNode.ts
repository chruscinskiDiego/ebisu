import { GraphState } from "../schemas/message.schema"

const identifyDatabaseOperation = (
    question: string,
): GraphState['databaseExecutionType'] => {
    const normalizedQuestion = question.toLowerCase();

    if (/\b(insert|criar|adicionar|cadastrar)\b/.test(normalizedQuestion)) {
        return 'insert';
    }

    if (/\b(update|atualizar|alterar|mudar)\b/.test(normalizedQuestion)) {
        return 'update';
    }

    if (/\b(delete|deletar|remover|excluir)\b/.test(normalizedQuestion)) {
        return 'delete';
    }

    return 'select';
};

export const createDatabaseExecutionNode = () => {
    return async (state: GraphState): Promise<Partial<GraphState>> => {
        if (!state.question) {
            return {
                error: 'Nao foi possivel executar no banco sem uma pergunta.',
            };
        }

        const databaseExecutionType =
            state.databaseExecutionType ?? identifyDatabaseOperation(state.question);

        return {
            databaseExecutionType,
            databaseExecutionResult:
                `Fluxo de banco selecionado (${databaseExecutionType}) para: ${state.question}`,
        };
    };
};
