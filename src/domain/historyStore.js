// ============================================================
// SECTION 4 — TASK HISTORY (localStorage persistence, unchanged)
// ============================================================
export const HistoryStore = {
  KEY: "ai_village_task_history_v1",
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  },
  save(list) {
    try { localStorage.setItem(this.KEY, JSON.stringify(list.slice(-60))); } catch (e) {}
  },
  add(record) {
    const list = this.load();
    list.push(record);
    this.save(list);
    return list;
  },
  clear(statuses = null) {
    if (!Array.isArray(statuses) || statuses.length === 0) {
      try { localStorage.removeItem(this.KEY); } catch (e) {}
      return [];
    }
    const keep = this.load().filter((record) => !statuses.includes(record.status));
    this.save(keep);
    return keep;
  },
};
