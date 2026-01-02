// This file contains the core logic for the world engine, managing the overall application state and interactions.

import { getBus } from '../bus/bus';
import { LanguageDomTreeSystem } from './lang/language-dom-tree-system.js';
import { MathSystem } from './math-system';

function nowMs() {
  return Date.now();
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

class WorldEngine {
  /**
   * @param {{ bus?: any, logger?: any }} [opts]
   */
  constructor(opts = {}) {
    this.log = opts.logger || console;

    this.info = (
      this.log && typeof this.log.info === 'function' ? this.log.info : this.log.log
    ).bind(this.log);
    this.warn = (
      this.log && typeof this.log.warn === 'function' ? this.log.warn : this.log.log
    ).bind(this.log);
    this.error = (
      this.log && typeof this.log.error === 'function' ? this.log.error : this.log.log
    ).bind(this.log);

    // Shared event bus for all engine subsystems and apps.
    this.bus = opts.bus || getBus();

    // Core state + app registry.
    this.state = {};
    this.apps = [];

    // Systems are long-lived services (math, physics, telemetry, etc.).
    this.systems = [];
  }

  initialize() {
    this.info('Initializing World Engine...');

    // Install default systems.
    this.registerSystem(new MathSystem({ bus: this.bus, logger: this.log }));
    this.registerSystem(new LanguageDomTreeSystem({ bus: this.bus, logger: this.log }));
    this.startSystems();

    this.loadApps();
  }

  /**
   * Register an engine system.
   * System shape: { name: string, start?: (engine) => void, stop?: () => void }
   * @param {any} system
   */
  registerSystem(system) {
    if (!system || typeof system !== 'object') return;
    this.systems.push(system);
  }

  startSystems() {
    for (const s of this.systems) {
      if (s && typeof s.start === 'function') {
        try {
          s.start(this);
        } catch (e) {
          this.warn('System start failed', s.name, e);
        }
      }
    }
  }

  stopSystems() {
    for (const s of this.systems) {
      if (s && typeof s.stop === 'function') {
        try {
          s.stop();
        } catch (e) {
          this.warn('System stop failed', s.name, e);
        }
      }
    }
  }

  /**
   * Convenience wrapper around the bus.
   * @param {any} channel
   * @param {(event:any)=>void} handler
   */
  on(channel, handler) {
    if (!this.bus || typeof this.bus.subscribe !== 'function') return () => undefined;
    return this.bus.subscribe(channel, handler);
  }

  /**
   * Convenience wrapper around the bus.
   * @param {any} event
   */
  emit(event) {
    if (!this.bus || typeof this.bus.emit !== 'function') return;
    this.bus.emit(event);
  }

  loadApps() {
    // Logic to load applications
    this.info('Loading applications...');
  }

  launchApp(appName) {
    const app = this.apps.find((a) => a.name === appName);
    if (app) {
      if (typeof app.launch === 'function') app.launch(this);
      this.info(`${appName} launched.`);
      this.emit({ channel: 'UI', type: 'APP_LAUNCHED', payload: { appName }, atMs: nowMs() });
      return;
    }

    this.error(`Application ${appName} not found.`);
  }

  closeApp(appName) {
    const app = this.apps.find((a) => a.name === appName);
    if (app) {
      if (typeof app.close === 'function') app.close(this);
      this.info(`${appName} closed.`);
      this.emit({ channel: 'UI', type: 'APP_CLOSED', payload: { appName }, atMs: nowMs() });
      return;
    }

    this.error(`Application ${appName} not found.`);
  }

  updateState(newState) {
    this.state = { ...this.state, ...newState };
    this.info('State updated:', this.state);
    this.emit({
      channel: 'UI',
      type: 'STATE_UPDATED',
      payload: { state: this.state },
      atMs: nowMs(),
    });
  }

  /**
   * Fire-and-forget math op request through the bus.
   * @param {'add'|'sub'|'mul'|'div'} op
   * @param {number} a
   * @param {number} b
   * @param {{ requestId?: string }} [opts]
   */
  requestMathOp(op, a, b, opts = {}) {
    const requestId = typeof opts.requestId === 'string' ? opts.requestId : makeId();
    this.emit({
      channel: 'MATH',
      type: 'OP',
      payload: { requestId, op, a, b },
      atMs: nowMs(),
    });
    return requestId;
  }
}

export default WorldEngine;
