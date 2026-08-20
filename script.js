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
  const modalPackSummary = document.getElementById('modalPackSummary');
  const loadingState = document.getElementById('loadingState');
  const paymentError = document.getElementById('paymentError');
  const checkoutContainer = document.getElementById('checkout');
  const paymentTitle = document.getElementById('paymentTitle');
  const stripePublishableKey = document.querySelector('meta[name="stripe-publishable-key"]')?.content?.trim();

  let selectedPack = null;
  let embeddedCheckout = null;
  let lastFocusedElement = null;

  function setSelectedPack(card) {
    const pack = card.dataset.pack;
    const name = card.dataset.packName;
    const price = Number(card.dataset.packPrice);

    selectedPack = { pack, name, price };

    pricingCards.forEach((pricingCard) => pricingCard.classList.remove('selected'));
    card.classList.add('selected');

    stickyBarText.textContent = `Pack ${name} sélectionné · ${price}€/mois`;
    stickyBar.hidden = false;
    document.body.classList.add('sticky-visible');
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

  function syncSelectedPackSummary() {
    if (!selectedPack) {
      return;
    }

    modalPackSummary.textContent = `${selectedPack.name} · ${selectedPack.price}€/mois`;
  }

  async function teardownEmbeddedCheckout() {
    if (embeddedCheckout && typeof embeddedCheckout.destroy === 'function') {
      await embeddedCheckout.destroy();
    }
    embeddedCheckout = null;
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

  async function createCheckoutSession(pack) {
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pack })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Impossible de créer la session de paiement.');
    }

    return data.client_secret;
  }

  async function initializePayment() {
    if (!selectedPack) {
      return;
    }

    loadingState.hidden = false;
    paymentError.hidden = true;
    paymentError.textContent = '';

    try {
      await teardownEmbeddedCheckout();
      checkoutContainer.innerHTML = '';
      const clientSecret = await createCheckoutSession(selectedPack.pack);
      await mountEmbeddedCheckout(clientSecret);
    } catch (error) {
      paymentError.hidden = false;
      paymentError.textContent = error.message || 'Une erreur est survenue lors de la création du paiement.';
    } finally {
      loadingState.hidden = true;
    }
  }

  async function openModal() {
    if (!selectedPack) {
      return;
    }

    syncSelectedPackSummary();
    lastFocusedElement = document.activeElement;
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    paymentTitle?.focus();
    await initializePayment();
  }

  async function closeModal(keepSelection = false) {
    modalOverlay.hidden = true;
    document.body.style.overflow = '';
    paymentError.hidden = true;
    paymentError.textContent = '';
    loadingState.hidden = true;
    await teardownEmbeddedCheckout();
    checkoutContainer.innerHTML = '';

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }

    if (!keepSelection) {
      lastFocusedElement = null;
    }
  }

  function goToOffers() {
    closeModal(true);
    offersSection?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  stickyBarCta?.addEventListener('click', openModal);
  modalClose?.addEventListener('click', () => closeModal());
  changePackBtn?.addEventListener('click', goToOffers);

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
  const dossierForm = document.getElementById('dossierForm');
  const dossierSuccess = document.getElementById('dossierSuccess');
  const dossierSubmit = document.getElementById('dossierSubmit');
  const waiverCheckbox = document.getElementById('dossierWaiver');
  const existingListingFields = document.getElementById('dossierExistingFields');
  const newListingMessage = document.getElementById('dossierNewMessage');
  const googleAccountEmail = document.getElementById('dossierGoogleEmail');
  const selectedPackField = document.getElementById('dossierPackField');
  const sessionIdField = document.getElementById('dossierSessionField');

  if (thanksPack) {
    thanksPack.textContent = `Votre pack ${label.name} est activé.`;
  }

  if (selectedPackField) {
    selectedPackField.value = pack;
  }

  if (sessionIdField) {
    sessionIdField.value = sessionId;
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

  function updateListingFields() {
    const selectedStatus = dossierForm?.querySelector('input[name="google_listing_status"]:checked')?.value;
    const isExisting = selectedStatus === 'existing';
    const isNew = selectedStatus === 'new';

    existingListingFields.hidden = !isExisting;
    newListingMessage.hidden = !isNew;
    googleAccountEmail.required = isExisting;
  }

  function syncSubmitState() {
    dossierSubmit.disabled = !waiverCheckbox.checked;
  }

  dossierForm?.querySelectorAll('input[name="google_listing_status"]').forEach((input) => {
    input.addEventListener('change', updateListingFields);
  });

  waiverCheckbox?.addEventListener('change', syncSubmitState);
  syncSubmitState();

  dossierForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!waiverCheckbox.checked) {
      return;
    }

    dossierSubmit.disabled = true;

    try {
      const formData = new FormData(dossierForm);
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
      });

      dossierForm.hidden = true;
      dossierSuccess.hidden = false;
    } catch (_) {
      dossierSubmit.disabled = false;
    }
  });

  dossierForm?.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => input.classList.remove('invalid'));
  });
}

initGoogleAdsMode();
initPurchaseTunnel();

if (window.location.pathname.endsWith('/merci.html')) {
  initMerciPage();
}
