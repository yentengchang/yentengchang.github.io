import * as THREE from '../vendor/three-0.180.0/three.module.min.js';
const base='/auto-inspector/';
const read=async p=>{const r=await fetch(base+p);if(!r.ok)throw Error(`${p}: ${r.status}`);return r.json();};
let shared;
async function sources(){return shared??=Promise.all([read('assets/data/studio-2-spatial.json'),read('assets/layers/studio-2-scene.gltf'),...['Bed','Storage','Table_Dining','Chair_Couch','Chair_Dining','Toilet','Sink'].map(n=>read(`assets/ui/furniture/${n}.json`))]);}
const clamp=x=>Math.max(0,Math.min(1,x));
const V=a=>new THREE.Vector3(...a);
export async function makeScene(canvas,{raycast=false}={}){
  const [data,fixture,...furniture]=await sources();
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-5,5,4,-4,.01,200),root=new THREE.Group();scene.add(root);
  scene.add(new THREE.HemisphereLight(0xffffff,0x77716a,2.5));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(4,9,7);scene.add(sun);
  const floorY=data.floors[0].transformColumnMajor[13];const world=a=>V(a).add(new THREE.Vector3(0,-floorY,0));
  const roomParts=[],objects=[],markers=[],halos=[],ceiling=new THREE.Group(),dimensions=new THREE.Group();root.add(ceiling,dimensions);
  const dimensionLabels=[];
  const material=(colour,extra={})=>new THREE.MeshStandardMaterial({color:colour,roughness:.85,side:THREE.DoubleSide,...extra});
  function line(points,colour=0xb78043){const g=new THREE.BufferGeometry().setFromPoints(points),l=new THREE.Line(g,new THREE.LineBasicMaterial({color:colour,transparent:true,opacity:1}));root.add(l);return l;}
  function sphere(p,r=.055,colour=0xff1717){const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),material(colour));mesh.position.copy(p);root.add(mesh);return mesh;}
  let rayParts=[],rayPatch,photoPlane;
  if(raycast){
    const record=data.defects.find(d=>d.id==='04'),center=V(record.displayPointWorldM),local=a=>V(a).sub(center).multiplyScalar(18),corners=record.cornersWorldM.map(local),cam=local(record.cameraWorldM);
    const normal=corners[1].clone().sub(corners[0]).cross(corners[3].clone().sub(corners[0])).normalize();if(normal.dot(cam)<0)normal.negate();
    const wall=new THREE.Mesh(new THREE.PlaneGeometry(3.8,3.8),material(0xc6b9a1));wall.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);wall.position.copy(normal.clone().multiplyScalar(-.05));root.add(wall);
    const image=await new THREE.TextureLoader().loadAsync(base+'assets/experience/record-04.webp');image.colorSpace=THREE.SRGBColorSpace;
    wall.material.map=image;wall.material.color.set(0xffffff);
    const patchGeo=new THREE.BufferGeometry().setFromPoints([corners[0],corners[1],corners[2],corners[0],corners[2],corners[3]]);patchGeo.computeVertexNormals();
    rayPatch=new THREE.Mesh(patchGeo,material(0xb9503a,{transparent:true,opacity:.22,depthWrite:false}));root.add(rayPatch);line([...corners,corners[0]],0xe15b42);
    const imageCenter=cam.clone().lerp(new THREE.Vector3(),.35);photoPlane=new THREE.Mesh(new THREE.PlaneGeometry(.9,1.15),material(0xffffff,{map:image}));photoPlane.position.copy(imageCenter);photoPlane.quaternion.copy(wall.quaternion);root.add(photoPlane);sphere(cam,.09,0x367c87);
    for(const p of corners){const l=line([cam,cam],0x3aabba);rayParts.push({line:l,start:cam,end:p});sphere(p,.045,0xf09261);}
  }else{
    const buffer=Uint8Array.from(atob(fixture.buffers[0].uri.split(',')[1]),c=>c.charCodeAt(0)).buffer;
    for(const node of fixture.nodes){
      const layer=node.extras.layer;if(!['floor','wall'].includes(layer))continue;
      const primitive=fixture.meshes[node.mesh].primitives[0],geo=new THREE.BufferGeometry();
      for(const [name,key] of [['position','POSITION'],['normal','NORMAL']]){const a=fixture.accessors[primitive.attributes[key]],v=fixture.bufferViews[a.bufferView];geo.setAttribute(name,new THREE.Float32BufferAttribute(new Float32Array(buffer,v.byteOffset||0,a.count*3).slice(),3));}
      geo.translate(0,-floorY,0);
      const mesh=new THREE.Mesh(geo,material(layer==='floor'?0x8b8173:0x4b4945));mesh.userData={layer,front:['W05','W06','W07','W08','W09','W10'].includes(node.name)};root.add(mesh);roomParts.push(mesh);
    }
    const map={bed:'Bed',storage:'Storage',table:'Table_Dining',sofa:'Chair_Couch',chair:'Chair_Dining',toilet:'Toilet',sink:'Sink'};
    for(const ob of data.objects){
      const asset=furniture.find(f=>f.source===`${map[ob.category]||'Storage'}.usdz`),group=new THREE.Group();
      for(const part of asset.meshes){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));geo.setIndex(part.indices);geo.computeVertexNormals();group.add(new THREE.Mesh(geo,material(new THREE.Color(...part.colour))));}
      const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      const contents=new THREE.Group();contents.add(group);group.position.copy(center.negate());contents.scale.set(...ob.dimensionsM.map((d,i)=>d/size.getComponent(i)));
      const holder=new THREE.Group();holder.add(contents);holder.applyMatrix4(new THREE.Matrix4().fromArray(ob.transformColumnMajor));holder.position.y-=floorY;root.add(holder);objects.push(holder);
    }
    const glow=document.createElement('canvas');glow.width=128;glow.height=128;
    const context=glow.getContext('2d'),gradient=context.createRadialGradient(64,64,8,64,64,63);
    gradient.addColorStop(0,'#ff302bdd');gradient.addColorStop(.25,'#ff302b88');gradient.addColorStop(.65,'#ff302b22');gradient.addColorStop(1,'#ff302b00');context.fillStyle=gradient;context.fillRect(0,0,128,128);
    const glowTexture=new THREE.CanvasTexture(glow);
    for(const record of data.defects.filter(d=>['04','10','12'].includes(d.id))){
      const m=sphere(world(record.displayPointWorldM),.105);m.userData.id=record.id;m.material.depthTest=false;m.renderOrder=11;markers.push(m);
      const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,depthTest:false,depthWrite:false}));halo.position.copy(m.position);halo.renderOrder=12;root.add(halo);halos.push(halo);
    }
    const wall=data.walls.find(w=>w.id==='W04'),[a,b,c,d]=wall.polygonWorldM.map(world),offset=new THREE.Vector3(-.982,0,-.188).multiplyScalar(.55);
    const dimensionLine=(points)=>{const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x657673,depthTest:false,transparent:true,opacity:.9}));l.renderOrder=10;dimensions.add(l);};
    const topA=d.clone().add(new THREE.Vector3(0,.25,0)),topB=c.clone().add(new THREE.Vector3(0,.25,0));
    dimensionLine([d,topA,topB,c]);dimensionLabels.push({point:topA.clone().lerp(topB,.5).add(new THREE.Vector3(0,.12,0)),text:wall.dimensionsM[0].toFixed(2)+' m'});
    dimensionLine([a,a.clone().add(offset),d.clone().add(offset),d]);dimensionLabels.push({point:a.clone().lerp(d,.5).add(offset.clone().multiplyScalar(1.5)),text:wall.dimensionsM[1].toFixed(2)+' m'});
    const polygon=data.floors[0].polygonWorldM.map(p=>new THREE.Vector2(p[0],p[2]));
    // Restore the earlier continuous ceiling layer. Its height is illustrative,
    // not raw ceiling geometry from the RoomData export.
    const positions=[];
    for(const triangle of THREE.ShapeUtils.triangulateShape(polygon,[])){
      for(const i of triangle)positions.push(polygon[i].x,2.68,polygon[i].y);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
    ceiling.add(new THREE.Mesh(geo,material(0x53cbd2,{transparent:true,opacity:.65,depthWrite:false})));
    ceiling.add(new THREE.LineSegments(new THREE.WireframeGeometry(geo),new THREE.LineBasicMaterial({color:0x31898f,transparent:true,opacity:.48})));
  }
  const grid=new THREE.GridHelper(80,160,0xb8b8b4,0xd3d3d0);grid.position.y=-.025;scene.add(grid);
  let last={mode:raycast?'raycast':'model',p:1},renderedKey='';
  const projectLabels=()=>dimensionLabels.map(label=>{const v=label.point.clone().project(camera);return {x:(v.x+1)*50,y:(1-v.y)*50,text:label.text};});
  function update({mode='model',p=1}={}){
    last={mode,p};const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    // A completed state needs no redraw: no clock-driven rendering or idle
    // GPU work while the reader pauses at a result.
    const key=`${mode}|${p}|${w}|${h}|${renderer.getPixelRatio()}`;
    if(key===renderedKey)return projectLabels();
    if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
    const mini=['scan','ceiling'].includes(mode);grid.visible=!mini&&!raycast;scene.background=mini?null:new THREE.Color(raycast?0xf0efeb:0xeaeae6);
    if(raycast){
      const reveal=clamp((p-.1)/.55);for(const r of rayParts){r.line.geometry.setFromPoints([r.start,r.start.clone().lerp(r.end,reveal)]);r.line.visible=p<.95;}
      rayPatch.material.opacity=.12+.4*clamp((p-.6)/.3);photoPlane.visible=p<.9;
      camera.position.set(5.4-1.6*p,2.1,6.3);camera.lookAt(0,0,1);camera.userData.size=5.4;
    }else{
      for(const [i,mesh] of roomParts.entries()){
        const reveal=mode==='scan'?clamp(p*1.7-i/roomParts.length):1;mesh.scale.y=Math.max(.001,reveal);mesh.visible=reveal>0;
        mesh.material.color.set(mini?0xffffff:mesh.userData.layer==='floor'?0x8b8173:0x4b4945);
        const cut=!mini&&mesh.userData.front;mesh.material.transparent=cut;mesh.material.opacity=cut?.17:1;mesh.material.depthWrite=!cut;
      }
      for(const [i,o] of objects.entries()){o.visible=mode!=='scan'||p>(.35+i*.05);o.scale.setScalar(mode==='scan'?clamp((p-.3-i*.05)*5):1);}
      markers.forEach((m,i)=>{const t=clamp((p-.1-i*.14)/.18),pulse=Math.sin(t*Math.PI);m.visible=!mini&&t>0;m.scale.setScalar(t*(1+pulse*.6));halos[i].visible=m.visible;halos[i].scale.setScalar(.6+pulse*.7);halos[i].material.opacity=.6+pulse*.4;});
      dimensions.visible=!mini;ceiling.visible=mode==='ceiling';
      // Lift the intact surface away from the walls, then settle into context.
      ceiling.position.y=1.15*Math.sin(clamp(p)*Math.PI);
      const angle=mode==='scan'?.85-p*.2:mode==='ceiling'?.75:1.0-p*.4;camera.position.set(-1+11*Math.sin(angle),mini?9:10,.6+11*Math.cos(angle));
      const ceilingLift=mode==='ceiling'?ceiling.position.y:0;
      camera.lookAt(-1,1+ceilingLift*.5,.65);camera.userData.size=mini?7.7+ceilingLift:8.8;
    }
    const size=Math.max(camera.userData.size,(raycast?5.3:8.8)/(w/h));camera.left=-size*w/h/2;camera.right=size*w/h/2;camera.top=size/2;camera.bottom=-size/2;camera.updateProjectionMatrix();renderer.render(scene,camera);
    renderedKey=key;return projectLabels();
  }
  canvas.addEventListener('webglcontextrestored',()=>{renderedKey='';update(last);});
  const observer=new ResizeObserver(()=>update(last));observer.observe(canvas);
  update(last);return {update,data,dispose(){observer.disconnect();renderer.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});}};
}
