const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  const onboardingForm = document.getElementById('onboardingForm');
  const selectedPackField = document.getElementById('selectedPackField');
  const selectedPriceField = document.getElementById('selectedPriceField');
  const loadingState = document.getElementById('loadingState');
  const paymentError = document.getElementById('paymentError');
  const checkoutContainer = document.getElementById('checkout');
  const checkoutHint = document.getElementById('checkoutHint');
  const formFeedback = document.getElementById('formFeedback');
  const submitButton = document.getElementById('submitButton');
  const existingListingFields = document.getElementById('existingListingFields');
  const newListingMessage = document.getElementById('newListingMessage');
  const googleAccountEmail = document.getElementById('googleAccountEmail');
  const waiverCheckbox = document.getElementById('waiverCheckbox');
  const modalTitle = document.getElementById('modalTitle');
  const paymentTitle = document.getElementById('paymentTitle');
  const stripePublishableKey = document.querySelector('meta[name="stripe-publishable-key"]')?.content?.trim();

  let selectedPack = null;
  let embeddedCheckout = null;
  let lastFocusedElement = null;
  let currentStep = 'form';
  let formSubmitted = false;

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

  function updateListingFields() {
    const selectedStatus = onboardingForm?.querySelector('input[name="google_listing_status"]:checked')?.value;
    const isExisting = selectedStatus === 'existing';
    const isNew = selectedStatus === 'new';

    existingListingFields.hidden = !isExisting;
    newListingMessage.hidden = !isNew;
    googleAccountEmail.required = isExisting;
  }

  onboardingForm?.querySelectorAll('input[name="google_listing_status"]').forEach((input) => {
    input.addEventListener('change', updateListingFields);
  });

  function syncSelectedPackToForm() {
    if (!selectedPack) {
      return;
    }

    selectedPackField.value = selectedPack.pack;
    selectedPriceField.value = `${selectedPack.price}€/mois`;
    modalPackSummary.textContent = `${selectedPack.name} · ${selectedPack.price}€/mois`;
  }

  function focusStep(step) {
    requestAnimationFrame(() => {
      if (step === 'form') {
        const firstField = onboardingForm?.querySelector('input:not([type="hidden"]):not([name="bot-field"])');
        if (firstField) {
          firstField.focus();
        } else if (modalTitle) {
          modalTitle.focus();
        }
        return;
      }

      if (waiverCheckbox) {
        waiverCheckbox.focus();
      } else if (paymentTitle) {
        paymentTitle.focus();
      }
    });
  }

  function resetPaymentStep() {
    waiverCheckbox.checked = false;
    paymentError.hidden = true;
    paymentError.textContent = '';
    loadingState.hidden = true;
    checkoutHint.classList.remove('is-hidden');
    checkoutContainer.classList.add('is-locked');
    checkoutContainer.classList.remove('is-ready');
    checkoutContainer.setAttribute('aria-hidden', 'true');
    checkoutContainer.innerHTML = '';
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
      resetPaymentStep();
      teardownEmbeddedCheckout();
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

  function openModal() {
    if (!selectedPack) {
      return;
    }

    syncSelectedPackToForm();
    setStep('form');
    lastFocusedElement = document.activeElement;
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  async function closeModal(keepStep = false) {
    modalOverlay.hidden = true;
    document.body.style.overflow = '';

    if (!keepStep) {
      formSubmitted = false;
      setStep('form');
    }

    formFeedback.textContent = '';
    submitButton.disabled = false;
    await teardownEmbeddedCheckout();

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function goToOffers() {
    closeModal(true);
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

  function validateForm() {
    if (!onboardingForm) {
      return false;
    }

    let isValid = true;
    formFeedback.textContent = '';

    const requiredFields = onboardingForm.querySelectorAll('input[required]');
    requiredFields.forEach((field) => {
      const shouldCheckValue = field.type !== 'radio';
      const fieldValid = field.type === 'radio'
        ? onboardingForm.querySelector(`input[name="${field.name}"]:checked`)
        : field.value.trim();

      if (!fieldValid) {
        isValid = false;
        if (shouldCheckValue) {
          field.classList.add('invalid');
        }
      } else if (shouldCheckValue) {
        field.classList.remove('invalid');
      }
    });

    if (!isValid) {
      formFeedback.textContent = 'Merci de remplir tous les champs obligatoires avant de continuer.';
    }

    return isValid;
  }

  async function submitNetlifyForm(formData) {
    await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString()
    });
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

  async function createCheckoutSession(payload) {
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Impossible de créer la session de paiement.');
    }

    return data.client_secret;
  }

  async function initializePayment() {
    if (!selectedPack || !formSubmitted || !waiverCheckbox.checked) {
      return;
    }

    loadingState.hidden = false;
    paymentError.hidden = true;
    paymentError.textContent = '';

    const formData = new FormData(onboardingForm);
    formData.set('waiver_accepted', 'oui');
    const payload = {
      pack: selectedPack.pack,
      formData: Object.fromEntries(formData.entries())
    };

    try {
      await teardownEmbeddedCheckout();
      checkoutContainer.innerHTML = '';
      const clientSecret = await createCheckoutSession(payload);
      await mountEmbeddedCheckout(clientSecret);
      checkoutHint.classList.add('is-hidden');
      checkoutContainer.classList.remove('is-locked');
      checkoutContainer.classList.add('is-ready');
      checkoutContainer.setAttribute('aria-hidden', 'false');
    } catch (error) {
      paymentError.hidden = false;
      paymentError.textContent = error.message || 'Une erreur est survenue lors de la création du paiement.';
      waiverCheckbox.checked = false;
    } finally {
      loadingState.hidden = true;
    }
  }

  onboardingForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!selectedPack || !validateForm()) {
      return;
    }

    submitButton.disabled = true;

    try {
      const formData = new FormData(onboardingForm);
      await submitNetlifyForm(formData);
      formSubmitted = true;
      setStep('payment');
    } catch (_) {
      formFeedback.textContent = 'Une erreur est survenue lors de l\'envoi du formulaire. Réessayez.';
    } finally {
      submitButton.disabled = false;
    }
  });

  waiverCheckbox?.addEventListener('change', async () => {
    if (!waiverCheckbox.checked) {
      resetPaymentStep();
      await teardownEmbeddedCheckout();
      return;
    }

    await initializePayment();
  });

  onboardingForm?.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      input.classList.remove('invalid');
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

initPurchaseTunnel();

const PACK_LABELS = {
  essentiel: { name: 'Essentiel', amount: 69 },
  populaire: { name: 'Populaire', amount: 99 },
  premium: { name: 'Premium', amount: 179 }
};

if (window.location.pathname.endsWith('/merci.html')) {
  const packFromQuery = new URLSearchParams(window.location.search).get('pack');
  const label = PACK_LABELS[packFromQuery];
  const thanksPack = document.getElementById('thanksPack');
  if (label && thanksPack) {
    thanksPack.textContent = `Votre formule ${label.name} a bien été prise en compte.`;
  }
}
