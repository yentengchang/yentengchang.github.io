(() => {
  'use strict';
  const walkthrough = document.querySelector('[data-da-walkthrough]');
  if (!walkthrough) return;
  const steps = [...walkthrough.querySelectorAll('[data-da-step]')];
  const play = walkthrough.querySelector('[data-da-play]');
  const replay = walkthrough.querySelector('[data-da-replay]');
  const description = walkthrough.querySelector('[data-da-description]');
  const announcement = walkthrough.querySelector('[data-da-announcement]');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const descriptions = [
    'Identify the bar mark, size, quantity, shape and cutting length in the supplier drawing.',
    'Organize the attributes into a structured record. This JSON illustrates the data, not the original script format.',
    'Translate D25 into #8 and millimetres into centimetres, keeping the bar quantity and shape information.',
    'AutoLISP places the bar geometry and annotations using the crew’s drawing layout.'
  ];
  let state = 3;
  let timer = null;
  let playing = false;
  let visible = false;
  let started = false;
  let userInteracted = false;

  function render(next, announce = false) {
    state = next;
    walkthrough.dataset.daState = String(state);
    steps.forEach((button, index) => button.setAttribute('aria-pressed', String(index === state)));
    description.textContent = descriptions[state];
    if (announce) announcement.textContent = `Step ${state + 1}: ${descriptions[state]}`;
  }

  function clearTimer() {
    window.clearTimeout(timer);
    timer = null;
  }

  function setPlaying(value) {
    playing = value;
    play.textContent = value ? 'Pause' : 'Play';
    play.setAttribute('aria-label', value ? 'Pause illustrative workflow' : 'Play illustrative workflow');
    clearTimer();
    schedule();
  }

  function schedule() {
    if (!playing || !visible || document.hidden || timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      if (state === 3) {
        setPlaying(false);
        return;
      }
      render(state + 1);
      schedule();
    }, 2600);
  }

  steps.forEach((button, index) => button.addEventListener('click', () => {
    userInteracted = true;
    setPlaying(false);
    render(index, true);
  }));
  play.addEventListener('click', () => {
    userInteracted = true;
    if (playing) {
      setPlaying(false);
    } else {
      if (state === 3) render(0, true);
      setPlaying(true);
    }
  });
  replay.addEventListener('click', () => {
    userInteracted = true;
    render(0, true);
    setPlaying(true);
  });
  document.addEventListener('visibilitychange', () => {
    clearTimer();
    schedule();
  });
  motion.addEventListener('change', () => {
    setPlaying(false);
    render(3);
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) {
        clearTimer();
        return;
      }
      if (!started && !userInteracted && !motion.matches) {
        started = true;
        render(0);
        setPlaying(true);
      } else {
        schedule();
      }
    }, { threshold: 0.12 });
    observer.observe(walkthrough);
  } else {
    visible = true;
  }
  document.body.classList.add('da-enhanced');
  render(3);
  setPlaying(false);
})();
