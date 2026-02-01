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
      setError('');
      const response = await progressAPI.getTodayTasks();
      console.log('Today tasks response:', response.data.data); // Debug log
      setTodayData(response.data.data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.response?.data?.message || 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkComplete = async (pageNumber, type) => {
    try {
      setCompletingPage(pageNumber);
      setError('');
      await progressAPI.markComplete({ pageNumber, type });
      // Refresh data after marking complete
      await fetchTodayTasks();
    } catch (err) {
      console.error('Mark complete error:', err);
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

  // Check completion states
  const hasNewPages = todayData?.newPages && todayData.newPages.length > 0;
  const hasReviewPages = todayData?.reviewPages && todayData.reviewPages.length > 0;
  const totalMemorized = todayData?.stats?.totalMemorized || 0;
  const hasCompletedQuran = totalMemorized === 604;
  
  // Today is complete if: has memorized pages AND no new pages AND no review pages
  const isTodayComplete = totalMemorized > 0 && !hasNewPages && !hasReviewPages;

  // Format daily pages display
  const formatDailyPages = (pages) => {
    if (pages === 0.5) return '½';
    if (pages === 1) return '1';
    return pages;
  };

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
          <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm flex justify-between items-center">
            <span>{error}</span>
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
            {totalMemorized === 0
              ? "Ready to start your memorization journey?"
              : `You've memorized ${totalMemorized} pages (${todayData?.stats?.percentage || 0}% of the Quran)`}
          </p>
          {todayData?.stats?.dailyNewPages && (
            <p className="opacity-75 text-sm mt-1">
              Daily goal: {formatDailyPages(todayData.stats.dailyNewPages)} page{todayData.stats.dailyNewPages > 1 ? 's' : ''} per day
            </p>
          )}
        </div>

        {/* Today Complete Card */}
        {isTodayComplete && !hasCompletedQuran && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-lg p-6 mb-6 text-white text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold mb-2">Masha'Allah! Today's Tasks Complete!</h3>
            <p className="opacity-90 mb-4">
              You've finished your memorization and review for today. Come back tomorrow to continue your journey!
            </p>
            <button
              onClick={fetchTodayTasks}
              className="bg-white text-orange-600 px-6 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        )}

        {/* Quran Complete Card */}
        {hasCompletedQuran && (
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg p-6 mb-6 text-white text-center">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-2xl font-bold mb-2">Alhamdulillah! You Are a Hafiz!</h3>
            <p className="opacity-90">
              You have memorized the entire Quran. May Allah preserve it in your heart forever.
            </p>
          </div>
        )}

        {/* Today's Tasks - Show when not complete */}
        {!isTodayComplete && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* New Memorization Card */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🌱</span>
                <h3 className="text-lg font-bold text-gray-800">New Memorization</h3>
              </div>

              {hasNewPages ? (
                <div className="space-y-3 mb-4">
                  {todayData.newPages.map((page) => (
                    <div key={page.pageNumber} className="bg-green-50 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-2xl font-bold text-green-600 mb-1">
                            Page {page.pageNumber}
                          </div>
                          <div className="text-gray-600">
                            {page.surahName} • Juz {page.juzNumber}
                          </div>
                          <div className="text-sm text-gray-500 mt-1 font-arabic">
                            {page.surahNameArabic}
                          </div>
                        </div>
                        <button
                          onClick={() => handleMarkComplete(page.pageNumber, 'new')}
                          disabled={completingPage === page.pageNumber}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
                        >
                          {completingPage === page.pageNumber ? (
                            <span className="flex items-center gap-1">
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              Saving
                            </span>
                          ) : (
                            '✓ Done'
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-4xl mb-2">✅</div>
                  <div className="text-gray-600">
                    {hasCompletedQuran
                      ? "Masha'Allah! You've completed the entire Quran!"
                      : "New memorization complete! Focus on review."}
                  </div>
                </div>
              )}
            </div>

            {/* Review Card */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🔄</span>
                <h3 className="text-lg font-bold text-gray-800">Daily Review</h3>
              </div>

              {hasReviewPages ? (
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
                        <div className="text-xs text-gray-400">
                          Reviewed {page.reviewCount || 0} time{page.reviewCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkComplete(page.pageNumber, 'review')}
                        disabled={completingPage === page.pageNumber}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                      >
                        {completingPage === page.pageNumber ? (
                          <span className="flex items-center gap-1">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          </span>
                        ) : (
                          '✓ Done'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-gray-600">
                    {totalMemorized === 0
                      ? "No review pages yet. Start memorizing to build your review list!"
                      : "✅ All reviews complete for today!"}
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-500 text-center mt-4">
                {todayData?.reviewPages?.length || 0} page{(todayData?.reviewPages?.length || 0) !== 1 ? 's' : ''} to review
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-green-600">
              {totalMemorized}
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
              {604 - totalMemorized}
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