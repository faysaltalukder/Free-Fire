(() => {
  "use strict";
  const THREE = window.THREE;
  if (!THREE) { console.error("Three.js failed to load; keeping the 2D fallback."); const fallback=document.getElementById("gameCanvas"); if(fallback) fallback.style.opacity="1"; return; }
  const canvas = document.getElementById("game3dCanvas");
  let renderer, scene, camera, terrain, planeGroup, zoneRing;
  const fighterMeshes = new Map(), obstacleMeshes = new Map(), pickupMeshes = new Map(), bulletMeshes = new Map();
  const world = { width: 2200, height: 1600 };
  const mat = (color, roughness=0.88, metalness=0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
  const materials = {
    grass: mat("#536e43"), grassLight: mat("#6c8650"), water: mat("#183e50",.38,.12),
    trunk: mat("#60442d"), leaf1: mat("#254b32"), leaf2: mat("#376843"),
    roof: mat("#6b5140"), wall: mat("#c1ae85"), crate: mat("#8b7955"),
    player: mat("#c4e85b"), gloo: new THREE.MeshStandardMaterial({color:"#83d8ed",roughness:.28,metalness:.08,transparent:true,opacity:.82}), enemy: [mat("#c47a50"),mat("#a95f53"),mat("#718e83"),mat("#b39b68")],
    skin: mat("#c99470"), dark: mat("#26332e"), rifle: mat("#202824"), white: mat("#e5e9d9"),
    yellow: mat("#e7c15d"), med: mat("#d5f36b"), plane: mat("#d6ddd1"), canopy: mat("#d5f36b")
  };
  function init() {
    if (renderer) return true;
    try {
      renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:"high-performance"});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(innerWidth, innerHeight, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      scene = new THREE.Scene();
      scene.background = new THREE.Color("#8db3c1");
      scene.fog = new THREE.Fog("#8db3c1", 850, 2600);
      camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, .1, 5000);
      scene.add(new THREE.HemisphereLight("#e7f3ef", "#40543b", 2.0));
      const sun = new THREE.DirectionalLight("#fff0d3", 2.5);
      sun.position.set(-420, 700, 260); sun.castShadow = true;
      sun.shadow.mapSize.set(1024,1024);
      sun.shadow.camera.left=-1100; sun.shadow.camera.right=1100; sun.shadow.camera.top=900; sun.shadow.camera.bottom=-900;
      scene.add(sun);
      buildIsland();
      buildPlane();
      window.addEventListener("resize", resize);
      return true;
    } catch (e) { console.error("3D renderer initialization failed:",e); canvas.style.display="none"; const fallback=document.getElementById("gameCanvas"); if(fallback) fallback.style.opacity="1"; return false; }
  }
  function resize() {
    if (!renderer) return;
    renderer.setSize(innerWidth,innerHeight,false);
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  }
  function addMesh(parent, geometry, material, x,y,z, cast=true) {
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z); mesh.castShadow=cast; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  function buildIsland() {
    const sea=addMesh(scene,new THREE.PlaneGeometry(3600,2900),materials.water,1100,-13,800,false);
    sea.rotation.x=-Math.PI/2;
    const ground=addMesh(scene,new THREE.PlaneGeometry(world.width,world.height),materials.grass,1100,-2,800,false);
    ground.rotation.x=-Math.PI/2;
    const shore=addMesh(scene,new THREE.BoxGeometry(world.width+12,9,world.height+12),mat("#9c9870"),1100,-7,800,false);
    const gridMat=new THREE.MeshStandardMaterial({color:"#91a77a",transparent:true,opacity:.13});
    const grid=new THREE.GridHelper(2200,44,"#b7c49a","#b7c49a"); grid.position.set(1100,-1.6,800); grid.material=gridMat; scene.add(grid);
    // Dirt roads and a few small settlement buildings give the island readable scale.
    const roadMat=mat("#9b8c6b");
    [[1100,800,1250,42],[650,500,42,670],[1570,1120,42,620]].forEach(([x,z,w,d])=>{
      const road=addMesh(scene,new THREE.BoxGeometry(w,.15,d),roadMat,x,-1.5,z,false);
    });
    const houses=[[390,350],[760,270],[1450,360],[1830,650],[430,1110],[980,1290],[1630,1240],[1900,1030]];
    houses.forEach(([x,z],i)=>buildHouse(x,z,i));
    // Distant tree cover makes the map read as an island rather than a flat test plane.
    for(let i=0;i<145;i++){
      const x=80+Math.random()*2040,z=80+Math.random()*1440;
      if(houses.some(([hx,hz])=>Math.hypot(hx-x,hz-z)<105)) continue;
      buildTree(x,z,.72+Math.random()*.65);
    }
    const shoreLine=new THREE.Mesh(new THREE.TorusGeometry(1,1,4,120),mat("#c4b98a"));
    shoreLine.scale.set(1095,1,795); shoreLine.position.set(1100,-1.2,800); shoreLine.rotation.x=Math.PI/2; scene.add(shoreLine);
  }
  function buildHouse(x,z,i) {
    const g=new THREE.Group(); scene.add(g); g.position.set(x,0,z);
    const w=42+(i%3)*8,d=36+(i%2)*10;
    addMesh(g,new THREE.BoxGeometry(w,22,d),materials.wall,0,10,0);
    const roof=addMesh(g,new THREE.ConeGeometry(Math.max(w,d)*.78,17,4),materials.roof,0,29,0);
    roof.rotation.y=Math.PI/4;
    addMesh(g,new THREE.BoxGeometry(10,14,1.5),mat("#4a392c"),0,7,d/2+.8,false);
  }
  function buildTree(x,z,scale=1) {
    const g=new THREE.Group(); scene.add(g); g.position.set(x,0,z); g.scale.setScalar(scale);
    addMesh(g,new THREE.CylinderGeometry(3.5,5,27,7),materials.trunk,0,13,0);
    addMesh(g,new THREE.ConeGeometry(19,42,7),materials.leaf1,0,43,0);
    addMesh(g,new THREE.ConeGeometry(14,32,7),materials.leaf2,0,58,0);
    return g;
  }
  function buildPlane() {
    planeGroup=new THREE.Group(); scene.add(planeGroup);
    const fuselage=addMesh(planeGroup,new THREE.CylinderGeometry(7,9,104,16),materials.plane,0,0,0);
    fuselage.rotation.z=Math.PI/2;
    fuselage.scale.set(1,1,1);
    const nose=addMesh(planeGroup,new THREE.ConeGeometry(7,22,16),materials.plane,62,0,0);
    nose.rotation.z=-Math.PI/2;
    const tailCone=addMesh(planeGroup,new THREE.ConeGeometry(6,19,12),materials.plane,-61,0,0);
    tailCone.rotation.z=Math.PI/2;
    addMesh(planeGroup,new THREE.BoxGeometry(31,2.2,166),materials.plane,-2,0,0);
    addMesh(planeGroup,new THREE.BoxGeometry(28,2,58),materials.plane,-48,1,0);
    addMesh(planeGroup,new THREE.BoxGeometry(17,2,42),materials.plane,-45,11,0);
    addMesh(planeGroup,new THREE.BoxGeometry(18,2,16),mat("#536a70"),-14,7,0);
    addMesh(planeGroup,new THREE.BoxGeometry(3,14,17),mat("#263d47"),-20,-1,-8);
    addMesh(planeGroup,new THREE.BoxGeometry(3,14,17),mat("#263d47"),-20,-1,8);
    // Four engine nacelles and animated propellers make the aircraft read clearly in flight.
    const props=[];
    for(const z of [-53,53]){
      const engine=addMesh(planeGroup,new THREE.CylinderGeometry(6,6,28,14),mat("#89999a",.55,.2),8,-4,z);
      engine.rotation.z=Math.PI/2;
      const prop=new THREE.Group(); prop.position.set(23,-4,z); planeGroup.add(prop);
      const bladeA=addMesh(prop,new THREE.BoxGeometry(2,29,4),mat("#26343a"),0,0,0,false);
      const bladeB=addMesh(prop,new THREE.BoxGeometry(2,29,4),mat("#26343a"),0,0,0,false);
      bladeB.rotation.x=Math.PI/2;
      props.push(prop);
    }
    // Cockpit glazing and a clearly visible side cargo door.
    const glass=addMesh(planeGroup,new THREE.SphereGeometry(7,16,10),mat("#355b69",.25,.25),42,3,0,false);
    glass.scale.set(1.35,.72,1.15);
    addMesh(planeGroup,new THREE.BoxGeometry(2,19,20),mat("#263b43"),-19,-2,-10,false);
    addMesh(planeGroup,new THREE.BoxGeometry(2,13,17),mat("#d5f36b"),-19,-2,-10,false).material=mat("#d5f36b");
    planeGroup.userData.propellers=props;
  }
  function makeHuman(f) {
    const root=new THREE.Group();
    const uniform=f.isPlayer?materials.player:materials.enemy[(Math.abs(f.color.length*7+Math.round(f.hp)))%4];
    const torso=addMesh(root,new THREE.CapsuleGeometry(7,17,4,8),uniform,0,27,0);
    torso.scale.set(.72,1,.48);
    addMesh(root,new THREE.SphereGeometry(6.2,12,10),materials.skin,0,44,0);
    addMesh(root,new THREE.CylinderGeometry(2.5,3,9,8),materials.dark,0,38,0);
    const leftArm=new THREE.Group(); leftArm.position.set(-7,34,0); root.add(leftArm);
    addMesh(leftArm,new THREE.CapsuleGeometry(2.5,13,3,6),uniform,0,-8,0);
    const rightArm=new THREE.Group(); rightArm.position.set(7,34,0); root.add(rightArm);
    addMesh(rightArm,new THREE.CapsuleGeometry(2.5,13,3,6),uniform,0,-8,0);
    addMesh(root,new THREE.BoxGeometry(3.2,3.2,22),materials.rifle,5,30,10);
    const leftLeg=new THREE.Group(); leftLeg.position.set(-3.5,19,0); root.add(leftLeg);
    addMesh(leftLeg,new THREE.CapsuleGeometry(2.7,12,3,6),materials.dark,0,-7,0);
    const rightLeg=new THREE.Group(); rightLeg.position.set(3.5,19,0); root.add(rightLeg);
    addMesh(rightLeg,new THREE.CapsuleGeometry(2.7,12,3,6),materials.dark,0,-7,0);
    root.userData={leftLeg,rightLeg,leftArm,rightArm,uniform};
    return root;
  }
  function ensureObstacle(o,index) {
    const key=o;
    if(obstacleMeshes.has(key)) return obstacleMeshes.get(key);
    let mesh;
    if(o.type==="tree") mesh=buildTree(o.x,o.y,Math.max(.8,o.w/44));
    else if(o.type==="gloo") {
      const g=new THREE.Group(); scene.add(g); g.position.set(o.x,0,o.y); g.rotation.y=-(o.angle||0);
      addMesh(g,new THREE.BoxGeometry(o.w,35,o.h),materials.gloo,0,18,0);
      addMesh(g,new THREE.BoxGeometry(o.w-8,3,o.h+1),mat("#c9f7ff",.3),0,35,0,false);
      for(let x=-o.w/2+10;x<o.w/2;x+=20) addMesh(g,new THREE.BoxGeometry(2,30,2),mat("#d9f8ff",.3),x,18,0,false);
      mesh=g;
    } else {
      const g=new THREE.Group(); scene.add(g); g.position.set(o.x,0,o.y);
      addMesh(g,new THREE.BoxGeometry(o.w,18,o.h),materials.crate,0,9,0);
      addMesh(g,new THREE.BoxGeometry(o.w-8,2,o.h-8),mat("#b49d70"),0,18,0);
      mesh=g;
    }
    obstacleMeshes.set(key,mesh); return mesh;
  }
  function ensureFighter(f) {
    if(!fighterMeshes.has(f)) { const m=makeHuman(f); scene.add(m); fighterMeshes.set(f,m); }
    return fighterMeshes.get(f);
  }
  function ensurePickup(item) {
    if(!pickupMeshes.has(item)) {
      const g=new THREE.Group(); scene.add(g);
      const m=item.type==="ammo"?materials.yellow:materials.med;
      addMesh(g,new THREE.BoxGeometry(13,13,13),m,0,8,0);
      addMesh(g,new THREE.BoxGeometry(3,17,3),materials.dark,0,8,0);
      pickupMeshes.set(item,g);
    }
    return pickupMeshes.get(item);
  }
  function render(s) {
    if(!init()) return false;
    const {player,bots,obstacles,pickups,bullets,safeZone,state,dropActors,plane,elapsed,view}=s;
    const visibleFighters=[player,...bots];
    visibleFighters.forEach(f=>{
      const m=ensureFighter(f);
      const drop=state==="dropping"?dropActors.find(a=>a.fighter===f):null;
      const airborne=drop&&drop.jumped&&drop.progress<1;
      const waiting=drop&&!drop.jumped;
      m.visible=f.alive&&f.hp>0&&!airborne&&!waiting;
      if(m.visible){
        m.position.set(f.x,0,f.y);
        m.rotation.y=Math.PI/2-f.angle;
        const swing=Math.sin(elapsed*9+(f.isPlayer?0:3))*0.45;
        m.userData.leftLeg.rotation.x=swing; m.userData.rightLeg.rotation.x=-swing;
        m.userData.leftArm.rotation.x=-.5; m.userData.rightArm.rotation.x=-.5;
        if(f.damageFlash>0) m.userData.uniform.emissive.set("#5a2115");
        else m.userData.uniform.emissive.set("#000000");
      }
    });
    obstacles.forEach(ensureObstacle);
    obstacles.forEach(o=>{const m=obstacleMeshes.get(o); if(m)m.visible=true;});
    pickups.forEach(item=>{
      const m=ensurePickup(item); m.visible=item.active;
      if(item.active){m.position.set(item.x,0,item.y);m.rotation.y=elapsed*1.3;}
    });
    // Keep only live projectile meshes; update them from the combat simulation.
    const live=new Set(bullets);
    for(const [b,m] of bulletMeshes) if(!live.has(b)){scene.remove(m);bulletMeshes.delete(b);}
    bullets.forEach(b=>{
      if(!bulletMeshes.has(b)){const m=addMesh(scene,new THREE.SphereGeometry(2.5,8,6),b.owner.isPlayer?materials.yellow:mat("#ff9c73"),b.x,8,b.y);bulletMeshes.set(b,m);}
      const m=bulletMeshes.get(b);m.position.set(b.x,8,b.y);
    });
    if(zoneRing) scene.remove(zoneRing);
    zoneRing=new THREE.Mesh(new THREE.TorusGeometry(safeZone.radius,3,8,120),new THREE.MeshBasicMaterial({color:"#d8f36b",transparent:true,opacity:.8}));
    zoneRing.rotation.x=Math.PI/2;zoneRing.position.set(safeZone.x,.5,safeZone.y);scene.add(zoneRing);
    // Transport aircraft and visible parachutists are actual 3D meshes.
    planeGroup.visible=state==="dropping"&&!!plane;
    if(planeGroup.visible) {
      planeGroup.position.set(plane.x,115,plane.y);
      planeGroup.rotation.y=0;
      (planeGroup.userData.propellers||[]).forEach((prop,i)=>{prop.rotation.x=elapsed*34*(i===0?1:-1);});
    }
    if(state==="dropping"){
      dropActors.forEach(a=>{
        if(!a.jumped||a.progress>=1) return;
        const t=a.progress, x=a.startX+(a.landingX-a.startX)*t, z=a.startY+(a.landingY-a.startY)*t;
        let pack=a._3d;
        if(!pack){
          pack=new THREE.Group();scene.add(pack);
          const human=makeHuman(a.fighter);pack.add(human);
          const canopy=new THREE.Mesh(new THREE.SphereGeometry(19,16,10,0,Math.PI*2,0,Math.PI/2),a.fighter.isPlayer?materials.canopy:materials.enemy[1]);
          canopy.position.y=42;pack.add(canopy);
          const stringMat=new THREE.LineBasicMaterial({color:"#f2f0df"});
          for(const dx of [-15,15]){
            const points=[new THREE.Vector3(0,42,0),new THREE.Vector3(dx,-1,0)];
            pack.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),stringMat));
          }
          a._3d=pack;
        }
        pack.visible=true;pack.position.set(x,132*(1-t)+8,z);
        pack.children[0].rotation.y=Math.PI/2-a.fighter.angle;
      });
      dropActors.forEach(a=>{if(a._3d&&(!a.jumped||a.progress>=1))a._3d.visible=false;});
    } else dropActors.forEach(a=>{if(a._3d)a._3d.visible=false;});
    if(state==="dropping"){
      camera.position.set(world.width/2,560,world.height/2+260);
      camera.lookAt(world.width/2,0,world.height/2);
    } else {
      // Third-person shoulder camera: keep the complete avatar in frame with room to see the arena.
      const behind=112, height=66;
      const fx=Math.cos(player.angle), fz=Math.sin(player.angle);
      const desired=new THREE.Vector3(player.x-fx*behind, height, player.y-fz*behind);
      camera.position.copy(desired);
      camera.lookAt(player.x+fx*24,22,player.y+fz*24);
    }
    renderer.render(scene,camera);
    return true;
  }
  function screenToWorld(clientX,clientY) {
    if(!renderer||!camera) return null;
    const rect=canvas.getBoundingClientRect();
    const pointer=new THREE.Vector2(((clientX-rect.left)/rect.width)*2-1,-((clientY-rect.top)/rect.height)*2+1);
    const raycaster=new THREE.Raycaster();
    raycaster.setFromCamera(pointer,camera);
    const ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    const hit=new THREE.Vector3();
    if(!raycaster.ray.intersectPlane(ground,hit)) return null;
    return {x:hit.x,y:hit.z};
  }
  window.FreeFire3D={render,screenToWorld};
})();