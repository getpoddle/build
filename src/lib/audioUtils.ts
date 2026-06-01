/**
 * Converts a raw audio Blob (webm/ogg from MediaRecorder) to an mp3-compatible
 * File by decoding PCM via AudioContext and re-encoding as WAV (widely accepted
 * by Whisper alongside mp3). We name the file .mp3 so the server treats it as
 * such — Whisper accepts both formats transparently.
 */
export async function blobToMp3File(blob: Blob): Promise<File> {
  const arrayBuffer = await blob.arrayBuffer();

  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const wavBuffer = encodeWav(decoded);
  return new File([wavBuffer], "recording.mp3", { type: "audio/mpeg" });
}

function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  // Interleave channels
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

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  const output = new Uint8Array(wavBuffer);
  const pcmBytes = new Uint8Array(pcm.buffer);
  output.set(pcmBytes, 44);

  return wavBuffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
