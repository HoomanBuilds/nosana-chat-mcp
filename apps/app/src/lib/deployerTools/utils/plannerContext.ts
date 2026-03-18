import { AsyncLocalStorage } from "node:async_hooks";

type PlannerContext = {
  model?: string;
};

const storage = new AsyncLocalStorage<PlannerContext>();

// Fallback for when AsyncLocalStorage context is lost (e.g. inside AI SDK tool executes)
let _globalModel: string | undefined;

export function runWithPlannerModel<T>(
  model: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  _globalModel = model;
  return storage.run({ model }, fn);
}

export function getPlannerModel(): string | undefined {
  return storage.getStore()?.model ?? _globalModel;
}
