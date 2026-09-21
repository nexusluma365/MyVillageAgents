import { MockAgentProvider } from "./mockProvider.js";
import { RealAriaProvider, isRealAriaTask } from "./realAriaProvider.js";
import { RealSpecialistProvider } from "./realSpecialistProvider.js";
import { isSpecialist } from "./ariaRouter.js";

export class AgentProviderRouter {
  constructor(bus) {
    this.mockProvider = new MockAgentProvider(bus);
    this.realAriaProvider = new RealAriaProvider(bus);
    this.realSpecialistProvider = new RealSpecialistProvider(bus);
  }

  assignTask(agent, agentConfig, taskDef, params) {
    if (isRealAriaTask(agent, taskDef)) {
      return this.realAriaProvider.assignTask(agent, agentConfig, taskDef, params);
    }
    if (isSpecialist(agent?.id)) {
      return this.realSpecialistProvider.assignTask(agent, agentConfig, taskDef, params);
    }
    return this.mockProvider.assignTask(agent, agentConfig, taskDef, params);
  }
}
