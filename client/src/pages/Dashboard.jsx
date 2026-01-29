import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    // Will automatically redirect to login via ProtectedRoute
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">📖 Quran Tracker</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Welcome, {user?.name}!</span>
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
        {/* Welcome Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Assalamu Alaikum, {user?.name}! 👋
          </h2>
          <p className="text-gray-600">
            Welcome to your Quran memorization journey.
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            📊 Your Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-green-800 font-medium">Current Streak</p>
              <p className="text-3xl font-bold text-green-600">
                🔥 {user?.currentStreak || 0} days
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-blue-800 font-medium">Daily Goal</p>
              <p className="text-3xl font-bold text-blue-600">
                📖 {user?.dailyNewPages || 1} page
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-purple-800 font-medium">Onboarding</p>
              <p className="text-3xl font-bold text-purple-600">
                {user?.onboardingComplete ? '✅ Done' : '⏳ Pending'}
              </p>
            </div>
          </div>
        </div>

        {/* Next Steps Card */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">🚀 Next Steps</h3>
          <p className="mb-4">
            {user?.onboardingComplete
              ? "You're all set! Your daily tasks will appear here."
              : "Complete onboarding to start your memorization journey."}
          </p>
          <button className="bg-white text-green-600 px-6 py-2 rounded-lg font-medium hover:bg-green-50 transition-colors">
            {user?.onboardingComplete ? 'View Today\'s Tasks' : 'Start Onboarding'}
          </button>
        </div>

        {/* Auth Test Info (for debugging) */}
        <div className="mt-6 bg-gray-800 text-gray-100 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">🔧 Debug Info (remove later)</h4>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;