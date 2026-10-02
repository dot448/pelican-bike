const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function boot(reduced=false){
 const elements=new Map(),queue=new Map();let id=0;
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{attrs:{},style:{},events:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,v){this.events[k]=v}});return elements.get(selector)};
 const preference={matches:reduced,addEventListener(){}};
 const context={document:{querySelector:element,querySelectorAll:()=>[element('wheel1'),element('wheel2')],addEventListener(){}},window:{matchMedia:()=>preference},requestAnimationFrame:f=>{queue.set(++id,f);return id},cancelAnimationFrame:i=>queue.delete(i)};
 vm.runInNewContext(fs.readFileSync('animation.js','utf8'),context);
 const step=now=>{const callbacks=[...queue.values()];queue.clear();callbacks.forEach(f=>f(now))};
 const snapshot=()=>JSON.stringify([...elements].map(([s,e])=>[s,e.attrs,e.style]));
 return {element,step,snapshot,queue};
}
const app=boot();app.step(0);const initial=app.snapshot();app.step(200);assert.notEqual(app.snapshot(),initial);
for(const s of ['wheel1','wheel2','.rider','.scarf','.road','.cloud','#front-leg','#back-leg','#front-foot','#back-foot','#crank','#pedals']){
 const a=JSON.stringify(app.element(s).attrs);app.step(250);assert.notEqual(JSON.stringify(app.element(s).attrs),a,s+' must move');app.step(200);
}
app.element('#bell').events.click();app.step(300);assert.equal(app.element('.honk').style.opacity,'1');
for(let cycle=0;cycle<3;cycle++){
 app.element('#pause').events.click();const paused=app.snapshot();assert.equal(app.queue.size,0);app.step(1000+cycle*1000);app.step(1500+cycle*1000);assert.equal(app.snapshot(),paused,'All SVG attributes remain identical while paused');
 app.element('#pause').events.click();app.step(1600+cycle*1000);app.step(1633+cycle*1000);assert.notEqual(app.snapshot(),paused,'Resume restores actual motion');
}
const reduced=boot(true);const still=reduced.snapshot();reduced.step(0);reduced.step(500);assert.equal(reduced.snapshot(),still);assert.equal(reduced.queue.size,0);reduced.element('#pause').events.click();reduced.step(1000);reduced.step(1033);assert.notEqual(reduced.snapshot(),still,'Explicit Resume works with reduced motion');
console.log('PASS: wheel/body/scarf/road/cloud/leg/foot/crank geometry changes; all motion freezes; three pause/resume cycles; honk; reduced-motion initial stop and explicit resume');

// Physical rolling: road displacement equals the tire-edge arc length.
const rolling=boot(); rolling.step(0);
let previousDegrees=0,previousRoad=0;
for(let time=16;time<=3000;time+=16){
 rolling.step(time);
 const degrees=Number(rolling.element('wheel1').attrs.transform.match(/rotate\(([^)]+)/)[1]);
 const road=Number(rolling.element('.road').attrs.transform.match(/translate\(([^ ]+)/)[1]);
 const angularDelta=(degrees-previousDegrees+360)%360;
 const groundDelta=(previousRoad-road+120)%120;
 assert.ok(Math.abs(groundDelta-angularDelta*Math.PI/180*81.5)<0.004,'Road travel must equal wheel arc length, including repeat seams');
 assert.equal(rolling.element('#ride').attrs.transform,'translate(0 0)','No extra horizontal drift');
 previousDegrees=degrees;previousRoad=road;
}
console.log('PASS: no-slip rolling geometry across wheel wrap and road-pattern seams');
