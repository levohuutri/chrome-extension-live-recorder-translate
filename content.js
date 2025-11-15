let container;
let originalEl;
let translatedEl;
let timestampEl;
let notesPanel;
let notesList;
let notesButton;
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

function makeDraggable(element) {
  element.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  // Add cursor style
  element.style.cursor = "move";
}

function dragStart(e) {
  if (e.target === container || container.contains(e.target)) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
  }
}

function drag(e) {
  if (isDragging) {
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
    xOffset = currentX;
    yOffset = currentY;

    // Remove default positioning and use translate
    container.style.left = "auto";
    container.style.bottom = "auto";
    container.style.transform = `translate(${currentX}px, ${currentY}px)`;
  }
}

function dragEnd(e) {
  initialX = currentX;
  initialY = currentY;
  isDragging = false;
}

function ensureContainer() {
  if (container) return;
  container = document.createElement("div");
  container.id = "gemini-live-captions";
  container.className = "gemini-captions";

  timestampEl = document.createElement("div");
  timestampEl.className = "gemini-timestamp";

  originalEl = document.createElement("div");
  translatedEl = document.createElement("div");
  originalEl.className = "gemini-original";
  translatedEl.className = "gemini-translated";

  container.appendChild(timestampEl);
  container.appendChild(originalEl);
  container.appendChild(translatedEl);
  (document.body || document.documentElement).appendChild(container);

  // Make it draggable
  makeDraggable(container);
}

function ensureNotesPanel() {
  if (notesPanel) return;

  // Create notes button (toggle button)
  notesButton = document.createElement("button");
  notesButton.id = "gemini-notes-button";
  notesButton.className = "gemini-notes-btn";
  notesButton.textContent = "📝 Notes";
  notesButton.onclick = toggleNotesPanel;
  (document.body || document.documentElement).appendChild(notesButton);

  // Create notes panel
  notesPanel = document.createElement("div");
  notesPanel.id = "gemini-notes-panel";
  notesPanel.className = "gemini-notes-panel";
  notesPanel.style.display = "none";

  const header = document.createElement("div");
  header.className = "gemini-notes-header";
  header.innerHTML = `
    <span>📝 Summary Notes</span>
    <button class="gemini-notes-close">✕</button>
  `;

  notesList = document.createElement("div");
  notesList.className = "gemini-notes-list";
  notesList.innerHTML =
    "<div class='gemini-notes-empty'>No summaries yet. Summaries are generated every 30 seconds.</div>";

  notesPanel.appendChild(header);
  notesPanel.appendChild(notesList);
  (document.body || document.documentElement).appendChild(notesPanel);

  // Close button handler
  header.querySelector(".gemini-notes-close").onclick = () => {
    notesPanel.style.display = "none";
  };

  // Make notes panel draggable
  makeDraggable(notesPanel);
}

function toggleNotesPanel() {
  ensureNotesPanel();
  notesPanel.style.display =
    notesPanel.style.display === "none" ? "block" : "none";
}

function addSummaryToNotes(summaryObj) {
  ensureNotesPanel();

  // Remove empty message if exists
  const emptyMsg = notesList.querySelector(".gemini-notes-empty");
  if (emptyMsg) {
    emptyMsg.remove();
  }

  // Create summary item with both summary and full transcript
  const item = document.createElement("div");
  item.className = "gemini-note-item";

  const summarySection = summaryObj.summary
    ? `<div class="gemini-note-content"><strong>Summary:</strong><br>${summaryObj.summary}</div>`
    : "";

  const transcriptSection = summaryObj.fullTranscript
    ? `<div class="gemini-note-transcript"><strong>Full Transcript:</strong><br>${summaryObj.fullTranscript}</div>`
    : "";

  item.innerHTML = `
    <div class="gemini-note-time">${summaryObj.timestamp} (${summaryObj.itemCount} captions)</div>
    ${summarySection}
    ${transcriptSection}
  `;

  // Add to top of list
  notesList.insertBefore(item, notesList.firstChild);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "caption-original") {
    ensureContainer();
    container.style.display = "block";
    if (msg.timestamp) {
      // Display timestamp with latency
      const latencyText = msg.latency !== undefined ? ` +${msg.latency}s` : "";
      timestampEl.textContent = `[${msg.timestamp}${latencyText}]`;
    }
    originalEl.textContent = msg.text;
  }
  if (msg.type === "caption-translated") {
    ensureContainer();
    translatedEl.textContent = msg.text;
  }
  if (msg.type === "hide-captions") {
    if (container) {
      container.style.display = "none";
    }
    if (notesButton) {
      notesButton.style.display = "none";
    }
    if (notesPanel) {
      notesPanel.style.display = "none";
    }
  }
  if (msg.type === "show-ui") {
    // Show caption overlay immediately
    ensureContainer();
    container.style.display = "block";
    timestampEl.textContent = "[Waiting for audio...]";
    originalEl.textContent = "Recording started...";
    translatedEl.textContent = "";

    // Show notes panel and button immediately, clear old notes
    ensureNotesPanel();
    notesList.innerHTML =
      "<div class='gemini-notes-empty'>No summaries yet. Summaries are generated every 30 seconds.</div>";
    notesButton.style.display = "block";
  }
  if (msg.type === "add-summary") {
    addSummaryToNotes(msg.summary);
    // Ensure notes panel is available
    ensureNotesPanel();
    notesButton.style.display = "block";
  }
});
