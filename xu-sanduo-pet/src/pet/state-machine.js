'use strict';

/**
 * 许三多状态机 —— 纯逻辑，可在 Node / 浏览器复用。
 */

const STATES = Object.freeze({
  IDLE: 'idle',
  CODING: 'coding',
  MONKEY_BAR: 'monkey_bar',
  RUNNING: 'running',
  SLEEPING: 'sleeping',
  CELEBRATE: 'celebrate',
  GREET: 'greet',
  DEBUG: 'debug',
});

const TIMED = new Set([STATES.CELEBRATE, STATES.GREET, STATES.RUNNING]);

const DEFAULT_DURATIONS = Object.freeze({
  [STATES.CELEBRATE]: 10000,
  [STATES.GREET]: 3000,
  [STATES.RUNNING]: 12000,
});

class StateMachine {
  /**
   * @param {object} options
   */
  constructor(options = {}) {
    this.settings = options.settings || {};
    this.state = STATES.IDLE;
    this.enteredAt = Date.now();
    this.codingActiveMs = 0;
    this.lastCelebrateAt = 0;
    this.wasSleepingOrIdleAway = false;
    this._overrideUntil = 0;
    this._forced = null;
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  /** 手动强制状态（演示 / 托盘菜单） */
  force(state, durationMs = 8000) {
    if (!Object.values(STATES).includes(state)) return this.snapshot();
    this._forced = state;
    this._overrideUntil = Date.now() + durationMs;
    this._enter(state);
    return this.snapshot();
  }

  clearForce() {
    this._forced = null;
    this._overrideUntil = 0;
  }

  /**
   * @param {import('./types').ActivitySnapshot} snap
   */
  evaluate(snap) {
    const now = Date.now();
    const locked = this.settings.lockedState;
    if (locked && Object.values(STATES).includes(locked)) {
      if (this.state !== locked) this._enter(locked);
      return this.snapshot();
    }

    if (this.settings.paused) {
      return this.snapshot();
    }

    if (this._forced && now < this._overrideUntil) {
      return this.snapshot();
    }
    if (this._forced && now >= this._overrideUntil) {
      this.clearForce();
    }

    // 有时限覆盖态未结束
    if (TIMED.has(this.state)) {
      const dur = DEFAULT_DURATIONS[this.state] || 8000;
      if (now - this.enteredAt < dur) {
        return this.snapshot();
      }
    }

    const idleMs = snap.idleMs || 0;
    const sleepThreshold = this.settings.idleMs ?? 300000;
    const thinkMs = this.settings.thinkMs ?? 90000;
    const thinkMax = this.settings.thinkMaxMs ?? 300000;
    const runAfter = this.settings.runningAfterMs ?? 3000000;
    const cool = this.settings.celebrateCooldownMs ?? 600000;

    let next = STATES.IDLE;

    if (idleMs >= sleepThreshold) {
      next = STATES.SLEEPING;
      this.wasSleepingOrIdleAway = true;
      this.codingActiveMs = 0;
    } else if (snap.signal === 'celebrate' && now - this.lastCelebrateAt > cool) {
      next = STATES.CELEBRATE;
      this.lastCelebrateAt = now;
    } else if (
      this.wasSleepingOrIdleAway &&
      snap.isCodingApp &&
      idleMs < 5000
    ) {
      next = STATES.GREET;
      this.wasSleepingOrIdleAway = false;
    } else if (snap.signal === 'debug' && snap.isCodingApp) {
      next = STATES.DEBUG;
    } else if (snap.isCodingApp && idleMs < thinkMs) {
      next = STATES.CODING;
      this.codingActiveMs += snap.deltaMs || 1000;
      if (this.codingActiveMs >= runAfter) {
        next = STATES.RUNNING;
        this.codingActiveMs = 0;
      }
    } else if (
      snap.isCodingApp &&
      idleMs >= thinkMs &&
      idleMs < Math.min(thinkMax, sleepThreshold)
    ) {
      next = STATES.MONKEY_BAR;
    } else {
      next = STATES.IDLE;
      if (!snap.isCodingApp && idleMs > 60000) {
        this.wasSleepingOrIdleAway = true;
      }
    }

    if (next !== this.state) {
      this._enter(next);
    }

    return this.snapshot();
  }

  _enter(state) {
    this.state = state;
    this.enteredAt = Date.now();
  }

  snapshot() {
    return {
      state: this.state,
      enteredAt: this.enteredAt,
      codingActiveMs: this.codingActiveMs,
      forced: Boolean(this._forced),
    };
  }
}

module.exports = { StateMachine, STATES, DEFAULT_DURATIONS };
