import { useState, useEffect } from 'react';
import { progressAPI } from '../services/api';
import Navbar from '../components/Navbar';

const Progress = () => {
  const [juzData, setJuzData] = useState([]);
  const [allProgress, setAllProgress] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      setIsLoading(true);
      const [juzRes, allRes] = await Promise.all([
        progressAPI.getJuzProgress(),
        progressAPI.getAllProgress()
      ]);
      setJuzData(juzRes.data.data);
      setAllProgress(allRes.data.data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load progress data');
    } finally {
      setIsLoading(false);
    }
  };

  // Get color based on percentage
  const getProgressColor = (percentage) => {
    if (percentage === 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-green-400';
    if (percentage >= 50) return 'bg-yellow-400';
    if (percentage >= 25) return 'bg-orange-400';
    if (percentage > 0) return 'bg-orange-300';
    return 'bg-gray-200';
  };

  const getTextColor = (percentage) => {
    if (percentage >= 50) return 'text-white';
    if (percentage > 0) return 'text-white';
    return 'text-gray-500';
  };

  const getBorderColor = (percentage) => {
    if (percentage === 100) return 'border-green-600';
    if (percentage > 0) return 'border-yellow-500';
    return 'border-gray-300';
  };

  if (isLoading) {
    return (
      <div>
        <Navbar />
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading progress...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalMemorized = allProgress?.totalMemorized || 0;
  const percentage = allProgress?.percentage || 0;
  const completedJuz = juzData.filter(j => j.isComplete).length;
  const inProgressJuz = juzData.filter(j => j.percentage > 0 && !j.isComplete).length;

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">📈 Memorization Progress</h2>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Overall Progress Card */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Overall Progress</h3>
              <p className="opacity-90">
                {totalMemorized} of 604 pages memorized
              </p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold">{percentage}%</div>
              <div className="text-sm opacity-75">Complete</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-green-700 rounded-full h-4">
              <div
                className="bg-white rounded-full h-4 transition-all duration-500"
                style={{ width: `${Math.max(percentage, 1)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{completedJuz}</div>
            <div className="text-gray-600 text-sm">Juz Complete</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{inProgressJuz}</div>
            <div className="text-gray-600 text-sm">Juz In Progress</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-gray-400">
              {30 - completedJuz - inProgressJuz}
            </div>
            <div className="text-gray-600 text-sm">Juz Not Started</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">
              {604 - totalMemorized}
            </div>
            <div className="text-gray-600 text-sm">Pages Remaining</div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 justify-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-gray-600">Complete (100%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-400"></div>
              <span className="text-gray-600">In Progress (1-99%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-200"></div>
              <span className="text-gray-600">Not Started (0%)</span>
            </div>
          </div>
        </div>

        {/* Juz Grid */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Juz Overview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {juzData.map((juz) => (
              <div
                key={juz.juzNumber}
                className={`border-2 rounded-lg p-3 text-center transition-all hover:shadow-md ${getBorderColor(juz.percentage)}`}
              >
                <div className="text-xs text-gray-500 mb-1">Juz</div>
                <div className="text-2xl font-bold text-gray-800 mb-2">
                  {juz.juzNumber}
                </div>

                {/* Mini Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`${getProgressColor(juz.percentage)} rounded-full h-2 transition-all`}
                    style={{ width: `${juz.percentage}%` }}
                  ></div>
                </div>

                <div className="text-sm font-medium text-gray-700">
                  {juz.percentage}%
                </div>
                <div className="text-xs text-gray-500">
                  {juz.memorizedPages}/{juz.totalPages} pages
                </div>

                {juz.isComplete && (
                  <div className="text-green-500 text-sm mt-1">✅</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Juz List */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Detailed Breakdown</h3>
          <div className="space-y-3">
            {juzData.map((juz) => (
              <div key={juz.juzNumber} className="flex items-center gap-4">
                <div className="w-16 text-sm font-medium text-gray-700">
                  Juz {juz.juzNumber}
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`${getProgressColor(juz.percentage)} rounded-full h-3 transition-all`}
                      style={{ width: `${juz.percentage}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-20 text-right text-sm text-gray-600">
                  {juz.memorizedPages}/{juz.totalPages}
                </div>
                <div className="w-12 text-right text-sm font-medium text-gray-700">
                  {juz.percentage}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Progress;