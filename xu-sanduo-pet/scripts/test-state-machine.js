'use strict';

const assert = require('assert');
const { StateMachine, STATES } = require('../src/pet/state-machine');
const { includesAny } = require('../src/monitor/activity');
const { ANIMATIONS, FRAME_SIZE } = require('../src/pet/sprites');

function baseSnap(over = {}) {
  return {
    at: Date.now(),
    deltaMs: 1000,
    idleMs: 0,
    app: 'Cursor',
    title: 'main.js — project',
    source: 'test',
    isCodingApp: true,
    signal: null,
    degraded: false,
    platform: 'test',
    ...over,
  };
}

function testCoding() {
  const m = new StateMachine({
    settings: { idleMs: 300000, thinkMs: 90000, runningAfterMs: 999999999 },
  });
  const s = m.evaluate(baseSnap({ idleMs: 1000 }));
  assert.strictEqual(s.state, STATES.CODING);
}

function testSleep() {
  const m = new StateMachine({ settings: { idleMs: 300000 } });
  const s = m.evaluate(baseSnap({ idleMs: 400000, isCodingApp: false }));
  assert.strictEqual(s.state, STATES.SLEEPING);
}

function testMonkeyBar() {
  const m = new StateMachine({
    settings: { idleMs: 300000, thinkMs: 90000, thinkMaxMs: 300000 },
  });
  const s = m.evaluate(baseSnap({ idleMs: 120000, isCodingApp: true }));
  assert.strictEqual(s.state, STATES.MONKEY_BAR);
}

function testCelebrate() {
  const m = new StateMachine({ settings: { celebrateCooldownMs: 0 } });
  const s = m.evaluate(baseSnap({ signal: 'celebrate', idleMs: 500 }));
  assert.strictEqual(s.state, STATES.CELEBRATE);
}

function testGreet() {
  const m = new StateMachine({
    settings: { idleMs: 300000, thinkMs: 90000, runningAfterMs: 999999999 },
  });
  m.evaluate(baseSnap({ idleMs: 400000 }));
  assert.strictEqual(m.state, STATES.SLEEPING);
  const s = m.evaluate(baseSnap({ idleMs: 1000, isCodingApp: true }));
  assert.strictEqual(s.state, STATES.GREET);
}

function testForce() {
  const m = new StateMachine({ settings: {} });
  m.force(STATES.RUNNING, 5000);
  assert.strictEqual(m.state, STATES.RUNNING);
}

function testIncludes() {
  assert.ok(includesAny('Cursor Helper', ['cursor']));
  assert.ok(!includesAny('Chrome', ['cursor', 'code']));
}

function testSprites() {
  for (const [name, anim] of Object.entries(ANIMATIONS)) {
    assert.ok(anim.frames.length >= 2, name + ' needs frames');
    for (const frame of anim.frames) {
      for (const line of frame) {
        assert.ok(
          line.length === FRAME_SIZE,
          `${name} line width ${line.length} != ${FRAME_SIZE}: ${line}`
        );
      }
      assert.strictEqual(frame.length, 32, `${name} height`);
    }
  }
}

function run() {
  testCoding();
  testSleep();
  testMonkeyBar();
  testCelebrate();
  testGreet();
  testForce();
  testIncludes();
  testSprites();
  console.log('All state machine & sprite tests passed.');
}

run();
