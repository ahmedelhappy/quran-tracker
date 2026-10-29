// What the two EDGES of a verse's recording sound like — the silence it opens with
// and the silence it ends with — measured by decoding just those edges.
//
// The verse handover in Library.jsx needs this per boundary. It may start the next
// verse early, so it is heard the moment this one runs out; how early it may go is
// capped by how much SILENCE this verse ends with (plus the exact zeros the next one
// opens with), so that even if the next verse started sounding instantly, it could only
// ever land on silence — never on the last letter of this one. The "tight" pause
// setting trims those same silences down, so it needs both edges too.
//
// The CDN that serves most reciters sends no CORS headers, so its files can't be
// decoded in the page. everyayah serves the same recordings — byte-identical MPEG
// frames, see quranApi.js — with `access-control-allow-origin: *`, so the edges are
// read from there (getAyahEdgeUrl). Three small requests per verse, about 28 KB: the
// first 12 KB (which also carries the encoder's tags), a HEAD for the size, and the
// last 16 KB. A measurement only counts if the length it implies matches what the
// <audio> element reports for its own file (matchesDuration): where the two copies are
// not the same encode, it is thrown away and the handover takes no liberties.
//
// Every result is in MEDIA milliseconds (divide by the playback rate for wall time),
// and every failure is null — callers treat an unknown edge as no silence at all.

import { getAyahEdgeUrl } from './quranApi';
import { fetchWithTimeout, HttpStatusError, isRequestFailure } from '../utils/fetchWithTimeout';

const HEAD_BYTES = 12 * 1024;
const TAIL_BYTES = 16 * 1024;
const WIN_S = 0.01;           // 10 ms analysis windows: room tone flickers at 5 ms
// Silence is room tone: within 15 dB of the quietest the edge gets, and never louder
// than -40 dBFS — 15 dB and more under every reciter's speech here. A recording with no
// quiet edge at all (some reciters' files run loud to the last sample) then measures
// as no silence, which is the safe answer. (A cap relative to the edge's own peak was
// tried and dropped: an edge that is ALL room tone — Husary's last second often is —
// has no speech to be relative to, and measured as no silence.)
const ABOVE_FLOOR_DB = 15;
const MAX_SILENCE_DB = -40;
const CACHE_MAX = 64;

const cache = new Map();   // `${reciter}:${ord}` → Promise<edges | null>

const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

// MPEG audio layer III frame header at b[o], or null.
function frameAt(b, o) {
  if (o + 4 > b.length || b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) return null;
  const ver = (b[o + 1] >> 3) & 3;
  const layer = (b[o + 1] >> 1) & 3;
  const bri = b[o + 2] >> 4;
  const sri = (b[o + 2] >> 2) & 3;
  if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) return null;
  const mono = (b[o + 3] >> 6) === 3;
  return {
    mpeg1: ver === 3,
    kbps: BITRATES[ver === 3 ? 1 : 2][bri],
    rate: RATES[ver][sri],
    spf: ver === 3 ? 1152 : 576,
    // where a Xing/Info header would sit inside this frame
    sideInfo: ver === 3 ? (mono ? 21 : 36) : (mono ? 13 : 21),
  };
}

// The encoder's facts from the first bytes: where the audio starts, its format, and
// the Xing/Info frame count and LAME delay/padding when present.
function readHead(b) {
  let o = 0;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {   // "ID3"
    o = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]) + ((b[5] & 0x10) ? 10 : 0);
  }
  let f = null;
  for (; o < b.length - 4; o += 1) if ((f = frameAt(b, o))) break;
  if (!f) return null;
  const x = o + f.sideInfo;
  const tag = String.fromCharCode(b[x], b[x + 1], b[x + 2], b[x + 3]);
  let frames = null;
  let padding = 0;
  if ((tag === 'Xing' || tag === 'Info') && (b[x + 7] & 1)) {
    // The count is of AUDIO frames — the Info frame itself is not in it.
    frames = ((b[x + 8] << 24) | (b[x + 9] << 16) | (b[x + 10] << 8) | b[x + 11]) >>> 0;
    const l = x + 120;
    if (String.fromCharCode(b[l], b[l + 1], b[l + 2], b[l + 3]) === 'LAME') {
      const delay = (b[l + 21] << 4) | (b[l + 22] >> 4);
      padding = ((b[l + 22] & 0x0f) << 8) | b[l + 23];
      // Chrome trims the encoder's delay and padding off a LAME file, so the length it
      // plays is the frames less both.
      return { audioStart: o, ...f, frames, delay, padding };
    }
    return { audioStart: o, ...f, frames, delay: 0, padding: 0 };
  }
  return { audioStart: o, ...f, frames: null, delay: 0, padding };
}

const db = (sumSq, n) => 10 * Math.log10(sumSq / n + 1e-20);

// Window levels (dBFS) of a decoded buffer, channels mixed.
function windows(buf, startSample = 0, endSample = buf.length) {
  const chs = [];
  for (let c = 0; c < buf.numberOfChannels; c += 1) chs.push(buf.getChannelData(c));
  const w = Math.max(1, Math.round(buf.sampleRate * WIN_S));
  const out = [];
  for (let i = startSample; i + w <= endSample; i += w) {
    let s = 0;
    for (let k = i; k < i + w; k += 1) {
      let v = 0;
      for (const ch of chs) v += ch[k];
      v /= chs.length;
      s += v * v;
    }
    out.push(db(s, w));
  }
  return out;
}

function silenceThreshold(levels) {
  const live = levels.filter((x) => x > -150).sort((a, b) => a - b);
  if (!live.length) return -Infinity;
  const floor = live[Math.floor(live.length * 0.05)];
  return Math.min(floor + ABOVE_FLOOR_DB, MAX_SILENCE_DB);
}

async function decode(bytes, rate) {
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Ctx) return null;
  // At the file's own rate, so no resampling smears the edge.
  return new Ctx(1, 1, rate).decodeAudioData(bytes);
}

async function getBytes(url, range) {
  return fetchWithTimeout(url, {
    headers: { Range: `bytes=${range}` },
    read: async (res) => {
      if (!res.ok) throw new HttpStatusError(url, res.status);
      return new Uint8Array(await res.arrayBuffer());
    },
  });
}

async function measure(url) {
  const head = await getBytes(url, `0-${HEAD_BYTES - 1}`);
  const info = readHead(head);
  if (!info) return null;
  let size = head.length;
  let tail = head;
  if (head.length >= HEAD_BYTES) {   // a file that fit in one request is already whole
    const res = await fetchWithTimeout(url, { method: 'HEAD' });
    // A refused HEAD (a 5xx while the CDN struggles) says nothing about the file:
    // thrown as a request failure, so the verse is not cached as unmeasurable.
    if (!res.ok) throw new HttpStatusError(url, res.status);
    size = Number(res.headers.get('content-length'));
    if (!(size > HEAD_BYTES)) return null;
    tail = await getBytes(url, `${Math.max(HEAD_BYTES, size - TAIL_BYTES)}-${size - 1}`);
  }
  const id3v1 = tail.length >= 128 && tail[tail.length - 128] === 0x54
    && tail[tail.length - 127] === 0x41 && tail[tail.length - 126] === 0x47;   // "TAG"
  // How long the element should think this file is. With a Xing/Info count that is
  // exact; otherwise it is the constant-bitrate estimate a browser makes from the size.
  const audioBytes = size - info.audioStart - (id3v1 ? 128 : 0);
  const durMs = info.frames != null
    ? ((info.frames * info.spf - info.delay - info.padding) / info.rate) * 1000
    : (audioBytes * 8) / info.kbps;

  // HEAD: exact digital zeros first (encoder delay), then silence up to the first sound.
  const hb = await decode(head.buffer.slice(0), info.rate);
  let zeros = 0;
  const h0 = hb.getChannelData(0);
  const h1 = hb.numberOfChannels > 1 ? hb.getChannelData(1) : h0;
  while (zeros < hb.length && h0[zeros] === 0 && h1[zeros] === 0) zeros += 1;
  const hl = windows(hb, zeros);
  const hThr = silenceThreshold(hl);
  let hq = 0;
  while (hq < hl.length && hl[hq] <= hThr) hq += 1;
  // A file that is silent for all of these bytes is measured only as far as they go.
  const headZerosMs = (zeros / hb.sampleRate) * 1000;
  const headSilenceMs = headZerosMs + hq * WIN_S * 1000;

  // TAIL: back from the end while it stays silent. Decoded on its own, the chunk keeps
  // a LAME file's end padding, which the element never plays — so that is cut first.
  let tailSilenceMs = 0;
  if (tail !== head) {
    const tb = await decode(tail.buffer.slice(0), info.rate);
    const end = Math.max(0, tb.length - info.padding);
    // The chunk starts mid-stream, so its first frames decode without their bit
    // reservoir — possibly as noise. They are left out of the statistics.
    const w = Math.round(tb.sampleRate * WIN_S);
    const skip = 3 * info.spf;
    const tl = windows(tb, end - Math.floor((end - Math.min(end, skip)) / w) * w, end);
    const tThr = silenceThreshold(tl);
    let tq = 0;
    while (tq < tl.length - 1 && tl[tl.length - 1 - tq] <= tThr) tq += 1;
    tailSilenceMs = tq * WIN_S * 1000;
  } else {
    const all = windows(hb, zeros);
    const thr = silenceThreshold(all);
    let tq = 0;
    while (tq < all.length - 1 && all[all.length - 1 - tq] <= thr) tq += 1;
    tailSilenceMs = tq * WIN_S * 1000;
  }
  return { durMs, headZerosMs, headSilenceMs, tailSilenceMs, rate: info.rate };
}

// The edges of one verse, cached. Resolves null when they can't be measured — no
// CORS-readable copy of this reciter's file, a network failure, an undecodable chunk.
export function verseEdges(reciterId, ord) {
  const key = `${reciterId}:${ord}`;
  if (cache.has(key)) return cache.get(key);
  const url = getAyahEdgeUrl(reciterId, ord);
  const p = url
    ? measure(url).catch((err) => {
      // A request that failed or timed out says nothing about the file, so it is
      // not remembered as "can't be measured": the verse is measured again the
      // next time it plays (M-14). A file that can't be decoded stays null.
      if (isRequestFailure(err) && cache.get(key) === p) cache.delete(key);
      return null;
    })
    : Promise.resolve(null);
  cache.set(key, p);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  p.then((v) => { p.value = v; });   // read synchronously once settled (peekVerseEdges)
  return p;
}

// The edges if they are already known, else undefined (still measuring) — the handover
// decides frame by frame and cannot wait on a promise.
export function peekVerseEdges(reciterId, ord) {
  return cache.get(`${reciterId}:${ord}`)?.value;
}

// Whether a measurement describes the file the element is actually playing: the
// lengths must agree to within an ID3v1 tag's worth (a browser's size-based estimate
// counts that tag; 128 bytes is 32 ms at the lowest bitrate here).
export const matchesDuration = (edges, elementSeconds) =>
  !!edges && Number.isFinite(elementSeconds)
  && Math.abs(edges.durMs - elementSeconds * 1000) <= 40;
