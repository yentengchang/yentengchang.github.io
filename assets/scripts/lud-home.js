/* Portfolio walkthrough only: source-image annotations and simulated workflow, no live assessment. */
(() => {
  'use strict';
  const story = document.querySelector('[data-lud-story]');
  if (!story) return;
  const states = ['capture', 'segmentation', 'area', 'length', 'constraints', 'review', 'memory', 'retrieval'];
  const visual = story.querySelector('[data-lud-visual]');
  const copies = [...story.querySelectorAll('[data-lud-copy]')];
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const durations = [1200, 2800, 4300, 3000, 4400, 3300, 2700, 3400];
  const sceneNames = ['field image', 'segmentation', 'surface measurement', 'pin-to-pin measurement', 'constrained assessment', 'engineer review', 'case storage', 'case retrieval'];
  const status = ['Image ready', 'Regions identified', 'Area measured', 'Pins selected', 'Review required', 'Review completed', 'Record saved', 'Case context loaded'];
  const titles = ['Overview', 'Deterioration', 'Surface area', 'Pin-to-pin distance', 'Deterioration', 'Deterioration', 'Reviewed image', 'Deterioration'];
  let assetsReady = false;
  let observer;
  let animationFrame = 0;
  const playing = new Map();
  const entered = new Set();
  const ns = 'http://www.w3.org/2000/svg';
  const svgNode = (name, attributes) => {
    const node = document.createElementNS(ns, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };
  // Deliberately synthetic projection: no depth was recorded with these JPEGs.
  const surfacePoint = (u, v) => [293 + 213 * u + 44 * v, 61 + 44 * u + 165 * v];
  const cloud = visual.querySelector('[data-lud-depth-cloud]');
  const grid = [];
  for (let row = 0; row <= 10; row++) {
    const a = surfacePoint(0, row / 10), b = surfacePoint(1, row / 10);
    grid.push(`M${a}L${b}`);
    for (let column = 0; column <= 14; column++) {
      const [cx, cy] = surfacePoint(column / 14, row / 10);
      cloud.append(svgNode('circle', { cx, cy, r: 2.3, fill: `hsl(${190 + column * 2} 75% ${76 - column * 2}%)` }));
    }
  }
  for (let column = 0; column <= 14; column++) {
    grid.push(`M${surfacePoint(column / 14, 0)}L${surfacePoint(column / 14, 1)}`);
  }
  cloud.prepend(svgNode('path', { d: grid.join(' '), fill: 'none', stroke: '#63bddd', 'stroke-opacity': '.3', 'stroke-width': '1' }));
  const text = (root, selector, value) => { root.querySelector(selector).textContent = value; };
  const configure = (root, state) => {
    root.dataset.state = state;
    const index = states.indexOf(state);
    root.querySelector('[data-lud-replay]').setAttribute('aria-label', `Replay ${sceneNames[index]} animation`);
    const assessed = ['constraints', 'review', 'retrieval'].includes(state);
    text(root, '[data-lud-ui-heading]', state === 'memory' ? 'Inspection history' : 'Field inspection');
    text(root, '[data-lud-ui-status]', status[index]);
    text(root, '[data-lud-image-title]', titles[index]);
    root.querySelectorAll('[data-lud-nav]').forEach(node => node.classList.toggle('is-current', node.dataset.ludNav === (state === 'memory' ? 'history' : 'inspection')));
    text(root, '[data-lud-grade]', assessed ? (state === 'retrieval' ? 'D2' : 'D3') : '—');
    text(root, '[data-lud-prediction-title]', assessed ? 'VLM suggestion' : 'Awaiting assessment');
    text(root, '[data-lud-prediction-note]', assessed ? 'Deterioration degree' : '');
    text(root, '[data-lud-e-grade]', ['area', 'constraints', 'review', 'retrieval'].includes(state) ? '3' : '—');
    text(root, '[data-lud-final-grade]', state === 'review' ? 'D2' : '—');
    text(root, '[data-lud-review-note]', state === 'review' ? 'Localized corrosion; grade revised.' : '');
    text(root, '[data-lud-review-check]', state === 'review' ? 'Engineer review completed' : 'Quality gate → review');
    text(root, '[data-lud-image-action]', state === 'segmentation' ? 'Measure regions' : 'Analyze image');
    text(root, '[data-lud-spatial-target]', state === 'length' ? '3D pin coordinates' : '3D surface');
    setProgress(root, state, 1);
  };
  const setProgress = (root, state, phase) => {
    root.style.setProperty('--lud-capture-visible', phase > .08 ? 1 : 0);
    const segmentation = state === 'segmentation';
    root.style.setProperty('--lud-oil-reveal', !segmentation || phase > .05 ? 1 : 0);
    root.style.setProperty('--lud-rust-reveal', !segmentation || phase > .2 ? 1 : 0);
    root.style.setProperty('--lud-coating-reveal', !segmentation || phase > .35 ? 1 : 0);
    root.style.setProperty('--lud-pin-one', phase > .08 ? 1 : 0);
    root.style.setProperty('--lud-pin-two', phase > .23 ? 1 : 0);
    root.style.setProperty('--lud-measure', Math.max(0, Math.min(1, (phase - .24) * 3)));
    root.style.setProperty('--lud-distance-visible', phase > .58 ? 1 : 0);
    root.style.setProperty('--lud-depth-visible', phase > .06 && phase < .70 ? 1 : 0);
    root.style.setProperty('--lud-depth-build', Math.max(0, Math.min(1, (phase - .08) * 4)));
    root.style.setProperty('--lud-area-visible', phase > .66 ? 1 : 0);
    const constrained = state === 'constraints';
    const retrieving = state === 'retrieval';
    const assessing = constrained || retrieving;
    const candidateReady = !assessing || phase >= .56;
    const validated = !assessing || phase >= .83;
    root.dataset.candidateReady = String(candidateReady);
    root.style.setProperty('--lud-gate-visible', validated ? 1 : 0);
    root.querySelectorAll('[data-lud-contract]').forEach((row, index) => {
      row.classList.toggle('is-ready', !constrained || phase >= index * .16);
      row.classList.toggle('is-active', constrained && phase >= index * .16 && phase < (index + 1) * .16);
    });
    root.querySelectorAll('[data-lud-option]').forEach(option => option.classList.toggle('is-selected', candidateReady && option.dataset.ludOption === (state === 'retrieval' ? 'D2' : 'D3')));
    root.querySelectorAll('[data-lud-check]').forEach((check, index) => {
      check.style.opacity = !assessing || phase >= .58 + index * .10 ? '1' : '.3';
      check.classList.toggle('is-pending', assessing && phase < .58 + index * .10);
    });
    if (constrained) {
      text(root, '[data-lud-grade]', candidateReady ? 'D3' : '—');
      text(root, '[data-lud-prediction-title]', candidateReady ? 'VLM suggestion' : 'Applying constraints');
      text(root, '[data-lud-ui-status]', validated ? 'Review required' : candidateReady ? 'Checking output' : 'Constraining output');
    }
    if (state === 'area') {
      text(root, '[data-lud-ui-status]', phase > .66 ? 'Area measured' : 'Reconstructing surface');
      text(root, '[data-lud-e-grade]', phase > .66 ? '3' : '—');
    }
    if (state === 'capture') text(root, '[data-lud-ui-status]', phase > .4 ? 'Image ready' : 'Loading image');
    if (state === 'segmentation') text(root, '[data-lud-ui-status]', phase > .55 ? 'Regions identified' : 'Identifying regions');
    if (state === 'length') text(root, '[data-lud-ui-status]', phase > .58 ? 'Distance measured' : phase > .24 ? 'Measuring separation' : 'Selecting pin centres');
    if (state === 'review') {
      const reviewed = phase >= .8;
      root.dataset.reviewReady = String(reviewed);
      text(root, '[data-lud-final-grade]', phase >= .28 ? 'D2' : '—');
      text(root, '[data-lud-review-note]', phase >= .48 ? 'Localized corrosion; grade revised.' : '');
      text(root, '[data-lud-review-check]', reviewed ? 'Engineer review completed' : 'Engineer review required');
      text(root, '[data-lud-ui-status]', reviewed ? 'Review completed' : 'Engineer reviewing');
    }
    root.style.setProperty('--lud-record-visible', phase > .08 ? 1 : 0);
    root.style.setProperty('--lud-record-detail', phase > .28 ? 1 : 0);
    root.style.setProperty('--lud-record-attachments', phase > .46 ? 1 : 0);
    root.style.setProperty('--lud-record-indexed', phase > .7 ? 1 : 0);
    if (state === 'memory') text(root, '[data-lud-ui-status]', phase > .7 ? 'Record saved' : 'Saving reviewed case');
    root.style.setProperty('--lud-context-visible', phase > .18 ? 1 : 0);
    if (retrieving) {
      text(root, '[data-lud-grade]', candidateReady ? 'D2' : '—');
      text(root, '[data-lud-prediction-title]', candidateReady ? 'VLM suggestion' : 'Retrieving case context');
      text(root, '[data-lud-ui-status]', validated ? 'Case context loaded' : candidateReady ? 'Checking output' : 'Retrieving reviewed case');
    }
  };
  // Each scene stays in document flow; entry starts its short, non-looping animation.
  const finish = root => {
    const playback = playing.get(root);
    playing.delete(root);
    setProgress(root, root.dataset.state, 1);
    root.dataset.ludPlayback = 'complete';
    if (playback?.manual) text(root, '[data-lud-playback-status]', 'Animation complete.');
    if (!playing.size) { cancelAnimationFrame(animationFrame); animationFrame = 0; }
  };
  const tick = now => {
    animationFrame = 0;
    playing.forEach((playback, root) => {
      const phase = Math.min(1, (now - playback.start) / playback.duration);
      if (phase >= 1) finish(root); else setProgress(root, root.dataset.state, phase);
    });
    if (playing.size) animationFrame = requestAnimationFrame(tick);
  };
  const play = (root, manual = false) => {
    if (!assetsReady || reducedQuery.matches || document.hidden) { finish(root); return; }
    // Explicit replay may precede the observer callback after keyboard focus scrolls.
    entered.add(root);
    const state = root.dataset.state;
    playing.delete(root);
    root.dataset.ludPlayback = 'reset';
    setProgress(root, state, 0);
    // Reset the old result immediately; only the new sequence should transition.
    void root.offsetWidth;
    root.dataset.ludPlayback = 'playing';
    text(root, '[data-lud-playback-status]', manual ? 'Animation replaying.' : '');
    playing.set(root, { start: performance.now(), duration: durations[states.indexOf(state)], manual });
    if (!animationFrame) animationFrame = requestAnimationFrame(tick);
  };
  // Build independent scenes once. Resizing never replaces the focused replay control.
  const scenes = copies.map((copy, index) => {
    const clone = visual.cloneNode(true);
    clone.dataset.ludScene = states[index];
    configure(clone, states[index]);
    clone.dataset.ludPlayback = 'complete';
    copy.append(clone);
    return clone;
  });
  story.classList.add('lud-flow');
  const observeScenes = () => {
    observer?.disconnect();
    [...playing.keys()].forEach(finish);
    entered.clear();
    if (assetsReady && !reducedQuery.matches && !document.hidden && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= .25 && !entered.has(entry.target)) {
          entered.add(entry.target); play(entry.target);
        } else if (!entry.isIntersecting) {
          entered.delete(entry.target); finish(entry.target);
        }
      }), { threshold: [0, .25], rootMargin: '-60px 0px 0px' });
      scenes.forEach(scene => observer.observe(scene));
    }
  };
  story.addEventListener('click', event => {
    const button = event.target.closest('[data-lud-replay]');
    if (button) play(button.closest('[data-lud-visual]'), true);
  });
  document.addEventListener('visibilitychange', observeScenes);
  reducedQuery.addEventListener('change', observeScenes);

  fetch('/assets/images/lud-inspection/deterioration-regions.json').then(response => {
    if (!response.ok) throw new Error('Region asset unavailable');
    return response.json();
  }).then(data => {
    // Reuse the annotation's silhouette on the schematic plane, not inferred depth.
    const coordinates = data.regions.find(region => region.id === 'region-4').path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const projected = [];
    for (let i = 0; i < coordinates.length; i += 2) {
      projected.push(surfacePoint((coordinates[i] - 1550) / 1000, (coordinates[i + 1] - 800) / 1400));
    }
    story.querySelectorAll('[data-lud-depth-region]').forEach(group => group.append(svgNode('path', { d: `M${projected.join('L')}Z` })));
    story.querySelectorAll('[data-lud-home-regions]').forEach(group => {
      data.regions.forEach(region => {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', region.path);
        path.setAttribute('class', `lud-ui-mask-${region.category}`);
        group.append(path);
      });
    });
    story.querySelectorAll('[data-lud-home-surface]').forEach((group, index) => {
      const defs = document.createElementNS(ns, 'defs');
      const clip = document.createElementNS(ns, 'clipPath');
      clip.id = `lud-home-surface-${index}`;
      const boundary = document.createElementNS(ns, 'path');
      boundary.setAttribute('d', data.regions.find(region => region.id === 'region-4').path);
      clip.append(boundary);defs.append(clip);group.append(defs);
      // Schematic surface grid; the JPEG has no paired depth frame.
      const segments = [];
      for (let i = 0; i < 13; i++) { const x = 1550 + i * 85; segments.push(`M${x} 800L${x - 80} 2200`); }
      for (let i = 0; i < 18; i++) { const y = 800 + i * 80; segments.push(`M1560 ${y}L2510 ${y - 140}`); }
      const mesh = document.createElementNS(ns, 'path');
      mesh.setAttribute('d', segments.join(' '));mesh.setAttribute('clip-path', `url(#${clip.id})`);group.append(mesh);
    });
  }).catch(() => {
    story.querySelectorAll('[data-lud-image-title]').forEach(node => { node.textContent = 'Field image · overlay unavailable'; });
  }).finally(() => {
    assetsReady = true;
    story.classList.add('lud-playback-ready');
    observeScenes();
  });
})();
