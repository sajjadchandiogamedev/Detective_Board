(() => {
  "use strict";
  const viewport = document.querySelector("#viewport");
  const world = document.querySelector("#world");
  const svg = document.querySelector("#threads");
  const nodes = [...document.querySelectorAll(".node")];
  const mini = document.querySelector("#miniWorld");
  const miniWindow = document.querySelector("#miniWindow");
  const dialog = document.querySelector("#caseDialog");
  const toast = document.querySelector("#toast");
  const mobile = matchMedia("(max-width: 700px)");
  const files = {
    about: {
      kind: "PERSONNEL DOSSIER",
      title: "The Detective",
      description:
        "Curious by nature. Builder by trade. I follow the clues from a first sketch to a finished product, making useful things for the web along the way.\n\nThis board is a living portfolio: a few selected projects, the tools behind them, and the evidence that got me here.",
      meta: "CLASSIFICATION: PUBLIC · STATUS: ON THE CASE",
      code: '// Current assignment\nconst approach = ["listen", "investigate", "build", "refine"];',
    },
    "project-one": {
      kind: "CASE FILE / PROJECT 01",
      title: "Project One — After Hours",
      description:
        "A sample project card for your portfolio. Replace this case summary with what the project does, the problem it solves, and the part you are proudest of. Add screenshots, a demo, and a repository link when you have them.",
      meta: "CATEGORY: WEB APPLICATION · DATE: 2026 · STATUS: CLOSED (FOR NOW)",
      code: "// The clue that started it all\nfunction makeSomethingUseful(idea) {\n  return investigate(idea).then(build);\n}",
    },
    "project-two": {
      kind: "CASE FILE / PROJECT 02",
      title: "Project Two — The Archive",
      description:
        "A second sample case. Tell the story behind this project: the challenge, your approach, and the outcome. The evidence image area is ready for a real screenshot once you add one.",
      meta: "CATEGORY: INTERFACE / INFORMATION · DATE: 2025 · STATUS: FILED",
      code: 'const evidence = {\n  design: "clear by design",\n  details: "worth investigating"\n};',
    },
    "skill-js": {
      kind: "EVIDENCE NOTE / SKILL",
      title: "JavaScript",
      description:
        "I use JavaScript to add behavior to interfaces, connect data, and turn static pages into useful tools. Add your preferred frameworks, libraries, and a proficiency level here.",
      meta: "AREA: FRONT-END DEVELOPMENT · RELATED CASES: 01, 02",
      code: 'document.querySelectorAll(".clue")\n  .forEach(clue => clue.addEventListener("click", investigate));',
    },
    "skill-design": {
      kind: "EVIDENCE NOTE / SKILL",
      title: "Design & CSS",
      description:
        "From layout and typography to responsive details, I enjoy shaping interfaces that feel considered and easy to use. Customize this note with your design tools and areas of focus.",
      meta: "AREA: VISUAL DESIGN · RELATED CASES: 01, 02",
      code: ".details matter {\n  color: var(--character);\n  layout: intentional;\n}",
    },
    "cert-web": {
      kind: "CERTIFICATION / VERIFIED",
      title: "Web Development Foundations",
      description:
        "An example certificate entry. Replace with the real course or certification name, issuing organization, completion date, and credential link.",
      meta: "ISSUER: YOUR ORGANIZATION · DATE: ADD DATE · STATUS: VERIFIED",
      code: "",
    },
    achievement: {
      kind: "FIELD REPORT / ACHIEVEMENT",
      title: "One to Watch",
      description:
        "An example achievement clipping. Add an award, milestone, publication, launch, or other evidence of progress. Include dates and links so the trail can be followed.",
      meta: "SOURCE: YOUR PUBLICATION · DATE: ADD DATE · STATUS: RECORDED",
      code: "",
    },
    contact: {
      kind: "OPEN CHANNEL / CONTACT",
      title: "Let's talk.",
      description:
        "Have a case worth solving together? Replace the sample address with your preferred contact email, or add links to your professional profiles.",
      meta: "CONTACT: hello@example.com · REPLACE WITH YOUR EMAIL",
      code: "// New case intake\nif (goodIdea && goodPeople) {\n  openConversation();\n}",
    },
  };

  let scale = 1,
    panX = 0,
    panY = 0,
    dragging = false,
    startX = 0,
    startY = 0;
  let active = null,
    toastTimer,
    audioContext;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function drawWorld() {
    if (mobile.matches) return;
    world.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${scale})`;
    updateMini();
    drawThreads();
  }
  function constrain() {
    const w = viewport.clientWidth,
      h = viewport.clientHeight;
    const contentW = 1200 * scale,
      contentH = 760 * scale;
    const limitX = Math.max(0, (contentW - w) / 2 + 100);
    const limitY = Math.max(0, (contentH - h) / 2 + 100);
    panX = Math.max(-limitX, Math.min(limitX, panX));
    panY = Math.max(-limitY, Math.min(limitY, panY));
  }
  function zoomAt(next, clientX, clientY) {
    if (mobile.matches) return;
    const rect = viewport.getBoundingClientRect();
    const px =
      (clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
    const py =
      (clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;
    const updated = Math.max(0.55, Math.min(1.65, next));
    const ratio = updated / scale;
    panX = px - ratio * (px - panX);
    panY = py - ratio * (py - panY);
    scale = updated;
    constrain();
    drawWorld();
  }
  function drawThreads() {
    const width = 1200,
      height = 760;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.replaceChildren();
    const seen = new Set();
    nodes.forEach((node) => {
      (node.dataset.links || "")
        .split(/\s+/)
        .filter(Boolean)
        .forEach((id) => {
          const other = document.querySelector(`[data-node="${id}"]`);
          if (!other) return;
          const key = [node.dataset.node, id].sort().join("|");
          if (seen.has(key)) return;
          seen.add(key);
          const a = center(node),
            b = center(other);
          const bend = Math.max(30, Math.min(100, Math.abs(b.x - a.x) * 0.15));
          const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
          );
          path.setAttribute(
            "d",
            `M ${a.x} ${a.y} C ${a.x + (b.x > a.x ? bend : -bend)} ${a.y + 30}, ${b.x - (b.x > a.x ? bend : -bend)} ${b.y - 30}, ${b.x} ${b.y}`,
          );
          path.classList.add("thread");
          path.dataset.pair = key;
          svg.append(path);
        });
    });
    applyHighlight(active);
  }
  function center(node) {
    const x = node.offsetLeft + node.offsetWidth / 2;
    const y = node.offsetTop + node.offsetHeight / 2;
    return { x, y };
  }
  function applyHighlight(node) {
    const related = new Set(
      node
        ? [node.dataset.node, ...(node.dataset.links || "").split(/\s+/)]
        : [],
    );
    nodes.forEach((item) =>
      item.classList.toggle(
        "dimmed",
        !!node && !related.has(item.dataset.node),
      ),
    );
    svg.querySelectorAll(".thread").forEach((path) => {
      if (!node) {
        path.classList.remove("active", "dim");
        return;
      }
      const ids = path.dataset.pair.split("|");
      const connected = ids.includes(node.dataset.node);
      path.classList.toggle("active", connected);
      path.classList.toggle("dim", !connected);
    });
  }
  function updateMini() {
    const vw = viewport.clientWidth,
      vh = viewport.clientHeight;
    miniWindow.style.width = `${vw / scale}px`;
    miniWindow.style.height = `${vh / scale}px`;
    miniWindow.style.left = `${600 - (vw / 2 - panX) / scale}px`;
    miniWindow.style.top = `${380 - (vh / 2 - panY) / scale}px`;
  }
  function setToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }
  function sound(type) {
    if (localStorage.getItem("caseboard-sound") !== "on") return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume();
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator(),
        gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      const freq = type === "pin" ? 620 : type === "camera" ? 1150 : 280;
      osc.type = type === "paper" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now);
      if (type === "paper")
        osc.frequency.exponentialRampToValueAtTime(130, now + 0.13);
      else
        osc.frequency.exponentialRampToValueAtTime(
          type === "camera" ? 230 : 260,
          now + 0.075,
        );
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(
        type === "paper" ? 0.035 : 0.05,
        now + 0.008,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + (type === "paper" ? 0.16 : 0.09),
      );
      osc.start(now);
      osc.stop(now + (type === "paper" ? 0.17 : 0.1));
    } catch (_) {
      /* Sound is an optional enhancement. */
    }
  }
  function openFile(node) {
    const data = files[node.dataset.node];
    if (!data) return;
    active = node;
    applyHighlight(node);
    sound("paper");
    document.querySelector("#modalKicker").textContent = data.kind;
    document.querySelector("#modalTitle").textContent = data.title;
    document.querySelector("#modalDescription").textContent = data.description;
    document.querySelector("#modalMeta").textContent = data.meta;
    const code = document.querySelector("#modalCode");
    code.hidden = !data.code;
    code.querySelector("code").textContent = data.code;
    const visual = document.querySelector("#modalVisual");
    visual.classList.toggle("visible", node.dataset.kind === "project");
    const links = document.querySelector("#modalLinks");
    links.replaceChildren();
    if (node.dataset.kind === "project") {
      ["LIVE DEMO", "GITHUB REPOSITORY"].forEach((label) => {
        const item = document.createElement("span");
        item.textContent = `${label} · ADD URL`;
        links.append(item);
      });
      sound("camera");
    }
    if (node.dataset.kind === "contact") {
      const email = document.createElement("a");
      email.href = "mailto:hello@example.com";
      email.textContent = "EMAIL THE DESK";
      links.append(email);
    }
    if (!dialog.open) dialog.showModal();
  }
  nodes.forEach((node) => {
    node.addEventListener("pointerenter", () => {
      if (!mobile.matches) {
        active = node;
        applyHighlight(node);
      }
    });
    node.addEventListener("pointerleave", () => {
      if (!mobile.matches && !dialog.open) {
        active = null;
        applyHighlight(null);
      }
    });
    node.addEventListener("focus", () => {
      active = node;
      applyHighlight(node);
    });
    node.addEventListener("blur", () => {
      if (!dialog.open) {
        active = null;
        applyHighlight(null);
      }
    });
    node.addEventListener("click", () => {
      sound("pin");
      openFile(node);
    });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFile(node);
      }
    });
  });
  document.querySelector("#closeDialog").addEventListener("click", () => {
    sound("paper");
    dialog.close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    active = null;
    applyHighlight(null);
  });
  viewport.addEventListener("pointerdown", (event) => {
    if (mobile.matches || event.target.closest(".node")) return;
    dragging = true;
    startX = event.clientX - panX;
    startY = event.clientY - panY;
    viewport.classList.add("dragging");
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    panX = event.clientX - startX;
    panY = event.clientY - startY;
    constrain();
    drawWorld();
  });
  function stopDrag() {
    dragging = false;
    viewport.classList.remove("dragging");
  }
  viewport.addEventListener("pointerup", stopDrag);
  viewport.addEventListener("pointercancel", stopDrag);
  viewport.addEventListener(
    "wheel",
    (event) => {
      if (mobile.matches) return;
      event.preventDefault();
      zoomAt(
        scale * (event.deltaY < 0 ? 1.1 : 0.91),
        event.clientX,
        event.clientY,
      );
    },
    { passive: false },
  );
  document
    .querySelector("#zoomIn")
    .addEventListener("click", () => zoomAt(scale * 1.2));
  document
    .querySelector("#zoomOut")
    .addEventListener("click", () => zoomAt(scale / 1.2));
  document.querySelector("#resetView").addEventListener("click", () => {
    scale = 1;
    panX = 0;
    panY = 0;
    drawWorld();
  });
  document.querySelector("#minimap").addEventListener("click", (event) => {
    if (mobile.matches) return;
    const rect = mini.getBoundingClientRect();
    const x =
      ((event.clientX - rect.left - 8) / (mini.clientWidth - 16)) * 1200;
    const y = ((event.clientY - rect.top - 8) / (mini.clientHeight - 16)) * 760;
    panX = -(x - 600) * scale;
    panY = -(y - 380) * scale;
    constrain();
    drawWorld();
  });
  const soundButton = document.querySelector("#soundToggle");
  function updateSoundButton() {
    const enabled = localStorage.getItem("caseboard-sound") === "on";
    soundButton.setAttribute("aria-pressed", String(enabled));
    soundButton.querySelector("span").textContent = enabled
      ? " SOUND ON"
      : " SOUND OFF";
  }
  soundButton.addEventListener("click", () => {
    const enabled = localStorage.getItem("caseboard-sound") !== "on";
    localStorage.setItem("caseboard-sound", enabled ? "on" : "off");
    updateSoundButton();
    if (enabled) {
      sound("pin");
      setToast("Sound effects enabled");
    } else setToast("Sound effects muted");
  });
  mobile.addEventListener("change", () => {
    active = null;
    applyHighlight(null);
    drawWorld();
  });
  window.addEventListener("resize", () => {
    constrain();
    drawWorld();
  });
  window.addEventListener(
    "pointermove",
    (event) => {
      document.documentElement.style.setProperty("--mx", `${event.clientX}px`);
      document.documentElement.style.setProperty("--my", `${event.clientY}px`);
    },
    { passive: true },
  );
  updateSoundButton();
  requestAnimationFrame(() => {
    drawWorld();
  });
})();
