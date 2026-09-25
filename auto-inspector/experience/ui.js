const A='/auto-inspector/assets/';
const H=A+'experience/home-v2/';
const F=A+'experience/home-flow/';
export const fieldClips=[
  {id:'scan',duration:3.4,label:'Building the spatial model · studio'},
  {id:'multiroom',duration:4.4,label:'Across multiple rooms · earlier interface'},
  {id:'construction',duration:3.4,label:'Inspecting a construction site'},
  {id:'detection',duration:5.3,label:'Detecting and anchoring a crack'},
  {id:'manual',duration:4.3,label:'Manually selecting a region'}
];
const plus='<svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></svg>';
const cameraIcon='<svg viewBox="0 0 24 24"><path d="M2 7V3h4m12 0h4v4M2 17v4h4m12 0h4v-4M6 7h3l1-2h4l1 2h3v11H6Z"/><circle cx="12" cy="12" r="3"/></svg>';
const close='<span class="ai-capture-close"><svg viewBox="0 0 24 24"><path d="m2 2 20 20M22 2 2 22"/></svg></span>';
function dashboard(){return `<div class="ai-app-dashboard" data-ui="dashboard" data-state="overview">
  <aside class="ai-app-sidebar"><img class="ai-app-icon" src="${A}ui/dashboard/app-icon.png" alt=""><span class="ai-app-side-add">${plus}</span><span class="ai-app-help">ⓘ Help</span><img class="ai-app-company" src="${A}ui/dashboard/company-logo.png" alt=""></aside>
  <div class="ai-app-main"><h4 class="ai-app-welcome">Welcome to Auto Inspector</h4><p class="ai-app-date">Friday, January 9, 2026</p>
  <div class="ai-app-stats"><div class="ai-app-stat"><span>New this week</span><strong>2</strong></div><div class="ai-app-stat"><span>Projects</span><strong>5</strong></div></div>
  <div class="ai-app-toolbar"><h4>Your projects</h4><span class="ai-app-sort">↕ Date created</span></div><div class="ai-app-search"><svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/></svg>Search projects</div>
  <div class="ai-app-project-window"><ol class="ai-app-projects"><li class="ai-app-project ai-app-new">${plus}<span>New project</span></li>${[['219','Residence · 219'],['217','Residence · 217'],['temple','Temple'],['basement','Basement'],['office','Office']].map(([id,label])=>`<li class="ai-app-project"><img class="ai-app-project-photo" src="${A}ui/dashboard/field-${id}.webp" alt=""><div class="ai-app-project-info"><span class="ai-app-project-title">${label}</span><span class="ai-app-more">···</span></div></li>`).join('')}</ol></div></div>
  <div class="ai-home-create"><div class="ai-create-backdrop"></div><div class="ai-create-sheet"><span class="ai-create-input">Studio inspection</span><div class="ai-create-actions"><span class="ai-create-action ai-create-action--cancel">Cancel</span><span class="ai-create-action">Inspect</span></div></div></div></div>`;}
function sliders(){return `<div class="ai-detection-sliders">${['Confidence','IoU'].map(label=>`<div class="ai-detection-slider"><span class="ai-slider-value">0.50</span><span class="ai-slider-plus">+</span><span class="ai-slider-track"></span><span class="ai-slider-minus">−</span><span>${label}</span></div>`).join('')}</div><span class="ai-wall-filter">Wall filter<span class="ai-switch"></span></span><span class="ai-manual-box">Manual region</span>`;}
function capture(){return `<div class="ai-app-capture" data-ui="capture" data-state="scan">
  <div class="ai-camera"><video class="ai-camera-layer ai-scan-camera" muted playsinline preload="none" poster="${F}scan-camera.webp" src="${F}scan-camera.mp4"></video><img class="ai-camera-layer ai-ceiling-photo" src="${A}experience/ceiling-camera.webp" alt=""><div class="ai-photo-space is-detection ai-camera-layer"><img src="${A}experience/record-04.webp" alt=""><div class="ai-home-candidate"><span>crack</span></div><span class="ai-tap-point"></span></div></div>
  <span class="ai-capture-status">Scanning</span><div class="ai-spatial-mini"><canvas aria-label="Reconstructed room model"></canvas><span class="ai-mini-user"></span><span class="ai-mini-anchor"></span></div>
  <aside class="ai-control-rail">${close}<div class="ai-detect-controls">${sliders()}</div><div class="ai-ceiling-controls"><span>↻ Update ceiling</span><span>◉ Hide ceiling</span></div><div class="ai-capture-bottom"><span class="ai-capture-panorama">${cameraIcon}Panorama</span><span class="ai-capture-primary">Finish scan</span></div></aside>
  <div class="ai-ray-inset"><canvas aria-label="Projection from recorded camera position to wall coordinates"></canvas><span>Image → wall coordinates</span><small>Spatial projection · explanatory view</small></div>
  <span class="ai-ceiling-caption">CeilingMeshExtractor · illustrative mesh layer</span>
  <span class="ai-anchor-caption">Actual recording · the camera moves, the anchor stays</span>
  </div>`;}
function model(){return `<div class="ai-model-app" data-ui="model"><canvas aria-label="Measured studio model with native furniture and linked defect markers"></canvas><div class="ai-model-controls"><span>3D</span><div><span>H/S</span><span>Save</span></div></div><div class="ai-model-dimensions"><span>5.46 m</span><span>2.64 m</span><small>Measured wall dimensions · explanatory overlay</small></div><span class="ai-record-badge">Records 04 · 10 · 12</span></div>`;}
function record(){return `<div class="ai-record-app" data-ui="record"><div class="ai-record-sheet"><div class="ai-file-list">${['4.jpg','4_Label.jpg','10.jpg','10_Label.jpg','12.jpg','12_Label.jpg','3D Model','3D Model_Textured','Floor_Plan.dxf'].map((n,i)=>`<span class="${i===8?'selected':''}">${n}</span>`).join('')}</div><div class="ai-record-plan"></div><div class="ai-record-actions"><span>╱ EDIT</span><span>⇧ EXPORT</span><span>♧ DELETE</span></div></div></div>`;}
export function mountUI(target){
  target.innerHTML=`<div class="ai-experience" aria-hidden="true"><div class="ai-exp-screen ai-exp-dashboard">${dashboard()}</div><div class="ai-exp-screen ai-exp-capture">${capture()}</div><div class="ai-exp-screen ai-exp-model">${model()}</div><div class="ai-exp-screen ai-exp-record">${record()}</div><div class="ai-exp-screen ai-exp-field">${fieldClips.map(({id})=>`<video data-field="${id}" muted playsinline preload="metadata" poster="${H}${id}.webp" src="${H}${id}.mp4"></video>`).join('')}<div class="ai-field-caption"><span></span><small>Actual field recording</small></div></div></div>`;
  return target.querySelector('.ai-experience');
}

// Flow sections only mount their needed UI, rather than six complete apps.
export function mountSceneUI(target,index){
  const contents=[
    `<div class="ai-exp-screen ai-exp-dashboard">${dashboard()}</div>`,
    `<div class="ai-exp-screen ai-exp-dashboard">${dashboard()}</div><div class="ai-exp-screen ai-exp-capture">${capture()}</div>`,
    `<div class="ai-exp-screen ai-exp-capture">${capture()}</div>`,
    `<div class="ai-exp-screen ai-exp-capture">${capture()}</div><div class="ai-exp-screen ai-exp-selected"><video class="ai-selected-clip" muted playsinline preload="metadata" poster="${F}anchor-selected.webp" src="${F}anchor-selected.mp4"></video></div>`,
    `<div class="ai-exp-screen ai-exp-model">${model()}</div><div class="ai-exp-screen ai-exp-record">${record()}</div>`
  ];
  const runtime=document.createElement('div');runtime.className='ai-experience';runtime.setAttribute('aria-hidden','true');runtime.innerHTML=contents[index];target.append(runtime);
  if(index!==1)runtime.querySelector('.ai-scan-camera')?.remove();
  if(index!==3)runtime.querySelector('.ai-ray-inset')?.remove();
  return runtime;
}
