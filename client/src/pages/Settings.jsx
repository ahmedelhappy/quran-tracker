import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, progressAPI } from '../services/api';
import Navbar from '../components/Navbar';

const Settings = () => {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState('');
  const [dailyPages, setDailyPages] = useState(1);
  const [profileData, setProfileData] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [profileRes, progressRes] = await Promise.all([
        authAPI.getMe(),
        progressAPI.getAllProgress()
      ]);

      const profile = profileRes.data.data;
      setProfileData(profile);
      setName(profile.name);
      setDailyPages(profile.dailyNewPages);
      setProgressData(progressRes.data.data);
    } catch (err) {
      console.error('Fetch error:', err);
      setMessage({ type: 'error', text: 'Failed to load profile data' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage({ type: '', text: '' });

      const response = await authAPI.updateProfile({
        name: name.trim(),
        dailyNewPages: dailyPages
      });

      // Update the AuthContext with new data so Navbar and other components update immediately
      const updatedData = response.data.data;
      updateUser({
        name: updatedData.name,
        dailyNewPages: updatedData.dailyNewPages
      });

      // Also update local profile data
      setProfileData(prev => ({
        ...prev,
        name: updatedData.name,
        dailyNewPages: updatedData.dailyNewPages
      }));

      setMessage({ type: 'success', text: 'Settings saved successfully!' });

      // Clear success message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save settings'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div>
        <Navbar />
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙️ Settings</h2>

        {/* Message */}
        {message.text && (
          <div
            className={`p-3 rounded-lg mb-6 text-sm ${
              message.type === 'success'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Profile Settings */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">👤 Profile</h3>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Your name"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={profileData?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>
          </div>
        </div>

        {/* Memorization Settings */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">📖 Memorization Plan</h3>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-3">
              Daily New Pages Goal
            </label>
            <div className="space-y-3">
              {[
                { value: 0.5, label: 'Light', desc: '½ page per day', time: '~3.5 years' },
                { value: 1, label: 'Moderate', desc: '1 page per day', time: '~2 years' },
                { value: 2, label: 'Intensive', desc: '2 pages per day', time: '~1 year' },
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
                  <div className="flex justify-between items-center">
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

            <div className="bg-blue-50 p-3 rounded-lg mt-4 text-sm text-blue-700">
              💡 Daily review will always be 3 pages from your memorized portions.
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed mb-6"
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Saving...
            </span>
          ) : (
            'Save Settings'
          )}
        </button>

        {/* Account Info */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Account Information</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Member Since</div>
              <div className="font-medium text-gray-800">
                {formatDate(profileData?.createdAt)}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Current Streak</div>
              <div className="font-medium text-gray-800">
                🔥 {profileData?.currentStreak || 0} days
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Pages Memorized</div>
              <div className="font-medium text-gray-800">
                {progressData?.totalMemorized || 0} / 604
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Completion</div>
              <div className="font-medium text-gray-800">
                {progressData?.percentage || 0}%
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;