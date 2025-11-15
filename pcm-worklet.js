class PCMWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Int16Array(16000 * 20); // Buffer for max 20 seconds
    this.offset = 0;
    this.chunkSize = 16000 * 10; // Default 10 seconds

    // Listen for messages from main thread
    this.port.onmessage = (e) => {
      if (e.data.type === "set-chunk-time") {
        this.chunkSize = 16000 * e.data.chunkTime;
        console.log(
          "Worklet chunk size updated to:",
          e.data.chunkTime,
          "seconds"
        );
      }
    };
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      const v = s < 0 ? s * 32768 : s * 32767;
      if (this.offset < this.buf.length) {
        this.buf[this.offset++] = Math.round(v); // Round to ensure integer value
      }
      // Send chunk when we reach chunkSize OR buffer is full
      if (this.offset >= this.chunkSize) {
        // Create a proper copy of just the data we need
        const chunk = new Int16Array(this.offset);
        chunk.set(this.buf.subarray(0, this.offset));
        console.log(
          "Worklet sending chunk, offset:",
          this.offset,
          "buffer byteLength:",
          chunk.buffer.byteLength
        );
        this.port.postMessage(chunk.buffer);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-worklet", PCMWorkletProcessor);
