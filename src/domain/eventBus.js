// ============================================================
// SECTION 2 — TINY EVENT BUS (unchanged)
// ============================================================
export class EventBus {
  constructor() {
    this.listeners = {};
  }
  on(evt, fn) {
    (this.listeners[evt] = this.listeners[evt] || []).push(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) {
    if (!this.listeners[evt]) return;
    this.listeners[evt] = this.listeners[evt].filter((f) => f !== fn);
  }
  emit(evt, payload) {
    (this.listeners[evt] || []).slice().forEach((fn) => {
      try { fn(payload); } catch (e) { console.error(e); }
    });
  }
}
