const ALQURAN_API = 'https://api.alquran.cloud/v1';
const AUDIO_CDN = 'https://cdn.islamic.network/quran/audio/128';
const TAFSIR_CDN = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir';

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
export const TAFSIR_EDITIONS = [
  { id: 'muyassar',  source: 'page', edition: 'ar.muyassar',            nameAr: 'التفسير الميسّر',   nameEn: 'Tafsir Al-Muyassar' },
  { id: 'aysar',     source: 'ayah', slug: 'abu-bakr-jabir-al-jazairi', nameAr: 'أيسر التفاسير',     nameEn: 'Aysar at-Tafasir (al-Jazairi)' },
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
