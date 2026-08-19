/* ============================================
   PACK LOCAL — script.js
   ============================================ */

/* ---------- Menu burger ---------- */
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (burger && nav) {
  const closeNav = () => {
    nav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
  };
  burger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    burger.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
}

/* ---------- Reveal on scroll ---------- */
const revealEls = document.querySelectorAll('.reveal');
if (reduceMotion || !('IntersectionObserver' in window)) {
  revealEls.forEach(el => el.classList.add('in'));
} else if (revealEls.length) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => observer.observe(el));
}

/* ---------- Liens Stripe par pack (à remplacer par vrais Payment Links) ---------- */
const STRIPE_LINKS = {
  'Essentiel': '#stripe-link-essentiel-a-remplacer',
  'Populaire': '#stripe-link-populaire-a-remplacer',
  'Premium':   '#stripe-link-premium-a-remplacer',
};

/* ---------- État courant ---------- */
let selectedPack = null; // { name, price }

/* ---------- Éléments DOM ---------- */
const stickyBar     = document.getElementById('stickyBar');
const stickyBarText = document.getElementById('stickyBarText');
const stickyBarCta  = document.getElementById('stickyBarCta');

const modalOverlay  = document.getElementById('modalOverlay');
const modalClose    = document.getElementById('modalClose');
const stepForm      = document.getElementById('stepForm');
const stepPayment   = document.getElementById('stepPayment');
const stepConfirm   = document.getElementById('stepConfirm');

const modalPackName   = document.getElementById('modalPackName');
const paymentPackName = document.getElementById('paymentPackName');
const paymentAmount   = document.getElementById('paymentAmount');
const stripeContainer = document.getElementById('stripeContainer');

const onboardingForm      = document.getElementById('onboardingForm');
const formPack            = document.getElementById('formPack');
const formPrix            = document.getElementById('formPrix');

const ficheOui            = document.getElementById('ficheOui');
const ficheNon            = document.getElementById('ficheNon');
const ficheExistanteFields= document.getElementById('ficheExistanteFields');
const ficheCreationMsg    = document.getElementById('ficheCreationMsg');
const emailGoogleInput    = document.getElementById('emailGoogle');

/* ---------- Helpers modal ---------- */
function openModal() {
  modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  modalClose.focus();
}
function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = '';
  // Réinitialiser
  showStep(stepForm);
  if (onboardingForm) onboardingForm.reset();
  ficheExistanteFields.hidden = true;
  ficheCreationMsg.hidden = true;
}
function showStep(stepEl) {
  [stepForm, stepPayment, stepConfirm].forEach(s => s.hidden = (s !== stepEl));
}

/* ---------- Clic sur "Choisir [pack]" ---------- */
document.querySelectorAll('.plan-cta').forEach(btn => {
  btn.addEventListener('click', () => {
    const card = btn.closest('.offer-card');
    const name  = card.dataset.packName;
    const price = card.dataset.packPrice;

    selectedPack = { name, price };

    // Surligner la carte
    document.querySelectorAll('.offer-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    // Sticky bar
    stickyBarText.textContent = 'Pack ' + name + ' sélectionné · ' + price + '€ HT/mois';
    stickyBar.classList.add('visible');
  });
});

/* ---------- Clic "Continuer" (sticky bar) → ouvre modale ---------- */
if (stickyBarCta) {
  stickyBarCta.addEventListener('click', () => {
    if (!selectedPack) return;
    // Pré-remplir modale
    modalPackName.textContent = selectedPack.name;
    if (formPack)  formPack.value  = selectedPack.name;
    if (formPrix)  formPrix.value  = selectedPack.price + '€ HT/mois';
    showStep(stepForm);
    openModal();
  });
}

/* ---------- Fermeture modale ---------- */
if (modalClose) modalClose.addEventListener('click', closeModal);
if (modalOverlay) {
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOverlay && !modalOverlay.hidden) closeModal();
});

/* ---------- Logique conditionnelle fiche Google ---------- */
function toggleFicheFields() {
  const hasExisting = ficheOui && ficheOui.checked;
  const noFiche     = ficheNon && ficheNon.checked;

  ficheExistanteFields.hidden = !hasExisting;
  ficheCreationMsg.hidden     = !noFiche;

  // Rendre emailGoogle obligatoire uniquement si fiche existante
  if (emailGoogleInput) {
    emailGoogleInput.required = hasExisting;
  }
}

if (ficheOui) ficheOui.addEventListener('change', toggleFicheFields);
if (ficheNon) ficheNon.addEventListener('change', toggleFicheFields);

/* ---------- Soumission du formulaire → afficher paiement ---------- */
if (onboardingForm) {
  onboardingForm.addEventListener('submit', async e => {
    e.preventDefault();

    // Validation basique
    const required = onboardingForm.querySelectorAll('[required]');
    let valid = true;
    required.forEach(field => {
      if (!field.value.trim()) {
        field.classList.add('invalid');
        valid = false;
      } else {
        field.classList.remove('invalid');
      }
    });
    if (!valid) return;

    // Envoi à Netlify Forms (fetch silencieux)
    try {
      const data = new FormData(onboardingForm);
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString(),
      });
    } catch (_) {
      // On continue même si l'envoi échoue — Netlify le récupérera côté serveur
    }

    // Afficher étape paiement
    paymentPackName.textContent = selectedPack.name;
    paymentAmount.textContent   = selectedPack.price + '€';

    // Injecter le bouton Stripe Payment Link
    const stripeHref = STRIPE_LINKS[selectedPack.name] || '#';
    stripeContainer.innerHTML = '';
    const stripeBtn = document.createElement('a');
    stripeBtn.href      = stripeHref;
    stripeBtn.className = 'stripe-btn';
    stripeBtn.textContent = 'Payer ' + selectedPack.price + '€ HT/mois →';
    // Si c'est un vrai lien Stripe, ouvrir dans le même onglet (pas de _blank pour le tunnel)
    stripeContainer.appendChild(stripeBtn);

    showStep(stepPayment);
  });
}

/* ---------- Accessibilité : focus trap dans la modale ---------- */
if (modalOverlay) {
  modalOverlay.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const focusable = modalOverlay.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  });
}

/* ---------- Retirer le style "invalid" à la saisie ---------- */
document.querySelectorAll('.onboarding-form input').forEach(input => {
  input.addEventListener('input', () => input.classList.remove('invalid'));
});
