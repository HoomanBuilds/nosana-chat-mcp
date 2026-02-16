import { AsyncLocalStorage } from "node:async_hooks";

type PlannerContext = {
  model?: string;
};

const storage = new AsyncLocalStorage<PlannerContext>();

export function runWithPlannerModel<T>(
  model: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run({ model }, fn);
}

export function getPlannerModel(): string | undefined {
  return storage.getStore()?.model;
}

