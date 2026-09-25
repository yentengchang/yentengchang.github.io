/* Progressive enhancement only. No inference, grading, or case database runs in this demo. */
(() => {
  'use strict';
  document.querySelector('.lud-detail-page')?.classList.add('lud-interactive');
  const states = ['capture', 'segmentation', 'area', 'length', 'constraints', 'review', 'memory', 'retrieval'];
  const info = {
    capture: ['inspect', 'Image ready', 'Field image', 'RGB', 'Field capture', 'Capture / Inspect'],
    segmentation: ['inspect', 'Regions identified', 'Deterioration layers', 'SEGMENTATION', 'Reconstructed layers', 'Inspect / Segment'],
    area: ['measure', 'Extent estimate', 'Surface measurement', 'RGB + DEPTH', 'Conceptual depth layer', 'Measure / Area'],
    length: ['measure', 'Points selected', '', '', '', 'Measure / Pin distance'],
    constraints: ['assess', 'Constrained candidate', '', '', '', 'Assess / Constrain'],
    review: ['assess', 'Engineer-reviewed', '', '', '', 'Assess / Review'],
    memory: ['cases', 'Case retained', '', '', '', 'Review / Build knowledge'],
    retrieval: ['cases', 'Context retrieved', '', '', '', 'Retrieve / Assess again']
  };
  const setText = (root, selector, value) => { const node = root.querySelector(selector); if (node) node.textContent = value; };
  const configureVisual = (visual, state) => {
    visual.dataset.state = state;
    const [nav, status, title, mode, foot, footer] = info[state];
    visual.querySelectorAll('[data-lud-nav]').forEach(node => node.classList.toggle('is-current', node.dataset.ludNav === nav));
    setText(visual, '[data-lud-status]', status);
    setText(visual, '[data-lud-view-title]', title);
    setText(visual, '[data-lud-view-mode]', mode);
    setText(visual, '[data-lud-view-foot]', foot);
    setText(visual, '[data-lud-footer]', footer);
    setText(visual, '[data-lud-assessment-footer]', state === 'review' ? 'Candidate + correction + rationale retained' : 'Standards → structured candidate → checks');
    setText(visual, '[data-lud-memory-label]', state === 'retrieval' ? 'Retrieval-augmented assessment' : 'Reviewed-case knowledge');
    setText(visual, '[data-lud-memory-title]', state === 'retrieval' ? 'The next assessment starts with context.' : 'Keep the judgement, not just the grade.');
    setText(visual, '[data-lud-memory-footer]', state === 'retrieval' ? 'Standards + reviewed cases → constrained VLM' : 'Review → case knowledge → later assessment');
  };
  const story = document.querySelector('[data-lud-story]');
  if (story) {
    const shell = story.querySelector('.lud-scroll-shell');
    const stage = story.querySelector('.lud-pinned-stage');
    const visual = story.querySelector('[data-lud-visual]');
    const copies = [...story.querySelectorAll('[data-lud-copy]')];
    const staticQuery = matchMedia('(max-width: 900px), (prefers-reduced-motion: reduce), (max-height: 620px)');
    let current = -1;
    let pending = false;
    let staticMode = false;
    const update = () => {
      pending = false;
      if (staticMode) return;
      const top = parseFloat(getComputedStyle(stage).top) || 60;
      const available = shell.offsetHeight - stage.offsetHeight;
      const progress = Math.max(0, Math.min(.99999, (top - shell.getBoundingClientRect().top) / Math.max(1, available)));
      const index = Math.floor(progress * states.length);
      const phase = progress * states.length - index;
      if (index !== current) {
        current = index;
        copies.forEach((copy, i) => { copy.classList.toggle('is-active', i === index); copy.setAttribute('aria-hidden', String(i !== index)); });
        configureVisual(visual, states[index]);
        const group = index < 2 ? 'capture' : index < 4 ? 'area' : index < 6 ? 'constraints' : 'memory';
        story.querySelectorAll('[data-lud-jump]').forEach(button => {
          if (button.dataset.ludJump === group) button.setAttribute('aria-current', 'step');
          else button.removeAttribute('aria-current');
        });
      }
      visual.style.setProperty('--lud-pin-one', phase > .08 ? 1 : .2);
      visual.style.setProperty('--lud-pin-two', phase > .25 ? 1 : .2);
      visual.style.setProperty('--lud-measure', Math.max(0, Math.min(1, (phase - .25) * 3)));
    };
    const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(update); } };
    const setMode = () => {
      staticMode = staticQuery.matches;
      current = -1;
      story.classList.toggle('lud-static', staticMode);
      story.classList.toggle('lud-enhanced', !staticMode);
      copies.forEach((copy, index) => {
        copy.removeAttribute('aria-hidden');
        copy.querySelector('[data-lud-static-clone]')?.remove();
        if (staticMode) {
          const clone = visual.cloneNode(true);
          clone.dataset.ludStaticClone = '';
          clone.removeAttribute('style');
          // SVG paint servers must remain unique across the static keyframes.
          clone.querySelectorAll('[id]').forEach(node => {
            const previous = node.id;
            node.id = `${previous}-${index}`;
            ['fill', 'clip-path'].forEach(attribute => {
              clone.querySelectorAll(`[${attribute}="url(#${previous})"]`).forEach(shape => shape.setAttribute(attribute, `url(#${node.id})`));
            });
          });
          configureVisual(clone, states[index]);
          copy.append(clone);
        }
      });
      if (staticMode) story.querySelectorAll('[data-lud-jump]').forEach(button => button.removeAttribute('aria-current'));
      schedule();
    };
    story.querySelectorAll('[data-lud-jump]').forEach(button => button.addEventListener('click', () => {
      const index = states.indexOf(button.dataset.ludJump);
      if (staticMode) copies[index].scrollIntoView({ block: 'start', behavior: 'instant' });
      else {
        const top = parseFloat(getComputedStyle(stage).top) || 60;
        const destination = shell.getBoundingClientRect().top + scrollY - top + (shell.offsetHeight - stage.offsetHeight) * ((index + .35) / states.length);
        window.scrollTo({ top: destination, behavior: 'instant' });
      }
    }));
    staticQuery.addEventListener('change', setMode);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    setMode();
  }

  // Existing field annotations reconstruct the segmentation layer; they are not live model output.
  if (document.querySelector('[data-lud-regions]')) {
    fetch('/assets/images/lud-inspection/regions.json').then(response => {
      if (!response.ok) throw new Error('LUD region asset unavailable');
      return response.json();
    }).then(data => {
      const namespace = 'http://www.w3.org/2000/svg';
      document.querySelectorAll('[data-lud-regions]').forEach(group => {
        data.regions.forEach(region => {
          const path = document.createElementNS(namespace, 'path');
          path.setAttribute('d', region.path);
          path.setAttribute('class', `lud-region-${region.category}`);
          group.append(path);
        });
      });
      document.querySelectorAll('[data-lud-mesh]').forEach((group, index) => {
        // Deliberately schematic: this photo has no paired public depth frame.
        const defs = document.createElementNS(namespace, 'defs');
        const clip = document.createElementNS(namespace, 'clipPath');
        clip.id = `lud-surface-clip-${index}`;
        const boundary = document.createElementNS(namespace, 'path');
        boundary.setAttribute('d', data.regions.find(region => region.id === 'region-4').path);
        clip.append(boundary);
        defs.append(clip);
        group.append(defs);
        const lines = [];
        for (let i = 0; i < 10; i++) {
          const x = 760 + i * 100;
          lines.push(`M${x} 560 Q${x - 170} 1170 ${x + 320} 2050`);
        }
        for (let i = 0; i < 14; i++) {
          const y = 620 + i * 100;
          lines.push(`M840 ${y} Q1130 ${y - 80} 1650 ${y - 120}`);
        }
        const path = document.createElementNS(namespace, 'path');
        path.setAttribute('d', lines.join(' '));
        path.setAttribute('clip-path', `url(#${clip.id})`);
        group.append(path);
      });
    }).catch(() => {
      document.querySelectorAll('[data-lud-view-foot]').forEach(node => { node.textContent = 'Field image · region overlay unavailable'; });
      const toggle = document.querySelector('[data-lud-mask-toggle]');
      if (toggle) { toggle.disabled = true; toggle.textContent = 'Region overlay unavailable'; }
    });
  }
  const toggle = document.querySelector('[data-lud-mask-toggle]');
  toggle?.addEventListener('click', () => {
    const on = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(on));
    document.querySelector('[data-lud-detail-figure]').dataset.overlays = on ? 'on' : 'off';
  });
  const captions = {
    all: 'Field evidence connects to constrained assessment, engineer review, and a retrievable case record. The feedback path supplies context for later assessments.',
    evidence: 'Image regions and RGB-D geometry provide visual and quantitative evidence. A model suggestion is not the source of physical measurements.',
    assess: 'Relevant standards and reviewed cases condition the VLM. Schema, allowed grades, rule checks, and quality gates constrain the candidate output.',
    review: 'The engineer confirms or revises a candidate and records why. The initial output, final judgement, evidence, and reviewer context stay linked.',
    retrieval: 'Reviewed cases are indexed for later retrieval. They provide judgement context alongside standards; they do not replace standards or automatically update model weights.'
  };
  document.querySelectorAll('[data-lud-flow]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-lud-flow]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    const focus = button.dataset.ludFlow;
    document.querySelector('[data-lud-architecture]').dataset.focus = focus;
    setText(document, '[data-lud-flow-caption]', captions[focus]);
  }));
})();
