const QURAN_API = 'https://api.quran.com/api/v4';
const IMAGE_CDN = 'https://images.qurancdn.com/images/pages';
const AUDIO_CDN = 'https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy';

export const getPageImageUrl = (pageNumber) =>
  `${IMAGE_CDN}/${pageNumber}.jpg`;

export const getChapterAudioUrl = (chapterId) =>
  `${AUDIO_CDN}/${chapterId}.mp3`;

export const fetchVersesByPage = async (pageNumber) => {
  const res = await fetch(
    `${QURAN_API}/verses/by_page/${pageNumber}?words=false&fields=text_uthmani&per_page=50`
  );
  if (!res.ok) throw new Error('Failed to fetch verses');
  const data = await res.json();
  return data.verses;
};

export const fetchChapters = async () => {
  const res = await fetch(`${QURAN_API}/chapters?language=en`);
  if (!res.ok) throw new Error('Failed to fetch chapters');
  const data = await res.json();
  return data.chapters;
};
