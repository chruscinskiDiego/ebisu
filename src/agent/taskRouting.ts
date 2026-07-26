import type { GraphState, WorkflowTask } from './schemas/message.schema.ts';

export const USER_MEMORY_TASK_ROUTE = 'userDatabaseExecution';
export const STOCK_DATABASE_TASK_ROUTE = 'stockDatabaseExecution';
export const CRYPTO_DATABASE_TASK_ROUTE = 'cryptoDatabaseExecution';
export const REAL_TIME_MARKET_TASK_ROUTE = 'getRealTimeMarketShare';
export const STRUCTURED_RESPONSE_ROUTE = 'structuredResponse';

export const TASK_NODE_ROUTE_MAP = {
  [STOCK_DATABASE_TASK_ROUTE]: STOCK_DATABASE_TASK_ROUTE,
  [CRYPTO_DATABASE_TASK_ROUTE]: CRYPTO_DATABASE_TASK_ROUTE,
  [REAL_TIME_MARKET_TASK_ROUTE]: REAL_TIME_MARKET_TASK_ROUTE,
  [STRUCTURED_RESPONSE_ROUTE]: STRUCTURED_RESPONSE_ROUTE,
} as const;

export type TaskNodeRoute = keyof typeof TASK_NODE_ROUTE_MAP;

const intentionRouteFallback: Record<string, string> = {
  stockDatabaseExecution: STOCK_DATABASE_TASK_ROUTE,
  cryptoDatabaseExecution: CRYPTO_DATABASE_TASK_ROUTE,
  userDatabaseExecution: USER_MEMORY_TASK_ROUTE,
  realTimeMarketShare: REAL_TIME_MARKET_TASK_ROUTE,
  unknown: STRUCTURED_RESPONSE_ROUTE,
};

export const appendUnique = (values: string[] = [], value: string): string[] => {
  return values.includes(value) ? values : [...values, value];
};

export const getTaskRoute = (task: Pick<WorkflowTask, 'intention' | 'route'>): string => {
  return task.route || intentionRouteFallback[task.intention] || STRUCTURED_RESPONSE_ROUTE;
};

export const getWorkflowTasks = (state: GraphState): Array<Pick<WorkflowTask, 'intention' | 'route'>> => {
  if (state.workflowTasks?.length) return state.workflowTasks;

  return state.intention
    ? [
        {
          intention: state.intention,
          route: intentionRouteFallback[state.intention] ?? STRUCTURED_RESPONSE_ROUTE,
        },
      ]
    : [];
};

export const findWorkflowTaskByRoute = (
  state: GraphState,
  route: string,
): WorkflowTask | undefined => {
  return state.workflowTasks?.find((task) => getTaskRoute(task) === route);
};

export const isWorkflowTaskCompleted = (
  state: GraphState,
  task: Pick<WorkflowTask, 'intention' | 'route'>,
): boolean => {
  const completedTasks = state.completedWorkflowTasks ?? [];
  const route = getTaskRoute(task);

  return completedTasks.includes(route) || completedTasks.includes(task.intention);
};

export const getNextWorkflowNode = (state: GraphState): TaskNodeRoute => {
  const nextTask = getWorkflowTasks(state).find((task) => {
    const route = getTaskRoute(task);

    return (
      route !== USER_MEMORY_TASK_ROUTE &&
      route in TASK_NODE_ROUTE_MAP &&
      !isWorkflowTaskCompleted(state, task)
    );
  });

  const route = nextTask ? getTaskRoute(nextTask) : STRUCTURED_RESPONSE_ROUTE;

  return route in TASK_NODE_ROUTE_MAP
    ? route as TaskNodeRoute
    : STRUCTURED_RESPONSE_ROUTE;
};
