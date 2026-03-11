import { WORLD, clamp, dist2, lerp, lerpAngle } from "./constants.js";
import { createRenderer } from "./render.js";

if (typeof window !== "undefined") {
  window.__appBoot = window.__appBoot || { moduleLoaded: false };
  window.__appBoot.moduleLoaded = true;
}
const refs = {
  statsEl: document.getElementById("stats"),
  boardEl: document.getElementById("leaderboard"),
  hintEl: document.getElementById("hint"),
  menuOverlay: document.getElementById("menuOverlay"),
  landingSection: document.getElementById("landingSection"),
  roomSection: document.getElementById("roomSection"),
  nameInput: document.getElementById("nameInput"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  roomCodeBadge: document.getElementById("roomCodeBadge"),
  playersList: document.getElementById("playersList"),
  startMatchBtn: document.getElementById("startMatchBtn"),
  leaveRoomBtn: document.getElementById("leaveRoomBtn"),
  copyRoomBtn: document.getElementById("copyRoomBtn"),
  hostStatusEl: document.getElementById("hostStatus"),
  phaseStatusEl: document.getElementById("phaseStatus"),
  menuErrorEl: document.getElementById("menuError"),
  resultOverlay: document.getElementById("resultOverlay"),
  resultSummary: document.getElementById("resultSummary"),
  resultBoard: document.getElementById("resultBoard"),
  rematchBtn: document.getElementById("rematchBtn"),
  leaveAfterMatchBtn: document.getElementById("leaveAfterMatchBtn"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingStatus: document.getElementById("loadingStatus"),
  loadingProgressFill: document.getElementById("loadingProgressFill"),
  loadingProgressText: document.getElementById("loadingProgressText"),
  serverUrlInput: document.getElementById("serverUrlInput"),
  serverUrlHint: document.getElementById("serverUrlHint"),
  connStateText: document.getElementById("connStateText"),
  connTargetText: document.getElementById("connTargetText"),
  connReasonText: document.getElementById("connReasonText"),
  mobileControls: document.getElementById("mobileControls"),
  joystickBase: document.getElementById("joystickBase"),
  joystickStick: document.getElementById("joystickStick")
};

const canvas = document.getElementById("game");
const TOUCH_QUERY = "(hover: none), (pointer: coarse)";
const SERVER_URL_STORAGE_KEY = "dino-hole-server-url";

const state = {
  socket: null,
  socketOpen: false,
  pendingMessages: [],
  serverUrl: "",
  socketTarget: "",
  connectTimeoutId: 0,
  playerId: "",
  roomCode: "",
  hostId: "",
  phase: "menu",
  roomPlayers: [],
  ranking: [],
  finalRanking: [],
  foods: { civilians: [], cars: [], crates: [] },
  pickups: [],
  controlPoints: [],
  turretShots: [],
  popups: [],
  eventBanner: { text: "", color: "#5ce1ff", ttlMs: 0, flash: 0 },
  assetsLoaded: false,
  assetLoadProgress: 0,
  hasSnapshot: false,
  loadingProgress: 0,
  matchDurationMs: 0,
  timeLeftMs: 0,
  timeLeftSyncAt: performance.now(),
  elapsed: 0,
  pointer: null,
  pointerActive: false,
  pointerId: null,
  isTouchDevice: window.matchMedia(TOUCH_QUERY).matches || navigator.maxTouchPoints > 0,
  joystick: {
    active: false,
    pointerId: null,
    centerX: 0,
    centerY: 0,
    x: 0,
    y: 0,
    radius: 0
  },
  lastInputSentAt: 0,
  visualPlayers: new Map(),
  visualBots: new Map()
};

const renderer = createRenderer(canvas, refs, state);

let lastTs = 0;
refs.nameInput.value = localStorage.getItem("dino-hole-name") || "";
state.serverUrl = loadServerUrl();
if (refs.serverUrlInput) {
  refs.serverUrlInput.value = state.serverUrl;
}
renderServerHint();
state.socketTarget = buildSocketUrl();
setConnectionStatus("idle", "");

function getServerUrlFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("server") || "";
}

function normalizeServerUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  const candidate = /^[a-z]+:\/\//i.test(value) ? value : `http://${value}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return "";
  }

  if (!["http:", "https:", "ws:", "wss:"].includes(parsed.protocol)) {
    return "";
  }

  parsed.search = "";
  parsed.hash = "";
  if (!parsed.pathname || parsed.pathname === "/") {
    parsed.pathname = "";
  }

  return parsed.toString().replace(/\/$/, "");
}

function loadServerUrl() {
  const fromQuery = normalizeServerUrl(getServerUrlFromQuery());
  if (fromQuery) return fromQuery;
  return normalizeServerUrl(localStorage.getItem(SERVER_URL_STORAGE_KEY) || "");
}

function saveServerUrl() {
  const raw = String(refs.serverUrlInput?.value || "").trim();
  const normalized = normalizeServerUrl(raw);

  if (raw && !normalized) {
    setMenuError("服务器地址无效，例如：https://your-game-server.com");
    return false;
  }

  state.serverUrl = normalized;
  if (refs.serverUrlInput) {
    refs.serverUrlInput.value = normalized;
  }
  if (normalized) {
    localStorage.setItem(SERVER_URL_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(SERVER_URL_STORAGE_KEY);
  }

  if (!state.roomCode) {
    setMenuError("");
  }
  renderServerHint();
  state.socketTarget = buildSocketUrl();
  if (!state.socketOpen && !state.roomCode) {
    setConnectionStatus("idle", "");
  }
  return true;
}

function renderServerHint() {
  if (!refs.serverUrlHint) return;

  if (state.serverUrl) {
    refs.serverUrlHint.textContent = `当前服务器： ${state.serverUrl}`;
    return;
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    refs.serverUrlHint.textContent = "提示：APK 模式通常需要填写远程服务器地址。";
    return;
  }

  refs.serverUrlHint.textContent = "默认使用当前网站作为游戏服务器。";
}

function clearConnectTimeout() {
  if (!state.connectTimeoutId) return;
  window.clearTimeout(state.connectTimeoutId);
  state.connectTimeoutId = 0;
}

function setConnectionStatus(status, reason = "") {
  if (refs.connStateText) {
    const labels = {
      idle: "未连接",
      connecting: "连接中",
      connected: "已连接",
      error: "错误"
    };
    refs.connStateText.dataset.state = status;
    refs.connStateText.textContent = labels[status] || status;
  }

  if (refs.connTargetText) {
    refs.connTargetText.textContent = state.socketTarget || "-";
  }

  if (refs.connReasonText) {
    const text = String(reason || "").trim();
    refs.connReasonText.textContent = text;
    refs.connReasonText.classList.toggle("hidden", !text);
  }
}
function buildSocketUrl() {
  if (!state.serverUrl) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }

  const server = new URL(state.serverUrl);
  const protocol = server.protocol === "https:" || server.protocol === "wss:" ? "wss:" : "ws:";
  const path = !server.pathname || server.pathname === "/" ? "/ws" : server.pathname;
  return `${protocol}//${server.host}${path}`;
}
function ensureSocket() {
  if (state.socket) {
    if (state.socket.readyState === WebSocket.OPEN) {
      setConnectionStatus("connected", "");
      return;
    }
    if (state.socket.readyState === WebSocket.CONNECTING) {
      setConnectionStatus("connecting", "正在建立连接...");
      return;
    }
  }

  const socketUrl = buildSocketUrl();
  state.socketTarget = socketUrl;
  setConnectionStatus("connecting", "正在建立连接...");
  setMenuError("正在连接服务器...");

  let socket;
  try {
    socket = new WebSocket(socketUrl);
  } catch {
    setConnectionStatus("error", "WebSocket 初始化失败，请检查协议和端口。");
    setMenuError(`连接失败，请检查服务器地址：${state.serverUrl || "当前站点默认地址"}`);
    return;
  }

  state.socket = socket;
  state.socketOpen = false;

  clearConnectTimeout();
  state.connectTimeoutId = window.setTimeout(() => {
    if (state.socket !== socket || socket.readyState === WebSocket.OPEN) return;
    state.pendingMessages = [];
    setConnectionStatus("error", `连接超时（5 秒）：${socketUrl}`);
    setMenuError(`连接超时，请检查服务器是否可达：${state.serverUrl || `${window.location.protocol}//${window.location.host}`}`);
    try {
      socket.close();
    } catch {
      // ignore
    }
  }, 5000);

  socket.addEventListener("open", () => {
    clearConnectTimeout();
    state.socketOpen = true;
    flushPendingMessages();
    setConnectionStatus("connected", "");
    setMenuError("");
  });

  socket.addEventListener("message", (event) => {
    try {
      handleServerMessage(JSON.parse(event.data));
    } catch {
      setMenuError("收到无效的服务器消息。");
    }
  });

  socket.addEventListener("close", (event) => {
    clearConnectTimeout();
    const hadPendingMessages = state.pendingMessages.length > 0;
    state.socketOpen = false;
    state.socket = null;

    const code = event?.code ?? 0;
    const reason = event?.reason ? `，原因：${event.reason}` : "";
    const detail = `连接已关闭（代码 ${code}${reason}）`;

    if (state.roomCode) {
      setConnectionStatus("error", detail);
      setMenuError("连接已断开，请重新连接并加入房间。");
      resetClientState();
      return;
    }

    if (hadPendingMessages) {
      state.pendingMessages = [];
      setConnectionStatus("error", detail);
      setMenuError(`无法连接到服务器：${state.serverUrl || `${window.location.protocol}//${window.location.host}`}`);
      return;
    }

    setConnectionStatus("idle", "");
  });

  socket.addEventListener("error", () => {
    if (state.roomCode) return;
    setConnectionStatus("error", "网络错误，请检查地址、局域网和防火墙。");
    setMenuError(`无法连接到服务器：${state.serverUrl || `${window.location.protocol}//${window.location.host}`}`);
  });
}
function send(payload) {
  ensureSocket();
  if (state.socketOpen) {
    state.socket.send(JSON.stringify(payload));
  } else {
    state.pendingMessages.push(payload);
  }
}

function flushPendingMessages() {
  while (state.pendingMessages.length && state.socketOpen) {
    state.socket.send(JSON.stringify(state.pendingMessages.shift()));
  }
}

function setMenuError(message) {
  refs.menuErrorEl.textContent = message || "";
}

function saveName() {
  const value = refs.nameInput.value.trim().slice(0, 14);
  refs.nameInput.value = value;
  localStorage.setItem("dino-hole-name", value);
  return value;
}

function resetJoystickVisual() {
  if (refs.joystickStick) {
    refs.joystickStick.style.transform = "translate(0px, 0px)";
  }
}

function stopJoystick(forceStopInput = false) {
  if (state.joystick.pointerId != null && refs.joystickBase?.hasPointerCapture(state.joystick.pointerId)) {
    refs.joystickBase.releasePointerCapture(state.joystick.pointerId);
  }
  state.joystick.active = false;
  state.joystick.pointerId = null;
  state.joystick.x = 0;
  state.joystick.y = 0;
  resetJoystickVisual();
  if (forceStopInput) {
    sendStopInput();
  }
}

function resetClientState() {
  clearConnectTimeout();
  state.playerId = "";
  state.roomCode = "";
  state.hostId = "";
  state.phase = "menu";
  state.roomPlayers = [];
  state.ranking = [];
  state.finalRanking = [];
  state.foods = { civilians: [], cars: [], crates: [] };
  state.pickups = [];
  state.controlPoints = [];
  state.turretShots = [];
  state.popups = [];
  state.eventBanner = { text: "", color: "#5ce1ff", ttlMs: 0, flash: 0 };
  state.hasSnapshot = false;
  state.loadingProgress = 0;
  state.matchDurationMs = 0;
  state.timeLeftMs = 0;
  state.timeLeftSyncAt = performance.now();
  state.pointer = null;
  state.pointerActive = false;
  state.pointerId = null;
  stopJoystick();
  state.visualPlayers.clear();
  state.visualBots.clear();
  refs.resultOverlay.classList.add("hidden");
  refs.loadingOverlay.classList.add("hidden");
  updateOverlays();
}

function createOrJoinRoom(isCreate) {
  if (!saveServerUrl()) {
    return;
  }

  const name = saveName();
  if (!name) {
    setMenuError("请输入昵称。");
    refs.nameInput.focus();
    return;
  }

  if (isCreate) {
    send({ type: "create_room", name });
    return;
  }

  const roomCode = refs.roomCodeInput.value.trim().toUpperCase();
  refs.roomCodeInput.value = roomCode;
  if (roomCode.length < 5) {
    setMenuError("请输入 5 位房间码。");
    refs.roomCodeInput.focus();
    return;
  }

  send({ type: "join_room", name, roomCode });
}

function handleServerMessage(message) {
  if (message.type === "hello") {
    return;
  }

  if (message.type === "joined_room") {
    state.playerId = message.playerId;
    state.roomCode = message.roomCode;
    state.hostId = message.hostId;
    state.phase = "lobby";
    state.hasSnapshot = false;
    state.loadingProgress = 0;
    state.matchDurationMs = 0;
    state.finalRanking = [];
    setMenuError("");
    updateOverlays();
    return;
  }

  if (message.type === "room_state") {
    const prevPhase = state.phase;
    state.roomCode = message.roomCode || state.roomCode;
    state.hostId = message.hostId || "";
    state.roomPlayers = message.players || [];
    state.phase = message.phase || state.phase;
    if (prevPhase !== "running" && state.phase === "running") {
      state.hasSnapshot = false;
      state.loadingProgress = Math.min(state.loadingProgress, 0.08);
    }
    if (state.phase === "finished") {
      state.finalRanking = message.ranking || [];
      showResults();
    } else if (state.phase !== "running") {
      refs.resultOverlay.classList.add("hidden");
    }
    renderRoomPlayers();
    updateOverlays();
    return;
  }

  if (message.type === "snapshot") {
    applySnapshot(message);
    return;
  }

  if (message.type === "match_over") {
    state.phase = "finished";
    state.finalRanking = message.ranking || [];
    showResults();
    updateOverlays();
    return;
  }

  if (message.type === "left_room") {
    resetClientState();
    return;
  }

  if (message.type === "error") {
    setMenuError(message.message || "操作失败。");
  }
}

function applySnapshot(snapshot) {
  const previousTimeLeftMs = state.timeLeftMs;
  state.phase = "running";
  state.roomCode = snapshot.roomCode;
  state.ranking = snapshot.ranking || [];
  state.foods = snapshot.foods || { civilians: [], cars: [], crates: [] };
  state.pickups = snapshot.pickups || [];
  state.controlPoints = (snapshot.controlPoints || []).map((controlPoint) => ({ ...controlPoint }));
  state.turretShots = (snapshot.turretShots || []).map((shot) => ({ ...shot }));
  state.popups = (snapshot.popups || []).map((popup) => ({ ...popup }));
  state.eventBanner = {
    text: snapshot.eventBanner?.text || "",
    color: snapshot.eventBanner?.color || "#5ce1ff",
    ttlMs: Math.max(0, snapshot.eventBanner?.ttlMs || 0),
    flash: Math.max(0, snapshot.eventBanner?.flash || 0)
  };
  state.hasSnapshot = true;
  state.timeLeftMs = snapshot.timeLeftMs || 0;
  if (state.matchDurationMs <= 0 || state.timeLeftMs > previousTimeLeftMs + 2000) {
    state.matchDurationMs = state.timeLeftMs;
  } else if (state.timeLeftMs > state.matchDurationMs) {
    state.matchDurationMs = state.timeLeftMs;
  }
  state.timeLeftSyncAt = performance.now();
  refs.resultOverlay.classList.add("hidden");
  syncVisualMap(state.visualPlayers, snapshot.players || []);
  syncVisualMap(state.visualBots, snapshot.bots || []);
  updateOverlays();
}

function syncVisualMap(store, incoming) {
  const seen = new Set();
  for (const unit of incoming) {
    seen.add(unit.id);
    const existing = store.get(unit.id);
    if (!existing) {
      store.set(unit.id, {
        ...unit,
        displayX: unit.x,
        displayY: unit.y,
        displayAngle: unit.angle,
        displayMass: unit.mass,
        displayBodyR: unit.bodyR,
        displayHoleR: unit.holeR,
        targetX: unit.x,
        targetY: unit.y,
        targetAngle: unit.angle,
        targetMass: unit.mass,
        targetBodyR: unit.bodyR,
        targetHoleR: unit.holeR
      });
      continue;
    }

    const teleported = dist2(existing.targetX, existing.targetY, unit.x, unit.y) > 460 * 460;
    const respawned = !existing.alive && unit.alive;
    existing.targetX = unit.x;
    existing.targetY = unit.y;
    existing.targetAngle = unit.angle;
    existing.targetMass = unit.mass;
    existing.targetBodyR = unit.bodyR;
    existing.targetHoleR = unit.holeR;
    Object.assign(existing, unit);
    if (teleported || respawned) {
      existing.displayX = unit.x;
      existing.displayY = unit.y;
      existing.displayAngle = unit.angle;
      existing.displayMass = unit.mass;
      existing.displayBodyR = unit.bodyR;
      existing.displayHoleR = unit.holeR;
    }
  }

  for (const id of Array.from(store.keys())) {
    if (!seen.has(id)) {
      store.delete(id);
    }
  }
}

function stepVisuals(dt) {
  const alpha = 1 - Math.exp(-dt * 12);
  const dtMs = dt * 1000;
  for (const store of [state.visualPlayers, state.visualBots]) {
    for (const unit of store.values()) {
      unit.displayX = lerp(unit.displayX, unit.targetX, alpha);
      unit.displayY = lerp(unit.displayY, unit.targetY, alpha);
      unit.displayAngle = lerpAngle(unit.displayAngle, unit.targetAngle, alpha);
      unit.displayMass = lerp(unit.displayMass, unit.targetMass, alpha);
      unit.displayBodyR = lerp(unit.displayBodyR, unit.targetBodyR, alpha);
      unit.displayHoleR = lerp(unit.displayHoleR, unit.targetHoleR, alpha);
      if (unit.invincibleMs > 0) {
        unit.invincibleMs = Math.max(0, unit.invincibleMs - dtMs);
      }
      if (!unit.alive && unit.respawnMs > 0) {
        unit.respawnMs = Math.max(0, unit.respawnMs - dtMs);
      }
      if (unit.effects) {
        if (unit.effects.speedMs > 0) unit.effects.speedMs = Math.max(0, unit.effects.speedMs - dtMs);
        if (unit.effects.magnetMs > 0) unit.effects.magnetMs = Math.max(0, unit.effects.magnetMs - dtMs);
        if (unit.effects.shieldMs > 0) unit.effects.shieldMs = Math.max(0, unit.effects.shieldMs - dtMs);
      }
    }
  }

  if (state.eventBanner.ttlMs > 0) {
    state.eventBanner.ttlMs = Math.max(0, state.eventBanner.ttlMs - dtMs);
  }
  if (state.eventBanner.flash > 0) {
    state.eventBanner.flash = Math.max(0, state.eventBanner.flash - dt * 0.38);
  }

  for (let i = state.popups.length - 1; i >= 0; i--) {
    const popup = state.popups[i];
    const rise = 22 + (popup.size || 24) * 0.85;
    popup.y -= rise * dt;
    popup.lifeMs -= dtMs;
    if (popup.lifeMs <= 0) {
      state.popups.splice(i, 1);
    }
  }
}

function renderRoomPlayers() {
  refs.playersList.innerHTML = "";
  for (const player of state.roomPlayers) {
    const row = document.createElement("div");
    row.className = "playerRow";
    row.innerHTML = `
      <div class="playerSwatch" style="background:${player.color}"></div>
      <div>
        <div class="playerName">${player.id === state.hostId ? "[房主] " : ""}${player.name}${player.id === state.playerId ? "（你）" : ""}</div>
        <div class="playerMeta">${state.phase === "finished" ? "等待下一局" : state.phase === "running" ? "对局中" : "已就绪"}</div>
      </div>
      <div class="playerMeta">${player.connected ? "在线" : "离线"}</div>
    `;
    refs.playersList.append(row);
  }
}

function updateOverlays() {
  const inRoom = !!state.roomCode;
  const isRunning = state.phase === "running";
  const isFinished = state.phase === "finished";
  const isHost = !!state.playerId && state.playerId === state.hostId;
  const hostPlayer = state.roomPlayers.find((player) => player.id === state.hostId);

  refs.menuOverlay.classList.toggle("hidden", isRunning);
  refs.landingSection.classList.toggle("hidden", inRoom);
  refs.roomSection.classList.toggle("hidden", !inRoom);

  if (refs.mobileControls) {
    refs.mobileControls.classList.toggle("hidden", !(state.isTouchDevice && isRunning));
  }

  if (!inRoom) return;

  refs.roomCodeBadge.textContent = state.roomCode;
  refs.hostStatusEl.textContent = isHost
    ? "你是房主"
    : hostPlayer
      ? `房主：${hostPlayer.name}`
      : "房主：待分配";

  refs.phaseStatusEl.textContent = isRunning
    ? "对局进行中"
    : isFinished
      ? "本局已结束"
      : "等待房主开始";

  refs.startMatchBtn.textContent = isFinished ? "再开一局" : "开始对局";
  refs.startMatchBtn.classList.toggle("hidden", !isHost || isRunning);
  refs.startMatchBtn.disabled = !isHost;
}

function updateLoadingOverlay(dt = 0) {
  if (!refs.loadingOverlay || !refs.loadingProgressFill || !refs.loadingProgressText || !refs.loadingStatus) return;

  if (state.phase !== "running") {
    state.loadingProgress = 0;
    refs.loadingOverlay.classList.add("hidden");
    return;
  }

  const waitingForAssets = !state.assetsLoaded;
  const waitingForSnapshot = !state.hasSnapshot;
  const waiting = waitingForAssets || waitingForSnapshot;
  const targetProgress = waiting
    ? clamp(0.08 + state.assetLoadProgress * 0.68 + (waitingForSnapshot ? 0.12 : 0.24), 0.08, 0.95)
    : 1;
  const alpha = dt > 0 ? 1 - Math.exp(-dt * 8) : 1;
  state.loadingProgress = lerp(state.loadingProgress, targetProgress, alpha);

  if (!waiting && state.loadingProgress >= 0.995) {
    refs.loadingOverlay.classList.add("hidden");
    return;
  }

  refs.loadingOverlay.classList.remove("hidden");
  refs.loadingProgressFill.style.width = `${Math.round(clamp(state.loadingProgress, 0, 1) * 100)}%`;
  refs.loadingProgressText.textContent = `${Math.round(clamp(state.loadingProgress, 0, 1) * 100)}%`;
  refs.loadingStatus.textContent = waitingForAssets
    ? "正在准备资源..."
    : waitingForSnapshot
      ? "正在同步对局数据..."
      : "即将进入对局...";
}

function showResults() {
  if (!state.finalRanking.length) return;

  const rank = state.finalRanking.findIndex((row) => row.id === state.playerId) + 1;
  const self = state.finalRanking.find((row) => row.id === state.playerId);

  refs.resultSummary.textContent = rank && self
    ? `你获得第 ${rank} 名，得分 ${self.score}，击败 ${self.kills} 名对手，当前质量 ${self.mass}。`
    : "本局结束，查看最终排名。";

  refs.resultBoard.innerHTML = "";
  state.finalRanking.forEach((row, index) => {
    const div = document.createElement("div");
    div.className = "resultRow";
    div.innerHTML = `
      <div class="playerSwatch" style="background:${row.color}"></div>
      <div>
        <div class="resultName">${index + 1}. ${row.name}${row.id === state.playerId ? "（你）" : ""}${row.isBot ? " [BOT]" : ""}</div>
        <div class="resultMeta">得分 ${row.score} · 击败 ${row.kills} · 质量 ${row.mass}</div>
      </div>
      <div class="resultMeta">${index === 0 ? "冠军" : ""}</div>
    `;
    refs.resultBoard.append(div);
  });

  refs.resultOverlay.classList.remove("hidden");
}

function sendPointer(force = false) {
  if (state.phase !== "running" || !state.pointer) return;
  const now = performance.now();
  if (!force && now - state.lastInputSentAt < 45) return;
  state.lastInputSentAt = now;
  send({
    type: "input",
    targetX: state.pointer.x,
    targetY: state.pointer.y
  });
}

function sendStopInput() {
  if (state.phase !== "running") return;
  const self = state.visualPlayers.get(state.playerId);
  if (!self || !self.alive) return;

  state.pointer = {
    x: clamp(self.displayX, 20, WORLD.w - 20),
    y: clamp(self.displayY, 20, WORLD.h - 20)
  };
  state.pointerActive = false;
  sendPointer(true);
}

function onPointerDown(event) {
  if (state.phase !== "running") return;
  if (state.isTouchDevice && event.pointerType !== "mouse") return;

  state.pointerActive = true;
  state.pointerId = event.pointerId;
  state.pointer = renderer.getWorldPointer(event);
  sendPointer(true);
}

function onPointerMove(event) {
  if (state.phase !== "running") return;
  if (state.isTouchDevice && event.pointerType !== "mouse") return;
  if (!state.pointerActive && event.pointerType !== "mouse") return;
  if (state.pointerActive && state.pointerId != null && event.pointerId !== state.pointerId) return;

  state.pointer = renderer.getWorldPointer(event);
  if (state.pointerActive) sendPointer();
}

function onPointerUp(event) {
  if (state.pointerId != null && event.pointerId !== state.pointerId) return;
  state.pointerActive = false;
  state.pointerId = null;
}

function updateJoystickVisual(dx, dy) {
  if (!refs.joystickStick) return;
  refs.joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
}

function computeJoystickRadius() {
  const rect = refs.joystickBase?.getBoundingClientRect();
  if (!rect) return 0;
  return Math.max(22, rect.width * 0.33);
}

function syncJoystickPointer(force = false) {
  if (!state.joystick.active || state.phase !== "running") return;

  const self = state.visualPlayers.get(state.playerId);
  if (!self || !self.alive) return;

  const mag = Math.hypot(state.joystick.x, state.joystick.y);
  if (mag < 0.06) {
    if (force) sendStopInput();
    return;
  }

  const travel = 280;
  state.pointer = {
    x: clamp(self.displayX + state.joystick.x * travel, 20, WORLD.w - 20),
    y: clamp(self.displayY + state.joystick.y * travel, 20, WORLD.h - 20)
  };
  state.pointerActive = true;
  sendPointer(force);
}

function updateJoystickFromEvent(event) {
  const radius = state.joystick.radius || computeJoystickRadius();
  state.joystick.radius = radius;

  const dx = event.clientX - state.joystick.centerX;
  const dy = event.clientY - state.joystick.centerY;
  const distance = Math.hypot(dx, dy);
  const clampedDistance = Math.min(distance, radius);
  const ratio = distance > 0.001 ? clampedDistance / distance : 0;
  const clampedDx = dx * ratio;
  const clampedDy = dy * ratio;

  state.joystick.x = radius > 0 ? clampedDx / radius : 0;
  state.joystick.y = radius > 0 ? clampedDy / radius : 0;
  updateJoystickVisual(clampedDx, clampedDy);
  syncJoystickPointer(true);
}

function onJoystickDown(event) {
  if (state.phase !== "running") return;
  if (!refs.joystickBase) return;

  event.preventDefault();
  const rect = refs.joystickBase.getBoundingClientRect();
  state.joystick.active = true;
  state.joystick.pointerId = event.pointerId;
  state.joystick.centerX = rect.left + rect.width * 0.5;
  state.joystick.centerY = rect.top + rect.height * 0.5;
  state.joystick.radius = Math.max(22, rect.width * 0.33);

  refs.joystickBase.setPointerCapture(event.pointerId);
  updateJoystickFromEvent(event);
}

function onJoystickMove(event) {
  if (!state.joystick.active) return;
  if (event.pointerId !== state.joystick.pointerId) return;
  event.preventDefault();
  updateJoystickFromEvent(event);
}

function onJoystickUp(event) {
  if (!state.joystick.active) return;
  if (event.pointerId !== state.joystick.pointerId) return;
  event.preventDefault();
  stopJoystick(true);
}

function copyByExecCommand(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  textarea.remove();
  return ok;
}

async function copyRoomCodeSafe() {
  if (!state.roomCode) return;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(state.roomCode);
      setMenuError("房间码已复制。");
      return;
    } catch {
      // Fall through to the compatibility path.
    }
  }

  if (copyByExecCommand(state.roomCode)) {
    setMenuError("房间码已复制。");
    return;
  }

  try {
    window.prompt("复制失败，请手动复制：", state.roomCode);
  } catch {
    // Ignore prompt errors.
  }
  setMenuError(`房间码：${state.roomCode}`);
}

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.033, (ts - lastTs) / 1000);
  lastTs = ts;
  state.elapsed += dt;
  stepVisuals(dt);
  updateLoadingOverlay(dt);
  renderer.frame(dt);
  requestAnimationFrame(loop);
}

refs.createRoomBtn.addEventListener("click", () => createOrJoinRoom(true));
refs.joinRoomBtn.addEventListener("click", () => createOrJoinRoom(false));
refs.startMatchBtn.addEventListener("click", () => send({ type: "start_match" }));
refs.rematchBtn.addEventListener("click", () => send({ type: "start_match" }));
refs.leaveRoomBtn.addEventListener("click", () => send({ type: "leave_room" }));
refs.leaveAfterMatchBtn.addEventListener("click", () => send({ type: "leave_room" }));
refs.copyRoomBtn.addEventListener("click", copyRoomCodeSafe);
refs.roomCodeInput.addEventListener("input", () => {
  refs.roomCodeInput.value = refs.roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
});
refs.nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    createOrJoinRoom(true);
  }
});
refs.roomCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    createOrJoinRoom(false);
  }
});

if (refs.serverUrlInput) {
  refs.serverUrlInput.addEventListener("blur", saveServerUrl);
  refs.serverUrlInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    saveServerUrl();
  });
}

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);

if (refs.joystickBase) {
  refs.joystickBase.addEventListener("pointerdown", onJoystickDown);
  refs.joystickBase.addEventListener("pointermove", onJoystickMove);
  refs.joystickBase.addEventListener("pointerup", onJoystickUp);
  refs.joystickBase.addEventListener("pointercancel", onJoystickUp);
}

window.addEventListener("resize", () => {
  renderer.resize();
  state.joystick.radius = 0;
});

window.setInterval(() => {
  if (state.joystick.active) {
    syncJoystickPointer();
    return;
  }
  if (state.pointerActive) {
    sendPointer();
  }
}, 50);

renderer.resize();
updateOverlays();
updateLoadingOverlay();
requestAnimationFrame(loop);






























