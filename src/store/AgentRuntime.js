// ============================================================
// SECTION 7 — AGENT RUNTIME (state machine)
// Runtime state machine for the living village simulation. Domain/task
// events stay separate from rendering; this layer translates them into
// movement intent, idle behavior, social moments, handoffs, and UI alerts.
// ============================================================
import { routeBetween, distBetween, nodePos } from "../domain/nodes.js";
import { AGENT_TERRITORIES, BENCH_INTERACTIONS, WORK_INTERACTIONS, interactionYawToward, pickNode } from "../domain/interactions.js";
import { ARIA_AGENT_ID, isSpecialist } from "../domain/ariaRouter.js";
import { getMotion } from "./motion.js";

const runtimeById = {};
const interactionReservations = new Map();

function yawToward(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (Math.hypot(dx, dz) < 0.02) return null;
  return Math.atan2(dx, dz);
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function THREElessSmooth(t) {
  const v = Math.max(0, Math.min(1, t));
  return v * v * (3 - 2 * v);
}

function weightedChoice(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function reservePoint(pointId, agentId) {
  const reservedBy = interactionReservations.get(pointId);
  if (reservedBy && reservedBy !== agentId) return false;
  interactionReservations.set(pointId, agentId);
  return true;
}

function releasePoint(pointId, agentId) {
  if (pointId && interactionReservations.get(pointId) === agentId) {
    interactionReservations.delete(pointId);
  }
}

function releaseAgentReservations(agentId) {
  interactionReservations.forEach((reservedBy, pointId) => {
    if (reservedBy === agentId) interactionReservations.delete(pointId);
  });
}

function pickFreeBench(agentId, agents) {
  const preferred = Math.random() > 0.5 ? ["bench1", "bench2"] : ["bench2", "bench1"];

  return preferred.map((id) => BENCH_INTERACTIONS[id]).find((bench) => {
    if (!bench) return false;
    const reservedBy = interactionReservations.get(bench.seatNode);
    if (reservedBy && reservedBy !== agentId) return false;
    return !Object.values(agents).some((agent) => {
      const otherId = agent.cfg.id;
      if (otherId === agentId) return false;
      const otherMotion = getMotion(otherId);
      return otherMotion?.currentNode === bench.seatNode || otherMotion?.destinationNode === bench.seatNode;
    });
  });
}

function dynamicSlowFactor(agentId, motion, target) {
  const dx = target.x - motion.pos.x;
  const dz = target.z - motion.pos.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return 1;
  const dirX = dx / len;
  const dirZ = dz / len;
  let factor = 1;
  for (const [otherId, otherMotion] of getAgentMotionEntries()) {
    if (otherId === agentId) continue;
    const ox = otherMotion.pos.x - motion.pos.x;
    const oz = otherMotion.pos.z - motion.pos.z;
    const ahead = ox * dirX + oz * dirZ;
    const side = Math.abs(ox * -dirZ + oz * dirX);
    if (ahead > 0 && ahead < 0.95 && side < 0.45) factor = Math.min(factor, 0.45);
  }
  return factor;
}

function getAgentMotionEntries() {
  return Object.keys(runtimeById).map((id) => [id, getMotion(id)]).filter(([, motion]) => motion);
}

export class AgentRuntime {
  constructor(cfg, bus, provider, store) {
    this.cfg = cfg;
    this.bus = bus;
    this.provider = provider;
    this.store = store; // zustand store's { getState, setState }
    this.id = cfg.id;
    this.currentTask = null;
    this.idleTimer = null;
    this.waitingAlertedTaskIds = new Set();
    this.pendingTaskDone = null;
    this.pendingVisualTaskDone = null;
    this.readyForTaskDone = false;
  }

  get motion() { return getMotion(this.id); }

  init() {
    runtimeById[this.id] = this;
    this.store.getState().setAgentStatus(this.id, "idle");
    this.scheduleIdle(400 + Math.random() * 1200);
  }

  // ---- movement -------------------------------------------------------
  // Interpolated every frame (rAF) rather than via a CSS/spring transition
  // so the walk cycle can be driven by actual distance traveled, and so it
  // can be cancelled instantly (moveToken) the moment a task interrupts it.
  moveTo(targetNodeId, movementStatus = "walking") {
    const motion = this.motion;
    const myToken = ++motion.moveToken;
    const routeNodeIds = routeBetween(motion.currentNode, targetNodeId);
    const coords = routeNodeIds.map((id) => nodePos(id));
    motion.path = routeNodeIds;
    motion.destinationNode = targetNodeId;
    this.store.getState().setAgentStatus(this.id, movementStatus);

    return new Promise((resolve) => {
      let segIndex = 1;
      let segStart = { ...motion.pos };
      let segTarget = coords[1] ? { x: coords[1].x, z: coords[1].y } : segStart;
      let segDist = distBetween({ x: segStart.x, y: segStart.z }, { x: segTarget.x, y: segTarget.z });
      let segTraveled = 0;
      let lastT = null;
      let raf;

      const finish = (ok) => {
        motion.walkPhase = 0;
        if (ok) {
          const last = coords[coords.length - 1];
          motion.pos = { x: last.x, z: last.y };
          motion.currentNode = targetNodeId;
        }
        resolve(ok);
      };

      const step = (t) => {
        if (motion.moveToken !== myToken) { finish(false); return; }
        if (lastT === null) lastT = t;
        const dt = Math.min(0.05, (t - lastT) / 1000);
        lastT = t;

        const stopEase = segDist > 0 ? Math.min(segTraveled / 0.55, (segDist - segTraveled) / 0.55, 1) : 1;
        const speedScale = THREElessSmooth(Math.max(0.32, stopEase));
        let remainingMove = motion.speedMps * speedScale * dynamicSlowFactor(this.id, motion, segTarget) * dt;
        const distThisFrame = remainingMove;

        while (remainingMove > 0 && segIndex < coords.length) {
          const remainInSeg = segDist - segTraveled;
          if (remainInSeg > remainingMove) {
            segTraveled += remainingMove;
            remainingMove = 0;
          } else {
            remainingMove -= remainInSeg;
            segTraveled = segDist;
          }
          const frac = segDist > 0 ? segTraveled / segDist : 1;
          motion.pos = {
            x: segStart.x + (segTarget.x - segStart.x) * frac,
            z: segStart.z + (segTarget.z - segStart.z) * frac,
          };
          const dx = segTarget.x - segStart.x;
          const dz = segTarget.z - segStart.z;
          if (Math.hypot(dx, dz) > 0.02) {
            motion.targetYaw = Math.atan2(dx, dz);
          }

          if (segTraveled >= segDist - 0.001) {
            segIndex++;
            if (segIndex < coords.length) {
              segStart = segTarget;
              const nc = coords[segIndex];
              segTarget = { x: nc.x, z: nc.y };
              segDist = distBetween({ x: segStart.x, y: segStart.z }, { x: segTarget.x, y: segTarget.z });
              segTraveled = 0;
            }
          }
        }

        motion.walkPhase += distThisFrame / motion.strideLen;

        if (segIndex >= coords.length) { finish(true); return; }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
  }

  // ---- idle engine ------------------------------------------------------
  scheduleIdle(delay) {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.runIdleCycle(), delay);
  }

  async runIdleCycle() {
    const status = this.store.getState().agents[this.id].status;
    if (status !== "idle" && status !== "walking" && status !== "wandering") return;
    if (this.currentTask) return;

    const territory = AGENT_TERRITORIES[this.id];
    let behavior = weightedChoice([
      ["ambient", 45],
      ["local_walk", 20],
      ["inspect", 10],
      ["sit", 10],
      ["chat", 10],
      ["long_walk", 5],
    ]);
    let reservation = null;
    let exitNode = null;

    if (behavior === "chat" && Math.random() < 0.55) {
      const didChat = await this.trySocializeWithPeer();
      if (didChat) {
        this.scheduleIdle(1800 + Math.random() * 3200);
        return;
      }
    }

    if (behavior === "sit") {
      const bench = pickFreeBench(this.id, this.store.getState().agents);
      if (!bench || !reservePoint(bench.seatNode, this.id)) {
        behavior = Math.random() < 0.5 ? "ambient" : "inspect";
      } else {
        reservation = bench.seatNode;
        exitNode = bench.approachNode;
        const approachOk = await this.moveTo(bench.approachNode, "wandering");
        if (!approachOk || this.currentTask) { releasePoint(reservation, this.id); return; }
        this.motion.targetYaw = bench.seatYaw;
        await wait(220);
        const seatOk = await this.moveTo(bench.seatNode, "wandering");
        if (!seatOk || this.currentTask) { releasePoint(reservation, this.id); return; }
        this.motion.targetYaw = bench.seatYaw;
        this.motion.interaction = { type: "bench", id: bench.id };
        this.store.getState().setAgentStatus(this.id, "idle");
      }
    } else if (behavior === "local_walk" || behavior === "long_walk" || behavior === "inspect") {
      const pool = behavior === "long_walk"
        ? territory.longWalkNodes
        : behavior === "inspect"
          ? territory.inspectNodes
          : territory.localIdleNodes;
      const target = pickNode(pool, territory.homeNode || this.cfg.yardNode);
      const ok = await this.moveTo(target, "wandering");
      if (!ok || this.currentTask) return;
      if (behavior === "inspect") this.motion.targetYaw = interactionYawToward(target, territory.homeNode);
      this.store.getState().setAgentStatus(this.id, "idle");
    }

    if (this.store.getState().agents[this.id].status !== "idle") {
      releasePoint(reservation, this.id);
      this.scheduleIdle(3000 + Math.random() * 6000);
      return;
    }

    const bubbles = { sit: "💺", inspect: "🔧", ambient: Math.random() > 0.55 ? "👀" : "", local_walk: "", long_walk: "" };
    this.store.getState().setAgentBubble(this.id, bubbles[behavior] || "");
    this.store.getState().setAgentStatus(this.id, behavior === "ambient" ? "idle" : "socializing");
    await wait(3000 + Math.random() * 9000);
    if (this.currentTask) { releasePoint(reservation, this.id); return; }
    if (reservation) {
      this.motion.interaction = null;
      if (exitNode) await this.moveTo(exitNode, "wandering");
    }
    releasePoint(reservation, this.id);
    this.store.getState().setAgentBubble(this.id, "");
    this.store.getState().setAgentStatus(this.id, "idle");
    this.scheduleIdle(3000 + Math.random() * 9000);
  }

  async trySocializeWithPeer() {
    const state = this.store.getState();
    const candidates = Object.values(state.agents)
      .filter((a) => a.cfg.id !== this.id && a.status === "idle" && !a.currentTask)
      .map((a) => a.cfg.id);
    if (!candidates.length) return false;

    const peerId = candidates[Math.floor(Math.random() * candidates.length)];
    const mine = getMotion(this.id);
    const peer = getMotion(peerId);
    if (!mine || !peer) return false;

    const dx = peer.pos.x - mine.pos.x;
    const dz = peer.pos.z - mine.pos.z;
    if (Math.hypot(dx, dz) > 7) {
      const ok = await this.moveTo("hub", "wandering");
      if (!ok || this.currentTask) return false;
    }

    const mineNow = getMotion(this.id);
    const peerNow = getMotion(peerId);
    const toPeerX = peerNow.pos.x - mineNow.pos.x;
    const toPeerZ = peerNow.pos.z - mineNow.pos.z;
    if (Math.hypot(toPeerX, toPeerZ) > 0.05) {
      mineNow.targetYaw = Math.atan2(toPeerX, toPeerZ);
      peerNow.targetYaw = Math.atan2(-toPeerX, -toPeerZ);
    }

    const bubbles = ["...", "?", "!"];
    state.setAgentBubble(this.id, bubbles[Math.floor(Math.random() * bubbles.length)]);
    state.setAgentBubble(peerId, bubbles[Math.floor(Math.random() * bubbles.length)]);
    state.setAgentStatus(this.id, "socializing");
    state.setAgentStatus(peerId, "socializing");
    await wait(2200 + Math.random() * 1800);

    const latest = this.store.getState();
    if (!this.currentTask && latest.agents[this.id].status === "socializing") {
      latest.setAgentBubble(this.id, "");
      latest.setAgentStatus(this.id, "idle");
    }
    if (!latest.agents[peerId].currentTask && latest.agents[peerId].status === "socializing") {
      latest.setAgentBubble(peerId, "");
      latest.setAgentStatus(peerId, "idle");
      runtimeById[peerId]?.scheduleIdle(1600 + Math.random() * 2800);
    }
    return true;
  }

  // ---- task lifecycle -----------------------------------------------
  assign(taskDef, params) {
    if (this.currentTask) {
      this.store.getState().pushToast(`${this.cfg.name} is already working. Please wait for this request to finish.`, "assigned");
      return null;
    }
    clearTimeout(this.idleTimer);
    releaseAgentReservations(this.id);
    this.motion.interaction = null;
    this.motion.moveToken++;
    this.store.getState().setAgentBubble(this.id, "");
    this.store.getState().setAgentStatus(this.id, "assigned");
    this.store.getState().setBuildingGlow(this.id, false);
    this.pendingTaskDone = null;
    this.readyForTaskDone = false;

    let offStarted = () => {};
    let offProgress = () => {};
    let offDone = () => {};
    let offFail = () => {};
    const cleanup = () => { offStarted(); offProgress(); offDone(); offFail(); };
    offStarted = this.bus.on("task.started", (p) => {
      if (p.agentId === this.id && this.isCurrentTask(p.task)) this.onTaskEvent(p.task);
    });
    offProgress = this.bus.on("task.progress", (p) => {
      if (p.agentId === this.id && this.isCurrentTask(p.task)) this.onTaskEvent(p.task);
    });
    offDone = this.bus.on("task.completed", (p) => {
      if (p.agentId !== this.id || !this.isCurrentTask(p.task)) return;
      this.handleTaskDoneEvent(p.task, true, cleanup);
    });
    offFail = this.bus.on("task.failed", (p) => {
      if (p.agentId !== this.id || !this.isCurrentTask(p.task)) return;
      this.handleTaskDoneEvent(p.task, false, cleanup);
    });

    const task = this.provider.assignTask({ id: this.id }, this.cfg, taskDef, params);
    this.currentTask = task;
    this.store.getState().setAgentTask(this.id, task);

    this.walkAssignedTaskToWork();
    return task;
  }

  startVisualWork(task) {
    if (!task || this.currentTask) return false;
    clearTimeout(this.idleTimer);
    releaseAgentReservations(this.id);
    this.motion.interaction = null;
    this.motion.moveToken++;
    this.currentTask = task;
    this.pendingTaskDone = null;
    this.pendingVisualTaskDone = null;
    this.readyForTaskDone = false;
    this.store.getState().setAgentBubble(this.id, "!");
    this.store.getState().setAgentStatus(this.id, "assigned");
    this.store.getState().setBuildingGlow(this.id, false);
    this.store.getState().setAgentTask(this.id, task);
    this.walkAssignedTaskToWork();
    return true;
  }

  finishVisualWork(task, success) {
    if (!task?.id || !this.currentTask || this.currentTask.id !== task.id) return;
    if (!this.readyForTaskDone) {
      this.pendingVisualTaskDone = { task, success };
      this.store.getState().setAgentTask(this.id, task);
      return;
    }
    this.completeVisualWork(task, success);
  }

  async walkAssignedTaskToWork() {
    await wait(180 + Math.random() * 180);
    const work = WORK_INTERACTIONS[this.id] || { entranceNode: this.cfg.workNode, workNode: this.cfg.workNode, entranceYaw: 0, workYaw: 0 };
    const arrivedAtDoor = await this.moveTo(work.entranceNode, "walking_to_work");
    if (!arrivedAtDoor) return;
    this.motion.targetYaw = work.entranceYaw;
    await wait(260);
    const arrived = work.workNode === work.entranceNode ? true : await this.moveTo(work.workNode, "walking_to_work");
    if (!arrived) return;
    this.motion.targetYaw = work.workYaw;
    this.motion.interaction = { type: "work", id: this.id };
    this.store.getState().setAgentStatus(this.id, "working");
    this.store.getState().setBuildingGlow(this.id, true);
    this.store.getState().setAgentBubble(this.id, "");
    this.readyForTaskDone = true;
    if (this.pendingTaskDone) {
      const pending = this.pendingTaskDone;
      this.pendingTaskDone = null;
      setTimeout(() => this.handleTaskDoneEvent(pending.task, pending.success, pending.cleanup), 650);
    }
    if (this.pendingVisualTaskDone) {
      const pending = this.pendingVisualTaskDone;
      this.pendingVisualTaskDone = null;
      setTimeout(() => this.completeVisualWork(pending.task, pending.success), 650);
    }
  }

  async completeVisualWork(task, success) {
    this.readyForTaskDone = false;
    this.pendingVisualTaskDone = null;
    this.currentTask = task;
    this.store.getState().setBuildingGlow(this.id, false);
    this.store.getState().setAgentStatus(this.id, success ? "success" : "error");
    this.store.getState().setAgentBubble(this.id, success ? "✅" : "⚠️");
    this.store.getState().setAgentTask(this.id, task);
    if (isSpecialist(this.id)) {
      this.store.getState().setSpecialistLiveStatus(this.id, {
        status: success ? "completed" : "waiting",
        currentTask: null,
        task: task.title,
        lastResult: success ? (task.result || "Completed. Report sent to Aria.") : task.error,
      });
    }

    await wait(1800);
    if (!this.currentTask || this.currentTask.id !== task.id) return;
    this.store.getState().setAgentBubble(this.id, "");
    this.currentTask = null;
    this.motion.interaction = null;
    this.store.getState().setAgentTask(this.id, null);
    await this.moveTo(AGENT_TERRITORIES[this.id]?.homeNode || this.cfg.yardNode, "returning");
    this.store.getState().setAgentStatus(this.id, "idle");
    this.scheduleIdle(600 + Math.random() * 1800);
  }

  isCurrentTask(task) {
    if (!task?.id) return false;
    return !this.currentTask || this.currentTask.id === task.id;
  }

  handleTaskDoneEvent(task, success, cleanup) {
    if (!this.readyForTaskDone) {
      this.pendingTaskDone = { task, success, cleanup };
      this.onTaskEvent(task);
      return;
    }
    this.onTaskEvent(task);
    cleanup();
    this.onTaskDone(task, success);
  }

  onTaskEvent(task) {
    this.currentTask = task;
    if (isSpecialist(this.id)) {
      this.store.getState().setSpecialistLiveStatus(this.id, {
        status: this.store.getState().agents[this.id].status,
        currentTask: task.title,
        task: task.title,
      });
    }
    const status = this.store.getState().agents[this.id].status;
    if (status === "working" || status === "waiting") {
      const isWaiting = task.stage === "Reviewing" || task.stage === "Waiting";
      this.store.getState().setAgentStatus(this.id, isWaiting ? "waiting" : "working");
      if (isWaiting && !this.waitingAlertedTaskIds.has(task.id)) {
        this.waitingAlertedTaskIds.add(task.id);
        if (!isSpecialist(this.id)) {
          this.store.getState().openAgentAlert(
            this.id,
            "waiting",
            `I'm reviewing "${task.title}" now. I'll let you know when the result is ready.`,
            "important"
          );
        }
      }
    }
    this.store.getState().setAgentTask(this.id, task);
  }

  async onTaskDone(task, success) {
    this.readyForTaskDone = false;
    this.pendingTaskDone = null;
    this.store.getState().setBuildingGlow(this.id, false);
    this.store.getState().setAgentStatus(this.id, success ? "success" : "error");
    this.store.getState().setAgentBubble(this.id, success ? "✅" : "⚠️");
    this.store.getState().pushToast(
      isSpecialist(this.id)
        ? (success ? `${this.cfg.role} reported back to Aria.` : `${this.cfg.role} reported an issue to Aria.`)
        : (success ? `${this.cfg.name} finished "${task.title}".` : `${this.cfg.name} hit an error on "${task.title}".`),
      success ? "completed" : "error"
    );
    if (!isSpecialist(this.id)) {
      this.store.getState().openAgentAlert(
        this.id,
        success ? "complete" : task.status === "timed_out" ? "timed_out" : "error",
        success ? `Task complete. "${task.title}" is ready for review.` : task.error,
        success ? "normal" : "error",
        task
      );
    }
    this.store.getState().addHistory({
      id: task.id, agentId: isSpecialist(this.id) ? ARIA_AGENT_ID : this.id, agentName: isSpecialist(this.id) ? "Aria" : this.cfg.name, emoji: isSpecialist(this.id) ? "📊" : this.cfg.emoji,
      title: task.title, status: task.status, result: task.result, error: task.error,
      completedAt: task.completedAt || Date.now(),
      sourceAgentId: this.id,
      requestId: task.requestId,
      userMessage: task.userMessage,
      route: task.route,
      startedAt: task.startedAt,
      elapsedMs: task.elapsedMs,
      agentsInvolved: task.resultMeta?.agentsInvolved || [],
      requiresApproval: task.resultMeta?.requiresApproval === true,
      normalizedResponse: task.resultMeta?.normalizedResponse || null,
      errorMeta: task.errorMeta || null,
      retry: !success ? { agentId: this.id, taskId: task.type, params: task.parameters } : null,
    });
    this.store.getState().recordTaskOutcome(this.id, this.cfg, task, success);

    if (success) {
      await this.maybeHandoffCompletedTask(task);
    }

    await wait(2200);
    this.store.getState().setAgentBubble(this.id, "");
    this.currentTask = null;
    this.motion.interaction = null;
    this.store.getState().setAgentTask(this.id, null);
    await this.moveTo(AGENT_TERRITORIES[this.id]?.homeNode || this.cfg.yardNode, "returning");
    this.store.getState().setAgentStatus(this.id, "idle");
    this.scheduleIdle(600 + Math.random() * 1800);
  }

  async maybeHandoffCompletedTask(task) {
    if (isSpecialist(this.id)) return;
    if (this.id !== "research") return;
    if (task.parameters?.handoffFrom || task.parameters?.delegatedBy) return;

    const state = this.store.getState();
    const receiverId = "data";
    const receiver = state.agents[receiverId];
    const receiverRuntime = runtimeById[receiverId];
    if (!receiverRuntime || receiverRuntime.currentTask) return;
    if (receiver.status === "working" || receiver.status === "assigned" || receiver.status === "walking_to_work" || receiver.status === "waiting") return;

    this.store.getState().setAgentStatus(this.id, "handoff");
    this.store.getState().setAgentBubble(this.id, "📄");
    receiverRuntime.motion.moveToken++;
    this.store.getState().setAgentBubble(receiverId, "!");
    this.store.getState().setAgentStatus(receiverId, "handoff");

    const receiverPos = receiverRuntime.motion.pos;
    const mine = this.motion;
    const dx = receiverPos.x - mine.pos.x;
    const dz = receiverPos.z - mine.pos.z;
    if (Math.hypot(dx, dz) > 0.05) {
      mine.targetYaw = Math.atan2(dx, dz);
      receiverRuntime.motion.targetYaw = Math.atan2(-dx, -dz);
    }
    state.fireBeam(this.id, receiverId);
    this.bus.emit("agent.handoff", { fromAgentId: this.id, toAgentId: receiverId, task });
    await wait(1400);
    this.store.getState().setAgentBubble(receiverId, "");
    const analysisTask = receiver.cfg.tasks.find((t) => t.id === "generate_report") || receiver.cfg.tasks[0];
    state.assignTaskToAgent(receiverId, analysisTask.id, {
      source: `Research handoff from ${this.cfg.name}: ${task.title}`,
      topic: task.title,
      handoffFrom: this.id,
    });
  }
}
