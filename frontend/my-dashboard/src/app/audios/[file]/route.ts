import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ToneConfig = {
  frequency: number;
  durationMs: number;
  fadeOut?: boolean;
};

const SAMPLE_RATE = 44100;
const AUDIO_VARIANTS: Record<string, ToneConfig> = {
  happy: { frequency: 880, durationMs: 600, fadeOut: true },
  sad: { frequency: 220, durationMs: 900, fadeOut: false },
};

const WAV_HEADER_SIZE = 44;

const createToneBuffer = ({ frequency, durationMs, fadeOut = false }: ToneConfig) => {
  const sampleCount = Math.max(1, Math.floor((SAMPLE_RATE * durationMs) / 1000));
  const dataSize = sampleCount * 2; // 16-bit mono
  const buffer = Buffer.alloc(WAV_HEADER_SIZE + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(WAV_HEADER_SIZE - 8 + dataSize, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); // PCM header size
  buffer.writeUInt16LE(1, 20); // audio format PCM
  buffer.writeUInt16LE(1, 22); // channels
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < sampleCount; i++) {
    const t = i / SAMPLE_RATE;
    const amplitudeEnvelope = fadeOut ? 1 - i / sampleCount : 1;
    const sample = Math.sin(2 * Math.PI * frequency * t) * amplitudeEnvelope;
    buffer.writeInt16LE(Math.round(sample * 0x7fff * 0.5), WAV_HEADER_SIZE + i * 2);
  }

  return buffer;
};

const buildResponse = (key: string) => {
  const config = AUDIO_VARIANTS[key];
  if (!config) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }
  const toneBuffer = createToneBuffer(config);
  return new NextResponse(toneBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
};

export const GET = (
  _req: Request,
  context: {
    params: { file: string };
  },
) => {
  const slug = context.params.file?.toLowerCase();
  if (!slug) {
    return NextResponse.json({ error: "Missing audio key" }, { status: 400 });
  }
  const key = slug.endsWith(".mp3") ? slug.replace(/\.mp3$/, "") : slug;
  return buildResponse(key);
};
