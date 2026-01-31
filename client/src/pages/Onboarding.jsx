import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { progressAPI } from '../services/api';

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [selectedJuz, setSelectedJuz] = useState([]);
  const [dailyPages, setDailyPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  // Juz data with page ranges
  const juzList = Array.from({ length: 30 }, (_, i) => ({
    number: i + 1,
    name: `Juz ${i + 1}`,
  }));

  // Convert selected Juz to page numbers
  const getMemorizedPages = () => {
    const pages = [];
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

    selectedJuz.forEach(juzNum => {
      const juz = juzPageRanges.find(j => j.juz === juzNum);
      if (juz) {
        for (let page = juz.start; page <= juz.end; page++) {
          pages.push(page);
        }
      }
    });

    return pages;
  };

  const toggleJuz = (juzNumber) => {
    setSelectedJuz(prev =>
      prev.includes(juzNumber)
        ? prev.filter(j => j !== juzNumber)
        : [...prev, juzNumber]
    );
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError('');

    try {
      const memorizedPages = getMemorizedPages();
      
      await progressAPI.completeOnboarding({
        memorizedPages,
        dailyNewPages: dailyPages
      });

      // Refresh the page to update user state
      window.location.href = '/dashboard';

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete onboarding');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">📖 Quran Tracker</h1>
          <p className="text-gray-500 mt-2">Let's set up your memorization journey</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-12 h-1 ${
                      step > s ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Welcome, {user?.name}! 👋
            </h2>
            <p className="text-gray-600 mb-6">
              Bismillah! We'll help you create a personalized Quran memorization plan.
              This will only take a minute.
            </p>
            <div className="bg-green-50 p-4 rounded-lg mb-6">
              <h3 className="font-medium text-green-800 mb-2">What we'll set up:</h3>
              <ul className="text-green-700 text-sm space-y-1">
                <li>✓ Your current memorization progress</li>
                <li>✓ Your daily memorization goal</li>
                <li>✓ Your personalized review schedule</li>
              </ul>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Let's Get Started →
            </button>
          </div>
        )}

        {/* Step 2: Select Memorized Juz */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              What have you already memorized?
            </h2>
            <p className="text-gray-600 mb-6">
              Select the Juz (parts) you have already memorized. Don't worry if it's not perfect — you can adjust later.
            </p>

            {/* Quick Select */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSelectedJuz([])}
                className="px-3 py-1 text-sm rounded-lg bg-gray-200 hover:bg-gray-300"
              >
                Clear All
              </button>
              <button
                onClick={() => setSelectedJuz([30])}
                className="px-3 py-1 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
              >
                Only Juz 30
              </button>
              <button
                onClick={() => setSelectedJuz([29, 30])}
                className="px-3 py-1 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
              >
                Juz 29-30
              </button>
            </div>

            {/* Juz Grid */}
            <div className="grid grid-cols-5 gap-2 mb-6">
              {juzList.map((juz) => (
                <button
                  key={juz.number}
                  onClick={() => toggleJuz(juz.number)}
                  className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedJuz.includes(juz.number)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {juz.number}
                </button>
              ))}
            </div>

            {/* Selection Summary */}
            <div className="bg-gray-50 p-3 rounded-lg mb-6 text-sm">
              <span className="text-gray-600">Selected: </span>
              <span className="font-medium text-gray-800">
                {selectedJuz.length === 0
                  ? 'None (starting fresh)'
                  : `${selectedJuz.length} Juz (${getMemorizedPages().length} pages)`}
              </span>
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Daily Goal */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Set your daily goal
            </h2>
            <p className="text-gray-600 mb-6">
              How many new pages would you like to memorize each day?
            </p>

            {/* Goal Options */}
            <div className="space-y-3 mb-6">
              {[
                { value: 0.5, label: 'Light', desc: '½ page per day — ~3 years to complete' },
                { value: 1, label: 'Moderate', desc: '1 page per day — ~2 years to complete' },
                { value: 2, label: 'Intensive', desc: '2 pages per day — ~1 year to complete' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDailyPages(option.value)}
                  className={`w-full p-4 rounded-lg text-left transition-colors ${
                    dailyPages === option.value
                      ? 'bg-green-100 border-2 border-green-600'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium text-gray-800">{option.label}</div>
                  <div className="text-sm text-gray-600">{option.desc}</div>
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-green-50 p-4 rounded-lg mb-6">
              <h3 className="font-medium text-green-800 mb-2">📋 Your Plan Summary</h3>
              <ul className="text-green-700 text-sm space-y-1">
                <li>• Already memorized: {getMemorizedPages().length} pages</li>
                <li>• Daily new pages: {dailyPages}</li>
                <li>• Daily review: 3 pages</li>
                <li>• Remaining: {604 - getMemorizedPages().length} pages</li>
              </ul>
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleComplete}
                disabled={isLoading}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-green-400"
              >
                {isLoading ? 'Saving...' : 'Start My Journey 🚀'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;