import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { progressAPI } from '../services/api';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [todayData, setTodayData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [completingPage, setCompletingPage] = useState(null);

  useEffect(() => {
    fetchTodayTasks();
  }, []);

  const fetchTodayTasks = async () => {
    try {
      setIsLoading(true);
      const response = await progressAPI.getTodayTasks();
      setTodayData(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkComplete = async (pageNumber, type) => {
    try {
      setCompletingPage(pageNumber);
      await progressAPI.markComplete({ pageNumber, type });
      // Refresh data
      await fetchTodayTasks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark complete');
    } finally {
      setCompletingPage(null);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">📖 Quran Tracker</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-orange-100 px-3 py-1 rounded-full">
              <span className="text-orange-600">🔥</span>
              <span className="font-medium text-orange-700">
                {todayData?.stats?.currentStreak || 0} day streak
              </span>
            </div>
            <span className="text-gray-600 hidden sm:inline">Welcome, {user?.name}!</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 mb-6 text-white">
          <h2 className="text-2xl font-bold mb-2">
            Assalamu Alaikum, {user?.name}! 👋
          </h2>
          <p className="opacity-90">
            {todayData?.stats?.totalMemorized === 0
              ? "Ready to start your memorization journey?"
              : `You've memorized ${todayData?.stats?.totalMemorized} pages (${todayData?.stats?.percentage}% of the Quran)`}
          </p>
        </div>

        {/* Today's Tasks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* New Memorization Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🌱</span>
              <h3 className="text-lg font-bold text-gray-800">New Memorization</h3>
            </div>

            {todayData?.newPage ? (
              <div className="bg-green-50 rounded-lg p-4 mb-4">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  Page {todayData.newPage.pageNumber}
                </div>
                <div className="text-gray-600">
                  {todayData.newPage.surahName} • Juz {todayData.newPage.juzNumber}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {todayData.newPage.surahNameArabic}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-center">
                <div className="text-4xl mb-2">🎉</div>
                <div className="text-gray-600">
                  Masha'Allah! You've completed the entire Quran!
                </div>
              </div>
            )}

            {todayData?.newPage && (
              <button
                onClick={() => handleMarkComplete(todayData.newPage.pageNumber, 'new')}
                disabled={completingPage === todayData.newPage.pageNumber}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-green-400"
              >
                {completingPage === todayData.newPage.pageNumber
                  ? 'Saving...'
                  : '✓ Mark as Memorized'}
              </button>
            )}
          </div>

          {/* Review Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🔄</span>
              <h3 className="text-lg font-bold text-gray-800">Daily Review</h3>
            </div>

            {todayData?.reviewPages?.length > 0 ? (
              <div className="space-y-3 mb-4">
                {todayData.reviewPages.map((page) => (
                  <div
                    key={page.pageNumber}
                    className="flex items-center justify-between bg-blue-50 rounded-lg p-3"
                  >
                    <div>
                      <div className="font-medium text-gray-800">
                        Page {page.pageNumber}
                      </div>
                      <div className="text-sm text-gray-600">
                        {page.surahName} • Juz {page.juzNumber}
                      </div>
                    </div>
                    <button
                      onClick={() => handleMarkComplete(page.pageNumber, 'review')}
                      disabled={completingPage === page.pageNumber}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                    >
                      {completingPage === page.pageNumber ? '...' : '✓ Done'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-center">
                <div className="text-gray-600">
                  No review pages yet. Start memorizing to build your review list!
                </div>
              </div>
            )}

            <div className="text-sm text-gray-500 text-center">
              {todayData?.reviewPages?.length || 0} / 3 pages to review
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-green-600">
              {todayData?.stats?.totalMemorized || 0}
            </div>
            <div className="text-gray-600 text-sm">Pages Memorized</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {todayData?.stats?.percentage || 0}%
            </div>
            <div className="text-gray-600 text-sm">Complete</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">
              🔥 {todayData?.stats?.currentStreak || 0}
            </div>
            <div className="text-gray-600 text-sm">Day Streak</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">
              {604 - (todayData?.stats?.totalMemorized || 0)}
            </div>
            <div className="text-gray-600 text-sm">Pages Left</div>
          </div>
        </div>

        {/* Motivational Quote */}
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-4xl mb-4">💎</div>
          <blockquote className="text-gray-700 italic mb-2">
            "The best among you are those who learn the Quran and teach it."
          </blockquote>
          <cite className="text-gray-500 text-sm">— Prophet Muhammad ﷺ (Sahih Bukhari)</cite>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;