(() => {
  "use strict";
  const viewport = document.querySelector("#viewport");
  const world = document.querySelector("#world");
  const svg = document.querySelector("#threads");
  const mini = document.querySelector("#miniWorld");
  const miniWindow = document.querySelector("#miniWindow");
  const dialog = document.querySelector("#caseDialog");
  const toast = document.querySelector("#toast");
  const mobile = matchMedia("(max-width: 700px)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const W = 1400, H = 1500;
  let nodes = [], records = new Map(), links = new Map();
  let scale = 0.82, panX = 0, panY = 220, dragging = false, startX = 0, startY = 0;
  let active = null, toastTimer, audioContext;

  const el = (tag, className, text) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  function link(ids) { return [...(ids || [])]; }
  function buildNodes(data) {
    const worldCards = document.createDocumentFragment();
    const dossier = data.dossier;
    const entries = [
      { id: dossier.id, kind: "dossier", title: dossier.name, data: dossier },
      ...data.caseFiles.map(item => ({ id: item.id, kind: "project", title: item.title, data: item })),
      ...data.incidentReports.map(item => ({ id: item.id, kind: "report", title: item.role, data: item })),
      ...data.evidenceTags.map(item => ({ id: item.id, kind: "skill", title: item.name, data: item })),
      ...data.certifiedDocuments.map(item => ({ id: item.id, kind: "certificate", title: item.title, data: item })),
    ];
    const placements = [
      [7, 8], [36, 5], [69, 15], [13, 34], [43, 28], [76, 42],
      [8, 59], [47, 55], [68, 77], [4, 83], [29, 72], [72, 22],
      [27, 43], [57, 59], [22, 15], [51, 7], [79, 63], [39, 84],
    ];
    entries.forEach((entry, index) => {
      const [x, y] = placements[index] || [10 + (index * 37) % 75, 8 + (index * 29) % 82];
      const tilt = (Math.random() * 6.4 - 3.2).toFixed(1);
      const card = el("article", `evidence node ${tilt < 0 ? "tilt-left" : "tilt-right"} ${entry.kind === "project" ? "polaroid" : entry.kind === "dossier" ? "dossier" : entry.kind === "report" ? "memo report-card" : entry.kind === "skill" ? "skill-card forensic-tag" : "certificate"}`);
      card.dataset.node = entry.id;
      card.dataset.kind = entry.kind;
      card.dataset.links = "";
      card.style.setProperty("--x", `${x}%`);
      card.style.setProperty("--y", `${y}%`);
      card.style.setProperty("--r", `${tilt}deg`);
      card.style.zIndex = String(2 + (index * 7) % 4);
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Open ${entry.kind}: ${entry.title}`);
      card.append(makeTack());
      records.set(entry.id, entry);
      links.set(entry.id, new Set());

      if (entry.kind === "dossier") {
        card.append(el("span", "classified-stamp dossier-stamp", "SUBJECT DOSSIER: SAJJAD CHANDIO"));
        const tab = el("span", "file-tab", dossier.stamp);
        const head = el("div", "dossier-head");
        head.append(el("div", "avatar", "SC"));
        const heading = el("div");
        heading.append(el("span", "micro", "SUBJECT PROFILE"), el("h2", "", dossier.name), el("span", "status", dossier.alias));
        head.append(heading);
        card.append(tab, head, el("p", "type-copy", dossier.summary), el("div", "redacted", `${dossier.location} · CLASSIFIED`), el("span", "hand-note", "the one behind the board →"));
      } else if (entry.kind === "project") {
        const item = entry.data;
        card.append(el("span", "pin pin-red"));
        const photo = el("div", "photo photo-city");
        photo.append(el("span", "", item.label), el("b", "", item.classification), el("i", "", "✳"));
        card.append(photo, el("h2", "", item.title), el("p", "", item.classification), el("span", "hand-note", "evidence on record"));
      } else if (entry.kind === "report") {
        const item = entry.data;
        card.append(el("span", "clip"), el("span", "micro", item.caseNo), el("h2", "", item.role), el("div", "memo-rule"), el("p", "", `${item.company} · ${item.duration}`), el("p", "report-log", item.log), el("span", "byline", "INCIDENT FILE / VERIFIED"));
      } else if (entry.kind === "skill") {
        const item = entry.data;
        card.append(el("span", "tape"), el("span", "micro", item.category), el("h2", "", item.name), el("p", "", item.details), el("div", "skill-meter"));
      } else {
        const item = entry.data;
        card.append(el("span", "tape"), el("span", "micro", "CERTIFIED DOCUMENT"), el("div", "cert-seal", "✓"), el("h2", "", item.title), el("p", "", item.issuer), el("span", "stamp", item.stamp));
      }
      worldCards.append(card);
    });
    world.querySelectorAll(".node").forEach(node => node.remove());
    world.querySelector("#loadingNote")?.remove();
    world.append(worldCards);
    // Read the explicit relationship lists from case files, then make every connection traversable both ways.
    data.caseFiles.forEach(item => (item.connectedNodes || []).forEach(target => connect(item.id, target)));
    data.incidentReports.forEach(item => (item.connectedNodes || []).forEach(target => connect(item.id, target)));
    data.evidenceTags.forEach(item => (item.connectedNodes || []).forEach(target => connect(item.id, target)));
    data.certifiedDocuments.forEach(item => (item.connectedNodes || []).forEach(target => connect(item.id, target)));
    data.dossier.connectedNodes?.forEach(target => connect(data.dossier.id, target));
    nodes = [...world.querySelectorAll(".node")];
    nodes.forEach(node => node.dataset.links = [...(links.get(node.dataset.node) || [])].join(" "));
    nodes.forEach(attachNodeEvents);
    drawThreads();
  }
  function makeTack() {
    const holder = el("span", "thumbtack");
    holder.setAttribute("aria-hidden", "true");
    holder.innerHTML = '<svg viewBox="0 0 32 42" focusable="false"><ellipse cx="16" cy="37" rx="5" ry="2" fill="#160e09" opacity=".45"/><path d="M16 17 12 37h8l-4-20Z" fill="#9b3029" stroke="#4a1714" stroke-width="1.2"/><ellipse cx="16" cy="16" rx="11" ry="9" fill="#761f1b"/><ellipse cx="15" cy="13" rx="9" ry="7" fill="#d64b3d"/><ellipse cx="12" cy="11" rx="3" ry="2" fill="#ffd4b7" opacity=".75"/></svg>';
    return holder;
  }
  function connect(a, b) {
    if (!links.has(a) || !links.has(b) || a === b) return;
    links.get(a).add(b); links.get(b).add(a);
  }
  function drawThreads() {
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();
    const seen = new Set();
    nodes.forEach(node => (links.get(node.dataset.node) || []).forEach(id => {
      const other = nodes.find(item => item.dataset.node === id);
      if (!other) return;
      const pair = [node.dataset.node, id].sort().join("|");
      if (seen.has(pair)) return;
      seen.add(pair);
      const a = pinPoint(node), b = pinPoint(other), bend = Math.max(45, Math.min(150, Math.abs(b.x-a.x)*.2));
      const direction = b.x >= a.x ? 1 : -1;
      const curve = `M ${a.x} ${a.y} C ${a.x + direction*bend} ${a.y-65}, ${b.x - direction*bend} ${b.y-65}, ${b.x} ${b.y}`;
      const shadow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      shadow.setAttribute("d", curve); shadow.classList.add("thread-shadow"); shadow.dataset.pair = pair; svg.append(shadow);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", curve); path.classList.add("thread"); path.dataset.pair = pair; svg.append(path);
    }));
    addHub();
    applyHighlight(active);
  }
  function pinPoint(node) { return { x: node.offsetLeft + node.offsetWidth/2, y: node.offsetTop - 10 }; }
  function addHub() {
    const hub = document.createElementNS("http://www.w3.org/2000/svg", "g");
    hub.setAttribute("class", "string-hub"); hub.setAttribute("transform", `translate(${W*.51} ${H*.49})`);
    hub.innerHTML = '<circle r="16" class="hub-shadow"/><circle r="10" class="hub-ring"/><circle r="5" class="hub-core"/><path d="M-5-5 5 5M5-5-5 5" class="hub-glint"/>';
    svg.append(hub);
  }
  function applyHighlight(node) {
    const related = new Set(node ? [node.dataset.node, ...(links.get(node.dataset.node) || [])] : []);
    nodes.forEach(item => item.classList.toggle("dimmed", !!node && !related.has(item.dataset.node)));
    svg.querySelectorAll(".thread, .thread-shadow").forEach(path => {
      const ids = path.dataset.pair.split("|");
      path.classList.toggle("active", !!node && ids.includes(node.dataset.node));
      path.classList.toggle("dim", !!node && !ids.includes(node.dataset.node));
    });
  }
  function drawWorld() {
    if (mobile.matches) return;
    world.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${scale})`;
    updateMini(); drawThreads();
  }
  function constrain() {
    const limitX = Math.max(0, (W*scale-viewport.clientWidth)/2+100), limitY = Math.max(0, (H*scale-viewport.clientHeight)/2+100);
    panX = Math.max(-limitX, Math.min(limitX, panX)); panY = Math.max(-limitY, Math.min(limitY, panY));
  }
  function zoomAt(next, clientX, clientY) {
    if (mobile.matches) return;
    const rect = viewport.getBoundingClientRect(), px=(clientX ?? rect.left+rect.width/2)-rect.left-rect.width/2, py=(clientY ?? rect.top+rect.height/2)-rect.top-rect.height/2;
    const updated=Math.max(.45,Math.min(1.35,next)), ratio=updated/scale;
    panX=px-ratio*(px-panX); panY=py-ratio*(py-panY); scale=updated; constrain(); drawWorld();
  }
  function updateMini() {
    const vw=viewport.clientWidth,vh=viewport.clientHeight;
    miniWindow.style.width=`${vw/scale}px`; miniWindow.style.height=`${vh/scale}px`;
    miniWindow.style.left=`${W/2-(vw/2-panX)/scale}px`; miniWindow.style.top=`${H/2-(vh/2-panY)/scale}px`;
  }
  function soundEnabled() { return localStorage.getItem("caseboard-sound") !== "off"; }
  function getAudioContext() {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }
  let ambientMaster = null;
  function startAmbient() {
    if (!soundEnabled()) return;
    try {
      const ctx = getAudioContext();
      if (ambientMaster) {
        ambientMaster.gain.cancelScheduledValues(ctx.currentTime);
        ambientMaster.gain.setTargetAtTime(.38, ctx.currentTime, .35);
        return;
      }
      const now = ctx.currentTime;
      ambientMaster = ctx.createGain();
      ambientMaster.gain.setValueAtTime(.0001, now);
      ambientMaster.gain.setTargetAtTime(.38, now, .5);
      ambientMaster.connect(ctx.destination);

      const rainLength = Math.floor(ctx.sampleRate * 3);
      const rainBuffer = ctx.createBuffer(1, rainLength, ctx.sampleRate);
      const rainData = rainBuffer.getChannelData(0);
      let rainState = 0;
      for (let i = 0; i < rainLength; i++) {
        rainState = rainState * .94 + (Math.random() * 2 - 1) * .06;
        rainData[i] = rainState + (Math.random() * 2 - 1) * .12;
      }
      const rain = ctx.createBufferSource(); rain.buffer = rainBuffer; rain.loop = true;
      const rainHigh = ctx.createBiquadFilter(); rainHigh.type = "highpass"; rainHigh.frequency.value = 380;
      const rainLow = ctx.createBiquadFilter(); rainLow.type = "lowpass"; rainLow.frequency.value = 6200;
      const rainGain = ctx.createGain(); rainGain.gain.value = .18;
      rain.connect(rainHigh); rainHigh.connect(rainLow); rainLow.connect(rainGain); rainGain.connect(ambientMaster);
      rain.start(now);

      const crackleLength = Math.floor(ctx.sampleRate * 4);
      const crackleBuffer = ctx.createBuffer(1, crackleLength, ctx.sampleRate);
      const crackleData = crackleBuffer.getChannelData(0);
      for (let i = 0; i < crackleLength; i++) crackleData[i] = (Math.random() * 2 - 1) * .035;
      for (let i = 0; i < 34; i++) {
        const at = Math.floor(Math.random() * crackleLength);
        crackleData[at] += (Math.random() * 2 - 1) * (.3 + Math.random() * .7);
      }
      const crackle = ctx.createBufferSource(); crackle.buffer = crackleBuffer; crackle.loop = true;
      const crackleFilter = ctx.createBiquadFilter(); crackleFilter.type = "lowpass"; crackleFilter.frequency.value = 2600;
      const crackleGain = ctx.createGain(); crackleGain.gain.value = .09;
      crackle.connect(crackleFilter); crackleFilter.connect(crackleGain); crackleGain.connect(ambientMaster);
      crackle.start(now);

      const hum = ctx.createOscillator(); hum.type = "sine"; hum.frequency.value = 54;
      const humGain = ctx.createGain(); humGain.gain.value = .035;
      hum.connect(humGain); humGain.connect(ambientMaster); hum.start(now);
    } catch (_) {}
  }
  function setSoundEnabled(enabled) {
    localStorage.setItem("caseboard-sound", enabled ? "on" : "off");
    if (ambientMaster) {
      const ctx = getAudioContext();
      ambientMaster.gain.cancelScheduledValues(ctx.currentTime);
      ambientMaster.gain.setTargetAtTime(enabled ? .38 : .0001, ctx.currentTime, .12);
    } else if (enabled) startAmbient();
  }
  function sound(type) {
    if (!soundEnabled()) return;
    try {
      const ctx = getAudioContext();
      const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination); osc.type="triangle";
      osc.frequency.setValueAtTime(type === "camera" ? 1100 : 360,now); osc.frequency.exponentialRampToValueAtTime(150,now+.12);
      gain.gain.setValueAtTime(.0001,now); gain.gain.exponentialRampToValueAtTime(.03,now+.01); gain.gain.exponentialRampToValueAtTime(.0001,now+.14); osc.start(now); osc.stop(now+.15);
    } catch (_) {}
  }
  function playHoverPaper() {
    if (!soundEnabled()) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const duration = .055;
      const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i++) {
        // A slight, uneven amplitude shape gives the noise a papery scrape instead of a synthetic click.
        const progress = i / sampleCount;
        const envelope = Math.sin(Math.PI * progress) * (.78 + Math.random() * .22);
        samples[i] = (Math.random() * 2 - 1) * envelope;
      }
      const noise = ctx.createBufferSource(); noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = 1650; filter.Q.value = .85;
      const soften = ctx.createBiquadFilter();
      soften.type = "lowpass"; soften.frequency.value = 4800;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.065, now + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      noise.connect(filter); filter.connect(soften); soften.connect(gain); gain.connect(audioContext.destination);
      noise.start(now); noise.stop(now + duration);
    } catch (_) {}
  }
  function openFile(node) {
    const entry=records.get(node.dataset.node); if (!entry) return;
    const item=entry.data; active=node; applyHighlight(node); sound("paper");
    let kind,title,description,meta,extra="";
    if(entry.kind === "dossier") {
      kind="CLASSIFIED / ABOUT ME"; title=item.name; description=`${item.alias}\n${item.location}\n\n${item.summary}`;
      meta=`CASE FILE: ${item.stamp}`;
      extra=`Phone: ${item.contact.phone}`;
    } else if(entry.kind === "project") {
      kind=`CASE FILE / ${item.label}`; title=item.title; description=item.notes; meta=`CLASSIFICATION: ${item.classification}`; sound("camera");
    } else if(entry.kind === "report") {
      kind=item.caseNo; title=item.role; description=item.log; meta=`${item.company} · ${item.duration}`;
    } else if(entry.kind === "skill") {
      kind=`FORENSIC SKILL / ${item.category}`; title=item.name; description=item.details; meta="EVIDENCE TAG: SKILLS";
    } else {
      kind=`OFFICIAL RECORD / ${item.stamp}`; title=item.title; description=item.notes; meta=`ISSUER: ${item.issuer}`;
    }
    document.querySelector("#modalKicker").textContent=kind;
    document.querySelector("#modalTitle").textContent=title;
    document.querySelector("#modalDescription").textContent=description;
    document.querySelector("#modalMeta").textContent=meta;
    const code=document.querySelector("#modalCode"); code.hidden=true; code.querySelector("code").textContent="";
    const visual=document.querySelector("#modalVisual"); visual.classList.toggle("visible",entry.kind === "project");
    const linksBox=document.querySelector("#modalLinks"); linksBox.replaceChildren();
    const addLink=(label,url)=>{if(!url)return;const a=el("a","",label);a.href=url;a.target="_blank";a.rel="noopener noreferrer";linksBox.append(a);};
    if(entry.kind === "dossier") { addLink("EMAIL",`mailto:${item.contact.email}`); addLink("ARTSTATION",item.contact.artstation); addLink("ITCH.IO",item.contact.itchio); }
    if(extra) linksBox.append(el("span","",extra));
    if(!dialog.open) dialog.showModal();
  }
  function attachNodeEvents(node) {
    node.addEventListener("pointerenter",()=>{if(!mobile.matches){active=node;applyHighlight(node);playHoverPaper();}});
    node.addEventListener("pointerleave",()=>{if(!mobile.matches&&!dialog.open){active=null;applyHighlight(null);}});
    node.addEventListener("focus",()=>{active=node;applyHighlight(node);});
    node.addEventListener("blur",()=>{if(!dialog.open){active=null;applyHighlight(null);}});
    node.addEventListener("click",()=>{sound("pin");openFile(node);});
    node.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openFile(node);}});
  }
  document.querySelector("#closeDialog").addEventListener("click",()=>{sound("paper");dialog.close();});
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener("close",()=>{active=null;applyHighlight(null);});
  viewport.addEventListener("pointerdown",event=>{if(mobile.matches||event.target.closest(".node"))return;dragging=true;startX=event.clientX-panX;startY=event.clientY-panY;viewport.classList.add("dragging");viewport.setPointerCapture(event.pointerId);});
  viewport.addEventListener("pointermove",event=>{if(!dragging)return;panX=event.clientX-startX;panY=event.clientY-startY;constrain();drawWorld();});
  const stopDrag=()=>{dragging=false;viewport.classList.remove("dragging");};
  viewport.addEventListener("pointerup",stopDrag); viewport.addEventListener("pointercancel",stopDrag);
  viewport.addEventListener("wheel",event=>{if(mobile.matches)return;event.preventDefault();zoomAt(scale*(event.deltaY<0?1.1:.91),event.clientX,event.clientY);},{passive:false});
  document.querySelector("#zoomIn").addEventListener("click",()=>zoomAt(scale*1.2));
  document.querySelector("#zoomOut").addEventListener("click",()=>zoomAt(scale/1.2));
  document.querySelector("#resetView").addEventListener("click",()=>{scale=.82;panX=0;panY=220;drawWorld();});
  mini.addEventListener("click",event=>{if(mobile.matches)return;const rect=mini.getBoundingClientRect(),x=((event.clientX-rect.left-8)/(mini.clientWidth-16))*W,y=((event.clientY-rect.top-8)/(mini.clientHeight-16))*H;panX=-(x-W/2)*scale;panY=-(y-H/2)*scale;constrain();drawWorld();});
  const soundButton=document.querySelector("#soundToggle");
  function updateSoundButton(){const enabled=soundEnabled();soundButton.setAttribute("aria-pressed",String(enabled));soundButton.querySelector("span").textContent=enabled?" [SFX: AMBIENT NOIR ON]":" [SFX: AMBIENT NOIR OFF]";}
  soundButton.addEventListener("click",()=>{const enabled=!soundEnabled();setSoundEnabled(enabled);updateSoundButton();sound(enabled?"pin":"paper");toast.textContent=enabled?"Ambient and sound effects enabled":"Ambient and sound effects muted";toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),1800);});
  document.addEventListener("pointerover",event=>{
    const control=event.target.closest(".sound-toggle, .canvas-controls button, .close-file, .case-links a");
    if(control && !control.contains(event.relatedTarget)) playHoverPaper();
  });
  mobile.addEventListener("change",()=>{active=null;applyHighlight(null);drawWorld();});
  window.addEventListener("resize",()=>{constrain();drawWorld();});
  document.addEventListener("pointerdown",startAmbient,{capture:true});
  document.addEventListener("click",startAmbient,{capture:true});
  document.addEventListener("keydown",event=>{if(["w","a","s","d"].includes(event.key.toLowerCase()))startAmbient();},{capture:true});
  window.addEventListener("pointermove",event=>{document.documentElement.style.setProperty("--mouse-x",`${event.clientX}px`);document.documentElement.style.setProperty("--mouse-y",`${event.clientY}px`);},{passive:true});
  updateSoundButton();
  fetch("JSON.json").then(response=>{if(!response.ok)throw new Error("Could not load JSON.json");return response.json();}).then(data=>{buildNodes(data);requestAnimationFrame(()=>{drawWorld();});}).catch(error=>{const note=document.querySelector("#loadingNote");if(note)note.textContent="CASE EVIDENCE COULD NOT BE LOADED. Open this board through a local web server.";console.error(error);});
})();
