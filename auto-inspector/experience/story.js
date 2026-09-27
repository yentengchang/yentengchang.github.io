import {createPlayer} from './flow-player.js?v=20260927c';
import {createScene} from './flow-scenes.js?v=20260927c';
import {prepareVideo, prioritizeMedia, setForegroundMedia, holdMediaDownloads} from '/assets/scripts/media-preload.js?v=20260927c';
import {imagesReady} from '/assets/scripts/visual-readiness.js?v=20260927c';
const chapter=document.querySelector('#auto-inspector');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const rows=[...chapter.querySelectorAll('.ai-scene-section')];
const players=new Map(),pending=new Map();
let manifestPromise,navFrame=0,activeIndex=-1;
const manifest=()=>manifestPromise??=fetch('/auto-inspector/assets/experience/home-flow/source-manifest.json')
 .then(r=>{if(!r.ok)throw Error('Media manifest unavailable');return r.json();})
 .catch(error=>{manifestPromise=null;throw error;});
async function ensure(index,retry=false){
 if(players.has(index))return players.get(index);
 if(pending.has(index))return pending.get(index);
 if(reduced.matches)return null;
 const host=rows[index].querySelector('.ai-visual-stage');
 if(host.dataset.error&&!retry)return null;
 host.querySelector('.ai-load-retry')?.remove();delete host.dataset.error;
 host.dataset.loadingLabel='Preparing scene…';host.classList.add('is-buffering');host.setAttribute('aria-busy','true');
 const release=holdMediaDownloads();
 const promise=(async()=>{
  try{
   const config=await createScene(host,index,await manifest());
   await imagesReady(host);
   // Release the visual lane before waiting for a complete recording.
   release();
   await Promise.all([...host.querySelectorAll('video')].map(video=>prepareVideo(video,{urgent:true,retry})));
   const player=createPlayer(host,config);players.set(index,player);
   host.classList.remove('is-buffering');host.setAttribute('aria-busy','false');
   host.querySelectorAll('canvas').forEach(c=>c.addEventListener('webglcontextlost',()=>{
    player.dispose();players.delete(index);host.classList.remove('is-enhanced');host.querySelector('.ai-experience')?.remove();host.querySelector('.ai-player-controls')?.remove();host.dataset.error='WebGL context lost';
    offerRetry(host,index);
   },{once:true}));
   if(reduced.matches){player.setActive(false);rows[index].classList.add('ai-reduced');if(index===5)host.querySelector('video').controls=true;}
   else schedule();
   return player;
  }catch(error){
   host.dataset.error=error.message;host.querySelector('.ai-experience')?.remove();
   host.classList.remove('is-buffering');host.setAttribute('aria-busy','false');offerRetry(host,index);
   console.warn('Auto Inspector static fallback:',error.message);return null;
  }finally{release();pending.delete(index);}
 })();pending.set(index,promise);return promise;
}
function offerRetry(host,index){
 if(host.querySelector('.ai-load-retry'))return;
 const button=document.createElement('button');button.type='button';button.className='ai-load-retry';button.textContent='Retry scene';
 button.addEventListener('click',()=>ensure(index,true));host.append(button);
}
function update(){
 navFrame=0;let best=-1,bestScore=Infinity;
 if(!reduced.matches&&!document.hidden)rows.forEach((row,i)=>{
  const r=row.querySelector('.ai-visual-stage').getBoundingClientRect();
  const visible=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,64));
  if(visible<Math.min(r.height*.45,innerHeight*.3))return;
  const score=Math.abs((r.top+r.bottom)/2-innerHeight*.52);if(score<bestScore){best=i;bestScore=score;}
 });
 if(best!==activeIndex){
  activeIndex=best;
  const path=best===0||best===1?'scan-camera':best===3?'anchor-selected':best===5?'workflow-full':null;
  setForegroundMedia(path?'/auto-inspector/assets/experience/home-flow/'+path+'.mp4':null);
  if(path)prioritizeMedia('/auto-inspector/assets/experience/home-flow/'+path+'.mp4');
 }
 for(const [i,player] of players)player.setActive(i===best);
 if(best>=0)ensure(best);
}
function schedule(){if(!navFrame)navFrame=requestAnimationFrame(update);}
const observer=new IntersectionObserver(schedule,{threshold:[0,.3,.5]});
rows.forEach(row=>observer.observe(row));
window.addEventListener('scroll',schedule,{passive:true});
window.addEventListener('resize',schedule);
document.addEventListener('visibilitychange',schedule);
reduced.addEventListener('change',()=>{
 for(const [i,player] of players){
  player.setActive(false);rows[i].classList.toggle('ai-reduced',reduced.matches);
  rows[i].querySelector('.ai-visual-stage').tabIndex=reduced.matches?-1:0;
  if(i===5)rows[i].querySelector('video').controls=reduced.matches;
 }
 if(!reduced.matches)rows.forEach(row=>row.classList.remove('ai-reduced'));
 schedule();
});
chapter.dataset.layout='flow';chapter.dataset.ready='true';schedule();
if(new URLSearchParams(location.search).has('ai-review'))window.__aiFlow={players,ensure,active:()=>activeIndex};
