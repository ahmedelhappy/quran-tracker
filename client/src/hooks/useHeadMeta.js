import { useEffect } from 'react';

// A <meta name=… content=…> in the document head for as long as the calling
// page is on screen; whatever was there before (usually nothing) comes back
// when it leaves. The password pages use it for `robots: noindex` and, on the
// page that holds a reset token, `referrer: no-referrer` (H-06). The hosting
// headers in vercel.json say the same for those paths; this covers the page
// when it is reached by client-side navigation, or served from somewhere else.
export const useHeadMeta = (name, content) => {
  useEffect(() => {
    let meta = document.head.querySelector(`meta[name="${name}"]`);
    const previous = meta?.getAttribute('content') ?? null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
    return () => {
      if (previous === null) meta.remove();
      else meta.setAttribute('content', previous);
    };
  }, [name, content]);
};
