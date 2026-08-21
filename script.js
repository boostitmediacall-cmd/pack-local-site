const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PACK_LABELS = {
  essentiel: { name: 'Essentiel', amount: 69 },
  boost: { name: 'Boost', amount: 99 },
  premium: { name: 'Premium', amount: 179 }
};

const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

if (burger && nav) {
  const closeNav = () => {
    nav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
  };

  burger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(isOpen));
    burger.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeNav);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNav();
    }
  });
}

const revealEls = document.querySelectorAll('.reveal');

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('in'));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealEls.forEach((el) => observer.observe(el));
}

function initGoogleAdsMode() {
  if (!new URLSearchParams(window.location.search).has('gclid')) {
    return;
  }

  document.body.classList.add('ads-mode');
}

function initPurchaseTunnel() {
  const modalOverlay = document.getElementById('modalOverlay');
  if (!modalOverlay) {
    return;
  }

  const offersSection = document.getElementById('offres');
  const pricingCards = document.querySelectorAll('.pricing-card');
  const stickyBar = document.getElementById('stickyBar');
  const stickyBarText = document.getElementById('stickyBarText');
  const stickyBarCta = document.getElementById('stickyBarCta');
  const modalClose = document.getElementById('modalClose');
  const changePackBtn = document.getElementById('changePackBtn');
  const prevStepBtn = document.getElementById('prevStepBtn');
  const stepForm = document.getElementById('stepForm');
  const stepPayment = document.getElementById('stepPayment');
  const modalPackSummary = document.getElementById('modalPackSummary');
  const dossierForm = document.getElementById('dossierForm');
  const selectedPackField = document.getElementById('selectedPackField');
  const loadingState = document.getElementById('loadingState');
  const paymentError = document.getElementById('paymentError');
  const checkoutContainer = document.getElementById('checkout');
  const formFeedback = document.getElementById('formFeedback');
  const submitButton = document.getElementById('submitButton');
  const existingListingFields = document.getElementById('existingListingFields');
  const newListingMessage = document.getElementById('newListingMessage');
  const googleAccountEmail = document.getElementById('googleAccountEmail');
  const googleEmailStar = document.querySelector('.google-email-star');
  const waiverCheckbox = document.getElementById('waiverCheckbox');
  const waiverBox = document.getElementById('waiverBox');
  const modalTitle = document.getElementById('modalTitle');
  const paymentTitle = document.getElementById('paymentTitle');
  const stripePublishableKey = document.querySelector('meta[name="stripe-publishable-key"]')?.content?.trim();

  let selectedPack = null;
  let embeddedCheckout = null;
  let lastFocusedElement = null;
  let currentStep = 'form';
  let formPayload = null;

  const isLandingPage = document.body.classList.contains('lp-ads');
  const packCompareUrl = document.body.dataset.packCompareUrl;

  function setSelectedPack(card, { showSticky = !isLandingPage } = {}) {
    const pack = card.dataset.pack;
    const name = card.dataset.packName;
    const price = Number(card.dataset.packPrice);

    selectedPack = { pack, name, price };

    pricingCards.forEach((pricingCard) => pricingCard.classList.remove('selected'));
    card.classList.add('selected');

    if (showSticky && stickyBar && stickyBarText) {
      stickyBarText.textContent = `Pack ${name} sélectionné · ${price}€/mois`;
      stickyBar.hidden = false;
      document.body.classList.add('sticky-visible');
    }
  }

  function resolvePackCard(packId) {
    if (!packId) {
      return null;
    }
    return document.querySelector(`.pricing-card[data-pack="${packId}"]`);
  }

  function openCheckoutForPack(packId) {
    const card = resolvePackCard(packId) || resolvePackCard(document.body.dataset.defaultPack);
    if (!card) {
      return;
    }
    setSelectedPack(card);
    openModal();
  }

  offersSection?.addEventListener('click', (event) => {
    const button = event.target.closest('.plan-cta');
    if (!button) {
      return;
    }

    event.preventDefault();
    const card = button.closest('.pricing-card');
    if (!card) {
      return;
    }

    setSelectedPack(card);
  });

  document.querySelectorAll('[data-open-checkout]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const packId = button.dataset.pack
        || button.closest('.pricing-card')?.dataset.pack
        || document.body.dataset.defaultPack;
      openCheckoutForPack(packId);
    });
  });

  function syncSelectedPackSummary() {
    if (!selectedPack) {
      return;
    }

    modalPackSummary.textContent = `${selectedPack.name} · ${selectedPack.price}€/mois`;
    selectedPackField.value = selectedPack.pack;
  }

  function updateListingFields() {
    const selectedStatus = dossierForm?.querySelector('input[name="google_listing_status"]:checked')?.value;
    const isExisting = selectedStatus === 'existing';
    const isNew = selectedStatus === 'new';

    existingListingFields.hidden = !isExisting;
    newListingMessage.hidden = !isNew;
    googleAccountEmail.required = isExisting;
    if (googleEmailStar) {
      googleEmailStar.hidden = !isExisting;
    }

    if (!isExisting) {
      googleAccountEmail.classList.remove('invalid');
    }
  }

  dossierForm?.querySelectorAll('input[name="google_listing_status"]').forEach((input) => {
    input.addEventListener('change', updateListingFields);
  });

  function focusStep(step) {
    requestAnimationFrame(() => {
      if (step === 'form') {
        const firstField = dossierForm?.querySelector('input:not([type="hidden"]):not([name="bot-field"])');
        (firstField || modalTitle)?.focus();
        return;
      }

      paymentTitle?.focus();
    });
  }

  async function teardownEmbeddedCheckout() {
    if (embeddedCheckout && typeof embeddedCheckout.destroy === 'function') {
      await embeddedCheckout.destroy();
    }
    embeddedCheckout = null;
  }

  function setStep(step) {
    currentStep = step;

    if (step === 'form') {
      stepForm.hidden = false;
      stepForm.classList.add('is-active');
      stepPayment.hidden = true;
      stepPayment.classList.remove('is-active');
      changePackBtn.hidden = false;
      prevStepBtn.hidden = true;
      paymentError.hidden = true;
      paymentError.textContent = '';
      loadingState.hidden = true;
      teardownEmbeddedCheckout();
      checkoutContainer.innerHTML = '';
      focusStep('form');
      return;
    }

    stepForm.hidden = true;
    stepForm.classList.remove('is-active');
    stepPayment.hidden = false;
    stepPayment.classList.remove('is-active');
    void stepPayment.offsetWidth;
    stepPayment.classList.add('is-active');
    changePackBtn.hidden = true;
    prevStepBtn.hidden = false;
    focusStep('payment');
  }

  function validateForm() {
    let isValid = true;
    formFeedback.textContent = '';
    waiverBox.classList.remove('invalid');

    dossierForm.querySelectorAll('input').forEach((field) => {
      if (field.type !== 'radio' && field.type !== 'checkbox') {
        field.classList.remove('invalid');
      }
    });

    const requiredFields = dossierForm.querySelectorAll('input[required]');
    requiredFields.forEach((field) => {
      if (field.type === 'radio') {
        const checked = dossierForm.querySelector(`input[name="${field.name}"]:checked`);
        if (!checked) {
          isValid = false;
        }
        return;
      }

      if (!field.value.trim()) {
        field.classList.add('invalid');
        isValid = false;
      }
    });

    if (!waiverCheckbox.checked) {
      waiverBox.classList.add('invalid');
      isValid = false;
    }

    if (!isValid) {
      formFeedback.textContent = 'Merci de remplir tous les champs obligatoires et de cocher la case de renonciation avant de payer.';
    }

    return isValid;
  }

  function buildFormPayload() {
    const formData = new FormData(dossierForm);
    const googleSituation = formData.get('google_listing_status') || '';

    return {
      full_name: String(formData.get('full_name') || '').trim(),
      business_name: String(formData.get('business_name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      city: String(formData.get('city') || '').trim(),
      postal_code: String(formData.get('postal_code') || '').trim(),
      google_situation: String(googleSituation),
      google_email: String(formData.get('google_account_email') || '').trim(),
      google_listing_url: String(formData.get('google_listing_url') || '').trim(),
      waiver_accepted: waiverCheckbox.checked ? 'oui' : 'non',
      selected_pack: selectedPack.pack
    };
  }

  async function submitNetlifyFormBackup() {
    try {
      const formData = new FormData(dossierForm);
      formData.set('selected_pack', selectedPack.pack);
      formData.set('city', formPayload.city);
      formData.set('postal_code', formPayload.postal_code);

      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
      });

      if (!response.ok) {
        console.error('Netlify Forms backup failed:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Netlify Forms backup error:', error);
    }
  }

  async function mountEmbeddedCheckout(clientSecret) {
    if (!stripePublishableKey) {
      throw new Error('La clé publique Stripe est absente. Renseignez-la dans la balise meta "stripe-publishable-key".');
    }

    if (typeof window.Stripe !== 'function') {
      throw new Error('Stripe.js n\'a pas pu être chargé.');
    }

    const stripe = window.Stripe(stripePublishableKey);
    embeddedCheckout = await stripe.initEmbeddedCheckout({ clientSecret });
    embeddedCheckout.mount('#checkout');
  }

  async function createCheckoutSession() {
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack: selectedPack.pack,
        formData: formPayload
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Impossible de créer la session de paiement.');
    }

    return data.client_secret;
  }

  async function initializePayment() {
    if (!selectedPack || !formPayload) {
      return;
    }

    loadingState.hidden = false;
    paymentError.hidden = true;
    paymentError.textContent = '';

    try {
      await teardownEmbeddedCheckout();
      checkoutContainer.innerHTML = '';
      const clientSecret = await createCheckoutSession();
      await mountEmbeddedCheckout(clientSecret);
    } catch (error) {
      paymentError.hidden = false;
      paymentError.textContent = error.message || 'Une erreur est survenue lors de la création du paiement.';
    } finally {
      loadingState.hidden = true;
    }
  }

  function openModal() {
    if (!selectedPack) {
      return;
    }

    syncSelectedPackSummary();
    setStep('form');
    lastFocusedElement = document.activeElement;
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  async function closeModal() {
    modalOverlay.hidden = true;
    document.body.style.overflow = '';
    formFeedback.textContent = '';
    submitButton.disabled = false;
    formPayload = null;
    setStep('form');
    await teardownEmbeddedCheckout();
    checkoutContainer.innerHTML = '';

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function goToOffers() {
    closeModal();
    if (packCompareUrl) {
      window.location.href = packCompareUrl;
      return;
    }
    offersSection?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  stickyBarCta?.addEventListener('click', openModal);
  modalClose?.addEventListener('click', () => closeModal());
  changePackBtn?.addEventListener('click', goToOffers);
  prevStepBtn?.addEventListener('click', () => setStep('form'));

  modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modalOverlay.hidden) {
      closeModal();
    }
  });

  dossierForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!selectedPack || !validateForm()) {
      return;
    }

    submitButton.disabled = true;
    formPayload = buildFormPayload();

    try {
      await submitNetlifyFormBackup();
      setStep('payment');
      await initializePayment();
    } finally {
      submitButton.disabled = false;
    }
  });

  dossierForm?.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      input.classList.remove('invalid');
      if (formFeedback.textContent) {
        formFeedback.textContent = '';
      }
    });
    input.addEventListener('change', () => {
      if (input === waiverCheckbox) {
        waiverBox.classList.remove('invalid');
      }
      if (formFeedback.textContent) {
        formFeedback.textContent = '';
      }
    });
  });

  modalOverlay.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') {
      return;
    }

    const modal = modalOverlay.querySelector('.modal');
    const focusable = [...modal.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )].filter((el) => !el.closest('[hidden]'));

    if (!focusable.length) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function initMerciPage() {
  const params = new URLSearchParams(window.location.search);
  const pack = params.get('pack');
  const sessionId = params.get('session_id');
  const label = PACK_LABELS[pack];

  if (!sessionId || !label) {
    window.location.replace('index.html');
    return;
  }

  const thanksPack = document.getElementById('thanksPack');
  if (thanksPack) {
    thanksPack.textContent = `Votre pack ${label.name} est activé.`;
  }

  const conversionKey = `purchase_tracked_${sessionId}`;
  if (!sessionStorage.getItem(conversionKey) && typeof gtag === 'function') {
    gtag('event', 'purchase', {
      transaction_id: sessionId,
      value: label.amount,
      currency: 'EUR',
      items: [{
        item_id: pack,
        item_name: label.name,
        price: label.amount,
        quantity: 1
      }]
    });
    sessionStorage.setItem(conversionKey, '1');
  }
}

initGoogleAdsMode();
initPurchaseTunnel();
initMobileCtaBar();
initPremiumUrgency();

if (window.location.pathname.endsWith('/merci.html') || window.location.pathname.endsWith('merci.html')) {
  initMerciPage();
}

function initPremiumUrgency() {
  const banner = document.getElementById('premiumUrgency');
  const label = document.getElementById('premiumSlotsLabel');
  if (!banner || !label) {
    return;
  }
  const slots = banner.dataset.premiumSlots;
  if (slots) {
    label.textContent = slots;
  }
}

function initMobileCtaBar() {
  const bar = document.getElementById('mobileCtaBar');
  const modalOverlay = document.getElementById('modalOverlay');
  if (!bar) {
    return;
  }

  const mq = window.matchMedia('(max-width: 720px)');

  function sync() {
    const show = mq.matches
      && !document.body.classList.contains('sticky-visible')
      && !(modalOverlay && !modalOverlay.hidden);

    bar.hidden = !show;
    document.body.classList.toggle('has-mobile-cta', show);
    document.body.classList.toggle('modal-open', Boolean(modalOverlay && !modalOverlay.hidden));
  }

  mq.addEventListener('change', sync);
  sync();

  if (modalOverlay) {
    const observer = new MutationObserver(sync);
    observer.observe(modalOverlay, { attributes: true, attributeFilter: ['hidden'] });
  }

  const stickyBar = document.getElementById('stickyBar');
  if (stickyBar) {
    const stickyObserver = new MutationObserver(sync);
    stickyObserver.observe(stickyBar, { attributes: true, attributeFilter: ['hidden'] });
  }
}

