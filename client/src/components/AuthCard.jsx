import Footer from './Footer';
import Logo from './Logo';
import LanguageToggle from './LanguageToggle';

// The sign-in page's frame — language toggle, logo, one card with its h1 — for
// the password pages that sit next to it (H-06). `titleRef` lets a page move
// focus to the heading when the card's content is replaced (the form gives way
// to a confirmation), so a screen reader hears the new state and keyboard
// focus is not left on a control that no longer exists.
const AuthCard = ({ title, subtitle, titleRef, children }) => (
  <div className="min-h-screen bg-[#f9f9ff] dark:bg-gray-900 sacred-pattern flex flex-col relative">
    <div className="absolute top-4 end-4 z-20">
      <LanguageToggle variant="icon" />
    </div>
    <main id="main-content" className="flex-grow flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 sacred-shadow relative overflow-hidden border border-transparent dark:border-gray-700">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#064e3b] via-[#004f35] to-[#064e3b]" />
          <div className="text-center mb-6">
            <h1 ref={titleRef} tabIndex={titleRef ? -1 : undefined} className="text-2xl font-semibold text-[#151c27] dark:text-gray-100 mb-1 focus:outline-none">{title}</h1>
            {subtitle && <p className="text-[#404944] dark:text-gray-400">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

// The quiet text link under a card ("Back to sign in").
export const authLinkCls = 'font-medium text-[#064e3b] dark:text-emerald-400 hover:text-[#004f35] dark:hover:text-emerald-300 underline underline-offset-4 transition-colors';

export default AuthCard;
