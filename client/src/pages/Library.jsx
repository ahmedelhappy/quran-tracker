import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Library = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleNotify = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
      setEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="text-center max-w-lg">
          {/* Decorative illustration */}
          <div className="w-32 h-32 bg-gradient-to-br from-green-100 to-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm border border-gray-100">
            <span className="text-6xl">📚</span>
          </div>

          <h1 className="text-3xl font-extrabold text-[#1A1A1A] dark:text-gray-100 mb-3">
            Quran Library — Coming Soon! 📚
          </h1>
          <p className="text-[#4A4A4A] dark:text-gray-400 leading-relaxed mb-8">
            We are crafting a serene, distraction-free environment for your studies.
            Access the Mushaf, Tafseer, and recitations — all in one place — coming soon.
          </p>

          {/* Notify form */}
          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 text-[#1B4332] font-medium">
              ✅ You're on the list! We'll let you know when the library is ready.
            </div>
          ) : (
            <form onSubmit={handleNotify} className="flex gap-2 max-w-sm mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#40916C] focus:ring-1 focus:ring-[#40916C]"
              />
              <button
                type="submit"
                className="bg-[#1B4332] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#2D6A4F] transition-colors whitespace-nowrap"
              >
                Notify Me →
              </button>
            </form>
          )}
          <p className="text-xs text-gray-400 mt-3">
            We'll only email you when the library is ready. No spam, ever.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Library;
