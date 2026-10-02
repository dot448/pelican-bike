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
for(const s of ['wheel1','wheel2','.rider','.scarf','.road','.cloud','#ride','#front-leg','#back-leg','#front-foot','#back-foot','#crank','#pedals']){
 const a=JSON.stringify(app.element(s).attrs);app.step(250);assert.notEqual(JSON.stringify(app.element(s).attrs),a,s+' must move');app.step(200);
}
app.element('#bell').events.click();app.step(300);assert.equal(app.element('.honk').style.opacity,'1');
for(let cycle=0;cycle<3;cycle++){
 app.element('#pause').events.click();const paused=app.snapshot();assert.equal(app.queue.size,0);app.step(1000+cycle*1000);app.step(1500+cycle*1000);assert.equal(app.snapshot(),paused,'All SVG attributes remain identical while paused');
 app.element('#pause').events.click();app.step(1600+cycle*1000);app.step(1633+cycle*1000);assert.notEqual(app.snapshot(),paused,'Resume restores actual motion');
}
const reduced=boot(true);const still=reduced.snapshot();reduced.step(0);reduced.step(500);assert.equal(reduced.snapshot(),still);assert.equal(reduced.queue.size,0);reduced.element('#pause').events.click();reduced.step(1000);reduced.step(1033);assert.notEqual(reduced.snapshot(),still,'Explicit Resume works with reduced motion');
console.log('PASS: wheel/body/scarf/road/cloud/travel/leg/foot/crank geometry changes; all motion freezes; three pause/resume cycles; honk; reduced-motion initial stop and explicit resume');
