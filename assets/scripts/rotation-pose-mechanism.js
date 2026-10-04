(() => {
  'use strict';
  // Reconstructed geometry, not measured dimensions or a structural-response simulation.
  const R = Math.hypot(55, 60), neutral = Math.atan2(60, 55), NS = 'http://www.w3.org/2000/svg';
  const round = value => Number(value.toFixed(3));
  function pose(progress) {
    const u = 24 * Math.sin(2 * Math.PI * progress);
    const pair = (side, cx, activeTravel) => {
      const angle = activeTravel > 0 ? Math.acos((55 + activeTravel) / R) - neutral : 0;
      const q = side === 'a' ? [55, 60] : [-55, -60];
      const pin = [cx + q[0] * Math.cos(angle) - q[1] * Math.sin(angle), q[0] * Math.sin(angle) + q[1] * Math.cos(angle)];
      return { side, cx, angle, pin, corner: [cx + u + q[0], q[1]], active: activeTravel > .02 };
    };
    return { u, a: pair('a', -168, Math.max(0, u)), b: pair('b', 168, Math.max(0, -u)) };
  }
  function scene(progress, view = 'assembly', cutaway = true) {
    const model = pose(progress);
    const faces = []; let layer = 0;
    const project = ([x, y, z]) => [450 + 1.04 * (.9135 * x - .4067 * y), 350 + 1.04 * (-.2297 * x - .5160 * y - .8253 * z)];
    const depth = ([x, y, z]) => -.3356 * x - .7539 * y + .5646 * z;
    const path = vertices => vertices.map((point, i) => `${i ? 'L' : 'M'}${project(point).map(round).join(' ')}`).join('') + 'Z';
    function face(vertices, fill, attrs = '') {
      faces.push({ layer, depth: vertices.reduce((sum, point) => sum + depth(point), 0) / vertices.length, markup: `<path d="${path(vertices)}" fill="${fill}" stroke="#737f90" stroke-opacity=".18" stroke-width=".7" ${attrs}/>` });
    }
    function box(x, y, z, w, h, height, color, alpha = 1) {
      const attrs = `opacity="${alpha}"`;
      face([[x,y,z+height],[x+w,y,z+height],[x+w,y+h,z+height],[x,y+h,z+height]], color[0], attrs);
      face([[x,y,z],[x,y+h,z],[x,y+h,z+height],[x,y,z+height]], color[1], attrs);
      face([[x,y,z],[x+w,y,z],[x+w,y,z+height],[x,y,z+height]], color[2], attrs);
    }
    function cylinder(cx, cy, z, radius, height, color, id) {
      const n = 36, top = [];
      for (let i = 0; i < n; i++) {
        const t = i * Math.PI * 2 / n, t2 = (i + 1) * Math.PI * 2 / n;
        const p = [cx + radius * Math.cos(t), cy + radius * Math.sin(t)];
        const q = [cx + radius * Math.cos(t2), cy + radius * Math.sin(t2)];
        top.push([...p, z + height]);
        if (-.3356 * Math.cos((t+t2)/2) - .7539 * Math.sin((t+t2)/2) > 0) face([[...p,z],[...q,z],[...q,z+height],[...p,z+height]], color[1]);
      }
      face(top, color[0], `data-component="${id}" data-face="top" data-origin="${cx},${cy},${z+height}"`);
    }
    function roller(cx, cy) {
      const n = 24, r = 14, z = 115, half = 10, end = [];
      for (let i = 0; i < n; i++) {
        const t = i * Math.PI * 2 / n, t2 = (i + 1) * Math.PI * 2 / n;
        const p = [cx+r*Math.cos(t), z+r*Math.sin(t)], q = [cx+r*Math.cos(t2), z+r*Math.sin(t2)];
        end.push([p[0],cy-half,p[1]]);
        if (-.3356*Math.cos((t+t2)/2)+.5646*Math.sin((t+t2)/2)>0) face([[p[0],cy-half,p[1]],[q[0],cy-half,q[1]],[q[0],cy+half,q[1]],[p[0],cy+half,p[1]]], '#afb8c6');
      }
      face(end, '#dbe0e8');
    }
    function slot(pair) {
      const sign = pair.side === 'a' ? 1 : -1;
      const map = ([x,y], z) => [pair.cx + model.u + sign*x, sign*y, z];
      const outer = [[43,-4],[67,-4],[67,48],[122,48],[122,72],[43,72]];
      const inner = [[48,1],[62,1],[62,53],[117,53],[117,67],[48,67]];
      const top = outer.map(p=>map(p,82)), hole = inner.map(p=>map(p,82));
      faces.push({ depth: top.reduce((sum,p)=>sum+depth(p),0)/top.length, markup: `<path d="${path(top)}${path(hole)}" fill-rule="evenodd" fill="#444c59" stroke="#263344" stroke-width=".9" data-component="slot-${pair.side}" data-corner="${pair.corner.join(',')}" data-origin="${pair.cx+model.u},0,82"/>` });
      face(inner.map(p=>map(p,74)), '#171e29');
      for (const contour of [outer, inner]) for (let i=0;i<contour.length;i++) {
        const a=contour[i], b=contour[(i+1)%contour.length];
        face([map(a,74),map(b,74),map(b,82),map(a,82)], '#687384');
      }
      for (const p of [[45,8],[111,70]]) {
        const [x,y]=map(p,82); box(x-3,y-3,82,6,6,32,['#b4becb','#929eaf','#a0abba']);
      }
      if (pair.active) {
        const a=project([pair.corner[0],pair.pin[1],83]);
        faces.push({ depth: depth([pair.corner[0],pair.pin[1],83])+.1, markup:`<circle cx="${round(a[0])}" cy="${round(a[1])}" r="11" fill="none" stroke="#0066cc" stroke-width="2"/>` });
      }
    }
    if (view === 'detail') return detailScene(model, progress);
    box(-340,-200,0,680,400,12,['#e2e6ed','#aab4c3','#bcc5d2']);
    for (const pair of [model.a,model.b]) {
      cylinder(pair.cx,0,12,128,16,['#e6e9ef','#aeb7c5'],`disk-${pair.side}`);
      cylinder(pair.cx,0,28,10,3,['#9aa7b9','#73849b'],`bearing-${pair.side}`);
      cylinder(pair.cx,0,31,5.5,23,['#eef2f7','#a6b2c3'],`axis-${pair.side}`);
      // Index lines reveal rotation without adding tracking markers or measured readouts.
      for (const t of [0,Math.PI/2]) {
        const a=project([pair.cx-110*Math.cos(t+pair.angle),-110*Math.sin(t+pair.angle),28.3]);
        const b=project([pair.cx+110*Math.cos(t+pair.angle),110*Math.sin(t+pair.angle),28.3]);
        faces.push({depth:depth([pair.cx,0,28.3]),markup:`<path d="M${a.map(round).join(' ')}L${b.map(round).join(' ')}" fill="none" stroke="#8f9cae" stroke-width="1.5"/>`});
      }
      slot(pair);
      cylinder(pair.pin[0],pair.pin[1],28,6,75,[pair.active?'#6da8ed':'#79a9e4',pair.active?'#0066cc':'#367ab8'],`pin-${pair.side}`);
    }
    for (const y of [-140,124]) {
      box(-157,y,12,314,16,83,['#c9d1de','#a8b3c3','#b5becd'],cutaway && y<0 ? .32 : 1);
      box(-174,y-2,95,348,20,6,['#a4afbf','#78879d','#8b98ac']);
    }
    for (const x of [-124,124]) for (const y of [-132,132]) roller(x+model.u,y);
    // The broad upper plates occlude the linkage beneath them. Compose each
    // convex plate as a layer rather than sorting it against small pin faces.
    layer=1;
    box(-158+model.u,-118,114,316,236,14,['#d7e1ee','#a9b9cf','#b7c7dd'],cutaway?.32:1);
    layer=2;
    box(-80+model.u,-72,128,160,144,25,['#c8d3e2','#93a5be','#a5b6ce'],cutaway?.28:1);
    layer=3;
    box(-80+model.u,-72,153,160,144,10,['#d7e1ee','#a7b7cd','#bac9dc'],cutaway?.28:1);
    faces.sort((a,b)=>(a.layer||0)-(b.layer||0)||a.depth-b.depth);
    return svgStart(model,progress,'Oblique reconstructed assembly') + faces.map(f=>f.markup).join('') + '</svg>';
  }
  function svgStart(model, progress, label) {
    return `<svg xmlns="${NS}" viewBox="0 0 900 560" role="img" aria-label="${label}" data-u="${model.u}" data-progress="${progress}" data-angle-a="${model.a.angle}" data-angle-b="${model.b.angle}"><title>${label}</title><desc>Slots move with the upper platform. The eccentric pins remain attached to their disks and follow circular paths about fixed centre axes. Pin–slot contact converts relative translation into disk rotation. Dimensions and motion are illustrative.</desc>`;
  }
  function detailScene(model, progress) {
    const s=1.52, cx=435, cy=295, pair=model.a;
    const p=([x,y])=>[cx+s*x,cy-s*y];
    const polygon=points=>points.map((point,i)=>`${i?'L':'M'}${p(point).map(round).join(' ')}`).join('')+'Z';
    const outline=[[43,-4],[67,-4],[67,48],[122,48],[122,72],[43,72]].map(([x,y])=>[x+model.u,y]);
    const hole=[[48,1],[62,1],[62,53],[117,53],[117,67],[48,67]].map(([x,y])=>[x+model.u,y]);
    const pin=p([pair.pin[0]-pair.cx,pair.pin[1]]);
    const marker=p([110*Math.cos(pair.angle),110*Math.sin(pair.angle)]);
    return svgStart(model,progress,'Top view of one pin–slot pair')+`
      <circle cx="${cx}" cy="${cy}" r="${128*s}" fill="#e8ecf2" stroke="#aab6c6" stroke-width="2" data-component="disk-a" data-origin="-168,0,28"/>
      <circle cx="${cx}" cy="${cy}" r="${R*s}" fill="none" stroke="#b9c4d4" stroke-dasharray="5 7"/>
      <path d="M${cx} ${cy}L${marker.map(round).join(' ')}" stroke="#8595ab" stroke-width="2"/>
      <path d="${polygon(outline)}${polygon(hole)}" fill-rule="evenodd" fill="#444c59" stroke="#243244" stroke-width="1.5" data-component="slot-a" data-origin="${pair.cx+model.u},0,82" data-corner="${pair.corner.join(',')}"/>
      <circle cx="${round(pin[0])}" cy="${round(pin[1])}" r="12" fill="${pair.active?'#0066cc':'#6f96c7'}" stroke="#f4f8ff" stroke-width="2" data-component="pin-a" data-origin="${pair.pin.join(',')},103"/>
      <circle cx="${cx}" cy="${cy}" r="9" fill="#f9fbff" stroke="#8798ae" stroke-width="2" data-component="axis-a" data-origin="-168,0,54"/>
      <path d="M${round(pin[0]+15)} ${round(pin[1])}L710 252" fill="none" stroke="#7f9ac0" stroke-width="1.5"/>
      <text x="712" y="247" fill="#0066cc" font-family="system-ui" font-size="24">Disk pin</text>
      <path d="M${cx} ${cy+13}V500" fill="none" stroke="#8d9db2" stroke-width="1.2"/>
      <text x="${cx}" y="530" text-anchor="middle" fill="#627086" font-family="system-ui" font-size="24">Fixed centre axis</text>
      <text x="${cx}" y="55" text-anchor="middle" fill="#627086" font-family="system-ui" font-size="24">Slot moves with the platform</text>
    </svg>`;
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports={pose,scene}; return; }
  const host=document.querySelector('[data-rpt-mechanism]');
  if (!host) return;
  const viewport=host.querySelector('[data-rpt-assembly-scene]');
  const button=host.querySelector('[data-rpt-mechanism-play]'), slider=host.querySelector('[data-rpt-mechanism-seek]');
  const stage=host.querySelector('[data-rpt-mechanism-stage]'), explanation=host.querySelector('[data-rpt-mechanism-explanation]');
  const cutaway=host.querySelector('[data-rpt-cutaway]'), reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let progress=0, view='assembly', running=false, frame=null, previous=null, rendered=0;
  function draw(value) {
    progress=Math.max(0,Math.min(1,value));
    const model=pose(progress);
    viewport.innerHTML=scene(progress,view,cutaway.checked);
    host.dataset.mechanismProgress=String(progress);
    host.dataset.mechanismDisk=model.a.active?'A':model.b.active?'B':'none';
    host.dataset.assemblyView=view;
    slider.value=String(progress);
    if (view==='detail' && model.u<-.5) {
      stage.textContent='The opposite disk engages';
      explanation.textContent='This pin stays on the free leg while the slot moves past it. The other pin–slot pair turns the opposite disk.';
    } else if (Math.abs(model.u)<.5) {
      stage.textContent=progress>=1?'Cycle complete':'Platform and linkage';
      explanation.textContent='The centre axes stay on the base. Each off-centre pin connects its disk to a slot beneath the upper platform.';
    } else {
      stage.textContent='Slot contact turns a disk';
      explanation.textContent='As the platform slides, a slot wall guides the eccentric pin around its disk’s fixed axis. The opposite pin can slide along its slot.';
      if (progress>.18&&progress<.43||progress>.68&&progress<.93) {
        stage.textContent='Rotational inertia acts through the contact';
        explanation.textContent='Accelerating or decelerating a disk requires torque. The inertial reaction acts through the pin and slot on the platform.';
      }
    }
    slider.setAttribute('aria-valuetext',stage.textContent);
  }
  function pause() {
    running=false; if(frame!==null) cancelAnimationFrame(frame);
    frame=null; previous=null; rendered=0;
    button.textContent=progress>=1?'Replay mechanism':'Play mechanism'; button.setAttribute('aria-pressed','false');
  }
  function advance(now) {
    if(!running)return;
    const dt=previous===null?0:Math.min((now-previous)/1000,.1); previous=now;
    progress=Math.min(1,progress+dt/12);
    if(now-rendered>=40||progress>=1) { draw(progress); rendered=now; }
    if(progress>=1)pause(); else frame=requestAnimationFrame(advance);
  }
  button.addEventListener('click',()=>{
    if(running)return pause(); if(reduced.matches)return;
    if(progress>=1)draw(0);
    running=true; previous=null; button.textContent='Pause mechanism'; button.setAttribute('aria-pressed','true'); frame=requestAnimationFrame(advance);
  });
  slider.addEventListener('input',()=>{draw(Number(slider.value));pause();});
  for(const option of host.querySelectorAll('[data-rpt-assembly-view]')) option.addEventListener('click',()=>{
    view=option.dataset.rptAssemblyView;
    for(const item of host.querySelectorAll('[data-rpt-assembly-view]'))item.setAttribute('aria-pressed',String(item===option));
    host.querySelector('[data-rpt-cutaway-label]').hidden=view==='detail'; draw(progress);
  });
  cutaway.addEventListener('change',()=>draw(progress));
  function preference(){pause();button.hidden=reduced.matches;}
  reduced.addEventListener('change',preference);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)pause();}).observe(host);
  host.querySelector('[data-rpt-assembly-views]').hidden=false;
  host.querySelector('[data-rpt-mechanism-controls]').hidden=false;
  draw(0);preference();
})();
