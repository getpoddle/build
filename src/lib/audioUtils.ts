/**
 * Converts a raw audio Blob (webm/ogg from MediaRecorder) into a File named
 * "recording.mp3" that Whisper accepts. We decode to PCM via AudioContext and
 * re-encode as WAV — a lossless container Whisper handles without any native
 * codec dependency in the browser.
 *
 * If AudioContext decoding fails (e.g. unsupported codec in a sandboxed env),
 * the original blob is returned as-is so Whisper can still attempt transcription.
 */
export async function blobToMp3File(blob: Blob): Promise<File> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();

    let decoded: AudioBuffer;
    try {
      decoded = await audioCtx.decodeAudioData(arrayBuffer);
    } finally {
      audioCtx.close();
    }

    const wavBuffer = encodeWav(decoded);
    return new File([wavBuffer], 'recording.wav', { type: 'audio/wav' });
  } catch {
    // Fallback: pass original blob directly — Whisper can handle webm/ogg too
    const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
    return new File([blob], `recording.${ext}`, { type: blob.type || 'audio/webm' });
  }
}

function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = Math.min(buffer.numberOfChannels, 2); // max stereo
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;

  const length = buffer.length * numChannels;
  const pcm = new Int16Array(length);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      pcm[i * numChannels + ch] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
  }

  const dataBytes = pcm.length * 2;
  const wavBuffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(wavBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  new Uint8Array(wavBuffer).set(new Uint8Array(pcm.buffer), 44);
  return wavBuffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
