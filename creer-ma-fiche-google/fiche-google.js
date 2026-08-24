/* fiche-google.js — logique du formulaire multi-étapes + Netlify + Stripe */

(function () {
  'use strict';

  /* ── Google Ads mode (masque la nav si gclid présent) ─────────────────── */
  if (new URLSearchParams(window.location.search).has('gclid')) {
    document.body.classList.add('fg-ads-mode');
  }

  /* ── Reveal animations ─────────────────────────────────────────────────── */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('in'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => observer.observe(el));
  }

  /* ── Éléments DOM ──────────────────────────────────────────────────────── */
  const steps = document.querySelectorAll('.fg-step');
  const progressFill = document.getElementById('fgProgressFill');
  const progressLabel = document.getElementById('fgProgress');
  const stepNumEl = document.getElementById('fgStepNum');

  const TOTAL_STEPS = 5;

  /* ── Utilitaire : passer à une étape ───────────────────────────────────── */
  function goToStep(n) {
    steps.forEach((step) => {
      const isTarget = Number(step.dataset.step) === n;
      step.hidden = !isTarget;
      if (isTarget) step.classList.add('is-active');
      else step.classList.remove('is-active');
    });

    const pct = Math.round((n / TOTAL_STEPS) * 100);
    if (progressFill) progressFill.style.width = pct + '%';
    if (stepNumEl) stepNumEl.textContent = n;
    if (progressLabel) {
      progressLabel.setAttribute('aria-valuenow', n);
      progressLabel.setAttribute('aria-label', `Étape ${n} sur ${TOTAL_STEPS}`);
    }

    window.scrollTo({ top: document.getElementById('formulaire')?.offsetTop - 80 || 0, behavior: 'smooth' });
  }

  /* ── Logique adresse vs zone de service ────────────────────────────────── */
  const addressBlock = document.getElementById('fgAddressBlock');
  const serviceZoneBlock = document.getElementById('fgServiceZoneBlock');
  const addrRequiredEls = document.querySelectorAll('.fg-addr-required');
  const zoneRequiredEls = document.querySelectorAll('.fg-zone-required');
  const streetInput = document.getElementById('fg_street');
  const postalInput = document.getElementById('fg_postal_code');
  const cityInput = document.getElementById('fg_city');
  const zoneInput = document.getElementById('fg_service_zone');

  function updateAddressMode() {
    const val = document.querySelector('input[name="has_address"]:checked')?.value;
    const hasPhysical = val === 'oui';
    const hasZone = val === 'non';

    if (addressBlock) addressBlock.hidden = !hasPhysical;
    if (serviceZoneBlock) serviceZoneBlock.hidden = !hasZone;

    addrRequiredEls.forEach((el) => (el.hidden = !hasPhysical));
    zoneRequiredEls.forEach((el) => (el.hidden = !hasZone));

    if (streetInput) streetInput.required = hasPhysical;
    if (postalInput) postalInput.required = hasPhysical;
    if (cityInput) cityInput.required = hasPhysical;
    if (zoneInput) zoneInput.required = hasZone;
  }

  document.querySelectorAll('input[name="has_address"]').forEach((input) => {
    input.addEventListener('change', updateAddressMode);
  });
  updateAddressMode();

  /* ── Validation par étape ──────────────────────────────────────────────── */
  function validateStep(n) {
    if (n === 1) {
      const name = document.getElementById('fg_business_name');
      const cat = document.getElementById('fg_category_main');
      if (!name?.value.trim()) { showError(name, 'Merci d\'indiquer le nom de votre entreprise.'); return false; }
      if (!cat?.value.trim()) { showError(cat, 'Merci d\'indiquer votre catégorie d\'activité principale.'); return false; }
      return true;
    }

    if (n === 2) {
      const hasAddressRadio = document.querySelector('input[name="has_address"]:checked');
      if (!hasAddressRadio) {
        showFeedback('Merci d\'indiquer si votre établissement est accessible aux clients.'); return false;
      }
      if (hasAddressRadio.value === 'oui') {
        const s = document.getElementById('fg_street');
        const p = document.getElementById('fg_postal_code');
        const c = document.getElementById('fg_city');
        if (!s?.value.trim()) { showError(s, 'Merci d\'indiquer votre adresse.'); return false; }
        if (!p?.value.trim()) { showError(p, 'Merci d\'indiquer votre code postal.'); return false; }
        if (!c?.value.trim()) { showError(c, 'Merci d\'indiquer votre ville.'); return false; }
      } else {
        const z = document.getElementById('fg_service_zone');
        if (!z?.value.trim()) { showError(z, 'Merci d\'indiquer votre zone de service.'); return false; }
      }
      return true;
    }

    if (n === 3) {
      const phone = document.getElementById('fg_phone_business');
      if (!phone?.value.trim()) { showError(phone, 'Merci d\'indiquer le téléphone de l\'établissement.'); return false; }
      return true;
    }

    return true;
  }

  function showError(input, msg) {
    const feedback = document.getElementById('fgFeedback');
    if (feedback) { feedback.textContent = msg; }
    input?.focus();
  }

  function showFeedback(msg) {
    const feedback = document.getElementById('fgFeedback');
    if (feedback) feedback.textContent = msg;
  }

  function clearFeedback() {
    const feedback = document.getElementById('fgFeedback');
    if (feedback) feedback.textContent = '';
  }

  /* ── Boutons Suivant / Précédent ───────────────────────────────────────── */
  document.querySelectorAll('[data-fg-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const currentStep = Number(btn.dataset.fgNext);
      clearFeedback();
      if (!validateStep(currentStep)) return;
      goToStep(currentStep + 1);
    });
  });

  document.querySelectorAll('[data-fg-prev]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const currentStep = Number(btn.dataset.fgPrev);
      clearFeedback();
      goToStep(currentStep - 1);
    });
  });

  /* ── Collecte des données des étapes précédentes dans les hidden fields ── */
  function syncHiddenFields() {
    const map = {
      fg_h_business_name: 'fg_business_name',
      fg_h_category_main: 'fg_category_main',
      fg_h_category_secondary: 'fg_category_secondary',
      fg_h_has_address: null, // radio, traitement spécial
      fg_h_street: 'fg_street',
      fg_h_postal_code: 'fg_postal_code',
      fg_h_city: 'fg_city',
      fg_h_service_zone: 'fg_service_zone',
      fg_h_phone_business: 'fg_phone_business',
      fg_h_website: 'fg_website',
    };

    for (const [hiddenId, sourceId] of Object.entries(map)) {
      if (!sourceId) continue;
      const hidden = document.getElementById(hiddenId);
      const source = document.getElementById(sourceId);
      if (hidden && source) hidden.value = source.value;
    }

    // has_address (radio)
    const hasAddrHidden = document.getElementById('fg_h_has_address');
    const checkedRadio = document.querySelector('input[name="has_address"]:checked');
    if (hasAddrHidden) hasAddrHidden.value = checkedRadio?.value || '';

    // Horaires (concaténation)
    const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const hoursStr = days
      .map((d) => {
        const val = document.getElementById(`fg_hours_${d}`)?.value?.trim();
        return val ? `${d.charAt(0).toUpperCase() + d.slice(1)} : ${val}` : null;
      })
      .filter(Boolean)
      .join(' | ');
    const hoursHidden = document.getElementById('fg_h_hours');
    if (hoursHidden) hoursHidden.value = hoursStr;
  }

  /* ── Soumission Netlify puis Stripe ────────────────────────────────────── */
  const leadForm = document.getElementById('fgLeadForm');
  const submitBtn = document.getElementById('fgSubmit');

  leadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFeedback();

    const email = document.getElementById('fg_contact_email');
    const phone = document.getElementById('fg_contact_phone');
    const waiver = document.getElementById('fg_waiver');

    if (!email?.value.trim()) { showError(email, 'Merci d\'indiquer votre email.'); return; }
    if (!phone?.value.trim()) { showError(phone, 'Merci d\'indiquer votre téléphone.'); return; }
    if (!waiver?.checked) { showFeedback('Merci d\'accepter les conditions de démarrage immédiat.'); return; }

    syncHiddenFields();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours…';
    }

    /* GA4 lead event */
    if (typeof gtag === 'function') {
      gtag('event', 'lead_fiche_google', {
        event_category: 'fiche_google',
        business_name: document.getElementById('fg_business_name')?.value || '',
      });
    }

    /* 1. Soumettre à Netlify */
    try {
      const formData = new FormData(leadForm);
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString(),
      });
      if (!res.ok) {
        console.warn('Netlify form submission non-OK, on continue quand même.');
      }
    } catch (netlifyErr) {
      console.warn('Netlify form error (non bloquant) :', netlifyErr);
    }

    /* 2. Lancer le Stripe Embedded Checkout */
    goToStep(5);
    await initStripeCheckout(buildFormPayload());
  });

  function buildFormPayload() {
    return {
      business_name: document.getElementById('fg_business_name')?.value || '',
      category_main: document.getElementById('fg_category_main')?.value || '',
      category_secondary: document.getElementById('fg_category_secondary')?.value || '',
      has_address: document.querySelector('input[name="has_address"]:checked')?.value || '',
      street: document.getElementById('fg_street')?.value || '',
      postal_code: document.getElementById('fg_postal_code')?.value || '',
      city: document.getElementById('fg_city')?.value || '',
      service_zone: document.getElementById('fg_service_zone')?.value || '',
      phone_business: document.getElementById('fg_phone_business')?.value || '',
      website: document.getElementById('fg_website')?.value || '',
      contact_email: document.getElementById('fg_contact_email')?.value || '',
      contact_phone: document.getElementById('fg_contact_phone')?.value || '',
    };
  }

  async function initStripeCheckout(formPayload) {
    const loadingState = document.getElementById('fgLoadingState');
    const paymentError = document.getElementById('fgPaymentError');
    const checkoutContainer = document.getElementById('fgCheckout');
    const stripeKey = document.querySelector('meta[name="stripe-publishable-key"]')?.content?.trim();

    if (loadingState) loadingState.hidden = false;
    if (paymentError) paymentError.hidden = true;

    try {
      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: 'fiche-google', formData: formPayload }),
      });

      const data = await res.json();

      if (!res.ok || !data.client_secret) {
        throw new Error(data.error || 'Impossible de préparer le paiement.');
      }

      if (loadingState) loadingState.hidden = true;

      const stripe = Stripe(stripeKey);
      const checkout = await stripe.initEmbeddedCheckout({ clientSecret: data.client_secret });
      checkout.mount(checkoutContainer);
    } catch (err) {
      if (loadingState) loadingState.hidden = true;
      if (paymentError) {
        paymentError.textContent = err.message || 'Une erreur est survenue. Veuillez réessayer.';
        paymentError.hidden = false;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continuer vers le paiement sécurisé →';
      }
      goToStep(4);
    }
  }
})();
