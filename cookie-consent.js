/**
 * Cookie consent + Google Consent Mode v2 (GA4).
 * Analytics loads only after explicit "granted" consent.
 * Stripe / payment cookies are unaffected.
 */
(function () {
  const STORAGE_KEY = 'cookie_consent';
  const GA_MEASUREMENT_ID = 'G-Y6CL1MT94D';
  let gaLoaded = false;
  let bannerEl = null;

  function getStoredConsent() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function storeConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      /* private mode / blocked storage */
    }
  }

  function ensureGtagStub() {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }
  }

  function updateAnalyticsConsent(granted) {
    ensureGtagStub();
    window.gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied'
    });
  }

  function loadGoogleAnalytics() {
    if (gaLoaded) {
      return;
    }
    gaLoaded = true;
    updateAnalyticsConsent(true);

    const existing = document.querySelector('script[data-cookie-ga]');
    if (existing) {
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID);
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.dataset.cookieGa = '1';
    script.addEventListener('load', () => {
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID);
    });
    document.head.appendChild(script);
  }

  function showBanner() {
    if (!bannerEl) {
      return;
    }
    bannerEl.hidden = false;
    document.body.classList.add('cookie-banner-visible');
  }

  function hideBanner() {
    if (!bannerEl) {
      return;
    }
    bannerEl.hidden = true;
    document.body.classList.remove('cookie-banner-visible');
  }

  function applyConsent(value, { persist = true } = {}) {
    if (value !== 'granted' && value !== 'denied') {
      return;
    }

    if (persist) {
      storeConsent(value);
    }

    if (value === 'granted') {
      loadGoogleAnalytics();
    } else {
      updateAnalyticsConsent(false);
    }

    hideBanner();
  }

  function buildBanner() {
    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.id = 'cookieBanner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'cookieBannerTitle');
    banner.setAttribute('aria-describedby', 'cookieBannerText');
    banner.hidden = true;
    banner.innerHTML = `
      <div class="cookie-banner-card">
        <div class="cookie-banner-copy">
          <p class="cookie-banner-title" id="cookieBannerTitle">Cookies &amp; mesure d'audience</p>
          <p class="cookie-banner-text" id="cookieBannerText">Nous utilisons Google Analytics pour mesurer l'audience du site. Vos données ne sont pas revendues.</p>
          <a class="cookie-banner-link" href="cookies.html">En savoir plus</a>
        </div>
        <div class="cookie-banner-actions">
          <button type="button" class="btn btn-outline cookie-banner-btn" data-cookie-consent="denied">Refuser</button>
          <button type="button" class="btn btn-outline cookie-banner-btn" data-cookie-consent="granted">Accepter</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
    return banner;
  }

  function init() {
    ensureGtagStub();
    bannerEl = buildBanner();

    bannerEl.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cookie-consent]');
      if (!button) {
        return;
      }
      applyConsent(button.getAttribute('data-cookie-consent'));
    });

    document.querySelectorAll('[data-manage-cookies]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        showBanner();
      });
    });

    const saved = getStoredConsent();
    if (saved === 'granted') {
      loadGoogleAnalytics();
    } else if (saved === 'denied') {
      updateAnalyticsConsent(false);
    } else {
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
