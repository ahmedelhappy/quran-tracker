import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { progressAPI } from '../services/api';

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [selectedJuz, setSelectedJuz] = useState([]);
  const [pageRanges, setPageRanges] = useState([]);
  const [dailyPages, setDailyPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { user } = useAuth();

  // Juz page ranges
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

  // Get all memorized pages (from Juz + all page ranges)
  const getMemorizedPages = () => {
    const pages = new Set();

    // Add pages from selected Juz
    selectedJuz.forEach(juzNum => {
      const juz = juzPageRanges.find(j => j.juz === juzNum);
      if (juz) {
        for (let page = juz.start; page <= juz.end; page++) {
          pages.add(page);
        }
      }
    });

    // Add pages from all page ranges
    pageRanges.forEach(range => {
      if (range.start && range.end) {
        const start = parseInt(range.start);
        const end = parseInt(range.end);
        if (start >= 1 && end <= 604 && start <= end) {
          for (let page = start; page <= end; page++) {
            pages.add(page);
          }
        }
      }
    });

    return Array.from(pages).sort((a, b) => a - b);
  };

  const toggleJuz = (juzNumber) => {
    setSelectedJuz(prev =>
      prev.includes(juzNumber)
        ? prev.filter(j => j !== juzNumber)
        : [...prev, juzNumber]
    );
  };

  // Add a new page range
  const addPageRange = () => {
    setPageRanges([...pageRanges, { start: '', end: '', id: Date.now() }]);
  };

  // Update a page range
  const updatePageRange = (id, field, value) => {
    setPageRanges(pageRanges.map(range =>
      range.id === id ? { ...range, [field]: value } : range
    ));
  };

  // Remove a page range
  const removePageRange = (id) => {
    setPageRanges(pageRanges.filter(range => range.id !== id));
  };

  // Get Juz info for a page number
  const getJuzForPage = (pageNum) => {
    for (const juz of juzPageRanges) {
      if (pageNum >= juz.start && pageNum <= juz.end) {
        return juz.juz;
      }
    }
    return null;
  };

  // Validate a single page range
  const validateRange = (range) => {
    if (!range.start && !range.end) return { valid: true, empty: true };
    
    const start = parseInt(range.start);
    const end = parseInt(range.end);
    
    if (isNaN(start) || isNaN(end)) return { valid: false, error: 'Enter valid numbers' };
    if (start < 1 || end > 604) return { valid: false, error: 'Pages must be 1-604' };
    if (start > end) return { valid: false, error: 'Start must be ≤ End' };
    
    return { valid: true, empty: false };
  };

  // Validate all page ranges
  const validateAllRanges = () => {
    for (const range of pageRanges) {
      const result = validateRange(range);
      if (!result.valid) return false;
    }
    return true;
  };

  const handleComplete = async () => {
    if (!validateAllRanges()) {
      setError('Please fix invalid page ranges');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const memorizedPages = getMemorizedPages();

      await progressAPI.completeOnboarding({
        memorizedPages,
        dailyNewPages: dailyPages
      });

      window.location.href = '/dashboard';

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete onboarding');
      setIsLoading(false);
    }
  };

  const totalMemorizedPages = getMemorizedPages().length;

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
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {s}
                </div>
                {s < 4 && (
                  <div className={`w-8 h-1 ${step > s ? 'bg-green-600' : 'bg-gray-300'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="underline">Dismiss</button>
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
                <li>✓ Your current memorization progress (complete Juz)</li>
                <li>✓ Any partial memorization (specific page ranges)</li>
                <li>✓ Your daily memorization goal</li>
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

        {/* Step 2: Select Complete Juz */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Select Complete Juz
            </h2>
            <p className="text-gray-600 mb-6">
              Which Juz have you <strong>fully memorized</strong>? Select all that apply.
              <br />
              <span className="text-sm text-gray-500">
                (You can add partial pages in the next step)
              </span>
            </p>

            {/* Quick Select Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setSelectedJuz([])}
                className="px-3 py-1 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setSelectedJuz([30])}
                className="px-3 py-1 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              >
                Only Juz 30
              </button>
              <button
                onClick={() => setSelectedJuz([29, 30])}
                className="px-3 py-1 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              >
                Juz 29-30
              </button>
              <button
                onClick={() => setSelectedJuz([28, 29, 30])}
                className="px-3 py-1 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              >
                Juz 28-30
              </button>
            </div>

            {/* Juz Grid */}
            <div className="grid grid-cols-5 gap-2 mb-6">
              {juzPageRanges.map((juz) => (
                <button
                  key={juz.juz}
                  onClick={() => toggleJuz(juz.juz)}
                  className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedJuz.includes(juz.juz)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {juz.juz}
                </button>
              ))}
            </div>

            {/* Selection Summary */}
            <div className="bg-gray-50 p-3 rounded-lg mb-6 text-sm">
              <span className="text-gray-600">Selected complete Juz: </span>
              <span className="font-medium text-gray-800">
                {selectedJuz.length === 0
                  ? 'None'
                  : `${selectedJuz.length} Juz (${selectedJuz.sort((a, b) => a - b).join(', ')})`}
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

        {/* Step 3: Partial Memorization (Multiple Ranges) */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Partial Memorization
            </h2>
            <p className="text-gray-600 mb-6">
              Have you memorized pages that aren't part of a complete Juz?
              You can add multiple page ranges.
            </p>

            {/* Page Ranges List */}
            <div className="space-y-4 mb-6">
              {pageRanges.length === 0 ? (
                <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
                  No page ranges added yet
                </div>
              ) : (
                pageRanges.map((range, index) => {
                  const validation = validateRange(range);
                  return (
                    <div key={range.id} className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-blue-800">Range {index + 1}</span>
                        <button
                          onClick={() => removePageRange(range.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ✕ Remove
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">From Page</label>
                          <input
                            type="number"
                            min="1"
                            max="604"
                            value={range.start}
                            onChange={(e) => updatePageRange(range.id, 'start', e.target.value)}
                            placeholder="1"
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                              !validation.valid && !validation.empty ? 'border-red-400' : 'border-gray-300'
                            }`}
                          />
                        </div>
                        <span className="text-gray-500 mt-5">to</span>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">To Page</label>
                          <input
                            type="number"
                            min="1"
                            max="604"
                            value={range.end}
                            onChange={(e) => updatePageRange(range.id, 'end', e.target.value)}
                            placeholder="10"
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                              !validation.valid && !validation.empty ? 'border-red-400' : 'border-gray-300'
                            }`}
                          />
                        </div>
                      </div>
                      
                      {/* Show validation error or Juz info */}
                      {!validation.valid && !validation.empty && (
                        <div className="mt-2 text-sm text-red-600">{validation.error}</div>
                      )}
                      {validation.valid && !validation.empty && range.start && range.end && (
                        <div className="mt-2 text-sm text-blue-700">
                          {parseInt(range.end) - parseInt(range.start) + 1} pages
                          {getJuzForPage(parseInt(range.start)) && (
                            <span>
                              {' '}• Juz {getJuzForPage(parseInt(range.start))}
                              {getJuzForPage(parseInt(range.end)) !== getJuzForPage(parseInt(range.start)) && 
                                `-${getJuzForPage(parseInt(range.end))}`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Range Button */}
            <button
              onClick={addPageRange}
              className="w-full py-3 border-2 border-dashed border-green-400 text-green-600 rounded-lg font-medium hover:bg-green-50 transition-colors mb-6"
            >
              + Add Page Range
            </button>

            {/* Info */}
            <div className="bg-gray-50 p-3 rounded-lg mb-6 text-sm">
              <p className="text-gray-600">
                💡 <strong>Tip:</strong> Page numbers are from 1 to 604 (Madani Mushaf).
                Add as many ranges as needed.
              </p>
            </div>

            {/* Summary */}
            <div className="bg-green-50 p-3 rounded-lg mb-6 text-sm">
              <span className="text-gray-600">Total pages to be marked as memorized: </span>
              <span className="font-medium text-green-700">
                {totalMemorizedPages} pages
              </span>
              {selectedJuz.length > 0 && pageRanges.length > 0 && (
                <span className="text-gray-500 ml-1">
                  (from {selectedJuz.length} Juz + {pageRanges.filter(r => r.start && r.end).length} range{pageRanges.filter(r => r.start && r.end).length !== 1 ? 's' : ''})
                </span>
              )}
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
                onClick={() => setStep(4)}
                disabled={!validateAllRanges()}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Daily Goal */}
        {step === 4 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Set Your Daily Goal
            </h2>
            <p className="text-gray-600 mb-6">
              How many new pages would you like to memorize each day?
            </p>

            {/* Goal Options */}
            <div className="space-y-3 mb-6">
              {[
                { value: 0.5, label: 'Light', desc: '½ page per day — Great for busy schedules', time: '~3.5 years' },
                { value: 1, label: 'Moderate', desc: '1 page per day — Balanced approach', time: '~2 years' },
                { value: 2, label: 'Intensive', desc: '2 pages per day — For dedicated learners', time: '~1 year' },
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
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-800">{option.label}</div>
                      <div className="text-sm text-gray-600">{option.desc}</div>
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                      {option.time}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Daily Review Info */}
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h3 className="font-medium text-blue-800 mb-2">📚 Daily Review</h3>
              <p className="text-blue-700 text-sm">
                In addition to new memorization, you'll review <strong>3 pages</strong> daily 
                from your previously memorized portions. This helps strengthen retention.
              </p>
            </div>

            {/* Final Summary */}
            <div className="bg-green-50 p-4 rounded-lg mb-6">
              <h3 className="font-medium text-green-800 mb-2">📋 Your Plan Summary</h3>
              <ul className="text-green-700 text-sm space-y-1">
                <li>• Already memorized: <strong>{totalMemorizedPages} pages</strong></li>
                <li>• Daily new memorization: <strong>{dailyPages === 0.5 ? '½' : dailyPages} page{dailyPages > 1 ? 's' : ''}</strong></li>
                <li>• Daily review: <strong>3 pages</strong></li>
                <li>• Remaining to memorize: <strong>{604 - totalMemorizedPages} pages</strong></li>
              </ul>
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleComplete}
                disabled={isLoading}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Saving...
                  </span>
                ) : (
                  'Start My Journey 🚀'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;