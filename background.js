import { encodeWav16kMono } from "./wav.js";

const STATE = {
  activeTabId: null,
  streamId: null,
  capturing: false,
  language: "en",
  apiKeys: [], // Array of API keys
  currentKeyIndex: 0, // Round-robin index
  chunkQueue: [],
  processing: false,
  captionBuffer: [], // Store captions for summary
  summaryInterval: null,
  summaries: [], // Store all summaries
  chunkTime: 10, // Default 10 seconds
  noteTime: 30, // Default 30 seconds
  startTime: null, // Track recording start time
  conversationStyle: "", // Custom conversation style instructions
};

// Get next API key using round-robin
function getNextApiKey() {
  if (STATE.apiKeys.length === 0) return null;
  const key = STATE.apiKeys[STATE.currentKeyIndex];
  STATE.currentKeyIndex = (STATE.currentKeyIndex + 1) % STATE.apiKeys.length;
  return key;
}

function getCapturedTabs() {
  return new Promise((resolve) => {
    if (!chrome.tabCapture || !chrome.tabCapture.getCapturedTabs) {
      resolve([]);
      return;
    }
    chrome.tabCapture.getCapturedTabs((tabs) => resolve(tabs || []));
  });
}

async function isTabCaptured(tabId) {
  const tabs = await getCapturedTabs();
  return tabs.some((t) => t.tabId === tabId && t.status === "active");
}

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({});
  const has = contexts.find((c) => c.contextType === "OFFSCREEN_DOCUMENT");
  if (has) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Audio capture and processing",
  });
}

async function startCapture(tabId) {
  try {
    if (STATE.capturing) {
      chrome.runtime.sendMessage({
        type: "start-error",
        error: "Already recording",
      });
      return;
    }
    if (await isTabCaptured(tabId)) {
      chrome.runtime.sendMessage({
        type: "start-error",
        error: "Tab already has an active capture",
      });
      return;
    }
    STATE.activeTabId = tabId;
    await ensureOffscreen();

    // Inject content script dynamically (only when needed)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ["styles.css"],
      });
    } catch (err) {
      // Content script might already be injected or tab doesn't allow injection
      console.log("Content script injection:", err.message);
    }

    const id = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    STATE.streamId = id;
    STATE.capturing = true;
    STATE.startTime = Date.now(); // Record start time

    // Clear ALL previous data - start fresh
    STATE.chunkQueue = [];
    STATE.captionBuffer = [];
    STATE.summaries = [];
    STATE.processing = false;
    STATE.currentKeyIndex = 0;

    console.log("Starting fresh - all old data cleared");

    startSummaryTimer();

    // Show caption overlay and notes panel immediately
    chrome.tabs.sendMessage(tabId, { type: "show-ui" }, () => {
      if (chrome.runtime.lastError) {
        console.log("Could not show UI:", chrome.runtime.lastError.message);
      }
    });

    chrome.runtime.sendMessage({
      type: "start-recording",
      target: "offscreen",
      data: { streamId: id, chunkTime: STATE.chunkTime },
    });
    chrome.runtime.sendMessage({ type: "start-success" });
  } catch (e) {
    STATE.capturing = false;
    STATE.streamId = null;
    chrome.runtime.sendMessage({
      type: "start-error",
      error: e && e.message ? e.message : String(e),
    });
  }
}

function stopCapture() {
  chrome.runtime.sendMessage({ type: "stop-recording", target: "offscreen" });

  // Stop summary timer and generate final summary
  stopSummaryTimer();

  // Hide captions on the active tab
  if (STATE.activeTabId) {
    chrome.tabs.sendMessage(
      STATE.activeTabId,
      { type: "hide-captions" },
      () => {
        // Ignore errors if tab is closed or can't receive messages
        if (chrome.runtime.lastError) {
          console.log(
            "Could not hide captions:",
            chrome.runtime.lastError.message
          );
        }
      }
    );
  }

  STATE.capturing = false;
  STATE.streamId = null;

  // Clear all memory and queues
  STATE.chunkQueue = [];
  STATE.captionBuffer = [];
  STATE.summaries = [];
  STATE.processing = false;
  STATE.startTime = null;
  STATE.currentKeyIndex = 0;

  console.log("All memory cleared on stop");
}

async function processQueue() {
  if (STATE.processing) return;
  STATE.processing = true;
  while (STATE.chunkQueue.length && STATE.capturing) {
    // Only process if still capturing
    const item = STATE.chunkQueue.shift();
    console.log(
      "Processing chunk, samples:",
      item.samples,
      "byteLength:",
      item.samples?.byteLength
    );
    const wav = encodeWav16kMono(item.samples);
    console.log("WAV encoded, size:", wav.byteLength);

    // Convert to base64 in chunks to avoid stack overflow
    const uint8Array = new Uint8Array(wav);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(
        i,
        Math.min(i + chunkSize, uint8Array.length)
      );
      binary += String.fromCharCode.apply(null, chunk);
    }
    const b64 = btoa(binary);

    console.log("Base64 (first 100 chars):", b64.substring(0, 100));
    const result = await transcribeChunk(b64);

    if (result && result.original && result.original.trim()) {
      // Calculate latency: time from when audio was captured to now
      const now = Date.now();
      const latencySeconds = item.captureTime
        ? Math.round((now - item.captureTime) / 1000)
        : 0;

      // Get current timestamp
      const timestamp = new Date().toLocaleTimeString();

      // Add to caption buffer for summary (without timestamp for cleaner summary)
      STATE.captionBuffer.push({
        timestamp: timestamp,
        original: result.original,
        translated: result.translated || result.original,
      });

      // Send original transcription with timestamp and latency
      chrome.tabs.sendMessage(
        STATE.activeTabId,
        {
          type: "caption-original",
          text: result.original,
          timestamp: timestamp,
          latency: latencySeconds,
        },
        () => {
          if (chrome.runtime.lastError) {
            chrome.runtime.sendMessage({
              type: "status-update",
              text: "Cannot display captions on this page",
            });
          }
        }
      );

      // Send translated text (from same response)
      if (result.translated && result.translated.trim()) {
        chrome.tabs.sendMessage(
          STATE.activeTabId,
          {
            type: "caption-translated",
            text: result.translated,
            timestamp: timestamp,
          },
          () => {
            if (chrome.runtime.lastError) {
              chrome.runtime.sendMessage({
                type: "status-update",
                text: "Cannot display captions on this page",
              });
            }
          }
        );
      }
    }
  }
  STATE.processing = false;
}

async function transcribeChunk(b64) {
  const apiKey = getNextApiKey();
  if (!apiKey) {
    console.error("No API key available");
    return null;
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" +
    apiKey;

  // Request both transcription and translation in one call
  const prompt =
    STATE.language === "en"
      ? `Transcribe the following audio. If there is no clear speech or the audio is silent/unclear, return an empty response. Otherwise, return only the transcribed text without any timestamps or time markers. Do NOT make up or guess content.${
          STATE.conversationStyle
            ? "\n\nConversation style: " + STATE.conversationStyle
            : ""
        }`
      : `Transcribe the following audio and translate it to ${
          STATE.language
        }. If there is no clear speech or the audio is silent/unclear, return an empty response. Otherwise, do NOT include any timestamps or time markers in the output. Return the response in this exact format:
ORIGINAL: [transcribed text without timestamps]
TRANSLATED: [translated text without timestamps]
Do NOT make up or guess content if the audio is unclear.${
          STATE.conversationStyle
            ? "\n\nConversation style for translation: " +
              STATE.conversationStyle
            : ""
        }`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "audio/wav", data: b64 } },
        ],
      },
    ],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const c = json.candidates && json.candidates[0];
  if (!c) return null;
  const p = c.content && c.content.parts && c.content.parts[0];
  const text = p && p.text ? p.text : "";

  // Parse the response
  if (STATE.language === "en") {
    return { original: text, translated: text };
  } else {
    const originalMatch = text.match(/ORIGINAL:\s*(.+?)(?=\nTRANSLATED:|$)/s);
    const translatedMatch = text.match(/TRANSLATED:\s*(.+)/s);
    return {
      original: originalMatch ? originalMatch[1].trim() : text,
      translated: translatedMatch ? translatedMatch[1].trim() : text,
    };
  }
}

async function translateText(text, lang) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" +
    STATE.apiKey;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Translate the following into " +
              lang +
              ". Return only translated text.",
          },
          { text: text },
        ],
      },
    ],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return "";
  const json = await res.json();
  const c = json.candidates && json.candidates[0];
  if (!c) return "";
  const p = c.content && c.content.parts && c.content.parts[0];
  return p && p.text ? p.text : "";
}

async function generateSummary() {
  if (STATE.captionBuffer.length === 0) return;

  const apiKey = getNextApiKey();
  if (!apiKey) {
    console.error("No API key available for summary");
    return;
  }

  // Combine all captions from buffer WITHOUT timestamps (cleaner summary)
  const combinedText = STATE.captionBuffer
    .map((item) => (STATE.language === "en" ? item.original : item.translated))
    .join(" ");

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" +
    apiKey;

  // Create language-specific prompt with both summary and full transcript request
  const languageInstruction =
    STATE.language === "en"
      ? `Process the following transcribed audio and provide TWO sections:

1. SUMMARY: Summarize the main points. Start directly with the summary content, no introductory phrases.
2. FULL TRANSCRIPT: Rewrite all the captions clearly and coherently.

Format your response exactly as:
SUMMARY:
[your summary here]

FULL TRANSCRIPT:
[complete rewritten transcript here]${
          STATE.conversationStyle
            ? "\n\nConversation style: " + STATE.conversationStyle
            : ""
        }`
      : `Xử lý đoạn audio sau và cung cấp HAI phần:

1. TÓM TẮT: Tóm tắt nội dung chính. Bắt đầu trực tiếp với nội dung tóm tắt, không thêm câu giới thiệu.
2. NỘI DUNG ĐẦY ĐỦ: Viết lại toàn bộ các caption một cách rõ ràng và mạch lạc.

Định dạng trả về chính xác như sau:
TÓM TẮT:
[tóm tắt của bạn]

NỘI DUNG ĐẦY ĐỦ:
[nội dung đầy đủ đã viết lại]${
          STATE.conversationStyle
            ? "\n\nPhong cách hội thoại: " + STATE.conversationStyle
            : ""
        }`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${languageInstruction}\n\n${combinedText}`,
          },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) return;
  const json = await res.json();
  const c = json.candidates && json.candidates[0];
  if (!c) return;
  const p = c.content && c.content.parts && c.content.parts[0];
  const responseText = p && p.text ? p.text : "";

  if (responseText.trim()) {
    // Parse the response to extract summary and full transcript
    let summary = "";
    let fullTranscript = "";

    const summaryMarker = STATE.language === "en" ? "SUMMARY:" : "TÓM TẮT:";
    const transcriptMarker =
      STATE.language === "en" ? "FULL TRANSCRIPT:" : "NỘI DUNG ĐẦY ĐỦ:";

    const summaryIndex = responseText.indexOf(summaryMarker);
    const transcriptIndex = responseText.indexOf(transcriptMarker);

    if (summaryIndex !== -1 && transcriptIndex !== -1) {
      summary = responseText
        .substring(summaryIndex + summaryMarker.length, transcriptIndex)
        .trim();
      fullTranscript = responseText
        .substring(transcriptIndex + transcriptMarker.length)
        .trim();
    } else {
      // Fallback: use entire response as summary if format not found
      summary = responseText.trim();
      fullTranscript = combinedText;
    }

    const summaryObj = {
      timestamp: new Date().toLocaleTimeString(),
      summary: summary,
      fullTranscript: fullTranscript,
      itemCount: STATE.captionBuffer.length,
    };

    STATE.summaries.push(summaryObj);

    // Send summary to content script
    chrome.tabs.sendMessage(STATE.activeTabId, {
      type: "add-summary",
      summary: summaryObj,
    });

    console.log("Generated summary:", summaryObj);
  }

  // Clear buffer for next 30s
  STATE.captionBuffer = [];
}

function startSummaryTimer() {
  // Clear existing timer if any
  if (STATE.summaryInterval) {
    clearInterval(STATE.summaryInterval);
  }

  // Generate summary based on configured noteTime
  STATE.summaryInterval = setInterval(() => {
    if (STATE.capturing) {
      generateSummary();
    }
  }, STATE.noteTime * 1000); // Convert seconds to milliseconds
}

function stopSummaryTimer() {
  if (STATE.summaryInterval) {
    clearInterval(STATE.summaryInterval);
    STATE.summaryInterval = null;
  }
  // Generate final summary for any remaining captions
  if (STATE.captionBuffer.length > 0) {
    generateSummary();
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "audio-chunk" && STATE.capturing) {
    console.log(
      "Received audio chunk array, length:",
      msg.data?.length,
      "type:",
      Array.isArray(msg.data)
    );
    // Convert array back to Int16Array/ArrayBuffer
    const int16Array = new Int16Array(msg.data);
    console.log(
      "Converted to Int16Array, byteLength:",
      int16Array.buffer.byteLength
    );
    // Store with timestamp when audio chunk was captured
    STATE.chunkQueue.push({
      samples: int16Array.buffer,
      captureTime: Date.now(),
    });
    processQueue();
  }
  if (msg.type === "popup-start") {
    STATE.language = msg.data.language;
    STATE.apiKeys = msg.data.apiKeys || [];
    STATE.currentKeyIndex = 0; // Reset round-robin index
    STATE.conversationStyle = msg.data.conversationStyle || "";
    STATE.chunkTime = msg.data.chunkTime || 10;
    STATE.noteTime = msg.data.noteTime || 30;

    if (STATE.apiKeys.length === 0) {
      chrome.runtime.sendMessage({
        type: "start-error",
        error: "Missing API key",
      });
      return;
    }
    if (!msg.data.tabId) {
      chrome.runtime.sendMessage({
        type: "start-error",
        error: "No active tab",
      });
      return;
    }
    if (STATE.capturing) {
      chrome.runtime.sendMessage({
        type: "start-error",
        error: "Already recording",
      });
      return;
    }
    startCapture(msg.data.tabId);
  }
  if (msg.type === "popup-stop") {
    stopCapture();
    chrome.runtime.sendMessage({ type: "stopped" });
  }
  if (msg.type === "update-language") {
    STATE.language = msg.data.language;
  }
});
