/* Lightweight 3D projection for the concept illustration. No field data is saved. */
(() => {
  'use strict';
  const defaults = {step: 0, component: 2, face: 'South face', section: 'middle', grade: 'V2', marker: true, isolate: false, yaw: -.62, pitch: .48, zoom: 1, panX: 0, panY: 0};
  const categories = {V1: '#c6a04c', V2: '#cb7b39', V3: '#a94e2d'};
  function renderModel(input) {
    const s = {...defaults, ...input};
    const cos = Math.cos(s.yaw), sin = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
    const project = ([x,y,z]) => {
      const rx = x * cos + z * sin, rz = z * cos - x * sin;
      const ry = (y - 3.1) * cp - rz * sp;
      const depth = (y - 3.1) * sp + rz * cp;
      const scale = 27 * s.zoom * 70 / (70 + depth);
      return [400 + rx * scale + s.panX, 238 - ry * scale + s.panY];
    };
    const point = p => project(p).map(n => n.toFixed(1)).join(',');
    const path = pts => pts.map((p,i) => `${i ? 'L' : 'M'}${point(p)}`).join(' ');
    const zFor = rib => -12 + (rib - 1) * 2;
    const arc = (z,start=0,end=1) => Array.from({length: 33}, (_,i) => {const t = start + (end-start)*i/32; return [6*Math.cos(t*Math.PI),3+3.5*Math.sin(t*Math.PI),z];});
    const arch = z => [[6,0,z],...arc(z),[-6,0,z]];
    const line = (pts, color, width=1.1, extra='') => `<path d="${path(pts)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
    const floor = [[-6,0,-12],[6,0,-12],[6,0,12],[-6,0,12]];
    let content = `<path d="${path(floor)} Z" fill="#e9e8e1" fill-opacity=".65" stroke="#d9d8d0"/>`;
    if (!s.isolate) {
      for (const t of [0,.17,.33,.5,.67,.83,1]) {const [x,y] = arc(0)[Math.round(t*32)]; content += line([[x,y,-12],[x,y,12]],'#c1c4be',.9);}
      for (let i=1;i<13;i+=2) content += line([[-6,0,zFor(i)],[-6,3,zFor(i+1)],[-6,0,zFor(i+2)]],'#c6c8c1',.8);
    }
    const order = Array.from({length:13},(_,i)=>i+1).sort((a,b) => zFor(b)*cos - zFor(a)*cos);
    for (const i of order) {
      const selected = s.step>=1 && i===s.component;
      if (s.isolate && !selected) continue;
      content += `<g data-df-rib="${i}">${line(arch(zFor(i)),selected ? '#a94e2d' : '#9da39a',selected ? 3 : 1.3)}${line(arch(zFor(i)),'transparent',12,'pointer-events="stroke"')}</g>`;
    }
    const z = zFor(s.component);
    if (s.step >= 2 && s.marker) {
      const pos = {upper:.43,middle:.24,lower:.07}[s.section];
      const [x,y] = arc(z,pos,pos)[0];
      content += line(arc(z,pos-.055,pos+.055),s.step>=3 ? categories[s.grade] : '#a94e2d',7);
      const [px,py] = project([x,y,z + (s.face==='South face' ? -.2 : .2)]);
      const c = s.step>=3 ? categories[s.grade] : '#a94e2d';
      content += `<g transform="translate(${px.toFixed(1)},${py.toFixed(1)})"><path d="M0,0 C-7,-9 -15,-17 -15,-25 A15,15 0 1 1 15,-25 C15,-17 7,-9 0,0Z" fill="${c}" stroke="white" stroke-width="3"/><circle cy="-25" r="4" fill="white"/>`;
      if (s.step>=3) content += `<rect x="21" y="-39" width="47" height="29" rx="7" fill="white" stroke="#e1dcd3"/><text x="44.5" y="-19" text-anchor="middle" fill="${c}" font-size="16" font-weight="600">${s.grade}</text>`;
      content += '</g>';
    }
    if (!s.isolate) {
      const route = [[-4,0,-9],[0,0,-9],[4,0,-9]];
      content += line(route,'#b7906e',2,'stroke-dasharray="5 6"');
      route.forEach((p,i) => {const [x,y]=project(p);content+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="white" stroke="#b7906e" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y+26).toFixed(1)}" text-anchor="middle" fill="#8e7968" font-size="16">${'ABC'[i]}</text>`;});
      const [tx,ty]=project([0,0,-9]);content+=`<text x="${tx.toFixed(1)}" y="${(ty+53).toFixed(1)}" text-anchor="middle" fill="#8e7968" font-size="14">Ground viewpoints</text>`;
    }
    if (s.step>=1) {
      const [x,y]=project([-6,0,z]);content+=`<text x="${(x-10).toFixed(1)}" y="${(y+24).toFixed(1)}" text-anchor="end" fill="#a94e2d" font-size="16" font-weight="600">R${String(s.component).padStart(2,'0')}</text>`;
    }
    if (s.step===4) content+=`<rect x="225" y="456" width="350" height="38" rx="10" fill="white" stroke="#e1dcd3"/><text x="400" y="480" text-anchor="middle" fill="#7a6b5f" font-size="15">Selected face · ${s.marker ? 'Illustrative '+s.grade : 'Pending confirmation'}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="800" height="520" role="img" aria-label="Conceptual arched structural model. Simplified geometry with illustrative ground viewpoints and a selected inspection location." tabindex="0" style="font-family: -apple-system,BlinkMacSystemFont,Arial,sans-serif"><g>${content}</g></svg>`;
  }
  // Allows the identical illustration to be exported as the no-JavaScript fallback.
  if (typeof document === 'undefined') { globalThis.dfRenderModel = renderModel; return; }
  const page = document.querySelector('.df-page');
  if (!page) return;
  const find = selector => page.querySelector(selector);
  const all = selector => [...page.querySelectorAll(selector)];
  const s = {...defaults};
  const steps = [
    ['Ground observation','Follow the planned route.','Use the ground viewpoints to check each face in sequence.'],
    ['Component selection','Choose the right member.','Select the member and face. Isolate or rotate the model for a clearer view.'],
    ['Location marking','Mark the defect.','Choose a section. Place, revise or remove the location marker.'],
    ['Observation record','Keep the useful details.','Choose V1–V3. Add a clear photo or note when needed.'],
    ['Face completion','Review before moving on.','See which faces are checked, unchecked or obscured before moving on.']
  ];
  const model = find('[data-df-model]');
  const fallback = model.innerHTML;
  try {
    model.innerHTML = renderModel(s);
    const svg = model.querySelector('svg');
    function redraw() {
      const parsed = new DOMParser().parseFromString(renderModel(s),'image/svg+xml');
      svg.innerHTML = parsed.documentElement.innerHTML;
    }
    function location() { return `R${String(s.component).padStart(2,'0')} · ${s.face} · ${s.section[0].toUpperCase()+s.section.slice(1)} section`; }
    function update(announce=true) {
      const [label,title,copy] = steps[s.step];
      find('[data-df-step-label]').textContent = label;
      find('[data-df-step-title]').textContent = title;
      find('[data-df-step-copy]').textContent = copy;
      all('[data-df-step]').forEach(b => b.setAttribute('aria-pressed',String(Number(b.dataset.dfStep)===s.step)));
      find('[data-df-previous]').disabled = s.step===0;
      find('[data-df-next]').disabled = s.step===4;
      find('[data-df-selection]').textContent = s.step===0 ? 'Ground observation' : `R${String(s.component).padStart(2,'0')} · ${s.face}`;
      find('.df-example-controls').hidden = s.step===0;
      find('[data-df-section]').parentElement.hidden = s.step<2;
      find('[data-df-record]').hidden = s.step<3;
      find('[data-df-criteria]').hidden = s.step<3;
      find('[data-df-location]').textContent = s.marker ? location() : 'No example marker';
      find('[data-df-category-label]').textContent = s.grade;
      all('[data-df-grade-choice]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.dfGradeChoice===s.grade)));
      find('[data-df-marker]').textContent = s.marker ? 'Remove example marker' : 'Restore example marker';
      find('[data-df-isolate]').disabled = s.step===0;
      find('[data-df-isolate]').setAttribute('aria-pressed',String(s.isolate));
      if (announce) find('[data-df-announcement]').textContent = `Step ${s.step+1}: ${title} ${s.step>=1 ? location()+'.' : ''}`;
      redraw();
    }
    all('[data-df-step]').forEach(b => b.addEventListener('click',()=> {s.step=Number(b.dataset.dfStep);if(!s.step)s.isolate=false;update();}));
    find('[data-df-previous]').addEventListener('click',()=>{s.step=Math.max(0,s.step-1);if(!s.step)s.isolate=false;update();});
    find('[data-df-next]').addEventListener('click',()=>{s.step=Math.min(4,s.step+1);update();});
    find('[data-df-component]').addEventListener('change',e=>{s.component=Number(e.target.value);update();});
    find('[data-df-face]').addEventListener('change',e=>{s.face=e.target.value;update();});
    find('[data-df-section]').addEventListener('change',e=>{s.section=e.target.value;update();});
    all('[data-df-grade-choice]').forEach(b=>b.addEventListener('click',()=>{s.grade=b.dataset.dfGradeChoice;update();}));
    find('[data-df-marker]').addEventListener('click',()=>{s.marker=!s.marker;update();});
    find('[data-df-isolate]').addEventListener('click',()=>{s.isolate=!s.isolate;update();});
    function changeView(action) {
      if(action==='left')s.yaw-=.18;
      if(action==='right')s.yaw+=.18;
      if(action==='in')s.zoom=Math.min(1.25,s.zoom+.08);
      if(action==='out')s.zoom=Math.max(.65,s.zoom-.08);
      if(action==='reset') {const {yaw,pitch,zoom,panX,panY}=defaults;Object.assign(s,{yaw,pitch,zoom,panX,panY});}
      redraw();
    }
    all('[data-df-view]').forEach(b=>b.addEventListener('click',()=>changeView(b.dataset.dfView)));
    svg.addEventListener('keydown',e=>{
      const action={ArrowLeft:'left',ArrowRight:'right','+':'in','=':'in','-':'out',Home:'reset'}[e.key];
      if(action){e.preventDefault();changeView(action);}
      else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();s.pitch=Math.max(.12,Math.min(.8,s.pitch+(e.key==='ArrowUp'?.07:-.07)));redraw();}
    });
    let drag = null, frame = 0;
    svg.addEventListener('pointerdown',e=>{
      if(e.button!==0 || (e.pointerType==='touch' && !e.isPrimary))return;
      drag={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false,pan:e.shiftKey};
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove',e=>{
      if(!drag || e.pointerId!==drag.id)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(!drag.moved && Math.hypot(dx,dy)<5)return;
      drag.moved=true;
      // Vertical single-finger movement remains native page scrolling.
      if(e.pointerType==='touch'&&Math.abs(dy)>Math.abs(dx)*1.5)return;
      svg.classList.add('df-dragging');
      if(drag.pan){s.panX=Math.max(-80,Math.min(80,s.panX+dx));s.panY=Math.max(-60,Math.min(60,s.panY+dy));}
      else {s.yaw+=dx*.006;s.pitch=Math.max(.12,Math.min(.8,s.pitch+dy*.004));}
      drag.x=e.clientX;drag.y=e.clientY;
      if(!frame)frame=requestAnimationFrame(()=>{frame=0;redraw();});
    });
    const endDrag=e=>{if(drag?.id===e.pointerId){drag=null;svg.classList.remove('df-dragging');}};
    svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);
    // Explicit controls make all model actions available without a pointer.
    update(false);
    page.classList.add('df-enhanced');
  } catch (error) {
    model.innerHTML=fallback;
    page.classList.remove('df-enhanced');
    all('[hidden]').forEach(e=>e.hidden=false);
    console.error('Concept illustration unavailable; static workflow retained.',error);
  }
})();
