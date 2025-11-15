let stream;
let audioCtx;
let playbackCtx;
let workletReady = false;
let port;

async function setupAudio(streamId, chunkTime = 10) {
  try {
    const media = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
      },
    });
    stream = media;

    // Create AudioContext for processing at 16kHz (for Gemini)
    audioCtx = new AudioContext({ sampleRate: 16000 });
    await audioCtx.audioWorklet.addModule(
      chrome.runtime.getURL("pcm-worklet.js")
    );
    const src = audioCtx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(audioCtx, "pcm-worklet");

    // Send chunkTime to worklet
    node.port.postMessage({ type: "set-chunk-time", chunkTime: chunkTime });

    node.port.onmessage = (e) => {
      console.log(
        "Offscreen received from worklet:",
        e.data,
        "byteLength:",
        e.data?.byteLength
      );
      // Convert ArrayBuffer to Array for message passing
      const int16Array = new Int16Array(e.data);
      const dataArray = Array.from(int16Array);
      console.log("Converted to array, length:", dataArray.length);
      chrome.runtime.sendMessage({ type: "audio-chunk", data: dataArray });
    };
    src.connect(node);

    // Create separate AudioContext for playback at native sample rate (48kHz)
    playbackCtx = new AudioContext();
    const playbackSrc = playbackCtx.createMediaStreamSource(stream);
    playbackSrc.connect(playbackCtx.destination);
  } catch (e) {
    chrome.runtime.sendMessage({
      type: "start-error",
      error: e && e.message ? e.message : String(e),
    });
  }
}

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "start-recording") {
    await setupAudio(msg.data.streamId, msg.data.chunkTime);
  }
  if (msg.type === "stop-recording") {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    if (playbackCtx) {
      playbackCtx.close();
      playbackCtx = null;
    }
  }
});
