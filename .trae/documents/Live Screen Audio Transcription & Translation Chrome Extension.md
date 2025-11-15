## Overview
Build a Chrome Extension that captures the current tab’s audio, streams it to Gemini Live 2.5 Flash (native audio), receives real-time transcripts, translates to a user-selected language (en, jp, vi), and overlays original + translated captions on the page.

## Key Change
Use the Gemini Live WebSocket API (`live.connect`) with model `gemini-live-2.5-flash-native-audio-preview-09-2025` for real-time speech-to-text. Keep translation in the same live session by sending text turns based on the incoming transcripts.

## Architecture
1. Manifest V3 extension
2. Background service worker: opens Live session, coordinates capture, translation, and messaging
3. Offscreen document: long-lived audio processing, resampling to 16 kHz mono PCM, streaming frames
4. Content script: caption overlay UI
5. Popup UI: start/stop, language selection; settings persisted in `chrome.storage`

## Permissions
- `tabCapture`, `activeTab`, `scripting`, `offscreen`, `storage`
- `host_permissions`: `wss://*` (WebSocket) and `https://generativelanguage.googleapis.com/*`

## Data Flow
1. User starts capture in popup → background calls `chrome.tabCapture.capture({audio: true})`
2. Background ensures offscreen document exists and passes `MediaStream`
3. Offscreen document converts to 16-bit PCM, 16 kHz, mono; streams small frames to background
4. Background holds a single Gemini Live session via `@google/genai` → `ai.live.connect({ model, config })`
   - `inputAudioTranscription: {}` enabled to receive `serverContent.inputTranscription`
5. For each transcript update (partial/final):
   - Send it to content script (original caption)
   - Post a text turn to the same session: "Translate to <lang>; return only translated text" → receive text → send to content script (translated caption)

## Implementation Steps
1. Scaffold MV3 files: `manifest.json`, `background.js`, `content.js`, `popup.html/js`, `offscreen.html/js`, `styles.css`
2. Audio capture: `chrome.tabCapture` from active tab with user gesture
3. Offscreen audio pipeline:
   - `AudioWorklet` for resampling to 16 kHz mono PCM
   - Frame sizing ~20–40 ms; batch into ~200–400 ms chunks for `session.sendRealtimeInput`
4. Live session setup:
   - Model: `gemini-live-2.5-flash-native-audio-preview-09-2025`
   - `responseModalities: [AUDIO]` optional; transcription enabled via `inputAudioTranscription: {}`
   - `systemInstruction`: concise, friendly assistant; we’ll keep responses minimal
5. Streaming:
   - Continuously `session.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } })`
   - Handle `for await (const response of session.receive())` for transcription events
6. Translation within session:
   - On transcript event, call `session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: 'Translate to <lang>: <transcript>' }]] } })`
   - Parse returned text → update overlay
7. UI Overlay:
   - Two-line display: original + translated
   - Position toggle (top/bottom), font size, translucency
8. Popup UI:
   - Start/Stop
   - Language dropdown: English (`en`), Japanese (`ja` shown as JP), Vietnamese (`vi`)
   - Persist via `chrome.storage.sync`
9. Messaging & lifecycle:
   - Robust message channels between background, offscreen, and content
   - Graceful stop: close Live session, release streams
10. Error handling & performance:
   - Reconnect logic for WebSocket
   - Backpressure: skip translation if too many pending
   - Auto-hide on silence; VAD optional later

## Gemini Integration Details
- Package: `@google/genai` (browser-capable via ESM; bundle for MV3)
- Model: `gemini-live-2.5-flash-native-audio-preview-09-2025`
- Audio format: `audio/pcm;rate=16000` (16-bit PCM, mono)
- Translation prompts are issued as text turns inside the same session
- If SDK/browser constraints arise, fallback to HTTP `generateContent` with chunked audio; translation as second request

## Security & Privacy
- Prefer a backend proxy for API key; otherwise store locally and warn users
- Do not persist audio; stream-only processing
- Visual indicator when capture is active

## Limitations & Considerations
- Tab audio capture (not full system audio). For full system/screen audio, consider `desktopCapture` or `getDisplayMedia` with audio in a follow-up
- Latency depends on network + model; target < 1s for transcript, < 2s including translation

## Testing & Validation
- Test with YouTube/video sites; verify partial and final transcripts
- Measure end-to-end latency; tune frame size
- Simulate disconnects/reconnects; ensure captions recover

## Deliverables
- MV3 extension with live transcription via Gemini Live and live translation
- Popup controls and persisted settings
- Overlay captions showing original + translated in real time