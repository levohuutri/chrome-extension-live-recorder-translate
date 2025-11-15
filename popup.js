async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id || null;
}

const lang = document.getElementById("lang");
const apikeys = document.getElementById("apikeys");
const conversationStyle = document.getElementById("conversationStyle");
const chunkTime = document.getElementById("chunkTime");
const noteTime = document.getElementById("noteTime");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const statusEl = document.getElementById("status");

chrome.storage.sync.get(
  ["language", "apiKeys", "conversationStyle", "chunkTime", "noteTime"],
  (res) => {
    if (res.language) lang.value = res.language;
    if (res.apiKeys) apikeys.value = res.apiKeys;
    if (res.conversationStyle) conversationStyle.value = res.conversationStyle;
    if (res.chunkTime) chunkTime.value = res.chunkTime;
    if (res.noteTime) noteTime.value = res.noteTime;
  }
);

lang.addEventListener("change", () => {
  chrome.storage.sync.set({ language: lang.value });
});

apikeys.addEventListener("change", () => {
  chrome.storage.sync.set({ apiKeys: apikeys.value });
});

conversationStyle.addEventListener("change", () => {
  chrome.storage.sync.set({ conversationStyle: conversationStyle.value });
});

chunkTime.addEventListener("change", () => {
  chrome.storage.sync.set({ chunkTime: chunkTime.value });
});

noteTime.addEventListener("change", () => {
  chrome.storage.sync.set({ noteTime: noteTime.value });
});

startBtn.addEventListener("click", async () => {
  const tabId = await getActiveTabId();
  const keysText = apikeys.value && apikeys.value.trim();
  if (!keysText) {
    statusEl.textContent = "Missing API key";
    return;
  }

  // Parse API keys (one per line)
  const keys = keysText
    .split("\n")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (keys.length === 0) {
    statusEl.textContent = "Missing API key";
    return;
  }

  if (!tabId) {
    statusEl.textContent = "No active tab";
    return;
  }
  statusEl.textContent = "Starting…";
  chrome.runtime.sendMessage({
    type: "popup-start",
    data: {
      tabId,
      language: lang.value,
      apiKeys: keys,
      conversationStyle: conversationStyle.value.trim(),
      chunkTime: parseInt(chunkTime.value),
      noteTime: parseInt(noteTime.value),
    },
  });
});

stopBtn.addEventListener("click", async () => {
  statusEl.textContent = "Stopped";
  chrome.runtime.sendMessage({ type: "popup-stop" });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "start-success") {
    statusEl.textContent = "Recording";
  }
  if (msg.type === "start-error") {
    statusEl.textContent = `Error: ${msg.error || "Cannot start"}`;
  }
  if (msg.type === "stopped") {
    statusEl.textContent = "Stopped";
  }
  if (msg.type === "status-update") {
    statusEl.textContent = msg.text;
  }
});
