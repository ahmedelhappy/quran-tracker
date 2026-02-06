import { Link } from 'react-router-dom';

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <span className="text-xl font-bold text-gray-800">Quran Tracker</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-6">
            Your Journey to Becoming a{' '}
            <span className="text-green-600">Hafiz</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            A personalized Quran memorization tracker that helps you build consistent habits, 
            track your progress, and achieve your Hifz goals with smart review scheduling.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl"
            >
              Start Your Journey - Free
            </Link>
            <a
              href="#features"
              className="bg-white text-green-600 px-8 py-3 rounded-lg font-medium text-lg border-2 border-green-600 hover:bg-green-50 transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* Benefits instead of stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
          <div className="bg-white rounded-xl p-6 shadow-md text-center">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold text-gray-800 mb-2">Stay Consistent</h3>
            <p className="text-gray-600 text-sm">Daily tasks and streak tracking keep you motivated</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md text-center">
            <div className="text-3xl mb-3">🧠</div>
            <h3 className="font-bold text-gray-800 mb-2">Remember Forever</h3>
            <p className="text-gray-600 text-sm">Smart review system based on proven science</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md text-center">
            <div className="text-3xl mb-3">📈</div>
            <h3 className="font-bold text-gray-800 mb-2">Track Progress</h3>
            <p className="text-gray-600 text-sm">Visual dashboard shows your journey clearly</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Everything You Need for Successful Hifz
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Built with proven memorization techniques and cognitive science principles
              to help you retain what you memorize.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-green-50 rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Personalized Plans</h3>
              <p className="text-gray-600">
                Set your daily memorization goal (½, 1, or 2 pages) and get a 
                customized schedule that fits your pace and lifestyle.
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🔄</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Smart Review System</h3>
              <p className="text-gray-600">
                Based on spaced repetition principles, our system schedules 
                reviews at optimal intervals to combat the forgetting curve.
              </p>
            </div>

            <div className="bg-orange-50 rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🔥</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Streak Tracking</h3>
              <p className="text-gray-600">
                Build consistency with daily streaks. See your progress grow 
                and stay motivated to maintain your memorization habit.
              </p>
            </div>

            <div className="bg-purple-50 rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Progress Dashboard</h3>
              <p className="text-gray-600">
                Visual statistics showing pages memorized, completion percentage, 
                and your journey progress at a glance.
              </p>
            </div>

            <div className="bg-yellow-50 rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Daily Tasks</h3>
              <p className="text-gray-600">
                Clear daily objectives for new memorization and review pages. 
                Never wonder what to work on next.
              </p>
            </div>

            <div className="bg-pink-50 rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Access Anywhere</h3>
              <p className="text-gray-600">
                Web-based application works on any device - desktop, tablet, 
                or mobile. No installation required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              How It Works
            </h2>
            <p className="text-gray-600">Get started in 3 simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Create Account</h3>
              <p className="text-gray-600">
                Sign up for free and tell us about your current memorization status.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Set Your Goals</h3>
              <p className="text-gray-600">
                Choose your daily memorization pace and we'll create your personalized plan.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Track Daily</h3>
              <p className="text-gray-600">
                Complete your daily tasks, mark progress, and watch your journey unfold.
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link
              to="/register"
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-green-700 transition-colors shadow-lg inline-block"
            >
              Start Now - It's Free
            </Link>
          </div>
        </div>
      </section>

      {/* Motivational Section */}
      <section className="py-16 md:py-24 bg-green-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-5xl mb-6">💎</div>
          <blockquote className="text-2xl md:text-3xl font-medium mb-4 italic">
            "The best among you are those who learn the Quran and teach it."
          </blockquote>
          <cite className="text-green-200">— Prophet Muhammad ﷺ (Sahih Bukhari)</cite>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-800 mb-2">Is Quran Tracker free to use?</h3>
              <p className="text-gray-600">
                Yes! Quran Tracker is completely free. We believe everyone should have 
                access to tools that help them memorize the Quran.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-800 mb-2">Do I need to install an app?</h3>
              <p className="text-gray-600">
                No installation needed. Quran Tracker is a web application that works 
                in your browser on any device - computer, tablet, or phone.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-800 mb-2">What if I've already memorized some Quran?</h3>
              <p className="text-gray-600">
                During onboarding, you can select which Juz you've memorized, or enter 
                specific page ranges. The system will start your journey from where you are.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-800 mb-2">How does the review system work?</h3>
              <p className="text-gray-600">
                Based on spaced repetition, you'll review 3 pages daily from your memorized 
                portions. This helps transfer knowledge to long-term memory.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📖</span>
                <span className="text-xl font-bold">Quran Tracker</span>
              </div>
              <p className="text-gray-400">
                A personalized memorization tracker to help you on your journey 
                to becoming a Hafiz.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link to="/register" className="hover:text-white transition-colors">
                    Get Started
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    Login
                  </Link>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">About</h4>
              <p className="text-gray-400">
                This project was developed as a graduation project to help 
                Muslims worldwide in their Quran memorization journey.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>© {new Date().getFullYear()} Quran Tracker. Built with ❤️ for the Ummah.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;