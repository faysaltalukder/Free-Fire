(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const ui = {
    status: $("statusText"), health: $("healthValue"), healthFill: $("healthFill"),
    kills: $("killsValue"), alive: $("aliveValue"), zone: $("zoneValue"),
    ammo: $("ammoValue"), reserve: $("reserveValue"), medkits: $("medkitCount"),
    start: $("startOverlay"), end: $("endOverlay"), startBtn: $("startBtn"),
    restartBtn: $("restartBtn"), reloadBtn: $("reloadBtn"), medkitBtn: $("medkitBtn"),
    fireBtn: $("fireBtn"), joystick: $("joystick"), knob: $("stickKnob"),
    toast: $("toast"), resultTitle: $("resultTitle"), resultCopy: $("resultCopy"),
    resultEyebrow: $("resultEyebrow"), finalKills: $("finalKills"), finalTime: $("finalTime")
  };

  const WORLD = { width: 2200, height: 1600 };
  const CONFIG = { botCount: 14, playerSpeed: 245, botSpeed: 105, fireRate: 0.16, reloadTime: 1.35 };
  let view = { width: innerWidth, height: innerHeight, dpr: 1 };
  let state = "menu", lastTime = 0, elapsed = 0, toastTimer = 0;
  let camera = { x: 0, y: 0 };
  let player, bots, bullets, pickups, obstacles, particles, safeZone, keys, mouse, joystick;
  let dropActors = [], dropElapsed = 0, plane = null;
  let lastHud = 0;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const random = (min, max) => min + Math.random() * (max - min);
  const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const formatTime = (seconds) => {
    const s = Math.floor(seconds);
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  };

  function resize() {
    view.width = innerWidth;
    view.height = innerHeight;
    view.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(view.width * view.dpr);
    canvas.height = Math.floor(view.height * view.dpr);
    canvas.style.width = view.width + "px";
    canvas.style.height = view.height + "px";
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }
  addEventListener("resize", resize);
  resize();

  function makeObstacles() {
    const items = [];
    for (let i = 0; i < 47; i++) {
      const type = Math.random() > .48 ? "tree" : "crate";
      const w = type === "tree" ? random(34, 56) : random(48, 78);
      const h = type === "tree" ? random(34, 56) : random(42, 65);
      const item = { x: random(90, WORLD.width - 90), y: random(90, WORLD.height - 90), w, h, type };
      if (Math.hypot(item.x - WORLD.width / 2, item.y - WORLD.height / 2) > 170) items.push(item);
    }
    return items;
  }

  function newFighter(x, y, isPlayer = false, index = 0) {
    return {
      x, y, radius: isPlayer ? 16 : 14, hp: isPlayer ? 100 : 70, maxHp: isPlayer ? 100 : 70,
      angle: 0, speed: isPlayer ? CONFIG.playerSpeed : CONFIG.botSpeed,
      alive: true, isPlayer, fireCooldown: random(.2, 1.2), strafe: Math.random() > .5 ? 1 : -1,
      wander: random(0, Math.PI * 2), color: isPlayer ? "#d9f36d" : ["#e6a15a", "#d77c68", "#9bb3a0", "#c2b58b"][index % 4],
      damageFlash: 0
    };
  }

  function startGame() {
    elapsed = 0;
    player = newFighter(WORLD.width * .28, WORLD.height * .52, true);
    player.ammo = 28; player.reserve = 84; player.medkits = 1; player.kills = 0;
    player.reloading = 0; player.shotCooldown = 0;
    bots = [];
    for (let i = 0; i < CONFIG.botCount; i++) {
      const x = clamp(WORLD.width * (.20 + i * .043) + random(-75, 75), 80, WORLD.width - 80);
      const y = clamp(WORLD.height * .5 + random(-520, 520), 80, WORLD.height - 80);
      bots.push(newFighter(x, y, false, i));
    }
    bullets = [];
    particles = [];
    obstacles = makeObstacles();
    pickups = [];
    for (let i = 0; i < 23; i++) {
      pickups.push({
        x: random(90, WORLD.width - 90), y: random(90, WORLD.height - 90),
        type: Math.random() > .36 ? "ammo" : "med", radius: 10, active: true
      });
    }
    safeZone = { x: WORLD.width / 2 + random(-90, 90), y: WORLD.height / 2 + random(-70, 70), startRadius: 900, radius: 900, minRadius: 175, shrinkDelay: 12, shrinkDuration: 190 };
    keys = {};
    mouse = { x: view.width / 2 + 100, y: view.height / 2, down: false, active: false };
    joystick = { active: false, x: 0, y: 0, pointerId: null };
    dropActors = [{ fighter: player, startX: clamp(-180 + 330 * 1.55, 70, WORLD.width - 70), startY: 350, landingX: player.x, landingY: player.y, delay: 1.55, progress: 0 }];
    bots.forEach((bot, i) => {
      const delay = 1.85 + i * .28;
      dropActors.push({
        fighter: bot, startX: clamp(-180 + 330 * delay, 70, WORLD.width - 70),
        startY: 350, landingX: bot.x, landingY: bot.y, delay, progress: 0
      });
    });
    dropElapsed = 0;
    plane = { x: -180, y: 350, speed: 330, heading: 1 };
    camera.x = clamp(WORLD.width / 2 - view.width / 2, 0, WORLD.width - view.width);
    camera.y = clamp(WORLD.height / 2 - view.height / 2, 0, WORLD.height - view.height);
    state = "dropping";
    ui.start.classList.add("hidden");
    ui.end.classList.add("hidden");
    ui.status.textContent = "AIRBORNE · PREPARE TO JUMP";
    toast("TRANSPORT PLANE APPROACHING");
    updateHud(true);
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function toast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    toastTimer = 1.8;
  }

  function updateDrop(dt) {
    dropElapsed += dt;
    plane.x += plane.speed * dt;
    let landed = 0;
    for (const actor of dropActors) {
      if (dropElapsed < actor.delay) continue;
      actor.progress = clamp((dropElapsed - actor.delay) / 4.1, 0, 1);
      if (actor.progress >= 1) landed++;
    }
    if (dropElapsed > 7.4 && landed === dropActors.length) {
      state = "running";
      camera.x = clamp(player.x - view.width / 2, 0, WORLD.width - view.width);
      camera.y = clamp(player.y - view.height / 2, 0, WORLD.height - view.height);
      ui.status.textContent = "OPERATIVE IN ZONE";
      toast("TOUCHDOWN · SURVIVE THE ARENA");
      lastTime = performance.now();
      return;
    }
    updateDropCamera();
  }

  function updateDropCamera() {
    camera.x = clamp(WORLD.width / 2 - view.width / 2, 0, WORLD.width - view.width);
    camera.y = clamp(WORLD.height / 2 - view.height / 2, 0, WORLD.height - view.height);
  }

  function drawPlane() {
    if (!plane) return;
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(0);
    ctx.fillStyle = "rgba(5,12,8,.25)";
    ctx.beginPath(); ctx.ellipse(0, 8, 58, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d9dfd1";
    ctx.beginPath();
    ctx.moveTo(62, 0); ctx.lineTo(20, -8); ctx.lineTo(5, -35); ctx.lineTo(-5, -35);
    ctx.lineTo(-1, -8); ctx.lineTo(-42, -13); ctx.lineTo(-54, -23); ctx.lineTo(-61, -22);
    ctx.lineTo(-52, 0); ctx.lineTo(-61, 22); ctx.lineTo(-54, 23); ctx.lineTo(-42, 13);
    ctx.lineTo(-1, 8); ctx.lineTo(-5, 35); ctx.lineTo(5, 35); ctx.lineTo(20, 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#d5f36b"; ctx.fillRect(-12, -4, 28, 8);
    ctx.restore();
  }

  function drawParachute(actor) {
    if (actor.progress >= 1) return;
    const p = actor.progress;
    const x = actor.startX + (actor.landingX - actor.startX) * p;
    const y = actor.startY + (actor.landingY - actor.startY) * p;
    const lift = Math.sin(p * Math.PI) * 22;
    const canopy = 18 * (1 - p * .25);
    ctx.save();
    ctx.globalAlpha = .22 + p * .78;
    ctx.fillStyle = "rgba(5,12,8,.35)";
    ctx.beginPath(); ctx.ellipse(actor.landingX, actor.landingY + 7, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#e9eee2"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y + lift); ctx.lineTo(x - canopy, y + lift + 17); ctx.moveTo(x, y + lift); ctx.lineTo(x + canopy, y + lift + 17); ctx.stroke();
    ctx.fillStyle = actor.fighter.isPlayer ? "#d5f36b" : actor.fighter.color;
    ctx.beginPath(); ctx.arc(x, y + lift, canopy, Math.PI, 0); ctx.quadraticCurveTo(x, y + lift + 10, x - canopy, y + lift); ctx.fill();
    ctx.fillStyle = "#17251a";
    ctx.beginPath(); ctx.arc(x, y + lift + 21, 4, 0, Math.PI * 2); ctx.fill();
    if (actor.fighter.isPlayer) {
      ctx.fillStyle = "#f4f7e9"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center";
      ctx.fillText("YOU", x, y + lift + 38);
    }
    ctx.restore();
  }

  function drawDropOverlay() {
    const seconds = Math.max(0, 8 - dropElapsed);
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = "rgba(7,15,11,.72)";
    ctx.fillRect(0, 76, view.width, 42);
    ctx.fillStyle = "#d5f36b";
    ctx.font = "900 11px system-ui"; ctx.textAlign = "center";
    ctx.fillText("TRANSPORT FLIGHT  ·  " + (dropElapsed < 1.5 ? "APPROACHING DROP ZONE" : "PARACHUTES DEPLOYED"), view.width / 2, 94);
    ctx.fillStyle = "#eef2e8"; ctx.font = "800 18px system-ui";
    ctx.fillText(dropElapsed < 1.5 ? "GET READY TO JUMP" : "LANDING IN " + Math.ceil(seconds) + "s", view.width / 2, 108);
    ctx.restore();
  }



  function worldPointer(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left + camera.x, y: event.clientY - rect.top + camera.y };
  }

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") {
      const p = worldPointer(event);
      mouse.x = p.x; mouse.y = p.y; mouse.active = true;
    } else if (fireTouch.active && fireTouch.pointerId === event.pointerId) {
      const p = worldPointer(event);
      player && (player.angle = angleTo(player, p));
    }
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (state !== "running") return;
    if (event.pointerType === "mouse") {
      mouse.down = true;
      canvas.setPointerCapture?.(event.pointerId);
    } else if (event.clientX > view.width * .42) {
      // Touch and drag on the right side of the arena to aim and fire.
      fireTouch.active = true;
      fireTouch.pointerId = event.pointerId;
      canvas.setPointerCapture?.(event.pointerId);
      const p = worldPointer(event);
      player && (player.angle = angleTo(player, p));
    }
  });
  addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse") mouse.down = false;
    if (fireTouch.pointerId === event.pointerId) {
      fireTouch.active = false;
      fireTouch.pointerId = null;
    }
  });

  const fireTouch = { active: false, pointerId: null };
  ui.fireBtn.addEventListener("pointerdown", (event) => {
    if (state !== "running") return;
    event.preventDefault();
    fireTouch.active = true; fireTouch.pointerId = event.pointerId;
    ui.fireBtn.setPointerCapture?.(event.pointerId);
    if (player) player.angle = angleTo(player, { x: player.x + 1, y: player.y });
  });
  ui.fireBtn.addEventListener("pointerup", () => { fireTouch.active = false; });
  ui.fireBtn.addEventListener("pointercancel", () => { fireTouch.active = false; });

  ui.joystick.addEventListener("pointerdown", (event) => {
    if (state !== "running") return;
    event.preventDefault();
    joystick.active = true; joystick.pointerId = event.pointerId;
    ui.joystick.setPointerCapture?.(event.pointerId);
    moveStick(event);
  });
  ui.joystick.addEventListener("pointermove", (event) => {
    if (joystick.active && event.pointerId === joystick.pointerId) moveStick(event);
  });
  function releaseStick(event) {
    if (event.pointerId !== joystick.pointerId) return;
    joystick.active = false; joystick.x = 0; joystick.y = 0; joystick.pointerId = null;
    ui.knob.style.transform = "translate(0,0)";
  }
  ui.joystick.addEventListener("pointerup", releaseStick);
  ui.joystick.addEventListener("pointercancel", releaseStick);
  function moveStick(event) {
    const rect = ui.joystick.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const max = rect.width * .32;
    const len = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, max / len);
    const x = dx * scale, y = dy * scale;
    joystick.x = x / max; joystick.y = y / max;
    ui.knob.style.transform = "translate(" + x + "px," + y + "px)";
  }

  addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    keys[key] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    if (key === "r" && state === "running") reload();
    if (key === "f" && state === "running") useMedkit();
  });
  addEventListener("keyup", (event) => { keys[event.key.toLowerCase()] = false; });

  ui.startBtn.addEventListener("click", startGame);
  ui.restartBtn.addEventListener("click", startGame);
  ui.reloadBtn.addEventListener("click", reload);
  ui.medkitBtn.addEventListener("click", useMedkit);

  function reload() {
    if (!player || player.reloading > 0 || player.ammo >= 28 || player.reserve <= 0) return;
    player.reloading = CONFIG.reloadTime;
    toast("RELOADING...");
  }
  function useMedkit() {
    if (state !== "running" || player.medkits <= 0 || player.hp >= 92) return;
    player.medkits--;
    player.hp = Math.min(100, player.hp + 42);
    burst(player.x, player.y, "#d5f36b", 12);
    toast("MEDKIT USED · +42 HP");
    updateHud(true);
  }

  function blocked(x, y, radius) {
    for (const o of obstacles) {
      const cx = clamp(x, o.x - o.w / 2, o.x + o.w / 2);
      const cy = clamp(y, o.y - o.h / 2, o.y + o.h / 2);
      if (Math.hypot(x - cx, y - cy) < radius) return true;
    }
    return false;
  }

  function moveFighter(f, dx, dy) {
    const nx = clamp(f.x + dx, 22, WORLD.width - 22);
    if (!blocked(nx, f.y, f.radius)) f.x = nx;
    const ny = clamp(f.y + dy, 22, WORLD.height - 22);
    if (!blocked(f.x, ny, f.radius)) f.y = ny;
  }

  function spawnBullet(owner, angle, speed, damage) {
    const muzzle = owner.radius + 8;
    bullets.push({
      x: owner.x + Math.cos(angle) * muzzle, y: owner.y + Math.sin(angle) * muzzle,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      owner, damage, life: 1.45, radius: owner.isPlayer ? 3 : 2.5
    });
    burst(owner.x + Math.cos(angle) * (muzzle + 3), owner.y + Math.sin(angle) * (muzzle + 3), owner.isPlayer ? "#eff8b1" : "#ffbe7a", 3);
  }

  function burst(x, y, color, count = 7) {
    for (let i = 0; i < count; i++) {
      const a = random(0, Math.PI * 2), s = random(25, 105);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random(.18, .48), max: .48, color, size: random(1.5, 3.5) });
    }
  }

  function update(dt) {
    elapsed += dt;
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) ui.toast.classList.remove("show");
    if (player.reloading > 0) {
      player.reloading -= dt;
      if (player.reloading <= 0) {
        const need = 28 - player.ammo;
        const load = Math.min(need, player.reserve);
        player.ammo += load; player.reserve -= load;
        toast("MAGAZINE READY");
      }
    }
    player.shotCooldown = Math.max(0, player.shotCooldown - dt);
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.damageFlash = Math.max(0, player.damageFlash - dt);

    let mx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    let my = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    mx += joystick.x; my += joystick.y;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (ml > .05) moveFighter(player, mx * player.speed * dt, my * player.speed * dt);
    if (isTouchDevice() && !fireTouch.active && ml > .15) player.angle = Math.atan2(my, mx);

    if (mouse.active && !isTouchDevice()) player.angle = angleTo(player, { x: mouse.x, y: mouse.y });
    if (mouse.down || fireTouch.active) playerShoot();

    if (elapsed > safeZone.shrinkDelay) {
      const progress = clamp((elapsed - safeZone.shrinkDelay) / safeZone.shrinkDuration, 0, 1);
      safeZone.radius = safeZone.startRadius - (safeZone.startRadius - safeZone.minRadius) * progress;
    }

    for (const bot of bots) {
      if (!bot.alive) continue;
      bot.fireCooldown -= dt; bot.damageFlash = Math.max(0, bot.damageFlash - dt);
      const d = distance(bot, player);
      let dx = 0, dy = 0;
      if (d < 560) {
        const desired = d > 245 ? 1 : d < 175 ? -1 : 0;
        const moveAngle = angleTo(bot, player) + (desired === 0 ? Math.PI / 2 * bot.strafe : 0);
        dx = Math.cos(moveAngle) * desired;
        dy = Math.sin(moveAngle) * desired;
        bot.angle = angleTo(bot, player);
        if (d < 470 && bot.fireCooldown <= 0) {
          spawnBullet(bot, bot.angle + random(-.11, .11), 410, 7);
          bot.fireCooldown = random(.85, 1.5);
        }
      } else {
        bot.wander += random(-.8, .8) * dt;
        dx = Math.cos(bot.wander) * .45; dy = Math.sin(bot.wander) * .45;
      }
      if (Math.hypot(dx, dy) > .01) moveFighter(bot, dx * bot.speed * dt, dy * bot.speed * dt);
      if (distance(bot, safeZone) > safeZone.radius - 8) bot.hp -= 8 * dt;
      if (bot.hp <= 0) eliminate(bot, false);
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let remove = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;
      if (!remove && blocked(b.x, b.y, 3)) remove = true;
      if (!remove) {
        if (b.owner.isPlayer) {
          for (const bot of bots) {
            if (bot.alive && distance(b, bot) < bot.radius + b.radius) {
              bot.hp -= b.damage; bot.damageFlash = .12; burst(b.x, b.y, "#f0bc79", 4); remove = true;
              if (bot.hp <= 0) eliminate(bot, true);
              break;
            }
          }
        } else if (distance(b, player) < player.radius + b.radius) {
          player.hp -= b.damage; player.damageFlash = .16; burst(b.x, b.y, "#ff8b6f", 4); remove = true;
          if (player.hp <= 0) endGame(false);
        }
      }
      if (remove) bullets.splice(i, 1);
    }

    if (distance(player, safeZone) > safeZone.radius - player.radius) {
      player.hp -= 10 * dt;
      if (Math.floor(elapsed * 2) !== Math.floor((elapsed - dt) * 2)) toast("WARNING · OUTSIDE SAFE ZONE");
      if (player.hp <= 0) endGame(false);
    }

    for (const item of pickups) {
      if (!item.active || distance(player, item) > player.radius + item.radius + 3) continue;
      item.active = false;
      if (item.type === "ammo") { player.reserve = Math.min(180, player.reserve + 28); toast("AMMO COLLECTED · +28"); }
      else { player.medkits = Math.min(3, player.medkits + 1); toast("MEDKIT COLLECTED"); }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    const targetX = clamp(player.x - view.width / 2, 0, WORLD.width - view.width);
    const targetY = clamp(player.y - view.height / 2, 0, WORLD.height - view.height);
    camera.x += (targetX - camera.x) * Math.min(1, dt * 7);
    camera.y += (targetY - camera.y) * Math.min(1, dt * 7);

    if (bots.every((b) => !b.alive)) endGame(true);
    updateHud();
  }

  function isTouchDevice() { return matchMedia("(pointer: coarse)").matches; }

  function playerShoot() {
    if (player.reloading > 0 || player.shotCooldown > 0) return;
    if (player.ammo <= 0) {
      if (player.reserve > 0) reload();
      else toast("OUT OF AMMO");
      return;
    }
    player.ammo--;
    spawnBullet(player, player.angle + random(-.025, .025), 760, 28);
    player.shotCooldown = CONFIG.fireRate;
  }

  function eliminate(bot, byPlayer) {
    if (!bot.alive) return;
    bot.alive = false;
    burst(bot.x, bot.y, bot.color, 16);
    if (byPlayer) player.kills++;
    if (Math.random() < .7) pickups.push({ x: bot.x + random(-15, 15), y: bot.y + random(-15, 15), type: Math.random() > .5 ? "ammo" : "med", radius: 10, active: true });
  }

  function endGame(won) {
    if (state !== "running") return;
    state = "ended";
    ui.status.textContent = won ? "ARENA CLEARED" : "SIGNAL LOST";
    ui.resultEyebrow.textContent = won ? "MISSION SUCCESS" : "MATCH COMPLETE";
    ui.resultTitle.textContent = won ? "BOOYAH!" : "ELIMINATED";
    ui.resultCopy.textContent = won ? "You outlasted every fighter. The arena is yours." : "The arena has claimed another fighter. Drop back in and try again.";
    ui.finalKills.textContent = String(player.kills);
    ui.finalTime.textContent = formatTime(elapsed);
    ui.end.classList.remove("hidden");
    updateHud(true);
  }

  function updateHud(force = false) {
    if (!force && performance.now() - lastHud < 90) return;
    lastHud = performance.now();
    if (!player) return;
    ui.health.textContent = Math.max(0, Math.ceil(player.hp));
    ui.healthFill.style.width = clamp(player.hp, 0, 100) + "%";
    ui.healthFill.style.background = player.hp < 30 ? "#ee765f" : "";
    ui.kills.textContent = String(player.kills).padStart(2, "0");
    ui.alive.textContent = String(bots.filter((b) => b.alive).length + (player.alive ? 1 : 0));
    ui.ammo.textContent = String(player.ammo).padStart(2, "0");
    ui.reserve.textContent = player.reserve;
    ui.medkits.textContent = player.medkits;
    ui.zone.textContent = elapsed < safeZone.shrinkDelay ? "STABLE" : Math.ceil(safeZone.radius) + "M";
  }

  function draw() {
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawGround();
    if (state === "dropping") {
      drawObstacles();
      drawPlane();
      for (const actor of dropActors) drawParachute(actor);
    } else {
      drawZone();
      drawPickups();
      drawObstacles();
      drawBullets();
      drawFighters();
      drawParticles();
    }
    ctx.restore();
    if (state === "running") drawMiniCompass();
    if (state === "dropping") drawDropOverlay();
  }

  function drawGround() {
    ctx.fillStyle = "#304b39";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.strokeStyle = "rgba(202,225,183,.055)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.width; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke(); }
    for (let y = 0; y <= WORLD.height; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke(); }
    for (let i = 0; i < 210; i++) {
      const x = (i * 137.7) % WORLD.width, y = (i * 93.1) % WORLD.height;
      ctx.fillStyle = i % 2 ? "rgba(190,205,137,.08)" : "rgba(9,28,18,.10)";
      ctx.beginPath(); ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "rgba(221,237,200,.24)";
    ctx.lineWidth = 5; ctx.strokeRect(2, 2, WORLD.width - 4, WORLD.height - 4);
  }

  function drawZone() {
    ctx.save();
    ctx.fillStyle = "rgba(116,36,31,.23)";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(safeZone.x, safeZone.y, safeZone.radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(safeZone.x, safeZone.y, safeZone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(219,242,123,.88)"; ctx.lineWidth = 5; ctx.setLineDash([13, 10]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(safeZone.x, safeZone.y, safeZone.radius - 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(219,242,123,.22)"; ctx.lineWidth = 12; ctx.stroke();
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.type === "tree") {
        ctx.fillStyle = "rgba(8,20,13,.23)";
        ctx.beginPath(); ctx.ellipse(o.x + 5, o.y + 8, o.w * .55, o.h * .5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#203c2b"; ctx.beginPath(); ctx.arc(o.x, o.y, o.w * .52, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3d6441"; ctx.beginPath(); ctx.arc(o.x - 5, o.y - 6, o.w * .37, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(170,199,126,.2)"; ctx.beginPath(); ctx.arc(o.x - 9, o.y - 10, o.w * .14, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = "rgba(5,14,9,.25)"; ctx.fillRect(o.x - o.w / 2 + 5, o.y - o.h / 2 + 7, o.w, o.h);
        ctx.fillStyle = "#786d4f"; ctx.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
        ctx.strokeStyle = "#b2a27a"; ctx.lineWidth = 2; ctx.strokeRect(o.x - o.w / 2 + 4, o.y - o.h / 2 + 4, o.w - 8, o.h - 8);
        ctx.beginPath(); ctx.moveTo(o.x - o.w / 2 + 6, o.y); ctx.lineTo(o.x + o.w / 2 - 6, o.y); ctx.stroke();
      }
    }
  }

  function drawPickups() {
    for (const item of pickups) {
      if (!item.active) continue;
      const color = item.type === "ammo" ? "#e9c56b" : "#d5f36b";
      ctx.save(); ctx.translate(item.x, item.y);
      ctx.fillStyle = "rgba(8,15,10,.28)"; ctx.beginPath(); ctx.arc(2, 3, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#203022";
      if (item.type === "ammo") { ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-5, -3, 10, 3); }
      else { ctx.fillRect(-5, -1.5, 10, 3); ctx.fillRect(-1.5, -5, 3, 10); }
      ctx.restore();
    }
  }

  function drawFighters() {
    for (const bot of bots) if (bot.alive) drawFighter(bot);
    if (player && player.hp > 0) drawFighter(player);
  }

  function drawFighter(f) {
    ctx.save(); ctx.translate(f.x, f.y);
    ctx.fillStyle = "rgba(5,12,8,.3)";
    ctx.beginPath(); ctx.ellipse(2, 8, f.radius * 1.12, f.radius * .83, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(f.angle);
    ctx.fillStyle = f.damageFlash > 0 ? "#fff1dc" : f.color;
    ctx.beginPath(); ctx.arc(0, 0, f.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#253026"; ctx.beginPath(); ctx.arc(4, -4, f.radius * .48, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1c251d"; ctx.fillRect(5, -3, f.radius + 12, 6);
    ctx.fillStyle = f.isPlayer ? "#eff8bd" : "#e5b88a"; ctx.beginPath(); ctx.arc(7, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (!f.isPlayer && f.hp < f.maxHp) {
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(f.x - 17, f.y - 25, 34, 4);
      ctx.fillStyle = "#ee9b73"; ctx.fillRect(f.x - 17, f.y - 25, 34 * clamp(f.hp / f.maxHp, 0, 1), 4);
    }
    if (f.isPlayer) {
      ctx.beginPath(); ctx.arc(f.x, f.y, f.radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(213,243,107,.45)"; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      ctx.fillStyle = b.owner.isPlayer ? "#f2f5b0" : "#ffac75";
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMiniCompass() {
    const x = view.width - 96, y = 28, w = 68, h = 4;
    const d = distance(player, safeZone);
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(x - 8, y - 10, 82, 26);
    ctx.fillStyle = "#aab7a8"; ctx.font = "8px system-ui"; ctx.fillText("ZONE RANGE", x - 4, y - 2);
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(x, y + 4, w, h);
    ctx.fillStyle = d < safeZone.radius ? "#d5f36b" : "#f18c6d";
    ctx.fillRect(x, y + 4, w * clamp(1 - d / 1250, 0, 1), h);
  }

  function loop(now) {
    if (state !== "running" && state !== "dropping") { draw(); return; }
    const dt = Math.min((now - lastTime) / 1000, .04);
    lastTime = now;
    if (state === "dropping") updateDrop(dt);
    else update(dt);
    draw();
    if (state === "running" || state === "dropping") requestAnimationFrame(loop);
  }

  // Optional offline shell caching for the deployed GitHub Pages app.
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" })
        .catch((error) => console.warn("Offline support could not be enabled:", error));
    }, { once: true });
  }

  // Draw an idle arena behind the start screen.
  obstacles = makeObstacles();
  player = newFighter(WORLD.width / 2, WORLD.height / 2, true);
  bots = []; bullets = []; pickups = []; particles = [];
  safeZone = { x: WORLD.width / 2, y: WORLD.height / 2, radius: 900 };
  keys = {}; mouse = { x: 0, y: 0, down: false, active: false };
  joystick = { active: false, x: 0, y: 0, pointerId: null };
  camera.x = clamp(player.x - view.width / 2, 0, WORLD.width - view.width);
  camera.y = clamp(player.y - view.height / 2, 0, WORLD.height - view.height);
  draw();
})();