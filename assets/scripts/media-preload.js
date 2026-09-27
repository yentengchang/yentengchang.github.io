// Fetch each original recording in full before playback. The content hashes
// make cached responses safe to reuse when moving between Home and detail.
const root='/auto-inspector/assets/';
const definitions=[
  ['experience/home-flow/scan-camera.mp4','fc055bafd40a'],
  ['experience/home-flow/anchor-selected.mp4','52dbbe42b6e3'],
  ['experience/home-flow/workflow-full.mp4','10c0acca1d98'],
  ['review/clips/ceiling-reference.mp4','0d86df314dd9'],
  ['experience/field-studio.mp4','fc291221a5f1'],
  ['experience/field-multiroom.mp4','f0821439aa03'],
  ['experience/field-construction.mp4','43a06795b8f7']
];
const assets=new Map(definitions.map(([path,hash],order)=>{
  const url=root+path;
  let resolve;
  const ready=new Promise(done=>{resolve=done;});
  return [url,{url,key:url+'?v='+hash,order,priority:order,status:'queued',ready,resolve,blob:null,controller:null}];
}));
const running=new Set();
const limit=matchMedia('(max-width:720px)').matches?1:2;
const videoSources=new WeakMap();
const objectURLs=new WeakMap();
let cachePromise;

function mediaCache(){
  if(!cachePromise)cachePromise='caches' in window?caches.open('ytc-recordings-v1').catch(()=>null):Promise.resolve(null);
  return cachePromise;
}
function entryFor(source){
  const path=new URL(source,location.href).pathname;
  return assets.get(path);
}
function notify(entry){
  document.dispatchEvent(new CustomEvent('site-media-state',{detail:{url:entry.url,status:entry.status}}));
}
async function download(entry){
  const controller=new AbortController();
  entry.controller=controller;entry.status='loading';running.add(entry);notify(entry);
  try{
    const cache=await mediaCache();
    if(controller.signal.aborted)throw new DOMException('Interrupted','AbortError');
    let response=cache?await cache.match(entry.key):null;
    const fromCache=Boolean(response);
    if(!response){
      response=await fetch(entry.key,{signal:controller.signal,priority:entry.priority<0?'high':'low'});
      if(!response.ok)throw Error('Video download failed: '+response.status);
    }
    const blob=await response.blob();
    if(controller.signal.aborted)throw new DOMException('Interrupted','AbortError');
    if(cache&&!fromCache){
      try{await cache.put(entry.key,new Response(blob,{headers:{'Content-Type':'video/mp4'}}));}
      catch{ /* Browser storage may be unavailable or full; keep this visit usable. */ }
    }
    if(controller.signal.aborted)throw new DOMException('Interrupted','AbortError');
    entry.blob=blob;entry.status='ready';entry.resolve(blob);notify(entry);
  }catch(error){
    if(error.name==='AbortError')entry.status='queued';
    else{entry.status='failed';entry.resolve(null);notify(entry);}
  }finally{
    entry.controller=null;running.delete(entry);drain();
  }
}
function drain(){
  while(running.size<limit){
    const next=[...assets.values()].filter(entry=>entry.status==='queued')
      .sort((a,b)=>a.priority-b.priority||a.order-b.order)[0];
    if(!next)break;
    download(next);
  }
}
export function prioritizeMedia(source){
  const entry=entryFor(source);
  if(!entry)return;
  entry.priority=-100;
  if(entry.status==='queued'&&running.size>=limit){
    const lower=[...running].filter(item=>item.priority>entry.priority)
      .sort((a,b)=>b.priority-a.priority)[0];
    lower?.controller?.abort();
  }
  drain();
}
export function prepareVideo(video,{urgent=false}={}){
  if(videoSources.has(video)){
    if(urgent)prioritizeMedia(videoSources.get(video));
    return videoSources.get(video).ready;
  }
  const source=video.getAttribute('data-media-src')||video.getAttribute('src')||video.querySelector('source')?.getAttribute('src');
  const entry=source&&entryFor(source);
  if(!entry)return Promise.resolve(null);
  videoSources.set(video,entry);
  // Preserve the original markup as the no-JS fallback; JS owns the source now.
  video.removeAttribute('src');
  video.querySelectorAll('source').forEach(child=>child.removeAttribute('src'));
  video.preload='none';video.load();video.dataset.mediaStatus='loading';
  const figure=video.closest('figure');
  if(figure)figure.classList.add('media-loading');
  if(urgent)prioritizeMedia(source);
  entry.ready.then(blob=>{
    if(!video.isConnected)return;
    if(blob){
      const url=URL.createObjectURL(blob);
      objectURLs.set(video,url);video.src=url;video.preload='auto';video.load();
      const complete=()=>{video.dataset.mediaStatus='ready';figure?.classList.remove('media-loading');};
      if(video.readyState>=2)complete();else video.addEventListener('loadeddata',complete,{once:true});
    }else{
      // Native streaming remains available if storage or the full download fails.
      video.src=entry.url;video.preload='metadata';video.load();
      video.dataset.mediaStatus='fallback';figure?.classList.remove('media-loading');
    }
  });
  return entry.ready;
}
function prioritizeLocation(){
  const hash=location.hash;
  if(hash==='#auto-inspector'||hash==='#ai-scene-2')prioritizeMedia(root+'experience/home-flow/scan-camera.mp4');
  if(hash==='#ai-scene-4')prioritizeMedia(root+'experience/home-flow/anchor-selected.mp4');
  if(hash==='#ai-scene-6')prioritizeMedia(root+'experience/home-flow/workflow-full.mp4');
  if(hash==='#ceiling')prioritizeMedia(root+'review/clips/ceiling-reference.mp4');
  if(hash==='#field')for(const name of ['field-studio','field-multiroom','field-construction'])prioritizeMedia(root+'experience/'+name+'.mp4');
}
function start(){
  if(location.pathname.startsWith('/auto-inspector/')){
    for(const entry of assets.values())if(entry.order>=3)entry.priority=entry.order-23;
  }
  document.querySelectorAll('video').forEach(video=>prepareVideo(video));
  const observer=new IntersectionObserver(entries=>{
    for(const item of entries)if(item.isIntersecting){
      const video=item.target;
      const entry=videoSources.get(video);
      if(entry)prioritizeMedia(entry.url);
      observer.unobserve(video);
    }
  },{rootMargin:'700px 0px'});
  document.querySelectorAll('video').forEach(video=>{
    observer.observe(video);
    video.addEventListener('pointerdown',()=>prepareVideo(video,{urgent:true}),{passive:true});
    video.addEventListener('focusin',()=>prepareVideo(video,{urgent:true}));
  });
  addEventListener('hashchange',prioritizeLocation);
  prioritizeLocation();
  requestAnimationFrame(drain);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
