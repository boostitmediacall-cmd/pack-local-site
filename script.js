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

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeNav);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNav();
  });
}

/* ---------- Reveal on scroll ---------- */
const revealEls = document.querySelectorAll('.reveal');

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealEls.forEach(el => el.classList.add('in'));
} else if (revealEls.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealEls.forEach(el => observer.observe(el));
}

/* ---------- Pack selector + sticky bar ---------- */
const planButtons = document.querySelectorAll('.plan-cta');
const stickyBar = document.getElementById('stickyBar');
const stickyBarText = document.getElementById('stickyBarText');
const stickyBarLink = document.getElementById('stickyBarLink');

planButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.offer-card').forEach(c => c.classList.remove('selected'));
    btn.closest('.offer-card').classList.add('selected');

    const name = btn.dataset.packName;
    const price = btn.dataset.packPrice;
    const stripe = btn.dataset.stripe;

    stickyBarText.textContent = 'Pack ' + name + ' sélectionné · ' + price + '€/mois';
    stickyBarLink.href = stripe;
    stickyBar.classList.add('visible');
  });
});
