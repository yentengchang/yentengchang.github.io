/* Portfolio-only interaction. No inference, camera, grading or retrieval service. */
(() => {
  'use strict';
  const page = document.querySelector('.ld-page');
  if (!page) return;
  page.classList.add('ld-interactive');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = (tag, attributes) => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    return node;
  };
  // Synthetic plane for explaining the method, not depth recovered from a JPEG.
  const project = (u, v) => [293 + 213 * u + 44 * v, 61 + 44 * u + 165 * v];
  const cloud = page.querySelector('[data-ld-depth-cloud]');
  const lines = [];
  for (let row = 0; row <= 10; row++) {
    lines.push(`M${project(0, row / 10)}L${project(1, row / 10)}`);
    for (let col = 0; col <= 14; col++) {
      const [cx, cy] = project(col / 14, row / 10);
      cloud.append(svg('circle', { cx, cy, r: 2.3, fill: `hsl(${190 + col * 2} 75% ${76 - col * 2}%)` }));
    }
  }
  for (let col = 0; col <= 14; col++) lines.push(`M${project(col / 14, 0)}L${project(col / 14, 1)}`);
  cloud.prepend(svg('path', { d: lines.join(' '), fill: 'none', stroke: '#63bddd', 'stroke-opacity': '.3', 'stroke-width': 1 }));

  const segmentation = page.querySelector('[data-ld-segmentation]');
  const categoryButtons = [...segmentation.querySelectorAll('[data-ld-category]')];
  const original = segmentation.querySelector('[data-ld-original]');
  const selected = new Set(['oil', 'rust', 'coating']);
  const updateMasks = () => {
    segmentation.querySelectorAll('[data-category]').forEach(path => { path.style.opacity = selected.has(path.dataset.category) ? '1' : '0'; });
    categoryButtons.forEach(button => button.setAttribute('aria-pressed', String(selected.has(button.dataset.ldCategory))));
    original.setAttribute('aria-pressed', String(selected.size === 0));
  };
  categoryButtons.forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.ldCategory;
    if (selected.has(category)) selected.delete(category); else selected.add(category);
    updateMasks();
  }));
  original.addEventListener('click', () => {
    if (selected.size) selected.clear(); else ['oil', 'rust', 'coating'].forEach(category => selected.add(category));
    updateMasks();
  });
  fetch('/assets/images/lud-inspection/deterioration-regions.json').then(response => {
    if (!response.ok) throw new Error('Annotation asset unavailable');
    return response.json();
  }).then(data => {
    page.querySelectorAll('[data-ld-regions]').forEach(group => {
      data.regions.filter(region => !group.dataset.ldRegions || region.id === group.dataset.ldRegions).forEach(region => {
        group.append(svg('path', { d: region.path, class: `ld-mask-${region.category}`, 'data-category': region.category }));
      });
    });
    const values = data.regions.find(region => region.id === 'region-4').path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const points = [];
    for (let i = 0; i < values.length; i += 2) points.push(project((values[i] - 1550) / 1000, (values[i + 1] - 800) / 1400));
    page.querySelector('[data-ld-depth-region]').append(svg('path', { d: `M${points.join('L')}Z` }));
    updateMasks();
  }).catch(() => {
    page.querySelector('[data-ld-mask-status]').textContent = 'Field photograph shown; annotation layers are unavailable.';
    [...categoryButtons, original].forEach(button => { button.disabled = true; });
  });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motions = [...page.querySelectorAll('[data-ld-motion]')];
  const timers = new Map();
  const played = new Set();
  const assessment = page.querySelector('[data-ld-motion="assessment"]');
  const setText = (selector, value) => { assessment.querySelector(selector).textContent = value; };
  const setAssessment = phase => {
    assessment.dataset.phase = phase;
    const stages = ['criteria', 'grades', 'schema', 'candidate', 'checks', 'review', 'complete'];
    const index = stages.indexOf(phase);
    const candidate = index >= 3;
    const complete = phase === 'complete';
    setText('[data-ld-suggested]', candidate ? 'D3' : '—');
    setText('[data-ld-suggestion-label]', candidate ? 'VLM suggestion' : 'Applying constraints');
    setText('[data-ld-reviewed]', complete ? 'D2' : '—');
    setText('[data-ld-rationale]', complete ? 'Localized corrosion; grade revised.' : '');
    setText('[data-ld-review-status]', complete ? 'Engineer review completed' : 'Quality gate → review');
    setText('[data-ld-assess-status]', complete ? 'Review completed' : index >= 5 ? 'Review required' : index >= 3 ? 'Checking output' : 'Constraining output');
    assessment.querySelectorAll('[data-ld-contract]').forEach((row, i) => {
      row.classList.toggle('is-pending', i > index);
      row.classList.toggle('is-current', i === index);
    });
    assessment.querySelector('.ld-chosen').style.background = candidate ? '' : '#e4eaf2';
    assessment.querySelector('.ld-chosen').style.color = candidate ? '' : '#51667e';
    assessment.querySelectorAll('.ld-checks > span:not(.ld-review-check)').forEach(node => node.classList.toggle('is-pending', index < 4));
  };
  const cancel = node => { (timers.get(node) || []).forEach(clearTimeout); timers.delete(node); };
  const finish = node => {
    cancel(node);
    if (node === assessment) setAssessment('complete'); else node.dataset.phase = 'complete';
    node.querySelector('[data-ld-replay]')?.setAttribute('aria-label', node === assessment ? 'Replay assessment' : 'Replay measurement');
  };
  const play = node => {
    cancel(node); played.add(node);
    if (reduced.matches || document.hidden) { finish(node); return; }
    const schedule = node === assessment
      ? [[0, 'criteria'], [650, 'grades'], [1300, 'schema'], [2050, 'candidate'], [2750, 'checks'], [3400, 'review'], [4350, 'complete']]
      : [[0, 'start'], [350, 'one'], [1000, 'two'], [1450, 'line'], [2450, 'complete']];
    const update = phase => {
      if (node === assessment) setAssessment(phase); else node.dataset.phase = phase;
      if (phase === 'complete') {
        timers.delete(node);
        node.querySelector('[data-ld-animation-status]')?.replaceChildren(document.createTextNode('Demonstration complete. The suggested D3 and reviewed D2 remain linked to the evidence.'));
      }
    };
    update(schedule[0][1]);
    timers.set(node, schedule.slice(1).map(([delay, phase]) => setTimeout(() => update(phase), delay)));
  };
  motions.forEach(node => node.querySelector('[data-ld-replay]').addEventListener('click', () => play(node)));
  setAssessment('complete');
  // One short entrance demonstration. No looping; replay remains optional.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting && !played.has(entry.target)) {
        if (innerWidth > 760 && !reduced.matches) play(entry.target);
        played.add(entry.target); observer.unobserve(entry.target);
      }
    }), { threshold: .4 });
    motions.forEach(node => observer.observe(node));
  }
  reduced.addEventListener('change', () => { if (reduced.matches) motions.forEach(finish); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) motions.forEach(finish); });
})();
