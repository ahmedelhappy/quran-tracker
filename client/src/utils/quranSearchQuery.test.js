import { describe, it, expect } from 'vitest';
import {
  normalizeArabic, arabicTokens, toLatinDigits, parseJumps, matchSurahNames,
  looksUthmani, uthmaniWordSpellings, uthmaniQuerySlots,
} from './quranSearchQuery';
import { HIZB_RANGES } from '../data/hizbRanges';

describe('normalizeArabic', () => {
  it('strips tashkeel and the dagger alef, so a fully voweled word meets the bare one', () => {
    expect(normalizeArabic('بِسْمِ')).toBe('بسم');
    expect(normalizeArabic('الرَّحْمَٰنِ')).toBe('الرحمن');
    expect(normalizeArabic('قُلْ هُوَ اللَّهُ أَحَدٌ')).toBe('قل هو الله احد');
  });

  it('strips Quranic annotation marks and tatweel', () => {
    expect(normalizeArabic('رَيْبَۛ')).toBe('ريب');       // waqf sign
    expect(normalizeArabic('۞ إِنَّ')).toBe(' ان');       // rub el-hizb
    expect(normalizeArabic('الـــله')).toBe('الله');       // tatweel
    expect(normalizeArabic('ا‏ل​له')).toBe('الله'); // direction and zero-width marks
  });

  it('unifies the alef forms, alef maqsura and ta marbuta', () => {
    expect(normalizeArabic('أ إ آ ٱ')).toBe('ا ا ا ا');
    expect(normalizeArabic('هُدًى')).toBe('هدي');
    expect(normalizeArabic('رحمة')).toBe(normalizeArabic('رحمه'));
  });

  it('meets the Uthmani waw-with-dagger-alef with the plain spelling', () => {
    expect(normalizeArabic('ٱلصَّلَوٰةَ')).toBe(normalizeArabic('الصلاة'));
    expect(normalizeArabic('ٱلزَّكَوٰةَ')).toBe(normalizeArabic('الزكاة'));
  });

  it('unifies the hamza seats but never drops the hamza', () => {
    expect(normalizeArabic('مسؤول')).toBe(normalizeArabic('مسئول'));
    expect(normalizeArabic('مَآءً')).toBe('ماء');
    expect(normalizeArabic('ماء')).not.toBe(normalizeArabic('ما')); // water is not "what"
  });

  it('composes a separately typed hamza onto its letter first (NFC)', () => {
    expect(normalizeArabic('أحد')).toBe(normalizeArabic('أحد'));
  });

  it('turns Arabic-Indic digits into ASCII and survives non-strings', () => {
    expect(normalizeArabic('٢٥٥')).toBe('255');
    expect(normalizeArabic(null)).toBe('');
    expect(normalizeArabic(undefined)).toBe('');
  });
});

describe('arabicTokens', () => {
  it('splits on anything that is not an Arabic letter or digit', () => {
    expect(arabicTokens('قُلْ هُوَ ٱللَّهُ أَحَدٌ')).toEqual(['قل', 'هو', 'الله', 'احد']);
    expect(arabicTokens('  الحمد، لله!  ')).toEqual(['الحمد', 'لله']);
    expect(arabicTokens('hello')).toEqual([]);
  });
});

describe('toLatinDigits', () => {
  it('reads both Arabic-Indic digit sets', () => {
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toLatinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(toLatinDigits('page 5')).toBe('page 5');
  });
});

describe('parseJumps', () => {
  it('reads a verse reference in any separator or digit script', () => {
    for (const q of ['2:255', '2.255', '2/255', '2-255', '2 255', '٢:٢٥٥']) {
      expect(parseJumps(q)[0], q).toEqual({ type: 'verse', surahNumber: 2, ayahNumber: 255 });
    }
  });

  it('refuses a verse the surah does not have', () => {
    expect(parseJumps('2:287').some((j) => j.type === 'verse')).toBe(false);
    expect(parseJumps('115:1').some((j) => j.type === 'verse')).toBe(false);
  });

  it('reads a surah name with an ayah number, in Arabic or a common spelling', () => {
    const want = { type: 'verse', surahNumber: 2, ayahNumber: 255 };
    for (const q of ['البقرة 255', 'Al-Baqarah 255', 'baqara 255', '255 البقرة', 'سورة البقرة 255']) {
      expect(parseJumps(q), q).toContainEqual(want);
    }
  });

  it('reads pages, juz and hizb in both languages', () => {
    expect(parseJumps('page 50')).toContainEqual({ type: 'page', page: 50 });
    expect(parseJumps('صفحة ٥٠')).toContainEqual({ type: 'page', page: 50 });
    expect(parseJumps('p50')).toContainEqual({ type: 'page', page: 50 });
    expect(parseJumps('juz 30')).toContainEqual({ type: 'juz', juz: 30, page: 582 });
    expect(parseJumps('جزء 1')).toContainEqual({ type: 'juz', juz: 1, page: 1 });
    expect(parseJumps('hizb 5')).toContainEqual({ type: 'hizb', hizb: 5, page: HIZB_RANGES[4].start });
    expect(parseJumps('page 605')).toEqual([]);
  });

  it('offers a bare number as a page and, up to 114, as a surah', () => {
    expect(parseJumps('50')).toEqual([{ type: 'page', page: 50 }, { type: 'surah', surahNumber: 50 }]);
    expect(parseJumps('300')).toEqual([{ type: 'page', page: 300 }]);
  });

  it('finds a surah by an alias or a loose transliteration', () => {
    expect(parseJumps('yaseen')).toContainEqual({ type: 'surah', surahNumber: 36 });
    expect(parseJumps('surah kahf')).toContainEqual({ type: 'surah', surahNumber: 18 });
    expect(parseJumps('الكهف')).toContainEqual({ type: 'surah', surahNumber: 18 });
  });

  it('answers nothing for an empty query', () => {
    expect(parseJumps('')).toEqual([]);
    expect(parseJumps('   ')).toEqual([]);
    expect(parseJumps(null)).toEqual([]);
  });
});

describe('matchSurahNames', () => {
  it('suggests surahs a name begins while it is being typed', () => {
    expect(matchSurahNames('البق').map((s) => s.number)).toContain(2);
  });

  it('never matches an alias as a prefix ("الله" must not suggest Al-Masad by its alias "اللهب")', () => {
    expect(matchSurahNames('الله').map((s) => s.number)).not.toContain(111);
    expect(matchSurahNames('اللهب').map((s) => s.number)).toContain(111);
  });
});

// Real Uthmani strings, as quran.com's text_uthmani and the mushaf print them (L-14).
describe('Uthmani text pasted in', () => {
  const spelled = (w) => uthmaniWordSpellings(w).map((tokens) => tokens.join(' '));

  it('tells pasted Uthmani text from a typed query', () => {
    for (const q of ['يَـٰٓأَيُّهَا', 'ٱلْقُرْءَانُ', 'مَسْـُٔولًا', 'ٱلْكِتَـٰبَ', 'ءَامَنُوا۟', 'أَءِذَا', 'ءَأَنتُمْ', 'وَلَا تَقْرَبُوا۟ مَالَ']) {
      expect(looksUthmani(q), q).toBe(true);
    }
    // Typed text, bare or with full tashkeel, keeps the plain path and its results.
    for (const q of ['يا أيها', 'القرآن', 'مسؤولا', 'قُلْ هُوَ اللَّهُ أَحَدٌ', 'جزءا', 'قراءة', 'تساءلون', 'شيء', 'الرحمن الرحيم', '2:255']) {
      expect(looksUthmani(q), q).toBe(false);
      expect(uthmaniQuerySlots(q), q).toBeNull();
    }
  });

  it('offers the plain spelling a dagger alef stands for, or none', () => {
    expect(spelled('ٱلْكِتَـٰبَ')).toContain('الكتاب');
    expect(spelled('ٱلرَّحْمَـٰنِ')).toContain('الرحمن');
    expect(spelled('ذَٰلِكَ')).toContain('ذلك');
    expect(spelled('ٱلسَّمَـٰوَٰتِ')).toContain('السماوات');
    expect(spelled('ٱلصَّلَوٰةَ')).toContain(normalizeArabic('الصلاة'));
    expect(spelled('مَوْلَىٰنَا')).toContain('مولانا');
  });

  it('splits the vocative into the two words the index has', () => {
    expect(spelled('يَٰٓأَيُّهَا')).toContain('يا ايها');
    expect(spelled('يَـٰٓأَيُّهَا')).toContain('يا ايها');
    expect(spelled('يَـٰقَوْمِ')).toContain('يا قوم');
    expect(spelled('وَيَـٰقَوْمِ')).toContain('ويا قوم');
  });

  it('reads the Uthmani hamza spellings', () => {
    expect(spelled('مَسْـُٔولًا')).toContain(normalizeArabic('مسؤولا'));     // hamza on a tatweel
    expect(spelled('شَيْـًٔا')).toContain(normalizeArabic('شيئا'));
    expect(spelled('ٱلْقُرْءَانُ')).toContain(normalizeArabic('القرآن'));     // ءَا is آ
    expect(spelled('ءَامَنُوا۟')).toContain(normalizeArabic('آمنوا'));
    expect(spelled('أَءِذَا')).toContain(normalizeArabic('أإذا'));
  });

  it('reads the small letters and the silent-letter sign', () => {
    expect(spelled('إِبْرَٰهِـۧمَ')).toContain('ابراهيم');
    expect(spelled('بِهِۦ')).toContain('به');
    expect(spelled('يَتْلُوا۟')).toContain('يتلو');
    expect(spelled('تَجِدُوا۟')).toContain('تجدوا');
    expect(spelled('ٱلَّيْلِ')).toContain('الليل');
  });

  it('makes one slot per word and leaves out signs and verse numbers', () => {
    const slots = uthmaniQuerySlots('ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ۚ ٱلْحَىُّ ٱلْقَيُّومُ ٢٥٥');
    expect(slots).toHaveLength(7);
    expect(slots[0].map((t) => t.join(' '))).toContain('الله');
  });
});
