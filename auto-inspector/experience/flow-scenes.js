import {mountSceneUI} from './ui.js';
import {makeScene} from './scene.js';
const clamp=x=>Math.min(1,Math.max(0,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const range=(x,a,b)=>smooth((x-a)/(b-a));
const pulse=(x,a,b)=>Math.sin(range(x,a,b)*Math.PI);
const F='/auto-inspector/assets/experience/home-flow/';
export async function createScene(host,index,manifest){
  const records=Object.fromEntries(manifest.records.map(r=>[r.id,r]));
  if(index===5){
    const video=host.querySelector('video');return {duration:records['workflow-full'].duration,render(){},mediaAt:()=>({video,start:0,duration:records['workflow-full'].duration})};
  }
  const ui=mountSceneUI(host,index),q=s=>ui.querySelector(s),all=s=>[...ui.querySelectorAll(s)];
  let mini,ray,model;
  if([1,2,3].includes(index))mini=await makeScene(q('.ai-spatial-mini canvas'));
  if(index===3){
    ray=await makeScene(q('.ai-ray-inset canvas'),{raycast:true});
    const end=document.createElement('img');end.src=F+'anchor-hold.webp';end.alt='';end.className='ai-anchor-hold';q('.ai-exp-selected').append(end);
  }
  if(index===4){
    const response=await fetch('/auto-inspector/assets/layers/studio-2-plan-layers.svg');if(!response.ok)throw Error('Plan unavailable');
    // The source-controlled SVG is inserted only once, in this section.
    q('.ai-record-plan').innerHTML=await response.text();model=await makeScene(q('.ai-model-app canvas'));
  }
  const scanDuration=records['scan-camera'].duration,anchorDuration=records['anchor-selected'].duration;
  const duration=[10,2.5+scanDuration,7,6.6+anchorDuration,11][index];
  const show=(name,opacity)=>{const e=q('.ai-exp-'+name);if(e){e.classList.toggle('is-visible',opacity>0);e.style.opacity=String(opacity);}};
  const opacity=(s,n)=>{const e=q(s);if(e)e.style.opacity=String(n);};
  function render(time){
    const t=index===0?time*.8:time;
    if(index<=1){
      const modal=index===1?range(t,.35,1.1)*(1-range(t,2,2.7)):0;
      opacity('.ai-home-create',modal);q('.ai-create-sheet').style.transform='translateY('+((1-modal)*8)+'%) scale('+(.96+.04*modal)+')';
      q('.ai-app-main').style.filter='blur('+(modal*.9)+'cqw)';q('.ai-app-sidebar').style.filter='blur('+(modal*.9)+'cqw)';
      [...all('.ai-app-project:not(.ai-app-new)'),q('.ai-app-stats'),q('.ai-app-search'),q('.ai-app-sort'),q('.ai-app-new'),q('.ai-app-side-add')].forEach((el,i)=>{
        const f=index===0?pulse(t,.4+i*.56,1.8+i*.56):el.matches('.ai-app-new')?1-range(t,.1,.7):0;
        el.style.transform='translateY('+(-f*.7)+'cqw)';el.style.boxShadow='0 '+(.5+f*.5)+'cqw '+(.8+f*1.4)+'cqw #51341d'+Math.round(10+f*35).toString(16).padStart(2,'0')+',0 0 0 '+(f*.18)+'cqw #cc9b69';
      });
      const pan=index===0?range(t,1.9,2.6)*(1-range(t,4.1,4.8)):0;q('.ai-app-projects').style.transform=host.clientWidth<=440?'translateY('+(-25.5*pan)+'cqw)':'none';
    }
    if(index===0){show('dashboard',1);return;}
    if(index===1){
      const handoff=range(t,2,2.9);show('dashboard',1-handoff);show('capture',handoff);
      opacity('.ai-scan-camera',1);opacity('.ai-ceiling-photo',0);opacity('.ai-photo-space',0);
      const build=range(t,2.65,duration-.65);mini.update({mode:'scan',p:build});q('.ai-spatial-mini').style.transform='translateY('+((1-build)*8)+'%)';
    }
    if(index===2){
      show('capture',1);q('.ai-app-capture').dataset.state='ceiling';opacity('.ai-ceiling-photo',1);opacity('.ai-photo-space',0);
      mini.update({mode:'ceiling',p:range(t,.4,6.1)});q('.ai-spatial-mini').style.transform='scale('+(1+.12*pulse(t,.1,6.5))+')';
      q('.ai-ceiling-controls span').style.boxShadow='0 0 0 '+(pulse(t,.1,2)*.28)+'cqw #69d3d9a0';
    }
    if(index===3){
      const toClip=range(t,6.4,7.1);show('capture',1-toClip);show('selected',toClip);
      q('.ai-app-capture').dataset.state='detect';q('.ai-capture-status').textContent='Detecting';q('.ai-capture-primary').textContent='Finish detection';
      opacity('.ai-photo-space',1);opacity('.ai-ceiling-photo',0);mini.update({mode:'scan',p:1});
      q('.ai-spatial-mini').style.transform='scale(.72) translate(15%,20%)';
      opacity('.ai-home-candidate',range(t,.25,1)*(1-range(t,2.05,2.55)));
      opacity('.ai-tap-point',range(t,1.5,1.85)*(1-range(t,2.15,2.6)));
      const inset=range(t,2.2,2.9)*(1-range(t,6.2,6.95));opacity('.ai-ray-inset',inset);opacity('.ai-spatial-mini',1-inset);
      ray.update({mode:'raycast',p:range(t,2.7,6.35)});
      // End on a clean, source-derived anchored frame, not the next detection box.
      opacity('.ai-anchor-hold',range(t,duration-.75,duration));
    }
    if(index===4){
      const toPlan=range(t,6.1,7.25);show('model',1-toPlan);show('record',toPlan);
      const labels=model.update({mode:'model',p:range(t,.15,5.5)})||[];
      all('.ai-model-dimensions>span').forEach((e,i)=>{if(labels[i]){e.style.left=Math.max(7,Math.min(91,labels[i].x))+'%';e.style.top=Math.max(6,Math.min(91,labels[i].y))+'%';e.textContent=labels[i].text;}});
      all('#ai-anchors [data-record-id]').forEach((group,i)=>{
        const r=range(t,7.2+i*.65,8.2+i*.65),circles=[...group.querySelectorAll('circle')];group.style.opacity=String(.3+.7*r);
        circles[0].setAttribute('r',String(12+18*Math.sin(r*Math.PI)));circles[0].setAttribute('opacity',String(.24+.25*Math.sin(r*Math.PI)));circles[1].setAttribute('r',String(4.5+3*r));
      });
    }
  }
  const mediaAt=t=>index===1&&t>=2.5?{video:q('.ai-scan-camera'),start:2.5,duration:scanDuration}:index===3&&t>=6.6?{video:q('.ai-selected-clip'),start:6.6,duration:anchorDuration}:null;
  render(0);return {duration,render,mediaAt};
}
