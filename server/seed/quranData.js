const mongoose = require('mongoose');
require('dotenv').config();
const QuranMetadata = require('../models/QuranMetadata');

// Juz to Page mapping (which pages belong to which Juz)
const juzPageRanges = [
  { juz: 1, start: 1, end: 21 },
  { juz: 2, start: 22, end: 41 },
  { juz: 3, start: 42, end: 61 },
  { juz: 4, start: 62, end: 81 },
  { juz: 5, start: 82, end: 101 },
  { juz: 6, start: 102, end: 121 },
  { juz: 7, start: 122, end: 141 },
  { juz: 8, start: 142, end: 161 },
  { juz: 9, start: 162, end: 181 },
  { juz: 10, start: 182, end: 201 },
  { juz: 11, start: 202, end: 221 },
  { juz: 12, start: 222, end: 241 },
  { juz: 13, start: 242, end: 261 },
  { juz: 14, start: 262, end: 281 },
  { juz: 15, start: 282, end: 301 },
  { juz: 16, start: 302, end: 321 },
  { juz: 17, start: 322, end: 341 },
  { juz: 18, start: 342, end: 361 },
  { juz: 19, start: 362, end: 381 },
  { juz: 20, start: 382, end: 401 },
  { juz: 21, start: 402, end: 421 },
  { juz: 22, start: 422, end: 441 },
  { juz: 23, start: 442, end: 461 },
  { juz: 24, start: 462, end: 481 },
  { juz: 25, start: 482, end: 501 },
  { juz: 26, start: 502, end: 521 },
  { juz: 27, start: 522, end: 541 },
  { juz: 28, start: 542, end: 561 },
  { juz: 29, start: 562, end: 581 },
  { juz: 30, start: 582, end: 604 },
];

// Surah data (starting page for each Surah)
const surahData = [
  { number: 1, name: "Al-Fatiha", arabic: "الفاتحة", startPage: 1 },
  { number: 2, name: "Al-Baqarah", arabic: "البقرة", startPage: 2 },
  { number: 3, name: "Aal-Imran", arabic: "آل عمران", startPage: 50 },
  { number: 4, name: "An-Nisa", arabic: "النساء", startPage: 77 },
  { number: 5, name: "Al-Ma'idah", arabic: "المائدة", startPage: 106 },
  { number: 6, name: "Al-An'am", arabic: "الأنعام", startPage: 128 },
  { number: 7, name: "Al-A'raf", arabic: "الأعراف", startPage: 151 },
  { number: 8, name: "Al-Anfal", arabic: "الأنفال", startPage: 177 },
  { number: 9, name: "At-Tawbah", arabic: "التوبة", startPage: 187 },
  { number: 10, name: "Yunus", arabic: "يونس", startPage: 208 },
  { number: 11, name: "Hud", arabic: "هود", startPage: 221 },
  { number: 12, name: "Yusuf", arabic: "يوسف", startPage: 235 },
  { number: 13, name: "Ar-Ra'd", arabic: "الرعد", startPage: 249 },
  { number: 14, name: "Ibrahim", arabic: "إبراهيم", startPage: 255 },
  { number: 15, name: "Al-Hijr", arabic: "الحجر", startPage: 262 },
  { number: 16, name: "An-Nahl", arabic: "النحل", startPage: 267 },
  { number: 17, name: "Al-Isra", arabic: "الإسراء", startPage: 282 },
  { number: 18, name: "Al-Kahf", arabic: "الكهف", startPage: 293 },
  { number: 19, name: "Maryam", arabic: "مريم", startPage: 305 },
  { number: 20, name: "Ta-Ha", arabic: "طه", startPage: 312 },
  { number: 21, name: "Al-Anbiya", arabic: "الأنبياء", startPage: 322 },
  { number: 22, name: "Al-Hajj", arabic: "الحج", startPage: 332 },
  { number: 23, name: "Al-Mu'minun", arabic: "المؤمنون", startPage: 342 },
  { number: 24, name: "An-Nur", arabic: "النور", startPage: 350 },
  { number: 25, name: "Al-Furqan", arabic: "الفرقان", startPage: 359 },
  { number: 26, name: "Ash-Shu'ara", arabic: "الشعراء", startPage: 367 },
  { number: 27, name: "An-Naml", arabic: "النمل", startPage: 377 },
  { number: 28, name: "Al-Qasas", arabic: "القصص", startPage: 385 },
  { number: 29, name: "Al-Ankabut", arabic: "العنكبوت", startPage: 396 },
  { number: 30, name: "Ar-Rum", arabic: "الروم", startPage: 404 },
  { number: 31, name: "Luqman", arabic: "لقمان", startPage: 411 },
  { number: 32, name: "As-Sajdah", arabic: "السجدة", startPage: 415 },
  { number: 33, name: "Al-Ahzab", arabic: "الأحزاب", startPage: 418 },
  { number: 34, name: "Saba", arabic: "سبأ", startPage: 428 },
  { number: 35, name: "Fatir", arabic: "فاطر", startPage: 434 },
  { number: 36, name: "Ya-Sin", arabic: "يس", startPage: 440 },
  { number: 37, name: "As-Saffat", arabic: "الصافات", startPage: 446 },
  { number: 38, name: "Sad", arabic: "ص", startPage: 453 },
  { number: 39, name: "Az-Zumar", arabic: "الزمر", startPage: 458 },
  { number: 40, name: "Ghafir", arabic: "غافر", startPage: 467 },
  { number: 41, name: "Fussilat", arabic: "فصلت", startPage: 477 },
  { number: 42, name: "Ash-Shura", arabic: "الشورى", startPage: 483 },
  { number: 43, name: "Az-Zukhruf", arabic: "الزخرف", startPage: 489 },
  { number: 44, name: "Ad-Dukhan", arabic: "الدخان", startPage: 496 },
  { number: 45, name: "Al-Jathiyah", arabic: "الجاثية", startPage: 499 },
  { number: 46, name: "Al-Ahqaf", arabic: "الأحقاف", startPage: 502 },
  { number: 47, name: "Muhammad", arabic: "محمد", startPage: 507 },
  { number: 48, name: "Al-Fath", arabic: "الفتح", startPage: 511 },
  { number: 49, name: "Al-Hujurat", arabic: "الحجرات", startPage: 515 },
  { number: 50, name: "Qaf", arabic: "ق", startPage: 518 },
  { number: 51, name: "Adh-Dhariyat", arabic: "الذاريات", startPage: 520 },
  { number: 52, name: "At-Tur", arabic: "الطور", startPage: 523 },
  { number: 53, name: "An-Najm", arabic: "النجم", startPage: 526 },
  { number: 54, name: "Al-Qamar", arabic: "القمر", startPage: 528 },
  { number: 55, name: "Ar-Rahman", arabic: "الرحمن", startPage: 531 },
  { number: 56, name: "Al-Waqi'ah", arabic: "الواقعة", startPage: 534 },
  { number: 57, name: "Al-Hadid", arabic: "الحديد", startPage: 537 },
  { number: 58, name: "Al-Mujadila", arabic: "المجادلة", startPage: 542 },
  { number: 59, name: "Al-Hashr", arabic: "الحشر", startPage: 545 },
  { number: 60, name: "Al-Mumtahanah", arabic: "الممتحنة", startPage: 549 },
  { number: 61, name: "As-Saff", arabic: "الصف", startPage: 551 },
  { number: 62, name: "Al-Jumu'ah", arabic: "الجمعة", startPage: 553 },
  { number: 63, name: "Al-Munafiqun", arabic: "المنافقون", startPage: 554 },
  { number: 64, name: "At-Taghabun", arabic: "التغابن", startPage: 556 },
  { number: 65, name: "At-Talaq", arabic: "الطلاق", startPage: 558 },
  { number: 66, name: "At-Tahrim", arabic: "التحريم", startPage: 560 },
  { number: 67, name: "Al-Mulk", arabic: "الملك", startPage: 562 },
  { number: 68, name: "Al-Qalam", arabic: "القلم", startPage: 564 },
  { number: 69, name: "Al-Haqqah", arabic: "الحاقة", startPage: 566 },
  { number: 70, name: "Al-Ma'arij", arabic: "المعارج", startPage: 568 },
  { number: 71, name: "Nuh", arabic: "نوح", startPage: 570 },
  { number: 72, name: "Al-Jinn", arabic: "الجن", startPage: 572 },
  { number: 73, name: "Al-Muzzammil", arabic: "المزمل", startPage: 574 },
  { number: 74, name: "Al-Muddaththir", arabic: "المدثر", startPage: 575 },
  { number: 75, name: "Al-Qiyamah", arabic: "القيامة", startPage: 577 },
  { number: 76, name: "Al-Insan", arabic: "الإنسان", startPage: 578 },
  { number: 77, name: "Al-Mursalat", arabic: "المرسلات", startPage: 580 },
  { number: 78, name: "An-Naba", arabic: "النبأ", startPage: 582 },
  { number: 79, name: "An-Nazi'at", arabic: "النازعات", startPage: 583 },
  { number: 80, name: "Abasa", arabic: "عبس", startPage: 585 },
  { number: 81, name: "At-Takwir", arabic: "التكوير", startPage: 586 },
  { number: 82, name: "Al-Infitar", arabic: "الانفطار", startPage: 587 },
  { number: 83, name: "Al-Mutaffifin", arabic: "المطففين", startPage: 587 },
  { number: 84, name: "Al-Inshiqaq", arabic: "الانشقاق", startPage: 589 },
  { number: 85, name: "Al-Buruj", arabic: "البروج", startPage: 590 },
  { number: 86, name: "At-Tariq", arabic: "الطارق", startPage: 591 },
  { number: 87, name: "Al-A'la", arabic: "الأعلى", startPage: 591 },
  { number: 88, name: "Al-Ghashiyah", arabic: "الغاشية", startPage: 592 },
  { number: 89, name: "Al-Fajr", arabic: "الفجر", startPage: 593 },
  { number: 90, name: "Al-Balad", arabic: "البلد", startPage: 594 },
  { number: 91, name: "Ash-Shams", arabic: "الشمس", startPage: 595 },
  { number: 92, name: "Al-Layl", arabic: "الليل", startPage: 595 },
  { number: 93, name: "Ad-Duha", arabic: "الضحى", startPage: 596 },
  { number: 94, name: "Ash-Sharh", arabic: "الشرح", startPage: 596 },
  { number: 95, name: "At-Tin", arabic: "التين", startPage: 597 },
  { number: 96, name: "Al-Alaq", arabic: "العلق", startPage: 597 },
  { number: 97, name: "Al-Qadr", arabic: "القدر", startPage: 598 },
  { number: 98, name: "Al-Bayyinah", arabic: "البينة", startPage: 598 },
  { number: 99, name: "Az-Zalzalah", arabic: "الزلزلة", startPage: 599 },
  { number: 100, name: "Al-Adiyat", arabic: "العاديات", startPage: 599 },
  { number: 101, name: "Al-Qari'ah", arabic: "القارعة", startPage: 600 },
  { number: 102, name: "At-Takathur", arabic: "التكاثر", startPage: 600 },
  { number: 103, name: "Al-Asr", arabic: "العصر", startPage: 601 },
  { number: 104, name: "Al-Humazah", arabic: "الهمزة", startPage: 601 },
  { number: 105, name: "Al-Fil", arabic: "الفيل", startPage: 601 },
  { number: 106, name: "Quraysh", arabic: "قريش", startPage: 602 },
  { number: 107, name: "Al-Ma'un", arabic: "الماعون", startPage: 602 },
  { number: 108, name: "Al-Kawthar", arabic: "الكوثر", startPage: 602 },
  { number: 109, name: "Al-Kafirun", arabic: "الكافرون", startPage: 603 },
  { number: 110, name: "An-Nasr", arabic: "النصر", startPage: 603 },
  { number: 111, name: "Al-Masad", arabic: "المسد", startPage: 603 },
  { number: 112, name: "Al-Ikhlas", arabic: "الإخلاص", startPage: 604 },
  { number: 113, name: "Al-Falaq", arabic: "الفلق", startPage: 604 },
  { number: 114, name: "An-Nas", arabic: "الناس", startPage: 604 },
];

// Get Juz number for a page
function getJuzForPage(pageNumber) {
  for (const juz of juzPageRanges) {
    if (pageNumber >= juz.start && pageNumber <= juz.end) {
      return juz.juz;
    }
  }
  return 1;
}

// Get Surah for a page
function getSurahForPage(pageNumber) {
  let currentSurah = surahData[0];
  
  for (const surah of surahData) {
    if (surah.startPage <= pageNumber) {
      currentSurah = surah;
    } else {
      break;
    }
  }
  
  return currentSurah;
}

// Generate all 604 pages
function generateQuranPages() {
  const pages = [];
  
  for (let page = 1; page <= 604; page++) {
    const juz = getJuzForPage(page);
    const surah = getSurahForPage(page);
    
    pages.push({
      pageNumber: page,
      juzNumber: juz,
      surahName: surah.name,
      surahNameArabic: surah.arabic
    });
  }
  
  return pages;
}

// Seed function
async function seedQuranData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check if data already exists
    const existingCount = await QuranMetadata.countDocuments();
    
    if (existingCount > 0) {
      console.log(`⚠️  QuranMetadata already has ${existingCount} records.`);
      console.log('   Delete existing data? Run with --force flag');
      
      if (process.argv.includes('--force')) {
        await QuranMetadata.deleteMany({});
        console.log('🗑️  Deleted existing data');
      } else {
        console.log('   Exiting without changes.');
        process.exit(0);
      }
    }
    
    // Generate and insert pages
    const pages = generateQuranPages();
    console.log(`📖 Generated ${pages.length} pages`);
    
    await QuranMetadata.insertMany(pages);
    console.log('✅ Successfully seeded QuranMetadata collection!');
    
    // Show sample data
    console.log('\n📋 Sample data:');
    const samples = await QuranMetadata.find().limit(5);
    samples.forEach(s => {
      console.log(`   Page ${s.pageNumber}: Juz ${s.juzNumber}, ${s.surahName} (${s.surahNameArabic})`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

// Run the seed
seedQuranData();