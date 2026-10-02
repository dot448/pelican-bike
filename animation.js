/* One clock owns every moving SVG attribute. SVG <use> content is static. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const wheels = [...document.querySelectorAll('.wheel')];
  const parts = Object.fromEntries(['ride','crank','pedals','back-leg','back-foot','front-leg','front-foot'].map(id => [id, $('#'+id)]));
  const rider=$('.rider'), scarf=$('.scarf'), cloud=$('.cloud'), road=$('.road'), head=$('.head'), honk=$('.honk');
  const pause=$('#pause'), bell=$('#bell'), status=$('#status');
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused=preference.matches, elapsed=0, previous=null, frame=null, honkStarted=null;
  const n=value=>Number(value.toFixed(3));
  const set=(el,name,value)=>el.setAttribute(name,value);
  // 76-unit wheel centerline + half its 11-unit tire stroke = contact radius.
  const tireRadius=81.5, wheelPeriod=1400, roadRepeat=120;
  function render() {
    const distance=elapsed/wheelPeriod*(2*Math.PI*tireRadius);
    const wheelAngle=distance/tireRadius;
    const phase=wheelAngle/2; // Two wheel turns per complete pedal revolution.
    const degrees=n(wheelAngle*180/Math.PI%360), bob=Math.sin(phase*2)*5;
    wheels.forEach(wheel=>set(wheel,'transform',`rotate(${degrees})`));
    // The camera follows the bicycle: no extra horizontal drift or wheel slip.
    set(parts.ride,'transform','translate(0 0)');
    set(rider,'transform',`translate(0 ${n(bob)})`);
    set(scarf,'transform',`rotate(${n(Math.sin(phase*2.2)*7)} 493 208)`);
    set(cloud,'transform',`translate(${n(-150*(elapsed%40000)/40000)} 0)`);
    set(road,'transform',`translate(${n(-(distance%roadRepeat))} 0)`);
    const feet=[phase+Math.PI,phase].map(angle=>({x:481+28*Math.cos(angle),y:391+28*Math.sin(angle)}));
    set(parts.crank,'d',`M${n(feet[0].x)} ${n(feet[0].y)}L${n(feet[1].x)} ${n(feet[1].y)}`);
    set(parts.pedals,'d',feet.map(f=>`M${n(f.x-12)} ${n(f.y)}h24`).join(''));
    feet.forEach((f,i)=>{
      const side=i?'front':'back', hip={x:i?464:451,y:278+bob};
      // Solve two connected leg segments so each foot follows its pedal exactly.
      const dx=f.x-hip.x,dy=f.y-hip.y,d=Math.hypot(dx,dy),bend=Math.sqrt(Math.max(0,80*80-d*d/4));
      const knee={x:(hip.x+f.x)/2+dy/d*bend,y:(hip.y+f.y)/2-dx/d*bend};
      set(parts[side+'-leg'],'d',`M${hip.x} ${n(hip.y)}L${n(knee.x)} ${n(knee.y)}L${n(f.x-5)} ${n(f.y-5)}`);
      set(parts[side+'-foot'],'d',`M${n(f.x-8)} ${n(f.y-5)}l18 3`);
    });
    const age=honkStarted===null?Infinity:elapsed-honkStarted;
    set(honk,'opacity',age<650?'1':'0');
    honk.style.opacity=age<650?'1':'0';
    set(head,'transform',`rotate(${age<650?n(-5*Math.sin(age/650*Math.PI)):0} 509 231)`);
  }
  function tick(now) {
    frame=null;
    if(paused)return;
    if(previous!==null)elapsed+=Math.min(now-previous,64);
    previous=now; render(); frame=requestAnimationFrame(tick);
  }
  function update() {
    pause.setAttribute('aria-pressed',String(paused));
    pause.textContent=paused?'Resume ride':'Pause ride';
    if(frame!==null)cancelAnimationFrame(frame);
    frame=null; previous=null;
    if(!paused)frame=requestAnimationFrame(tick);
  }
  pause.addEventListener('click',()=>{paused=!paused;update()});
  bell.addEventListener('click',()=>{
    status.textContent='Honk! The pelican says hello.';
    if(!paused){honkStarted=elapsed;render()}
  });
  preference.addEventListener('change',event=>{paused=event.matches;update()});
  document.addEventListener('visibilitychange',()=>{previous=null});
  render();update();
})();
