/* One animation frame loop keeps the rider, wheels, and scenery in sync. */
(() => {
  'use strict';

  // 76-unit wheel centerline + half its 11-unit tire stroke = contact radius.
  const TIRE_RADIUS = 81.5;
  const WHEEL_PERIOD = 1400;
  const ROAD_REPEAT = 120;
  const SCENE_WIDTH = 1100;
  const CLOUD_SPEED = 150 / 40000;
  const HONK_DURATION = 650;
  const MAX_FRAME_DURATION = 64;
  const CRANK = { x: 481, y: 391, radius: 28 };
  const LEG_LENGTH = 80;

  const select = selector => document.querySelector(selector);
  const wheels = [...document.querySelectorAll('.wheel')];
  const parts = Object.fromEntries(
    ['ride', 'crank', 'pedals', 'back-leg', 'back-foot', 'front-leg', 'front-foot']
      .map(id => [id, select('#' + id)])
  );
  const rider = select('.rider');
  const scarf = select('.scarf');
  const cloud = select('.cloud');
  const road = select('.road');
  const head = select('.head');
  const honk = select('.honk');
  const pauseButton = select('#pause');
  const bellButton = select('#bell');
  const status = select('#status');
  const speedInput = select('#speed');
  const speedOutput = select('#speed-value');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  let manuallyPaused = false;
  let preferencePaused = motionPreference.matches;
  let rideElapsed = 0;
  let activeElapsed = 0;
  let speed = 1;
  let previousTime = null;
  let frame = null;
  let honkStarted = null;

  const round = value => Number(value.toFixed(3));
  const isPaused = () => manuallyPaused || preferencePaused;
  const set = (element, attribute, value) => element.setAttribute(attribute, value);

  function renderLegs(phase, bob) {
    const feet = [phase + Math.PI, phase].map(angle => ({
      x: CRANK.x + CRANK.radius * Math.cos(angle),
      y: CRANK.y + CRANK.radius * Math.sin(angle)
    }));
    set(parts.crank, 'd', `M${round(feet[0].x)} ${round(feet[0].y)}L${round(feet[1].x)} ${round(feet[1].y)}`);
    set(parts.pedals, 'd', feet.map(foot => `M${round(foot.x - 12)} ${round(foot.y)}h24`).join(''));

    feet.forEach((foot, index) => {
      const side = index ? 'front' : 'back';
      const hip = { x: index ? 464 : 451, y: 278 + bob };
      // Solve two connected leg segments so each foot follows its pedal.
      const dx = foot.x - hip.x;
      const dy = foot.y - hip.y;
      const distance = Math.hypot(dx, dy);
      const bend = Math.sqrt(Math.max(0, LEG_LENGTH ** 2 - distance ** 2 / 4));
      const knee = {
        x: (hip.x + foot.x) / 2 + dy / distance * bend,
        y: (hip.y + foot.y) / 2 - dx / distance * bend
      };
      set(parts[side + '-leg'], 'd', `M${hip.x} ${round(hip.y)}L${round(knee.x)} ${round(knee.y)}L${round(foot.x - 5)} ${round(foot.y - 5)}`);
      set(parts[side + '-foot'], 'd', `M${round(foot.x - 8)} ${round(foot.y - 5)}l18 3`);
    });
  }

  function renderHonk() {
    // The bell lasts the same amount of active time at every riding speed.
    const age = honkStarted === null ? Infinity : activeElapsed - honkStarted;
    const visible = age < HONK_DURATION;
    set(honk, 'opacity', visible ? '1' : '0');
    set(head, 'transform', `rotate(${visible ? round(-5 * Math.sin(age / HONK_DURATION * Math.PI)) : 0} 509 231)`);
  }

  function render() {
    const distance = rideElapsed / WHEEL_PERIOD * (2 * Math.PI * TIRE_RADIUS);
    const wheelAngle = distance / TIRE_RADIUS;
    const phase = wheelAngle / 2; // Two wheel turns per pedal revolution.
    const degrees = round(wheelAngle * 180 / Math.PI % 360);
    const bob = Math.sin(phase * 2) * 5;

    wheels.forEach(wheel => set(wheel, 'transform', `rotate(${degrees})`));
    set(parts.ride, 'transform', 'translate(0 0)');
    set(rider, 'transform', `translate(0 ${round(bob)})`);
    set(scarf, 'transform', `rotate(${round(Math.sin(phase * 2.2) * 7)} 493 208)`);
    // Two copies of the clouds make the wrap seamless across the full scene.
    set(cloud, 'transform', `translate(${round(-(rideElapsed * CLOUD_SPEED % SCENE_WIDTH))} 0)`);
    set(road, 'transform', `translate(${round(-(distance % ROAD_REPEAT))} 0)`);
    renderLegs(phase, bob);
    renderHonk();
  }

  function tick(now) {
    frame = null;
    if (isPaused() || document.hidden) return;

    if (previousTime !== null) {
      const delta = Math.min(Math.max(now - previousTime, 0), MAX_FRAME_DURATION);
      // Accumulate distance instead of scaling total time, so speed changes
      // never jump the bicycle or break the road/wheel rolling relationship.
      rideElapsed += delta * speed;
      activeElapsed += delta;
    }
    previousTime = now;
    render();
    frame = requestAnimationFrame(tick);
  }

  function syncPlayback() {
    const paused = isPaused();
    pauseButton.textContent = paused ? 'Resume ride' : 'Pause ride';
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    previousTime = null;
    if (!paused && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function updateSpeed() {
    speed = Number(speedInput.value);
    speedOutput.value = `${speed}×`;
    set(speedInput, 'aria-valuetext', `${speed} times normal speed`);
  }

  pauseButton.addEventListener('click', () => {
    const resume = isPaused();
    manuallyPaused = !resume;
    // Explicitly resuming also works when reduced motion is preferred.
    if (resume) preferencePaused = false;
    syncPlayback();
  });

  bellButton.addEventListener('click', () => {
    status.textContent = 'Honk! The pelican says hello.';
    honkStarted = activeElapsed;
    // A paused ride gets static feedback without starting any motion.
    renderHonk();
  });

  speedInput.addEventListener('input', updateSpeed);
  motionPreference.addEventListener('change', event => {
    preferencePaused = event.matches;
    syncPlayback();
  });
  document.addEventListener('visibilitychange', syncPlayback);

  updateSpeed();
  render();
  syncPlayback();
})();
