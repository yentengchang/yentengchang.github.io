import {createPlayer} from './flow-player.js';
import {createScene} from './flow-scenes.js';
const chapter=document.querySelector('#auto-inspector');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const rows=[...chapter.querySelectorAll('.ai-scene-section')];
const players=new Map(),pending=new Map();
const manifestPromise=fetch('/auto-inspector/assets/experience/home-flow/source-manifest.json').then(r=>{if(!r.ok)throw Error('Media manifest unavailable');return r.json();});
let navFrame=0,activeIndex=-1;
async function ensure(index){
 if(players.has(index))return players.get(index);
 if(pending.has(index))return pending.get(index);
 if(reduced.matches)return null;
 const host=rows[index].querySelector('.ai-visual-stage');
 const promise=(async()=>{
  try{
   const config=await createScene(host,index,await manifestPromise);
   const player=createPlayer(host,config);players.set(index,player);
   host.querySelectorAll('canvas').forEach(c=>c.addEventListener('webglcontextlost',()=>{
    player.dispose();players.delete(index);host.classList.remove('is-enhanced');host.querySelector('.ai-experience')?.remove();host.querySelector('.ai-player-controls')?.remove();host.dataset.error='WebGL context lost';
   }));
   if(reduced.matches)player.setActive(false);else schedule();
   return player;
  }catch(error){
   host.dataset.error=error.message;host.querySelector('.ai-experience')?.remove();
   // Keep this section's poster; one unavailable GPU view doesn't remove others.
   console.warn('Auto Inspector static fallback:',error.message);return null;
  }
 })();pending.set(index,promise);return promise;
}
function update(){
 navFrame=0;let best=-1,bestScore=Infinity;
 if(!reduced.matches&&!document.hidden)rows.forEach((row,i)=>{
  const r=row.querySelector('.ai-visual-stage').getBoundingClientRect();
  const visible=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,64));
  if(visible<Math.min(r.height*.45,innerHeight*.3))return;
  const score=Math.abs((r.top+r.bottom)/2-innerHeight*.52);if(score<bestScore){best=i;bestScore=score;}
 });
 activeIndex=best;
 for(const [i,player] of players)player.setActive(i===best);
 if(best>=0)ensure(best);
}
function schedule(){if(!navFrame)navFrame=requestAnimationFrame(update);}
const near=new IntersectionObserver(entries=>{
 for(const e of entries)if(e.isIntersecting)ensure(Number(e.target.dataset.scene));
 schedule();
},{rootMargin:'450px 0px'});
rows.forEach(r=>near.observe(r));
window.addEventListener('scroll',schedule,{passive:true});
window.addEventListener('resize',schedule,{passive:true});
document.addEventListener('visibilitychange',schedule);
reduced.addEventListener('change',()=>{
 for(const [i,player] of players){
  player.setActive(false);rows[i].classList.toggle('ai-reduced',reduced.matches);
  rows[i].querySelector('.ai-visual-stage').tabIndex=reduced.matches?-1:0;
  if(i===5)rows[i].querySelector('video').controls=reduced.matches;
 }
 if(!reduced.matches)rows.forEach(r=>r.classList.remove('ai-reduced'));
 schedule();
});
chapter.dataset.layout='flow';chapter.dataset.ready='true';schedule();
if(new URLSearchParams(location.search).has('ai-review'))window.__aiFlow={players,ensure,active:()=>activeIndex};
