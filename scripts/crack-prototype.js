(() => {
  const story = document.querySelector('[data-crack-story]');
  if (!story) return;

  const steps = [...story.querySelectorAll('[data-crack-state]')];
  const mobileCards = [...story.querySelectorAll('.crack-mobile-card')];
  const views = [...story.querySelectorAll('.crack-app-view')];

  const activate = (step) => {
    const state = step.dataset.crackState;
    if (!state) return;

    story.dataset.state = state;
    steps.forEach((item) => item.classList.toggle('is-active', item === step));
    views.forEach((view) => {
      const isActive = state === 'overview'
        ? view.classList.contains('crack-view-overview')
        : state === 'wall'
          ? view.classList.contains('crack-view-wall')
          : view.classList.contains('crack-view-detail');
      view.setAttribute('aria-hidden', String(!isActive));
    });
  };

  if (steps[0]) activate(steps[0]);

  steps.forEach((step) => {
    step.addEventListener('focus', () => activate(step));
    step.addEventListener('pointerenter', () => activate(step));
  });

  if ('IntersectionObserver' in window) {
    story.classList.add('crack-motion-ready');
    const stepObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible[0]) activate(visible[0].target);
    }, {
      rootMargin: '-36% 0px -44% 0px',
      threshold: [0, 0.15, 0.35, 0.6]
    });

    steps.forEach((step) => stepObserver.observe(step));

    const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.22 });

    mobileCards.forEach((card) => cardObserver.observe(card));
  } else {
    mobileCards.forEach((card) => card.classList.add('is-visible'));
  }
})();
