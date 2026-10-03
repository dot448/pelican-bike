const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'animation.js'), 'utf8');

function boot({ reduced = false, hidden = false, speed = 1 } = {}) {
  const elements = new Map();
  const queue = new Map();
  const documentEvents = {};
  const preferenceEvents = {};
  let frameId = 0;
  let now = 0;

  function element(selector) {
    if (!elements.has(selector)) {
      elements.set(selector, {
        attrs: {},
        events: {},
        value: selector === '#speed' ? String(speed) : '',
        textContent: '',
        setAttribute(name, value) { this.attrs[name] = String(value); },
        addEventListener(name, callback) { this.events[name] = callback; }
      });
    }
    return elements.get(selector);
  }

  const document = {
    hidden,
    querySelector: element,
    querySelectorAll: () => [element('wheel1'), element('wheel2')],
    addEventListener(name, callback) { documentEvents[name] = callback; }
  };
  const preference = {
    matches: reduced,
    addEventListener(name, callback) { preferenceEvents[name] = callback; }
  };
  const context = {
    document,
    window: { matchMedia: () => preference },
    requestAnimationFrame(callback) {
      queue.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame(id) { queue.delete(id); }
  };
  vm.runInNewContext(source, context);

  function step(time) {
    now = time;
    const callbacks = [...queue.values()];
    queue.clear();
    callbacks.forEach(callback => callback(time));
  }
  step(0);

  return {
    element,
    queue,
    step,
    advance(duration) {
      const end = now + duration;
      while (now < end) step(Math.min(now + 16, end));
    },
    snapshot() {
      return JSON.stringify([...elements].map(([selector, el]) => [selector, el.attrs]));
    },
    click(selector) { element(selector).events.click(); },
    setSpeed(value) {
      element('#speed').value = String(value);
      element('#speed').events.input();
    },
    setReduced(matches) {
      preference.matches = matches;
      preferenceEvents.change({ matches });
    },
    setHidden(value) {
      document.hidden = value;
      documentEvents.visibilitychange();
    }
  };
}

function wheelAngle(app) {
  return Number(app.element('wheel1').attrs.transform.match(/rotate\(([^)]+)/)[1]);
}

function translation(app, selector) {
  return Number(app.element(selector).attrs.transform.match(/translate\(([^ ]+)/)[1]);
}

function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 0.004, `${message}: ${actual} vs ${expected}`);
}

test('all riding geometry moves on the shared clock', () => {
  const app = boot();
  const selectors = ['wheel1', 'wheel2', '.rider', '.scarf', '.road', '.cloud',
    '#front-leg', '#back-leg', '#front-foot', '#back-foot', '#crank', '#pedals'];
  const before = selectors.map(selector => JSON.stringify(app.element(selector).attrs));
  app.advance(200);
  selectors.forEach((selector, index) => {
    assert.notEqual(JSON.stringify(app.element(selector).attrs), before[index], selector);
  });
  assert.equal(app.queue.size, 1);
});

test('repeated pause/resume freezes the scene and keeps only one frame scheduled', () => {
  const app = boot();
  app.click('#bell');
  for (let cycle = 0; cycle < 3; cycle++) {
    app.advance(48);
    app.click('#pause');
    const paused = app.snapshot();
    assert.equal(app.element('#pause').textContent, 'Resume ride');
    assert.equal(app.queue.size, 0);
    app.advance(1000);
    assert.equal(app.snapshot(), paused);
    app.click('#pause');
    assert.equal(app.element('#pause').textContent, 'Pause ride');
    assert.equal(app.queue.size, 1);
    app.advance(32);
    assert.notEqual(app.snapshot(), paused);
  }
});

for (const speed of [0.25, 1, 3]) {
  test(`speed ${speed}× scales travel and reports its accessible value`, () => {
    const app = boot({ speed });
    app.advance(400);
    closeTo(wheelAngle(app), 400 / 1400 * 360 * speed, 'wheel travel');
    assert.equal(app.element('#speed-value').value, `${speed}×`);
    assert.equal(app.element('#speed').attrs['aria-valuetext'], `${speed} times normal speed`);
  });

  test(`honk duration is independent of riding speed at ${speed}×`, () => {
    const app = boot({ speed });
    app.click('#bell');
    assert.equal(app.element('.honk').attrs.opacity, '1');
    assert.equal(app.element('#status').textContent, 'Honk! The pelican says hello.');
    app.advance(640);
    assert.equal(app.element('.honk').attrs.opacity, '1');
    app.advance(16);
    assert.equal(app.element('.honk').attrs.opacity, '0');
    assert.equal(app.element('.head').attrs.transform, 'rotate(0 509 231)');
  });
}

test('changing speed preserves position and applies to the next frame', () => {
  const app = boot();
  app.advance(160);
  const angle = wheelAngle(app);
  const road = translation(app, '.road');
  app.setSpeed(2);
  assert.equal(wheelAngle(app), angle);
  assert.equal(translation(app, '.road'), road);
  app.advance(16);
  closeTo(wheelAngle(app) - angle, 16 / 1400 * 360 * 2, 'new speed');
});

test('speed changes while paused take effect on resume without restarting motion', () => {
  const app = boot();
  app.advance(160);
  app.click('#pause');
  const angle = wheelAngle(app);
  app.setSpeed(3);
  app.advance(1000);
  assert.equal(app.queue.size, 0);
  assert.equal(wheelAngle(app), angle);
  app.click('#pause');
  app.advance(32); // First resumed frame establishes a new timestamp.
  closeTo(wheelAngle(app) - angle, 16 / 1400 * 360 * 3, 'resumed speed');
});

test('wheel arc length matches road travel across speeds, wraps, and seams', () => {
  const app = boot();
  let previousAngle = 0;
  let previousRoad = 0;
  for (const speed of [0.25, 1, 3, 0.5, 2]) {
    app.setSpeed(speed);
    for (let frame = 0; frame < 200; frame++) {
      app.advance(16);
      const angle = wheelAngle(app);
      const road = translation(app, '.road');
      const angularDelta = (angle - previousAngle + 360) % 360;
      const groundDelta = (previousRoad - road + 120) % 120;
      closeTo(groundDelta, angularDelta * Math.PI / 180 * 81.5, 'no-slip rolling');
      assert.equal(app.element('#ride').attrs.transform, 'translate(0 0)');
      previousAngle = angle;
      previousRoad = road;
    }
  }
});

test('reduced motion starts still and allows an explicit resume at the selected speed', () => {
  const app = boot({ reduced: true });
  const initial = app.snapshot();
  app.advance(500);
  assert.equal(app.snapshot(), initial);
  assert.equal(app.queue.size, 0);
  app.setSpeed(2);
  assert.equal(app.queue.size, 0);
  app.click('#pause');
  app.advance(32);
  closeTo(wheelAngle(app), 16 / 1400 * 360 * 2, 'explicit resume');
});

test('motion preference changes preserve a manual pause', () => {
  const app = boot();
  app.click('#pause');
  const paused = app.snapshot();
  app.setReduced(true);
  app.setReduced(false);
  app.advance(500);
  assert.equal(app.queue.size, 0);
  assert.equal(app.element('#pause').textContent, 'Resume ride');
  assert.equal(app.snapshot(), paused);
});

test('motion preferences pause and resume a ride that was not manually paused', () => {
  const app = boot();
  app.setReduced(true);
  assert.equal(app.queue.size, 0);
  app.setReduced(false);
  assert.equal(app.queue.size, 1);
  app.advance(32);
  assert.ok(wheelAngle(app) > 0);
});

test('honk gives static feedback while paused, including reduced motion', () => {
  for (const reduced of [false, true]) {
    const app = boot({ reduced });
    if (!reduced) app.click('#pause');
    app.click('#bell');
    assert.equal(app.element('.honk').attrs.opacity, '1');
    assert.equal(app.element('.head').attrs.transform, 'rotate(0 509 231)');
    assert.equal(app.queue.size, 0);
    const still = app.snapshot();
    app.advance(1000);
    assert.equal(app.snapshot(), still);
    app.click('#pause');
    app.advance(672);
    assert.equal(app.element('.honk').attrs.opacity, '0');
  }
});

test('hidden pages suspend the frame loop and resume without catching up', () => {
  const app = boot();
  app.advance(160);
  const before = app.snapshot();
  const angle = wheelAngle(app);
  app.setHidden(true);
  assert.equal(app.queue.size, 0);
  app.advance(10000);
  assert.equal(app.snapshot(), before);
  app.setHidden(false);
  assert.equal(app.queue.size, 1);
  app.advance(16);
  assert.equal(app.snapshot(), before);
  app.advance(16);
  closeTo(wheelAngle(app) - angle, 16 / 1400 * 360, 'visible frame');
  app.click('#pause');
  app.setHidden(true);
  app.setHidden(false);
  assert.equal(app.queue.size, 0, 'visibility must preserve manual pause');
  assert.equal(boot({ hidden: true }).queue.size, 0);
});

test('clouds move continuously beyond the old 40-second reset and wrap one scene width', () => {
  const app = boot({ speed: 3 });
  let previous = 0;
  let wraps = 0;
  for (let time = 64; time <= 100000; time += 64) {
    app.step(time);
    const current = translation(app, '.cloud');
    if (current > previous) wraps++;
    closeTo((previous - current + 1100) % 1100, 64 * 3 * 150 / 40000, 'cloud travel');
    previous = current;
  }
  assert.equal(wraps, 1);
});
