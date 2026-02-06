import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { progressAPI } from '../services/api';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [todayData, setTodayData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [completingPage, setCompletingPage] = useState(null);
  const [showExtraNew, setShowExtraNew] = useState(false);
  const [showExtraReview, setShowExtraReview] = useState(false);

  useEffect(() => {
    fetchTodayTasks();
  }, []);

  const fetchTodayTasks = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await progressAPI.getTodayTasks();
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

  const stats = todayData?.stats || {};
  const totalMemorized = stats.totalMemorized || 0;
  const hasCompletedQuran = totalMemorized === 604;
  const isTodayComplete = stats.todayComplete && totalMemorized > 0;

  const formatDailyPages = (pages) => {
    if (pages === 0.5) return '½';
    return pages;
  };

  // Page card component for reuse
  const PageCard = ({ page, type, isExtra = false }) => (
    <div className={`flex items-center justify-between ${type === 'new' ? 'bg-green-50' : 'bg-blue-50'} rounded-lg p-3`}>
      <div>
        <div className={`font-medium ${type === 'new' ? 'text-green-800' : 'text-gray-800'}`}>
          Page {page.pageNumber}
          {isExtra && <span className="text-xs ml-2 text-gray-500">(Extra)</span>}
        </div>
        <div className="text-sm text-gray-600">
          {page.surahName} • Juz {page.juzNumber}
        </div>
        {type === 'review' && page.reviewCount !== undefined && (
          <div className="text-xs text-gray-400">
            Reviewed {page.reviewCount} time{page.reviewCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      <button
        onClick={() => handleMarkComplete(page.pageNumber, type)}
        disabled={completingPage === page.pageNumber}
        className={`${type === 'new' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
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
  );

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
                {stats.currentStreak || 0} day streak
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
            <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
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
              : `You've memorized ${totalMemorized} pages (${stats.percentage || 0}% of the Quran)`}
          </p>
          <p className="opacity-75 text-sm mt-1">
            Daily goal: {formatDailyPages(stats.dailyNewPages)} new page{stats.dailyNewPages > 1 ? 's' : ''} + {stats.dailyReviewTarget || 3} review pages
          </p>
        </div>

        {/* Today Complete Card */}
        {isTodayComplete && !hasCompletedQuran && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-lg p-6 mb-6 text-white text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold mb-2">Masha'Allah! Today's Tasks Complete!</h3>
            <p className="opacity-90 mb-4">
              You've finished {stats.newPagesCompletedToday} new page{stats.newPagesCompletedToday !== 1 ? 's' : ''} and {stats.reviewsCompletedToday} review{stats.reviewsCompletedToday !== 1 ? 's' : ''} today!
            </p>
            <p className="opacity-75 text-sm">
              Come back tomorrow to continue your journey, or practice more below.
            </p>
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

        {/* Today's Tasks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* New Memorization Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌱</span>
                <h3 className="text-lg font-bold text-gray-800">New Memorization</h3>
              </div>
              <span className="text-sm text-gray-500">
                {stats.newPagesCompletedToday || 0}/{stats.targetNewPages || 1} done
              </span>
            </div>

            {/* Today's assigned new pages */}
            {todayData?.newPages && todayData.newPages.length > 0 ? (
              <div className="space-y-3 mb-4">
                {todayData.newPages.map((page) => (
                  <PageCard key={page.pageNumber} page={page} type="new" />
                ))}
              </div>
            ) : (
              <div className="bg-green-50 rounded-lg p-4 text-center mb-4">
                <div className="text-3xl mb-2">✅</div>
                <div className="text-green-700 font-medium">
                  {hasCompletedQuran
                    ? "You've completed the entire Quran!"
                    : "Today's memorization complete!"}
                </div>
              </div>
            )}

            {/* Want more? Section */}
            {!hasCompletedQuran && todayData?.extraNewPages?.length > 0 && (
              <div className="border-t pt-4">
                <button
                  onClick={() => setShowExtraNew(!showExtraNew)}
                  className="text-green-600 text-sm font-medium hover:underline flex items-center gap-1"
                >
                  {showExtraNew ? '▼' : '▶'} Want to memorize more? ({todayData.extraNewPages.length} pages)
                </button>
                {showExtraNew && (
                  <div className="space-y-3 mt-3">
                    {todayData.extraNewPages.map((page) => (
                      <PageCard key={page.pageNumber} page={page} type="new" isExtra />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Review Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔄</span>
                <h3 className="text-lg font-bold text-gray-800">Daily Review</h3>
              </div>
              <span className="text-sm text-gray-500">
                {stats.reviewsCompletedToday || 0}/{stats.dailyReviewTarget || 3} done
              </span>
            </div>

            {/* Today's assigned review pages */}
            {todayData?.reviewPages && todayData.reviewPages.length > 0 ? (
              <div className="space-y-3 mb-4">
                {todayData.reviewPages.map((page) => (
                  <PageCard key={page.pageNumber} page={page} type="review" />
                ))}
              </div>
            ) : (
              <div className="bg-blue-50 rounded-lg p-4 text-center mb-4">
                <div className="text-3xl mb-2">✅</div>
                <div className="text-blue-700 font-medium">
                  {totalMemorized === 0
                    ? "Start memorizing to build your review list!"
                    : "Today's reviews complete!"}
                </div>
              </div>
            )}

            {/* Want more? Section */}
            {todayData?.extraReviewPages?.length > 0 && (
              <div className="border-t pt-4">
                <button
                  onClick={() => setShowExtraReview(!showExtraReview)}
                  className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1"
                >
                  {showExtraReview ? '▼' : '▶'} Review more? ({todayData.extraReviewPages.length} pages)
                </button>
                {showExtraReview && (
                  <div className="space-y-3 mt-3">
                    {todayData.extraReviewPages.map((page) => (
                      <PageCard key={page.pageNumber} page={page} type="review" isExtra />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{totalMemorized}</div>
            <div className="text-gray-600 text-sm">Pages Memorized</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.percentage || 0}%</div>
            <div className="text-gray-600 text-sm">Complete</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">🔥 {stats.currentStreak || 0}</div>
            <div className="text-gray-600 text-sm">Day Streak</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">{604 - totalMemorized}</div>
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