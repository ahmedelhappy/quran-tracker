import { keyOfOrd } from '../utils/verseIndex';
import { fetchJSON } from '../utils/fetchWithTimeout';

const ALQURAN_API = 'https://api.alquran.cloud/v1';
const AUDIO_CDN = 'https://cdn.islamic.network/quran/audio';
const FALLBACK_AUDIO_BASE = 'https://everyayah.com/data';
const TAFSIR_CDN = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir';
// hefzmoyaser's backend. Verified browser-callable: it answers with
// `access-control-allow-origin: *` and a 204 preflight allowing GET. Two things
// it insists on: `riwaya` must be the INTEGER 1 (hafs), and without an explicit
// `Accept: application/json` a validation failure comes back as a 302 redirect to
// an HTML page instead of a 422. It rate-limits at 180 requests/minute
// (`x-ratelimit-limit`), which one request per verse read stays far below.
const HEFZ_API = 'https://newapi.hefzmoyaser.net/api';
const HEFZ_RIWAYA_HAFS = 1;

// ── Reciters ──────────────────────────────────────────────────────────
// Two sources, both verse-by-verse MP3s that an <audio> element plays cross-origin:
//   cdn.islamic.network — alquran.cloud's audio CDN, addressed by edition id and the
//     GLOBAL ayah number: {AUDIO_CDN}/{cdn}/{id}/{n}.mp3. `cdn` is the bitrate PATH
//     SEGMENT the files really live under — it is not the same for every reciter
//     (ar.abdulbasitmurattal 403s under /128/ but serves /64/ and /192/), and it is
//     not always the real bitrate either (Ayyoub's, Jibreel's "128" hold 64 kbps).
//   everyayah.com — addressed by folder and zero-padded surah+ayah ("086013").
//     Behind BunnyCDN with a ~300-day max-age, so the warm-up's repeat touches are
//     cache reads here.
//
// How an entry plays:
//   cdn set              → primary is the CDN. `everyayah` (if set) is the FALLBACK,
//                          used only once the primary has spent its retry budget on
//                          the verse being waited on (failBuf in Library.jsx).
//   cdn null             → primary is everyayah; there is no second source.
// So `everyayah` beside a `cdn` is a claim: SAME qari, SAME style, SAME recording
// and encode. Every such pair below was proven, not assumed — on 1:1, 2:255,
// 2:282, 18:1, 36:1, 55:1, 112:1, 114:6, global 5944/5953/5954 and 20 random
// ayahs, the MPEG audio frames (ID3 tags stripped) are BYTE-IDENTICAL on both
// sources (2026-10-13; 2026-09-22 for the first five). One noted exception: Maher's
// 1:1 is a different file on everyayah (0.2s longer); the other 30 match.
// Where no byte-identical folder exists, `everyayah` is null rather than "close
// enough" — the fallback must sound like the primary:
//   - Husary Mujawwad: everyayah's copy is identical except its LONG ayahs (2:255,
//     2:282), which are a different performance, 10–24s longer at 40 kbps.
//   - Shuraym: everyayah has the same recording but a different encode, and a
//     different 1:1 entirely.
//
// Also verified per entry: every sampled file 200 with an audio/* content type and
// a sane duration; and all 6236 ayahs reachable — every everyayah folder used here
// lists all of them in its MD5 manifest (or, where it publishes none: Ghamadi,
// Basfar 192, Hudhaify 128, Sowaid 64, answered a HEAD for every ayah), and the two
// CDN-only entries (Shuraym, Husary Mujawwad) answered a HEAD for every ayah too.
// That sweep is why Husary Mujawwad plays from /64/: under /128/ the CDN answers
// 416 for 45:25–45:32, a hole recitation would die in; /64/ is the same recording
// (all 31 sampled ayahs within 0.1s of /128/ — encoder delay, not a different
// take), 64 kbps / 22.05 kHz, and answers 200 for every ayah. One known quirk on
// BOTH paths: 43:69 comes back as application/octet-stream — the bytes are a
// valid MP3 and Chrome's <audio> sniffs and plays it (21.9s); not yet checked in
// Safari.
//
// `style` — murattal | mujawwad | muallim. A qari recorded in two styles is two
//   entries; they are never merged. Tempo over the same 31-ayah sample backs the
//   labels: murattal 375–917s, Husary's muallim 1116s, mujawwad 1211–1342s.
// `riwaya` — 'hafs' for every entry: the mushaf rendered here is the Madinah mushaf
//   in Hafs. Both sources label non-Hafs recordings explicitly (everyayah keeps
//   Warsh under warsh/, alquran.cloud names Qaloon in the title); none is listed.
// `kbps` — what the primary's frames really carry, measured, not read off a path.
// `aka` — other Latin spellings people search by.
//
// Rejected after checking (so they aren't re-tried blind):
//   - ar.minshawimujawwad (CDN): MISLABELLED — its files are byte-identical to
//     Minshawi's MURATTAL. The real mujawwad is everyayah-only (ea.minshawimujawwad).
//   - ar.ahmedajamy / ar.abdulsamad on the CDN: served as application/octet-stream
//     (one even application/x-dosexec). Ajamy plays from everyayah's byte-identical
//     ketaballah folder instead; AbdulSamad (QuranExplorer) is dropped — not the
//     Abdul Basit mujawwad recording, and nothing establishes its style.
//   - The "-2" editions (ar.alafasy-2 …): duplicates of the same recordings.
//   - everyayah Mustafa_Ismail_48kbps (4220 files missing), Menshawi_32kbps (303
//     missing), Ibrahim_Akhdar_64kbps (empty), khalefa_al_tunaiji_64kbps (its
//     001001.mp3 is byte-identical to Minshawi's — a wrong-qari file),
//     Parhizgar_48kbps (some files 18 kbps / 11 kHz), the second Ajamy folder (a
//     different recording under the same name).
//   - alquran.cloud's surah-by-surah editions: whole-surah files, which a verse
//     player cannot address.
//   - quran.com's recitation audio (2026-09-22): fewer of these reciters, lower
//     bitrates, and an API call per verse just to learn the file's address.
// Ids are stable — the reader's choice is saved under them. The five original
// ids are unchanged; an id this list no longer knows falls back to the default.
export const RECITERS = [
  // ── Murattal ──
  { id: 'ar.alafasy',             nameEn: 'Mishary Rashid Al-Afasy',     nameAr: 'مشاري راشد العفاسي',        style: 'murattal', riwaya: 'hafs', cdn: '128', everyayah: 'Alafasy_128kbps',                         kbps: 128, aka: 'Alafasy Afasi Mishari' },
  { id: 'ar.husary',              nameEn: 'Mahmoud Khalil Al-Husary',    nameAr: 'محمود خليل الحصري',         style: 'murattal', riwaya: 'hafs', cdn: '128', everyayah: 'Husary_128kbps',                          kbps: 128, aka: 'Hussary Husari' },
  { id: 'ar.minshawi',            nameEn: 'Mohamed Siddiq El-Minshawi',  nameAr: 'محمد صديق المنشاوي',        style: 'murattal', riwaya: 'hafs', cdn: '128', everyayah: 'Minshawy_Murattal_128kbps',               kbps: 128, aka: 'Minshawy Menshawi Minshawi' },
  { id: 'ar.abdulbasitmurattal',  nameEn: 'Abdul Basit Abdul Samad',     nameAr: 'عبد الباسط عبد الصمد',      style: 'murattal', riwaya: 'hafs', cdn: '192', everyayah: 'Abdul_Basit_Murattal_192kbps',            kbps: 192, aka: 'Abdulbasit Abdussamad Abdel Samad' },
  { id: 'ar.hudhaify',            nameEn: 'Ali Al-Hudhaify',             nameAr: 'علي بن عبدالرحمن الحذيفي',  style: 'murattal', riwaya: 'hafs', cdn: '128', everyayah: 'Hudhaify_128kbps',                        kbps: 128, aka: 'Huthaifi Hudhaifi Huzaifi' },
  { id: 'ar.muhammadayyoub',      nameEn: 'Muhammad Ayyoub',             nameAr: 'محمد أيوب',                 style: 'murattal', riwaya: 'hafs', cdn: '128', everyayah: 'Muhammad_Ayyoub_64kbps',                  kbps: 64,  aka: 'Ayyub Ayub' },
  { id: 'ar.abdurrahmaansudais',  nameEn: 'Abdul Rahman Al-Sudais',      nameAr: 'عبد الرحمن السديس',         style: 'murattal', riwaya: 'hafs', cdn: '192', everyayah: 'Abdurrahmaan_As-Sudais_192kbps',          kbps: 192, aka: 'Sudais Abdurrahman' },
  { id: 'ar.saoodshuraym',        nameEn: 'Saud Al-Shuraim',             nameAr: 'سعود الشريم',               style: 'murattal', riwaya: 'hafs', cdn: '64',  everyayah: null,                                      kbps: 128, aka: 'Shuraym Shuraim Saood' },
  { id: 'ar.mahermuaiqly',        nameEn: 'Maher Al-Muaiqly',            nameAr: 'ماهر المعيقلي',             style: 'murattal', riwaya: 'hafs', cdn: '64',  everyayah: 'Maher_AlMuaiqly_64kbps',                  kbps: 64,  aka: 'Muaiqli Maaiqly Mueaqly' },
  { id: 'ar.shaatree',            nameEn: 'Abu Bakr Al-Shatri',          nameAr: 'أبو بكر الشاطري',           style: 'murattal', riwaya: 'hafs', cdn: '128', everyayah: 'Abu_Bakr_Ash-Shaatree_128kbps',           kbps: 128, aka: 'Shaatree Shatery' },
  { id: 'ar.ahmedajamy',          nameEn: 'Ahmed Al-Ajmi',               nameAr: 'أحمد بن علي العجمي',        style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net', kbps: 128, aka: 'Ajamy Ajami' },
  { id: 'ar.abdullahbasfar',      nameEn: 'Abdullah Basfar',             nameAr: 'عبد الله بصفر',             style: 'murattal', riwaya: 'hafs', cdn: '192', everyayah: 'Abdullah_Basfar_192kbps',                 kbps: 192, aka: 'Basfer' },
  { id: 'ar.hanirifai',           nameEn: 'Hani Al-Rifai',               nameAr: 'هاني الرفاعي',              style: 'murattal', riwaya: 'hafs', cdn: '192', everyayah: 'Hani_Rifai_192kbps',                      kbps: 192, aka: 'Rifaai Refai' },
  { id: 'ar.muhammadjibreel',     nameEn: 'Muhammad Jibreel',            nameAr: 'محمد جبريل',                style: 'murattal', riwaya: 'hafs', cdn: '128', everyayah: 'Muhammad_Jibreel_64kbps',                 kbps: 64,  aka: 'Jibril Gebril' },
  { id: 'ar.ibrahimakhbar',       nameEn: 'Ibrahim Al-Akhdar',           nameAr: 'إبراهيم الأخضر',            style: 'murattal', riwaya: 'hafs', cdn: '32',  everyayah: 'Ibrahim_Akhdar_32kbps',                   kbps: 32,  aka: 'Akhdar Akhbar' },
  { id: 'ar.aymanswoaid',         nameEn: 'Ayman Suwayd',                nameAr: 'أيمن سويد',                 style: 'murattal', riwaya: 'hafs', cdn: '64',  everyayah: 'Ayman_Sowaid_64kbps',                     kbps: 64,  aka: 'Sowaid Swoaid Swed' },
  { id: 'ea.ghamdi',              nameEn: 'Saad Al-Ghamdi',              nameAr: 'سعد الغامدي',               style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Ghamadi_40kbps',                          kbps: 40,  aka: 'Ghamadi Ghamidi' },
  { id: 'ea.dossari',             nameEn: 'Yasser Al-Dosari',            nameAr: 'ياسر الدوسري',              style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Yasser_Ad-Dussary_128kbps',               kbps: 128, aka: 'Dussary Dossari Dawsari' },
  { id: 'ea.qatami',              nameEn: 'Nasser Al-Qatami',            nameAr: 'ناصر القطامي',              style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Nasser_Alqatami_128kbps',                 kbps: 128, aka: 'Alqatami Katami' },
  { id: 'ea.budair',              nameEn: 'Salah Al-Budair',             nameAr: 'صلاح البدير',               style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Salah_Al_Budair_128kbps',                 kbps: 128, aka: 'Budair Budayr' },
  { id: 'ea.juhany',              nameEn: 'Abdullah Al-Juhany',          nameAr: 'عبد الله عواد الجهني',      style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps',   kbps: 128, aka: 'Juhani Juhaynee Awad' },
  { id: 'ea.muhsinqasim',         nameEn: 'Abdul Muhsin Al-Qasim',       nameAr: 'عبد المحسن القاسم',         style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Muhsin_Al_Qasim_192kbps',                 kbps: 192, aka: 'Abdulmuhsin Qassim' },
  { id: 'ea.qahtani',             nameEn: 'Khalid Al-Qahtani',           nameAr: 'خالد القحطاني',             style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Khaalid_Abdullaah_al-Qahtaanee_192kbps',  kbps: 192, aka: 'Qahtaanee Khaled' },
  { id: 'ea.matroud',             nameEn: 'Abdullah Al-Matrood',         nameAr: 'عبد الله المطرود',          style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Abdullah_Matroud_128kbps',                kbps: 128, aka: 'Matroud' },
  { id: 'ea.bukhatir',            nameEn: 'Salah Bukhatir',              nameAr: 'صلاح بو خاطر',              style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Salaah_AbdulRahman_Bukhatir_128kbps',     kbps: 128, aka: 'Bu Khatir Salaah' },
  { id: 'ea.alijaber',            nameEn: 'Ali Jaber',                   nameAr: 'علي جابر',                  style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Ali_Jaber_64kbps',                        kbps: 64,  aka: 'Jabir' },
  { id: 'ea.faresabbad',          nameEn: 'Fares Abbad',                 nameAr: 'فارس عباد',                 style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Fares_Abbad_64kbps',                      kbps: 64,  aka: 'Faris' },
  { id: 'ea.tablawi',             nameEn: 'Mohamed Al-Tablawi',          nameAr: 'محمد محمود الطبلاوي',       style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Mohammad_al_Tablaway_128kbps',            kbps: 128, aka: 'Tablaway Tablawy' },
  { id: 'ea.banna',               nameEn: 'Mahmoud Ali Al-Banna',        nameAr: 'محمود علي البنا',           style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'mahmoud_ali_al_banna_32kbps',             kbps: 32,  aka: 'Albanna' },
  { id: 'ea.neana',               nameEn: 'Ahmed Nuaina',                nameAr: 'أحمد نعينع',                style: 'murattal', riwaya: 'hafs', cdn: null,  everyayah: 'Ahmed_Neana_128kbps',                     kbps: 128, aka: 'Neana Naina' },
  // ── Mujawwad ──
  { id: 'ar.husarymujawwad',      nameEn: 'Mahmoud Khalil Al-Husary',    nameAr: 'محمود خليل الحصري',         style: 'mujawwad', riwaya: 'hafs', cdn: '64',  everyayah: null,                                      kbps: 64,  aka: 'Hussary Husari' },
  { id: 'ea.abdulbasitmujawwad',  nameEn: 'Abdul Basit Abdul Samad',     nameAr: 'عبد الباسط عبد الصمد',      style: 'mujawwad', riwaya: 'hafs', cdn: null,  everyayah: 'Abdul_Basit_Mujawwad_128kbps',            kbps: 128, aka: 'Abdulbasit Abdussamad Abdel Samad' },
  { id: 'ea.minshawimujawwad',    nameEn: 'Mohamed Siddiq El-Minshawi',  nameAr: 'محمد صديق المنشاوي',        style: 'mujawwad', riwaya: 'hafs', cdn: null,  everyayah: 'Minshawy_Mujawwad_192kbps',               kbps: 192, aka: 'Minshawy Menshawi Minshawi' },
  // ── Muallim (teaching) ──
  { id: 'ea.husarymuallim',       nameEn: 'Mahmoud Khalil Al-Husary',    nameAr: 'محمود خليل الحصري',         style: 'muallim',  riwaya: 'hafs', cdn: null,  everyayah: 'Husary_Muallim_128kbps',                  kbps: 128, aka: 'Hussary Husari teacher' },
];

export const RECITER_STYLES = ['murattal', 'mujawwad', 'muallim'];

export const DEFAULT_RECITER = RECITERS[0].id;

const RECITER_BY_ID = new Map(RECITERS.map((r) => [r.id, r]));

// A saved id this build doesn't know (renamed, removed, tampered) is not an error:
// the reader just gets the default.
export const resolveReciterId = (id) => (RECITER_BY_ID.has(id) ? id : DEFAULT_RECITER);
export const getReciter = (id) => RECITER_BY_ID.get(resolveReciterId(id));

// everyayah addresses a verse by zero-padded surah + ayah ("086013").
const everyayahUrl = (folder, verseKey) => {
  const [surah, ayah] = String(verseKey ?? '').split(':');
  if (!folder || !surah || !ayah) return null;
  return `${FALLBACK_AUDIO_BASE}/${folder}/${surah.padStart(3, '0')}${ayah.padStart(3, '0')}.mp3`;
};

// The primary source for a verse, by its GLOBAL ayah number — whichever source
// that reciter's primary is.
//
// A CDN address ends in a bare "?". The CDN serves the very same file for it (the
// same edge object — a cold "…mp3?" is a MISS and the plain "…mp3" right after it
// a HIT, and the other way round; measured 2026-10-13), but to the browser it is a
// different cache key, and that is the point. The warm-up used to GET these files,
// which this CDN answers GZIP-ENCODED; an <audio> element that later found that copy
// in the HTTP cache revalidated it (one weak ETag for both encodings, so a 304) and
// was handed the compressed length — so it stopped early: 0.7–24% of the file never
// played (Hani ar-Rifai 112:1 lost its last 0.84 s, words included). Those copies sit
// in listeners' caches for up to 70 days, renewed by every revalidation; the "?"
// leaves them behind for good. The warm-up now asks with HEAD (ayahWarmMethod), so
// it makes no new ones.
export const getAyahAudioUrl = (reciterId, globalAyahNumber) => {
  const r = getReciter(reciterId);
  return r.cdn
    ? `${AUDIO_CDN}/${r.cdn}/${r.id}/${globalAyahNumber}.mp3?`
    : everyayahUrl(r.everyayah, keyOfOrd(globalAyahNumber));
};

// A copy of the verse's file that the page may READ (CORS), for measuring its edges
// (verseEdges.js): everyayah, primary or the byte-identical fallback. Null for the
// CDN-only reciters — the CDN sends no CORS headers.
export const getAyahEdgeUrl = (reciterId, globalAyahNumber) =>
  everyayahUrl(getReciter(reciterId).everyayah, keyOfOrd(globalAyahNumber));

// How the warm-up asks for a verse it only wants the edge to have ready. HEAD for the
// CDN: it warms the edge exactly as a GET does (cold object: HEAD → MISS, the next GET
// → HIT, 5/5) and has no body, so nothing gzip-encoded is left in the HTTP cache for
// the <audio> element to inherit (see getAyahAudioUrl). everyayah sends MP3s
// uncompressed, so its warm-up stays the GET it always was.
export const ayahWarmMethod = (reciterId) => (getReciter(reciterId).cdn ? 'HEAD' : 'GET');

// The digital silence every file of a reciter OPENS with — encoder delay, not the
// recording: exact zero samples ahead of the room tone. The player starts the next
// verse this much early (Library.jsx, the handover), so these zeros play under the
// last instant of the verse before instead of as a gap after it — and being exact
// zeros they add nothing to it. Measured 2026-10-13 with Chrome's decoder over 60
// ayahs per reciter (surah openings and random ayahs): each value is the SMALLEST run
// seen, less 3 ms, so it never reaches the room tone, let alone a word. Reciters left
// out are 0: LAME-tagged files (Chrome trims the delay itself — Afasy, Ayyoub,
// Jibreel, Maher, …), or a reciter whose runs vary down to under 13 ms (Husary's are
// 44 ms in 47 files of 60, but one is 8.9 ms; Minshawi's go down to 4.8 ms).
const LEADING_SILENCE_MS = {
  'ar.abdulbasitmurattal': 13, 'ar.hudhaify': 14, 'ar.abdurrahmaansudais': 11,
  'ar.shaatree': 24, 'ar.abdullahbasfar': 13, 'ar.hanirifai': 12, 'ar.ibrahimakhbar': 143,
  'ar.aymanswoaid': 16, 'ea.ghamdi': 26, 'ea.qatami': 12, 'ea.muhsinqasim': 11,
  'ea.alijaber': 33, 'ea.faresabbad': 25, 'ea.tablawi': 25, 'ea.neana': 37,
  'ea.abdulbasitmujawwad': 38, 'ea.minshawimujawwad': 11, 'ea.husarymuallim': 39,
};
export const getLeadingSilenceMs = (reciterId) => LEADING_SILENCE_MS[resolveReciterId(reciterId)] ?? 0;

// The verified second source. Null when the reciter has none — including every
// reciter whose primary already IS everyayah.
export const getFallbackAyahAudioUrl = (reciterId, verseKey) => {
  const r = getReciter(reciterId);
  return r.cdn ? everyayahUrl(r.everyayah, verseKey) : null;
};

// Tafsir editions verified to return 200:
//  - page editions come from api.alquran.cloud (one request per page)
//  - ayah editions come from the spa5k tafsir CDN (one request per ayah)
//
// The editions below were each checked against 48 ayahs spread over the whole
// mushaf (first and last pages, the short surahs, and the very long 2:282): all
// returned 200 with real content, as plain text with newlines — no markup to
// strip. أيسر التفاسير and the إعراب edition exist ONLY on the spa5k CDN;
// alquran.cloud and api.quran.com carry neither.
//
// `kind: 'irab'` marks the one entry that is grammatical analysis rather than
// commentary — it shares the picker but titles its panel differently.
// `source` says where an edition's text comes from:
//   'page' — api.alquran.cloud, one request per mushaf page, already per-ayah
//   'ayah' — the spa5k CDN, one request per ayah
//   'hefz' — newapi.hefzmoyaser.net, one request per ayah, `fallbackSlug` is the
//            spa5k copy used if it fails so a reader never gets an empty panel
//
// Which source each edition uses was decided by measurement, not preference: for
// every edition, runs of adjacent ayahs were fetched and the returned strings
// compared (36:40-47, 18:60-65, 2:1-7, 7:1-8, 55:1-10 — 39 ayahs).
//
//   aysar      spa5k  9/39 distinct  ->  hefz 39/39, same text length  => SWITCHED
//   ibnkathir  spa5k 15/39           ->  hefz 38/39 BUT ~60% the length
//                                        (12,913 vs 20,139 chars on 2:282) — an
//                                        abridged recension, so NOT switched:
//                                        grouped-but-complete beats per-ayah-but-cut
//   tabari     spa5k 26/39           ->  hefz 39/39 BUT truncates at exactly
//                                        32,767 chars, mid-word, on 2:255 and
//                                        2:282 — NOT switched
//   saadi, irab      already per-ayah on spa5k    => left alone
//   muyassar, jalalayn already per-ayah per page  => left alone
//   baghawi, qurtubi grouped, hefz doesn't carry them => left alone, and the
//                                        reader gets the "covers verses X-Y" banner
export const TAFSIR_EDITIONS = [
  { id: 'muyassar',  source: 'page', edition: 'ar.muyassar',            nameAr: 'التفسير الميسّر',   nameEn: 'Tafsir Al-Muyassar' },
  { id: 'aysar',     source: 'hefz', bookId: 11, fallbackSlug: 'abu-bakr-jabir-al-jazairi', nameAr: 'أيسر التفاسير',     nameEn: 'Aysar at-Tafasir (al-Jazairi)' },
  { id: 'ibnkathir', source: 'ayah', slug: 'ar-tafsir-ibn-kathir',      nameAr: 'تفسير ابن كثير',    nameEn: 'Tafsir Ibn Kathir' },
  { id: 'saadi',     source: 'ayah', slug: 'ar-tafseer-al-saddi',       nameAr: 'تفسير السعدي',      nameEn: "Tafsir As-Sa'di" },
  { id: 'jalalayn',  source: 'page', edition: 'ar.jalalayn',            nameAr: 'تفسير الجلالين',    nameEn: 'Tafsir Al-Jalalayn' },
  { id: 'baghawi',   source: 'ayah', slug: 'ar-tafsir-al-baghawi',      nameAr: 'تفسير البغوي',      nameEn: 'Tafsir Al-Baghawi' },
  { id: 'qurtubi',   source: 'ayah', slug: 'ar-tafseer-al-qurtubi',     nameAr: 'تفسير القرطبي',     nameEn: 'Tafsir Al-Qurtubi' },
  { id: 'tabari',    source: 'ayah', slug: 'ar-tafsir-al-tabari',       nameAr: 'تفسير الطبري',      nameEn: 'Tafsir At-Tabari' },
  { id: 'irab',      source: 'ayah', slug: 'al-i-rab-al-muyassar',      nameAr: 'الإعراب الميسّر',   nameEn: "I'rab (grammar) — Al-Muyassar", kind: 'irab' },
];

// Every fetch below is bounded (fetchJSON's deadline) and caches only a result it
// has checked, so a request that failed, timed out or brought back something
// unexpected is asked again next time instead of being remembered (M-14).
const fetchPageEdition = async (pageNumber, edition) => {
  const data = await fetchJSON(`${ALQURAN_API}/page/${pageNumber}/${edition}`);
  if (!Array.isArray(data?.data?.ayahs)) throw new Error('Unexpected page payload');
  // The API occasionally prefixes the first ayah with a BOM (U+FEFF) — strip it.
  return data.data.ayahs.map(a => ({ ...a, text: a.text.replace(new RegExp('\\uFEFF', 'g'), '') }));
};

const pageTextCache = new Map();

export const fetchPageText = async (pageNumber) => {
  if (pageTextCache.has(pageNumber)) return pageTextCache.get(pageNumber);
  const ayahs = await fetchPageEdition(pageNumber, 'quran-uthmani');
  pageTextCache.set(pageNumber, ayahs);
  return ayahs;
};

const tafsirPageCache = new Map();

export const fetchPageTafsir = async (pageNumber, edition = 'ar.muyassar') => {
  const key = `${edition}:${pageNumber}`;
  if (tafsirPageCache.has(key)) return tafsirPageCache.get(key);
  const ayahs = await fetchPageEdition(pageNumber, edition);
  tafsirPageCache.set(key, ayahs);
  return ayahs;
};

// hefzmoyaser returns its commentary as HTML fragments — <br /> throughout, and
// <p>…</p> in the longer books. The panel renders plain text (never
// dangerouslySetInnerHTML — this is third-party content going onto the page), so
// turn the breaks into newlines, drop any other tag, and decode the handful of
// entities that show up. Runs of blank lines are collapsed so the panel doesn't
// open with a gap.
const HTML_ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

export const htmlFragmentToText = (html) =>
  String(html ?? '')
    .replace(/\r\n?/g, '\n')
    // Swallow the whitespace a tag is followed by. The source writes "<br />\r\n",
    // and turning that into "\n" + "\n" would make every single line break read as
    // a PARAGRAPH break — which is how the panel ended up so airy.
    .replace(/<br\s*\/?>[ \t\n]*/gi, '\n')
    .replace(/<\/p\s*>[ \t\n]*/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const tafsirAyahCache = new Map();

export const fetchAyahTafsir = async (slug, surahNumber, ayahNumberInSurah) => {
  const key = `${slug}:${surahNumber}:${ayahNumberInSurah}`;
  if (tafsirAyahCache.has(key)) return tafsirAyahCache.get(key);
  const data = await fetchJSON(`${TAFSIR_CDN}/${slug}/${surahNumber}/${ayahNumberInSurah}.json`);
  // Not a string: an unexpected payload, which cached would pin an empty panel
  // on this verse for the rest of the session.
  if (typeof data?.text !== 'string') throw new Error('Unexpected tafsir payload');
  tafsirAyahCache.set(key, data.text);
  return data.text;
};

const hefzCache = new Map();

// One ayah's commentary from hefzmoyaser. Throws on anything unexpected so the
// caller can fall back to the spa5k copy rather than showing an empty panel.
export const fetchHefzAyahTafsir = async (bookId, surahNumber, ayahNumberInSurah) => {
  const key = `${bookId}:${surahNumber}:${ayahNumberInSurah}`;
  if (hefzCache.has(key)) return hefzCache.get(key);
  const url = `${HEFZ_API}/tafsir/show?chapter=${surahNumber}&verse=${ayahNumberInSurah}`
    + `&book_id=${bookId}&riwaya=${HEFZ_RIWAYA_HAFS}`;
  const data = await fetchJSON(url, { headers: { Accept: 'application/json' } });
  const text = htmlFragmentToText(data?.data?.tafsir);
  if (!text) throw new Error('Empty tafsir');
  hefzCache.set(key, text);
  return text;
};

// The text for one ayah of an edition, whatever its source — and, for a hefz
// edition, the spa5k copy if hefzmoyaser is unreachable.
export const fetchEditionAyahTafsir = async (ed, surahNumber, ayahNumberInSurah) => {
  if (ed.source !== 'hefz') return fetchAyahTafsir(ed.slug, surahNumber, ayahNumberInSurah);
  try {
    return await fetchHefzAyahTafsir(ed.bookId, surahNumber, ayahNumberInSurah);
  } catch {
    return fetchAyahTafsir(ed.fallbackSlug, surahNumber, ayahNumberInSurah);
  }
};

// How far the block of commentary just fetched actually reaches.
//
// A classical tafsir comments on a PASSAGE, not on one ayah at a time, and the
// CDN faithfully hands back that same block for every ayah in the passage. This
// was verified by diffing runs of adjacent ayahs: أيسر التفاسير returns
// byte-identical text for 36:41-36:46 (the case that was reported) and for the
// whole of 18:60-18:65; al-Baghawi, al-Qurtubi, at-Tabari and Ibn Kathir group
// as well, while As-Sa'di and the i'rab edition are per-ayah. So the grouping is
// the book's own structure, not a fetching bug, and no amount of re-fetching
// splits it. The honest response is to SAY which verses the block covers.
//
// Only ayah-source editions need this: the page-source ones were checked the
// same way and are strictly per-ayah (14 distinct texts across page 443).
//
// Walks outward from the ayah while the neighbour's text is byte-identical.
// Every probe goes through the cache above, so the rest of a run is already
// loaded by the time the reader steps into it.
const RUN_PROBE_LIMIT = 12; // no edition groups anything like this many ayahs

export const findTafsirRun = async (slug, surahNumber, ayahNumber, surahAyahCount, text) => {
  const alone = { from: ayahNumber, to: ayahNumber };
  if (!text) return alone;
  const sameAs = async (a) => {
    if (a < 1 || a > surahAyahCount) return false;
    try { return (await fetchAyahTafsir(slug, surahNumber, a)) === text; }
    catch { return false; }
  };
  let from = ayahNumber;
  for (let i = 0; i < RUN_PROBE_LIMIT; i++) {
    if (!(await sameAs(from - 1))) break;
    from--;
  }
  let to = ayahNumber;
  for (let i = 0; i < RUN_PROBE_LIMIT; i++) {
    if (!(await sameAs(to + 1))) break;
    to++;
  }
  return { from, to };
};

// In quran-uthmani the Basmala is prepended to the first ayah of every surah
// except Al-Fatiha (where it IS ayah 1) and At-Tawbah (which has none).
// Split it out so the renderer can show it as its own centered line.
export const splitBasmala = (ayah) => {
  if (ayah.numberInSurah !== 1 || ayah.surah.number === 1 || ayah.surah.number === 9) {
    return { basmala: null, text: ayah.text };
  }
  const words = ayah.text.split(' ');
  if (words.length > 4 && words[0].startsWith('بِسْمِ')) {
    return { basmala: words.slice(0, 4).join(' '), text: words.slice(4).join(' ') };
  }
  return { basmala: null, text: ayah.text };
};

// Lives in utils/formatNumber.js (so the app shell can use it without pulling
// this module into the main bundle); re-exported here for existing imports.
export { toArabicDigits } from '../utils/formatNumber';
