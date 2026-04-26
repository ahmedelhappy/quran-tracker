const Footer = () => (
  <footer className="bg-white dark:bg-gray-900 border-t border-emerald-100/50 dark:border-gray-700/50 w-full py-12 px-8 flex flex-col md:flex-row justify-between items-center gap-4 mt-auto">
    <p className="text-sm text-[#064e3b] dark:text-gray-400 opacity-80">
      © 2025 Quran Tracker. Dedicated to the pursuit of Hifz.
    </p>
    <div className="flex flex-wrap justify-center gap-6">
      {['Privacy Policy', 'Terms of Service', 'Contact Support', 'Donate'].map((l) => (
        <a key={l} href="#" className="text-sm text-emerald-700/70 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 underline underline-offset-4 opacity-80 hover:opacity-100 transition-all">
          {l}
        </a>
      ))}
    </div>
  </footer>
);

export default Footer;
