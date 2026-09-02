const ALQURAN_API = 'https://api.alquran.cloud/v1';
const AUDIO_CDN = 'https://cdn.islamic.network/quran/audio/128';
const TAFSIR_CDN = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir';
// hefzmoyaser's backend. Verified browser-callable: it answers with
// `access-control-allow-origin: *` and a 204 preflight allowing GET. Two things
// it insists on: `riwaya` must be the INTEGER 1 (hafs), and without an explicit
// `Accept: application/json` a validation failure comes back as a 302 redirect to
// an HTML page instead of a 422. It rate-limits at 180 requests/minute
// (`x-ratelimit-limit`), which one request per verse read stays far below.
const HEFZ_API = 'https://newapi.hefzmoyaser.net/api';
const HEFZ_RIWAYA_HAFS = 1;

// Reciters verified against cdn.islamic.network (HEAD 200 on per-ayah files).
// ar.abdulbasitmurattal returns 403 on this CDN — excluded.
export const RECITERS = [
  { id: 'ar.alafasy',         nameEn: 'Mishary Rashid Al-Afasy',     nameAr: 'مشاري راشد العفاسي' },
  { id: 'ar.husary',          nameEn: 'Mahmoud Khalil Al-Husary',    nameAr: 'محمود خليل الحصري' },
  { id: 'ar.minshawi',        nameEn: 'Mohamed Siddiq El-Minshawi',  nameAr: 'محمد صديق المنشاوي' },
  { id: 'ar.hudhaify',        nameEn: 'Ali Al-Hudhaify',             nameAr: 'علي بن عبدالرحمن الحذيفي' },
  { id: 'ar.muhammadayyoub',  nameEn: 'Muhammad Ayyoub',             nameAr: 'محمد أيوب' },
];

export const DEFAULT_RECITER = RECITERS[0].id;

export const getAyahAudioUrl = (reciterId, globalAyahNumber) =>
  `${AUDIO_CDN}/${reciterId}/${globalAyahNumber}.mp3`;

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

const fetchPageEdition = async (pageNumber, edition) => {
  const res = await fetch(`${ALQURAN_API}/page/${pageNumber}/${edition}`);
  if (!res.ok) throw new Error('Failed to fetch page');
  const data = await res.json();
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
  const res = await fetch(`${TAFSIR_CDN}/${slug}/${surahNumber}/${ayahNumberInSurah}.json`);
  if (!res.ok) throw new Error('Failed to fetch tafsir');
  const data = await res.json();
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
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Failed to fetch tafsir');
  const data = await res.json();
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

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export const toArabicDigits = (n) =>
  String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
