// Google Analytics 4. Paste this site's measurement ID ("G-…") here to turn it on; empty keeps it off.
// The same file is in the bingo, generala and truco repositories; only this line differs.
const GA_MEASUREMENT_ID = '';

// Everything else lives in a function, so its names never clash with the ones in app.js
// (classic scripts share one global scope). Besides the ID, it adds only window.dataLayer and window.track.
(() => {
  // Local dev servers (localhost, bingo.localhost…) and LAN tests never send data.
  const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|^(10|192\.168)\.|^172\.(1[6-9]|2\d|3[01])\./;
  const enabled = Boolean(GA_MEASUREMENT_ID) && !LOCAL_HOST.test(window.location.hostname);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    // gtag.js looks for the arguments object itself: a rest parameter (an array) would not work.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  }

  // Sends one event, such as "game_start". Does nothing while analytics is off.
  // Params carry counts and settings only, never the names people type.
  window.track = (name, params = {}) => {
    if (enabled) gtag('event', name, params);
  };

  if (!enabled) return;

  // No ads features: ad cookies denied, no Google signals, no ad personalization.
  // This also keeps the list of Google domains in the Content Security Policy short.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  });
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.append(script);
})();
