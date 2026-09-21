import { RealAriaProvider, isRealAriaTask } from "./realAriaProvider.js";
import { RealSpecialistProvider } from "./realSpecialistProvider.js";
import { isSpecialist } from "./ariaRouter.js";

export class AgentProviderRouter {
  constructor(bus) {
    this.bus = bus;
    this.realAriaProvider = new RealAriaProvider(bus);
    this.realSpecialistProvider = new RealSpecialistProvider(bus);
    this._taskSeq = 1;
  }

  assignTask(agent, agentConfig, taskDef, params) {
    if (isRealAriaTask(agent, taskDef)) {
      return this.realAriaProvider.assignTask(agent, agentConfig, taskDef, params);
    }
    if (isSpecialist(agent?.id)) {
      return this.realSpecialistProvider.assignTask(agent, agentConfig, taskDef, params);
    }
    return this.failLocalTask(agent, taskDef, params);
  }

  failLocalTask(agent, taskDef, params = {}) {
    const task = {
      id: "local-error-" + this._taskSeq++,
      agentId: agent?.id || "unknown",
      type: taskDef?.id || "unknown",
      title: taskDef?.label || "Unknown Task",
      parameters: params,
      status: "queued",
      stage: "Assigned",
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      result: null,
      resultMeta: null,
      error: null,
    };
    this.bus.emit("agent.task.assigned", { agentId: task.agentId, task: { ...task } });
    queueMicrotask(() => {
      task.status = "failed";
      task.stage = "Error";
      task.completedAt = Date.now();
      task.error = "This task is not connected to ARIA. Please ask ARIA instead.";
      this.bus.emit("task.failed", { agentId: task.agentId, task: { ...task } });
    });
    return task;
  }
}
