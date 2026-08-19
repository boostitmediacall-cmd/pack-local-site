const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
const pricingCards = document.querySelectorAll('.pricing-card');
const chooseButtons = document.querySelectorAll('.choose-pack');
const stickyBar = document.getElementById('stickyBar');
const stickyBarText = document.getElementById('stickyBarText');
const stickyBarCta = document.getElementById('stickyBarCta');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const onboardingForm = document.getElementById('onboardingForm');
const selectedPackField = document.getElementById('selectedPackField');
const selectedPriceField = document.getElementById('selectedPriceField');
const selectedPackDisplay = document.getElementById('selectedPackDisplay');
const selectedPriceDisplay = document.getElementById('selectedPriceDisplay');
const paymentStep = document.getElementById('paymentStep');
const paymentSummary = document.getElementById('paymentSummary');
const loadingState = document.getElementById('loadingState');
const paymentError = document.getElementById('paymentError');
const checkoutContainer = document.getElementById('checkout');
const formFeedback = document.getElementById('formFeedback');
const submitButton = document.getElementById('submitButton');
const existingListingFields = document.getElementById('existingListingFields');
const newListingMessage = document.getElementById('newListingMessage');
const googleAccountEmail = document.getElementById('googleAccountEmail');
const stripePublishableKey = document.querySelector('meta[name="stripe-publishable-key"]')?.content?.trim();

let selectedPack = null;
let embeddedCheckout = null;
let lastFocusedElement = null;

const PACK_LABELS = {
  essentiel: { name: 'Essentiel', amount: 69 },
  populaire: { name: 'Populaire', amount: 99 },
  premium: { name: 'Premium', amount: 179 }
};

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

function setSelectedPack(card) {
  const pack = card.dataset.pack;
  const name = card.dataset.packName;
  const price = Number(card.dataset.packPrice);

  selectedPack = { pack, name, price };

  pricingCards.forEach((pricingCard) => pricingCard.classList.remove('selected'));
  card.classList.add('selected');

  stickyBarText.textContent = `Pack ${name} selectionne · ${price}€/mois`;
  stickyBar.hidden = false;
  document.body.classList.add('sticky-visible');
}

chooseButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const card = button.closest('.pricing-card');
    if (!card) {
      return;
    }

    setSelectedPack(card);
  });
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
  selectedPriceField.value = `${selectedPack.price}€/mois HT`;
  selectedPackDisplay.textContent = selectedPack.name;
  selectedPriceDisplay.textContent = `${selectedPack.price}€/mois HT`;
  paymentSummary.textContent = `Pack ${selectedPack.name} · ${selectedPack.price}€/mois HT`;
}

function openModal() {
  if (!selectedPack) {
    return;
  }

  syncSelectedPackToForm();
  lastFocusedElement = document.activeElement;
  modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  modalClose.focus();
}

async function teardownEmbeddedCheckout() {
  if (embeddedCheckout && typeof embeddedCheckout.destroy === 'function') {
    await embeddedCheckout.destroy();
  }
  embeddedCheckout = null;
  checkoutContainer.innerHTML = '';
}

async function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = '';
  paymentStep.hidden = true;
  paymentError.hidden = true;
  paymentError.textContent = '';
  loadingState.hidden = true;
  formFeedback.textContent = '';
  submitButton.disabled = false;
  await teardownEmbeddedCheckout();

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

stickyBarCta?.addEventListener('click', openModal);
modalClose?.addEventListener('click', () => {
  closeModal();
});

modalOverlay?.addEventListener('click', (event) => {
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
    throw new Error('La cle publique Stripe est absente. Renseignez-la dans la balise meta "stripe-publishable-key".');
  }

  if (typeof window.Stripe !== 'function') {
    throw new Error('Stripe.js n a pas pu etre charge.');
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
    throw new Error(data.error || 'Impossible de creer la session de paiement.');
  }

  return data.client_secret;
}

onboardingForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!selectedPack || !validateForm()) {
    return;
  }

  submitButton.disabled = true;
  loadingState.hidden = false;
  paymentError.hidden = true;
  paymentError.textContent = '';
  paymentStep.hidden = false;

  const formData = new FormData(onboardingForm);
  const payload = {
    pack: selectedPack.pack,
    formData: Object.fromEntries(formData.entries())
  };

  try {
    await teardownEmbeddedCheckout();
    await submitNetlifyForm(formData);
    const clientSecret = await createCheckoutSession(payload);
    await mountEmbeddedCheckout(clientSecret);
  } catch (error) {
    paymentError.hidden = false;
    paymentError.textContent = error.message || 'Une erreur est survenue lors de la creation du paiement.';
  } finally {
    loadingState.hidden = true;
    submitButton.disabled = false;
  }
});

onboardingForm?.querySelectorAll('input').forEach((input) => {
  input.addEventListener('input', () => {
    input.classList.remove('invalid');
    if (formFeedback.textContent) {
      formFeedback.textContent = '';
    }
  });
});

modalOverlay?.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') {
    return;
  }

  const focusable = modalOverlay.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
  );

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

if (window.location.pathname.endsWith('/merci.html')) {
  const packFromQuery = new URLSearchParams(window.location.search).get('pack');
  const label = PACK_LABELS[packFromQuery];
  const thanksPack = document.getElementById('thanksPack');
  if (label && thanksPack) {
    thanksPack.textContent = `Votre formule ${label.name} a bien ete prise en compte.`;
  }
}
