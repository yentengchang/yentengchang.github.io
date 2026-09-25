const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const icon=name=>({play:'<path d="m9 5 11 7-11 7Z"/>',pause:'<path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" stroke-width="4"/>',replay:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" fill="none" stroke="currentColor" stroke-width="2"/>'}[name]);
const svg=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+icon(name)+'</svg>';
const fmt=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
export function createPlayer(host,{duration,render,mediaAt=()=>null}){
  let time=0,active=false,paused=false,scrubbing=false,raf=0,last=0,video=null,touchTimer,disposed=false;
  const media=[...host.querySelectorAll('video')];media.forEach(v=>{v.muted=true;v.controls=false;});
  host.classList.add('ai-player');host.tabIndex=0;
  const overlay=document.createElement('div');overlay.className='ai-player-controls';
  overlay.innerHTML='<button class="ai-center-control" type="button" aria-label="Pause">'+svg('pause')+'</button><div class="ai-transport"><button type="button" data-skip="-10" aria-label="Back 10 seconds">↶<small>10</small></button><input class="ai-seek" type="range" min="0" max="'+duration+'" value="0" step=".05" aria-label="Playback position"><span class="ai-time">'+fmt(0)+' / '+fmt(duration)+'</span><button type="button" data-skip="10" aria-label="Forward 10 seconds">↷<small>10</small></button><button class="ai-fullscreen" type="button" aria-label="Enter fullscreen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button></div>';
  host.append(overlay);const center=overlay.querySelector('.ai-center-control'),slider=overlay.querySelector('input'),label=overlay.querySelector('.ai-time');
  function isPlaying(){return active&&!paused&&!scrubbing&&!document.hidden&&time<duration&&!disposed;}
  function pauseMedia(){media.forEach(v=>v.pause());}
  function sync(seeking=false){
    const spec=mediaAt(time),next=spec?.video;
    if(video!==next){pauseMedia();video=next;if(video)video._desired=clamp(time-spec.start,0,spec.duration);}
    if(!video)return;
    if(video.preload!=='auto'){video.preload='auto';video.load();}
    if(seeking)video._desired=clamp(time-spec.start,0,spec.duration);
    if(video._desired!=null&&video.readyState>=1){video.currentTime=Math.min(video._desired,video.duration-.015);video._desired=null;}
    if(!isPlaying()||time>=spec.start+spec.duration){video.pause();return;}
    if(video.paused&&!video.ended&&!video._pendingPlay){
      video._pendingPlay=true;video.play().catch(e=>{
        if(e.name==='AbortError'||next!==video)return;paused=true;host.classList.add('needs-play');schedule();
      }).finally(()=>{next._pendingPlay=false;});
    }
  }
  function paint(){
    render(time);host.dataset.elapsed=time.toFixed(3);host.dataset.playback=time>=duration?'complete':isPlaying()?'playing':'paused';
    if(!scrubbing)slider.value=String(time);slider.setAttribute('aria-valuetext',fmt(time)+' of '+fmt(duration));label.textContent=fmt(time)+' / '+fmt(duration);
    const state=time>=duration?'replay':isPlaying()?'pause':'play';
    if(center.dataset.icon!==state){center.innerHTML=svg(state);center.dataset.icon=state;center.setAttribute('aria-label',state==='replay'?'Replay':state==='play'?'Play':'Pause');}
  }
  function tick(now){
    raf=0;const dt=last?Math.min((now-last)/1000,.1):0;last=now;
    if(isPlaying()){
      const spec=mediaAt(time);
      if(spec&&time<spec.start+spec.duration){
        if(video===spec.video&&video._desired==null&&!video.seeking){
          if(video.ended)time=spec.start+spec.duration;
          else if(!video.paused)time=Math.max(time,spec.start+Math.min(spec.duration,video.currentTime));
        }
      }else time+=dt;
      time=clamp(time,0,duration);if(duration-time<.025)time=duration;
    }
    paint();sync();if(isPlaying())schedule();
  }
  function schedule(){if(!raf&&!disposed)raf=requestAnimationFrame(tick);}
  function seek(t){time=clamp(t,0,duration);last=0;sync(true);paint();schedule();}
  function toggle(){
    host.classList.remove('needs-play');if(time>=duration){time=0;paused=false;sync(true);}else paused=!paused;
    last=0;if(paused)pauseMedia();sync();schedule();
  }
  center.addEventListener('click',toggle);
  overlay.querySelectorAll('[data-skip]').forEach(b=>b.addEventListener('click',()=>seek(time+Number(b.dataset.skip))));
  slider.addEventListener('pointerdown',()=>{scrubbing=true;pauseMedia();});
  slider.addEventListener('input',()=>seek(Number(slider.value)));
  const endScrub=()=>{scrubbing=false;last=0;sync();schedule();};
  slider.addEventListener('change',endScrub);slider.addEventListener('pointerup',endScrub);slider.addEventListener('pointercancel',endScrub);
  host.addEventListener('keydown',e=>{
    if(e.target.matches('input,button'))return;
    if([' ','k','ArrowLeft','ArrowRight','j','l','Home','End'].includes(e.key)){
      e.preventDefault();if([' ','k'].includes(e.key))toggle();
      else seek(e.key==='Home'?0:e.key==='End'?duration:time+({'ArrowLeft':-5,'ArrowRight':5,j:-10,l:10}[e.key]));
    }
  });
  host.addEventListener('pointerup',e=>{
    if(e.target.closest('button,input'))return;
    if(e.pointerType==='touch'){host.classList.add('is-touch-active');clearTimeout(touchTimer);touchTimer=setTimeout(()=>host.classList.remove('is-touch-active'),3000);}
    else toggle();
  });
  overlay.querySelector('.ai-fullscreen').addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await host.requestFullscreen();}catch{}
  });
  for(const v of media){
    for(const type of ['loadedmetadata','loadeddata','seeked','ended','canplay'])v.addEventListener(type,()=>{sync();schedule();});
    v.addEventListener('error',()=>{paused=true;host.classList.add('needs-play');schedule();});
  }
  const visibility=()=>{last=0;if(document.hidden)pauseMedia();sync();schedule();};
  document.addEventListener('visibilitychange',visibility);
  host.dataset.duration=String(duration);host.dataset.ready='true';host.classList.add('is-enhanced');paint();
  return {
    duration,seek,toggle,setActive(value){if(active===value)return;active=value;last=0;if(!active)pauseMedia();sync();schedule();},
    pause(){paused=true;pauseMedia();schedule();},play(){paused=false;host.classList.remove('needs-play');if(time>=duration)seek(0);last=0;sync();schedule();},
    state:()=>({time,active,paused,duration,playing:isPlaying()}),
    dispose(){disposed=true;pauseMedia();cancelAnimationFrame(raf);clearTimeout(touchTimer);document.removeEventListener('visibilitychange',visibility);}
  };
}
