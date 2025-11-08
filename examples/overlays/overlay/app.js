const ROLE_OPTIONS = ["Mod", "VIP", "AI", "Viewer", "Streamer"];
const SSE_PATH = "/v1/events/chat/messages/stream";

const apiKeyInput = document.getElementById("apiKey");
const baseUrlInput = document.getElementById("baseUrl");
const excludedInput = document.getElementById("excluded");
const roleFilterContainer = document.getElementById("roleFilter");
const connectBtn = document.getElementById("connectBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const leaderboardEl = document.getElementById("leaderboardCards");

const state = {
  counts: new Map(),
  controller: null,
  reader: null,
  buffer: "",
  isConnected: false,
};

function initRoleFilter() {
  ROLE_OPTIONS.forEach((role) => {
    const id = `role-${role.toLowerCase()}`;
    const label = document.createElement("label");
    label.className = "role-chip";
    label.htmlFor = id;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.value = role;
    input.checked = true;

    const span = document.createElement("span");
    span.textContent = role;

    label.appendChild(input);
    label.appendChild(span);
    roleFilterContainer.appendChild(label);
  });
}

function getSelectedRoles() {
  return Array.from(roleFilterContainer.querySelectorAll("input[type=checkbox]"))
    .filter((input) => input.checked)
    .map((input) => input.value);
}

function getExcludedSet() {
  if (!excludedInput.value.trim()) {
    return new Set();
  }
  return new Set(
    excludedInput.value
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean)
  );
}

function updateStatus(message, tone = "neutral") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function renderLeaderboard() {
  const excluded = getExcludedSet();
  const topChatters = Array.from(state.counts.values())
    .filter((item) => !excluded.has(item.username.toLowerCase()))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  leaderboardEl.innerHTML = "";

  if (!topChatters.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Waiting for chat activity...";
    leaderboardEl.appendChild(empty);
    return;
  }

  topChatters.forEach((chatter, index) => {
    const card = document.createElement("article");
    card.className = `card ${["first", "second", "third"][index] || ""}`;

    const content = document.createElement("div");
    content.className = "card-content";

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `#${index + 1}`;

    const username = document.createElement("span");
    username.className = "username";
    username.textContent = chatter.username;

    const roleTag = document.createElement("span");
    roleTag.className = "role-tag";
    roleTag.textContent = chatter.role ?? "Viewer";

    const messageCount = document.createElement("span");
    messageCount.className = "message-count";
    messageCount.textContent = `${chatter.count} message${chatter.count === 1 ? "" : "s"}`;

    content.append(rank, username, roleTag, messageCount);
    card.appendChild(content);
    leaderboardEl.appendChild(card);
  });
}

function resetCounts() {
  state.counts.clear();
  renderLeaderboard();
}

function disconnect(reason) {
  state.controller?.abort();
  state.reader?.cancel().catch(() => {});
  state.controller = null;
  state.reader = null;
  state.buffer = "";
  if (state.isConnected) {
    updateStatus(reason ?? "Disconnected", "warning");
  }
  state.isConnected = false;
  connectBtn.disabled = false;
}

async function connect() {
  const apiKey = apiKeyInput.value.trim();
  const baseUrl = baseUrlInput.value.trim().replace(/\/$/, "");
  const roles = getSelectedRoles();

  if (!apiKey) {
    updateStatus("Please provide your API key", "error");
    return;
  }
  if (!baseUrl) {
    updateStatus("Please provide the API base URL", "error");
    return;
  }

  disconnect();

  const params = new URLSearchParams();
  roles.forEach((role) => params.append("roles", role));
  const url = `${baseUrl}${SSE_PATH}${params.toString() ? `?${params.toString()}` : ""}`;

  state.controller = new AbortController();
  updateStatus("Connecting…");
  connectBtn.disabled = true;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: state.controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Connection failed (HTTP ${response.status})`);
    }

    state.reader = response.body.getReader();
    state.buffer = "";
    state.isConnected = true;
    updateStatus("Connected", "success");

    readStream();
  } catch (error) {
    console.error(error);
    disconnect(error.message);
    connectBtn.disabled = false;
  }
}

async function readStream() {
  if (!state.reader) return;
  try {
    while (true) {
      const { value, done } = await state.reader.read();
      if (done) {
        disconnect("Stream ended");
        break;
      }
      if (value) {
        const chunk = new TextDecoder().decode(value);
        processChunk(chunk);
      }
    }
  } catch (error) {
    if (state.isConnected) {
      console.error(error);
      disconnect("Connection lost");
    }
  }
}

function processChunk(chunk) {
  state.buffer += chunk;
  let boundary;
  while ((boundary = state.buffer.indexOf("\n\n")) !== -1) {
    const rawEvent = state.buffer.slice(0, boundary);
    state.buffer = state.buffer.slice(boundary + 2);
    handleEvent(rawEvent);
  }
}

function handleEvent(rawEvent) {
  const lines = rawEvent.split("\n").map((line) => line.trim());
  if (lines.every((line) => !line || line.startsWith(":"))) {
    return; // comment or ping
  }

  let eventType = "message";
  const dataLines = [];

  lines.forEach((line) => {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  });

  if (eventType === "ping" || !dataLines.length) {
    return;
  }

  try {
    const payload = JSON.parse(dataLines.join("\n"));
    upsertChatter(payload);
  } catch (error) {
    console.error("Failed to parse event payload", error);
  }
}

function upsertChatter(payload) {
  if (!payload?.username) {
    return;
  }
  const usernameKey = payload.username.toLowerCase();
  const existing = state.counts.get(usernameKey) ?? {
    username: payload.username,
    role: payload.role,
    count: 0,
  };

  existing.count += 1;
  existing.role = payload.role ?? existing.role;

  state.counts.set(usernameKey, existing);
  renderLeaderboard();
}

connectBtn.addEventListener("click", connect);
resetBtn.addEventListener("click", () => {
  resetCounts();
  updateStatus("Counters reset", "neutral");
});
excludedInput.addEventListener("input", () => renderLeaderboard());

initRoleFilter();
renderLeaderboard();
