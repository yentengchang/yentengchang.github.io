(() => {
  const story = document.querySelector('[data-crack-story]');
  if (!story) return;

  const shell = story.querySelector('.crack-scroll-shell');
  const stage = story.querySelector('.crack-pinned-stage');
  const stateMarkers = [...story.querySelectorAll('.crack-scroll-states [data-crack-state]')];
  const copySections = [...story.querySelectorAll('[data-crack-copy]')];
  const stateNames = stateMarkers.map((marker) => marker.dataset.crackState);
  const v1Window = story.querySelector('.crack-v1-window');
  const v2Window = story.querySelector('.crack-v2-window');
  const wallFigures = [...story.querySelectorAll('.crack-v2-grid figure')];
  const morphTargetFigure = story.querySelector('[data-crack-morph-target]');
  const morphFeed = story.querySelector('.crack-morph-feed');
  const morphSource = story.querySelector('.crack-feed-square');
  const morphTarget = story.querySelector('[data-crack-morph-target] .crack-v2-feed');
  const maskCanvas = story.querySelector('.crack-mask-canvas');
  const skeletonCanvas = story.querySelector('.crack-skeleton-canvas');
  const distanceCanvas = story.querySelector('.crack-distance-canvas');
  const scanCanvas = story.querySelector('.crack-width-scan-canvas');
  const maxCanvas = story.querySelector('.crack-width-max-canvas');
  const detectionBox = story.querySelector('.crack-detection-box');
  const detectButton = story.querySelector('.crack-v1-detect');
  const logScale = story.querySelector('.crack-log-scale');
  const logDetection = story.querySelector('.crack-log-detection');
  const logLength = story.querySelector('.crack-log-length');
  const logWidth = story.querySelector('.crack-log-width');
  const eventSequencePanel = story.querySelector('.crack-event-sequence-panel');
  const eventSummaryPanel = story.querySelector('.crack-event-summary-panel');
  const eventWave = story.querySelector('.crack-event-wave path');
  const eventTrigger = story.querySelector('.crack-event-trigger');
  const eventTriggerLabel = story.querySelector('.crack-event-trigger-label');
  const eventTracks = [...story.querySelectorAll('.crack-event-tracks span')];
  const eventSequence = story.querySelector('.crack-event-sequence');
  const eventSummary = story.querySelector('.crack-event-summary');
  const eventSummaryLength = story.querySelector('.home-event-series-length');
  const eventSummaryWidth = story.querySelector('.home-event-series-width');
  let activeState = '';
  let frameRequested = false;
  let morphGeometry = null;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const remap = (value, start, end) => clamp((value - start) / (end - start), 0, 1);
  const smoothstep = (value) => {
    const t = clamp(value, 0, 1);
    return t * t * (3 - (2 * t));
  };
  const mix = (start, end, amount) => start + ((end - start) * amount);

  const activate = (state) => {
    if (!state || state === activeState) return;
    activeState = state;
    story.dataset.state = state;
    // Re-entering a step must also recover an evicted canvas bitmap (including
    // browsers that do not dispatch 2D context restoration events).
    restoreAnalysisLayers();
    const copyState = state === 'event-history' ? 'event' : state;

    if (state === 'wall') morphGeometry = null;

    copySections.forEach((section) => {
      const isActive = section.dataset.crackCopy === copyState;
      section.classList.toggle('is-active', isActive);
      section.setAttribute('aria-hidden', String(!isActive));
    });
  };

  const measureMorphGeometry = () => {
    if (!morphSource || !morphTarget || !story.querySelector('.crack-visual-stage')) return null;
    const visualRect = story.querySelector('.crack-visual-stage').getBoundingClientRect();
    const sourceRect = morphSource.getBoundingClientRect();
    const targetRect = morphTarget.getBoundingClientRect();

    return {
      source: {
        left: sourceRect.left - visualRect.left,
        top: sourceRect.top - visualRect.top,
        width: sourceRect.width,
        height: sourceRect.height
      },
      target: {
        left: targetRect.left - visualRect.left,
        top: targetRect.top - visualRect.top,
        width: targetRect.width,
        height: targetRect.height
      }
    };
  };

  const setAnalysisLayer = (element, opacity, reveal = 1) => {
    if (!element) return;
    element.style.opacity = String(opacity);
    element.style.clipPath = `inset(0 ${(1 - clamp(reveal, 0, 1)) * 100}% 0 0)`;
  };

  const clearLogHighlight = (entry) => {
    if (!entry) return;
    entry.style.background = '';
    entry.style.boxShadow = '';
  };

  const highlightLogEntry = (entry, intensity) => {
    if (!entry) return;
    const strength = clamp(intensity, 0, 1);
    entry.style.background = `rgba(54, 137, 199, ${strength * 0.16})`;
    entry.style.boxShadow = `0 0 0 1px rgba(112, 190, 246, ${strength * 0.82}), 0 0 0 ${strength * 0.18}rem rgba(75, 157, 216, ${strength * 0.11})`;
  };

  const resetVisuals = () => {
    if (v1Window) {
      v1Window.style.opacity = '1';
      v1Window.style.transform = 'none';
      v1Window.style.pointerEvents = 'auto';
    }
    if (v2Window) {
      v2Window.style.opacity = '0';
      v2Window.style.transform = 'none';
      v2Window.style.transformOrigin = 'top center';
      v2Window.style.pointerEvents = 'none';
    }
    wallFigures.forEach((figure) => {
      figure.style.opacity = '0';
      figure.style.transform = 'scale(0.96)';
    });
    if (morphFeed) morphFeed.style.opacity = '0';
    if (eventSequencePanel) {
      eventSequencePanel.style.opacity = '0';
      eventSequencePanel.style.transform = 'translateY(1rem)';
    }
    if (eventSummaryPanel) {
      eventSummaryPanel.style.opacity = '0';
      eventSummaryPanel.style.transform = 'translateY(1rem)';
    }
    if (eventWave) eventWave.style.strokeDashoffset = '1';
    if (eventTrigger) eventTrigger.style.opacity = '0';
    if (eventTriggerLabel) eventTriggerLabel.style.opacity = '0';
    eventTracks.forEach((track) => {
      track.style.clipPath = 'inset(0 100% 0 0)';
    });
    if (eventSequence) {
      eventSequence.style.opacity = '1';
      eventSequence.style.transform = 'none';
    }
    if (eventSummaryLength) eventSummaryLength.style.strokeDashoffset = '1';
    if (eventSummaryWidth) eventSummaryWidth.style.strokeDashoffset = '1';
    setAnalysisLayer(maskCanvas, 0);
    setAnalysisLayer(skeletonCanvas, 0, 0);
    setAnalysisLayer(distanceCanvas, 0);
    setAnalysisLayer(scanCanvas, 0, 0);
    setAnalysisLayer(maxCanvas, 0);
    if (detectionBox) detectionBox.style.opacity = '0';
    if (detectButton) {
      detectButton.classList.remove('is-running');
      detectButton.style.transform = 'none';
      detectButton.style.boxShadow = 'none';
    }
    if (logWidth) logWidth.style.opacity = '';
    [logScale, logDetection, logLength, logWidth].forEach((entry) => {
      if (!entry) return;
      entry.style.opacity = '';
      entry.style.transform = '';
      clearLogHighlight(entry);
    });
  };

  const updateAnalysis = (state, progress) => {
    const detectionStates = ['skeleton', 'width', 'wall', 'event'];
    const isRunning = detectionStates.includes(state) || (state === 'mask' && progress >= 0.14);
    if (detectButton) detectButton.classList.toggle('is-running', isRunning);

    if (state === 'scale') {
      highlightLogEntry(logScale, smoothstep(remap(progress, 0.02, 0.16)));
      return;
    }

    if (state === 'mask') {
      const pressDown = smoothstep(remap(progress, 0.01, 0.07));
      const pressUp = smoothstep(remap(progress, 0.07, 0.14));
      const pressAmount = pressDown * (1 - pressUp);
      if (detectButton) {
        detectButton.style.transform = `translateY(${pressAmount * 1.5}px) scale(${1 - (pressAmount * 0.025)})`;
        detectButton.style.boxShadow = `inset 0 ${pressAmount * 2}px ${pressAmount * 5}px rgba(0, 0, 0, ${pressAmount * 0.42})`;
      }

      const reveal = smoothstep(remap(progress, 0.16, 0.7));
      setAnalysisLayer(maskCanvas, reveal * 0.58);
      if (detectionBox) detectionBox.style.opacity = String(reveal);
      if (logDetection) {
        logDetection.style.opacity = String(reveal);
        logDetection.style.transform = `translateY(${(1 - reveal) * 0.25}rem)`;
      }
      const detectionHandoff = smoothstep(remap(progress, 0.18, 0.36));
      highlightLogEntry(logScale, 1 - detectionHandoff);
      highlightLogEntry(logDetection, detectionHandoff);
      return;
    }

    if (state === 'skeleton') {
      const reveal = smoothstep(remap(progress, 0.03, 0.88));
      setAnalysisLayer(maskCanvas, 0.58);
      setAnalysisLayer(skeletonCanvas, reveal > 0 ? 1 : 0, reveal);
      if (detectionBox) detectionBox.style.opacity = '1';
      const lengthReveal = smoothstep(remap(progress, 0.06, 0.3));
      if (logLength) {
        logLength.style.opacity = String(lengthReveal);
        logLength.style.transform = `translateY(${(1 - lengthReveal) * 0.25}rem)`;
      }
      const lengthHandoff = smoothstep(remap(progress, 0.06, 0.3));
      highlightLogEntry(logDetection, 1 - lengthHandoff);
      highlightLogEntry(logLength, lengthHandoff);
      return;
    }

    if (state === 'width' || state === 'wall' || state === 'event') {
      const distanceReveal = state === 'width' ? smoothstep(remap(progress, 0.01, 0.16)) : 1;
      const scanReveal = state === 'width' ? smoothstep(remap(progress, 0.06, 0.62)) : 1;
      const maximumReveal = state === 'width' ? smoothstep(remap(progress, 0.62, 0.8)) : 1;
      const widthResultReveal = state === 'width' ? smoothstep(remap(progress, 0.04, 0.24)) : 1;
      setAnalysisLayer(maskCanvas, 0.16);
      setAnalysisLayer(skeletonCanvas, 1, 1);
      setAnalysisLayer(distanceCanvas, distanceReveal * 0.9);
      setAnalysisLayer(scanCanvas, scanReveal * 0.96, scanReveal);
      setAnalysisLayer(maxCanvas, maximumReveal);
      if (detectionBox) detectionBox.style.opacity = '1';
      if (logWidth) {
        logWidth.style.opacity = String(widthResultReveal);
        logWidth.style.transform = `translateY(${(1 - widthResultReveal) * 0.25}rem)`;
      }
      if (state === 'width') {
        const widthHandoff = smoothstep(remap(progress, 0.04, 0.24));
        highlightLogEntry(logLength, 1 - widthHandoff);
        highlightLogEntry(logWidth, widthHandoff);
      }
    }
  };

  const updateWallTransition = (progress) => {
    if (!v1Window || !v2Window) return;
    const assemble = smoothstep(remap(progress, 0.08, 0.84));
    const v1Fade = smoothstep(remap(progress, 0.16, 0.76));
    const v2Fade = smoothstep(remap(progress, 0.1, 0.66));

    v1Window.style.opacity = String(1 - (v1Fade * 0.96));
    v1Window.style.transform = `scale(${mix(1, 0.96, v1Fade)})`;
    v1Window.style.pointerEvents = 'none';
    v2Window.style.opacity = String(v2Fade);
    v2Window.style.transform = 'none';
    v2Window.style.pointerEvents = 'auto';

    wallFigures.forEach((figure, index) => {
      if (figure === morphTargetFigure) return;
      const tileReveal = smoothstep(remap(progress, 0.2 + (index * 0.1), 0.58 + (index * 0.1)));
      figure.style.opacity = String(tileReveal);
      figure.style.transform = `scale(${mix(0.96, 1, tileReveal)})`;
    });

    if (morphTargetFigure) {
      const targetReveal = smoothstep(remap(progress, 0.87, 1));
      morphTargetFigure.style.opacity = String(targetReveal);
      morphTargetFigure.style.transform = `scale(${mix(0.96, 1, targetReveal)})`;
    }

    if (!morphFeed) return;
    if (!morphGeometry) morphGeometry = measureMorphGeometry();
    if (!morphGeometry) return;

    const movement = smoothstep(remap(progress, 0.06, 0.92));
    const fadeIn = smoothstep(remap(progress, 0.02, 0.1));
    const fadeOut = 1 - smoothstep(remap(progress, 0.88, 0.99));
    const { source, target } = morphGeometry;
    morphFeed.style.left = `${mix(source.left, target.left, movement)}px`;
    morphFeed.style.top = `${mix(source.top, target.top, movement)}px`;
    morphFeed.style.width = `${mix(source.width, target.width, movement)}px`;
    morphFeed.style.height = `${mix(source.height, target.height, movement)}px`;
    morphFeed.style.borderRadius = `${movement * 0.3}rem`;
    morphFeed.style.opacity = String(fadeIn * fadeOut);
    morphFeed.style.boxShadow = `0 ${mix(0, 10, assemble)}px ${mix(0, 28, assemble)}px rgba(0, 0, 0, ${mix(0, 0.28, assemble)})`;
  };

  const setEventContext = (windowShift = 1) => {
    if (!v1Window || !v2Window) return;

    v1Window.style.opacity = '0';
    v1Window.style.pointerEvents = 'none';
    v2Window.style.opacity = '1';
    v2Window.style.pointerEvents = 'auto';
    v2Window.style.transform = `translateY(${-7 * windowShift}%) scale(${mix(1, 0.67, windowShift)})`;
    wallFigures.forEach((figure) => {
      figure.style.opacity = '1';
      figure.style.transform = 'none';
    });
  };

  const updateEventSequence = (progress) => {
    if (!eventSequencePanel) return;
    const windowShift = smoothstep(remap(progress, 0.02, 0.3));
    const eventReveal = smoothstep(remap(progress, 0.1, 0.3));
    const waveReveal = smoothstep(remap(progress, 0.2, 0.58));
    const triggerReveal = smoothstep(remap(progress, 0.3, 0.42));

    setEventContext(windowShift);

    eventSequencePanel.style.opacity = String(eventReveal);
    eventSequencePanel.style.transform = `translateY(${(1 - eventReveal)}rem)`;
    if (eventWave) eventWave.style.strokeDashoffset = String(1 - waveReveal);
    if (eventTrigger) eventTrigger.style.opacity = String(triggerReveal);
    if (eventTriggerLabel) eventTriggerLabel.style.opacity = String(triggerReveal);
    eventTracks.forEach((track, index) => {
      const trackReveal = smoothstep(remap(progress, 0.42 + (index * 0.06), 0.68 + (index * 0.055)));
      track.style.clipPath = `inset(0 ${(1 - trackReveal) * 100}% 0 0)`;
    });
  };

  const updateEventHistory = (progress) => {
    if (!eventSequencePanel || !eventSummaryPanel) return;
    setEventContext(1);

    if (eventWave) eventWave.style.strokeDashoffset = '0';
    if (eventTrigger) eventTrigger.style.opacity = '1';
    if (eventTriggerLabel) eventTriggerLabel.style.opacity = '1';
    eventTracks.forEach((track) => {
      track.style.clipPath = 'inset(0 0 0 0)';
    });

    const summaryReveal = smoothstep(remap(progress, 0.12, 0.34));
    const lengthReveal = smoothstep(remap(progress, 0.46, 0.9));
    const widthReveal = smoothstep(remap(progress, 0.58, 0.99));
    eventSequencePanel.style.opacity = String(1 - summaryReveal);
    eventSequencePanel.style.transform = `translateY(${-0.3 * summaryReveal}rem)`;
    eventSummaryPanel.style.opacity = String(summaryReveal);
    eventSummaryPanel.style.transform = `translateY(${(1 - summaryReveal)}rem)`;
    if (eventSummaryLength) eventSummaryLength.style.strokeDashoffset = String(1 - lengthReveal);
    if (eventSummaryWidth) eventSummaryWidth.style.strokeDashoffset = String(1 - widthReveal);
  };

  const updateVisualProgress = (state, progress) => {
    const motionProgress = remap(progress, 0, 0.74);
    resetVisuals();
    updateAnalysis(state, motionProgress);
    if (state === 'wall') updateWallTransition(motionProgress);
    if (state === 'event') updateEventSequence(motionProgress);
    if (state === 'event-history') updateEventHistory(motionProgress);
  };

  const updateFromScroll = () => {
    frameRequested = false;
    const shellRect = shell.getBoundingClientRect();
    const stickyTop = Number.parseFloat(getComputedStyle(stage).top) || 0;
    const travel = Math.max(1, shell.offsetHeight - stage.offsetHeight);
    const progress = Math.min(1, Math.max(0, (stickyTop - shellRect.top) / travel));
    const scaledProgress = progress * stateNames.length;
    const index = Math.min(stateNames.length - 1, Math.floor(scaledProgress));
    const stateProgress = progress === 1 ? 1 : scaledProgress - index;
    activate(stateNames[index]);
    if (story.dataset.analysisReady !== 'true') restoreAnalysisLayers();
    updateVisualProgress(stateNames[index], stateProgress);
  };

  const queueUpdate = () => {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(updateFromScroll);
  };

  const jet = (value) => {
    const r = clamp(1.5 - Math.abs((4 * value) - 3), 0, 1);
    const g = clamp(1.5 - Math.abs((4 * value) - 2), 0, 1);
    const b = clamp(1.5 - Math.abs((4 * value) - 1), 0, 1);
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const prepareEventWaveform = () => {
    if (!eventWave) return;
    const points = [];
    const total = 260;
    const twoPi = Math.PI * 2;

    for (let index = 0; index <= total; index += 1) {
      const time = index / total;
      let amplitude = 0;

      if (time >= 0.06 && time < 0.28) {
        amplitude = mix(1.4, 5.5, smoothstep(remap(time, 0.06, 0.28)));
      } else if (time >= 0.28 && time < 0.42) {
        amplitude = mix(5.5, 27, smoothstep(remap(time, 0.28, 0.42)));
      } else if (time >= 0.42 && time < 0.58) {
        amplitude = mix(27, 11, smoothstep(remap(time, 0.42, 0.58)));
      } else if (time >= 0.58 && time < 0.84) {
        const decay = mix(10, 2, smoothstep(remap(time, 0.58, 0.84)));
        const aftershock = 5.5 * Math.exp(-Math.pow((time - 0.69) / 0.045, 2));
        amplitude = decay + aftershock;
      } else if (time >= 0.84 && time < 0.94) {
        amplitude = mix(2, 0, smoothstep(remap(time, 0.84, 0.94)));
      }

      const carrier =
        (Math.sin(time * twoPi * 61) * 0.63) +
        (Math.sin((time * twoPi * 103) + 0.7) * 0.25) +
        (Math.sin((time * twoPi * 17) + 1.1) * 0.12);
      const x = time * 800;
      const y = 40 + (amplitude * carrier);
      points.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
    }

    eventWave.setAttribute('d', points.join(' '));
  };

  const prepareEventSummary = () => {
    if (!eventSummaryLength || !eventSummaryWidth) return;

    const sampleCount = 241;
    const rawNoise = [];
    let seed = 27463;

    for (let index = 0; index < sampleCount + 8; index += 1) {
      seed = (seed * 16807) % 2147483647;
      rawNoise.push(((seed / 2147483647) * 2) - 1);
    }

    const filteredNoise = rawNoise.map((_, index) => {
      const a = rawNoise[Math.max(0, index - 2)];
      const b = rawNoise[Math.max(0, index - 1)];
      const c = rawNoise[index];
      const d = rawNoise[Math.min(rawNoise.length - 1, index + 1)];
      const e = rawNoise[Math.min(rawNoise.length - 1, index + 2)];
      return (a + (2 * b) + (3 * c) + (2 * d) + e) / 9;
    });

    const sigmoid = (value, center, steepness = 65) => 1 / (1 + Math.exp(-steepness * (value - center)));
    const gaussian = (value, center, spread) => Math.exp(-Math.pow((value - center) / spread, 2));
    const samples = Array.from({ length: sampleCount }, (_, index) => index / (sampleCount - 1));
    const xAt = (time) => 92 + (686 * time);
    const lengthY = (value) => 83 - (((value - 49.78) / 0.24) * 53);
    const widthY = (value) => 159 - (((value - 1.48) / 0.16) * 53);

    const lengthValues = samples.map((time, index) => {
      const noise = filteredNoise[index + 3];
      if (time < 0.3) {
        return 49.82 + (0.0018 * Math.sin(2 * Math.PI * ((4.2 * time) + 0.1))) + (0.0015 * noise);
      }
      if (time <= 0.75) {
        const eventTime = (time - 0.3) / 0.45;
        const growth =
          (0.018 * sigmoid(eventTime, 0.17)) +
          (0.043 * sigmoid(eventTime, 0.35)) +
          (0.052 * sigmoid(eventTime, 0.55)) +
          (0.036 * sigmoid(eventTime, 0.73)) +
          (0.019 * sigmoid(eventTime, 0.88));
        const activity =
          (0.36 * gaussian(eventTime, 0.24, 0.16)) +
          gaussian(eventTime, 0.55, 0.2) +
          (0.42 * gaussian(eventTime, 0.82, 0.16));
        return 49.82 + growth +
          ((0.0014 + (0.0036 * activity)) * noise) +
          (0.0018 * activity * Math.sin(2 * Math.PI * ((13.4 * eventTime) + (0.8 * eventTime * eventTime))));
      }
      const postTime = (time - 0.75) / 0.25;
      return 49.988 +
        (0.0025 * Math.exp(-7 * postTime) * Math.sin(2 * Math.PI * 8.5 * postTime)) +
        (0.0013 * noise);
    });

    const widthValues = samples.map((time, index) => {
      const noise = filteredNoise[index + 5];
      if (time < 0.3) {
        return 1.54 + (0.0015 * Math.sin(2 * Math.PI * ((4.8 * time) + 0.18))) + (0.0012 * noise);
      }
      if (time <= 0.75) {
        const eventTime = (time - 0.3) / 0.45;
        const activity =
          (0.38 * gaussian(eventTime, 0.2, 0.14)) +
          gaussian(eventTime, 0.51, 0.2) +
          (0.48 * gaussian(eventTime, 0.8, 0.17));
        const carrier =
          (0.48 * Math.sin(2 * Math.PI * ((9.1 * eventTime) + (1.1 * eventTime * eventTime)) + 0.3)) +
          (0.27 * Math.sin(2 * Math.PI * ((15.7 * eventTime) + (0.55 * eventTime * eventTime)) + 1.35)) +
          (0.16 * Math.sin(2 * Math.PI * (24.3 * eventTime) + 2.2)) +
          (0.18 * noise);
        return 1.54 + (0.032 * sigmoid(eventTime, 0.57, 18)) + ((0.005 + (0.054 * activity)) * carrier);
      }
      const postTime = (time - 0.75) / 0.25;
      return 1.572 +
        (0.0085 * Math.exp(-6.5 * postTime) * Math.sin(2 * Math.PI * 9.5 * postTime + 0.35)) +
        (0.0035 * Math.exp(-8 * postTime) * Math.sin(2 * Math.PI * 18.5 * postTime + 1.1)) +
        (0.0012 * noise);
    });

    const toPath = (values, yScale) => values.map((value, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command}${xAt(samples[index]).toFixed(2)} ${yScale(value).toFixed(2)}`;
    }).join(' ');

    eventSummaryLength.setAttribute('d', toPath(lengthValues, lengthY));
    eventSummaryWidth.setAttribute('d', toPath(widthValues, widthY));
  };

  // The accepted 400×400 reference geometry, compiled once from the original
  // segmentation screenshot. Keep this with the renderer: no image download,
  // decode or pixel-readback dependency is needed to initialize the walkthrough.
  // Entries are [left, right, center] in the original canvas coordinate system.
  const analysisRows = [
    null, null, null, [277,286,281.5], [277,286,281.5], [277,287,282], [277,287,282], [277,287,282],
    [277,288,282.5], [278,289,283.5], [279,289,284], [279,290,284.5], [280,290,285], [280,291,285.5], [281,292,286.5], [281,292,286.5],
    [282,301,291.5], [284,301,292.5], [284,301,292.5], [285,301,293], [286,301,293.5], [286,301,293.5], [287,301,294], [287,301,294],
    [288,301,294.5], [288,301,294.5], [289,301,295], [289,301,295], [289,301,295], [289,301,295], [288,301,294.5], [286,301,293.5],
    [284,301,292.5], [284,301,292.5], [281,301,291], [280,301,290.5], [279,300,289.5], [277,298,287.5], [276,297,286.5], [275,293,284],
    [273,291,282], [272,289,280.5], [270,289,279.5], [269,288,278.5], [268,287,277.5], [267,284,275.5], [267,283,275], [266,282,274],
    [266,282,274], [265,281,273], [265,281,273], [264,280,272], [264,279,271.5], [264,279,271.5], [264,279,271.5], [264,279,271.5],
    [263,279,271], [263,279,271], [263,278,270.5], [263,277,270], [263,277,270], [263,277,270], [263,277,270], [262,276,269],
    [262,276,269], [262,275,268.5], [262,274,268], [262,273,267.5], [262,273,267.5], [261,272,266.5], [260,272,266], [260,272,266],
    [260,272,266], [260,272,266], [260,272,266], [260,272,266], [260,272,266], [260,272,266], [260,272,266], [260,272,266],
    [260,272,266], [260,272,266], [260,272,266], [260,272,266], [260,272,266], [260,272,266], [260,272,266], [260,272,266],
    [260,272,266], [260,272,266], [260,273,266.5], [260,274,267], [260,274,267], [260,274,267], [260,273,266.5], [260,272,266],
    [260,272,266], [260,272,266], [259,272,265.5], [259,272,265.5], [259,272,265.5], [258,272,265], [258,271,264.5], [258,270,264],
    [257,270,263.5], [257,270,263.5], [255,269,262], [255,268,261.5], [255,267,261], [254,267,260.5], [254,266,260], [253,266,259.5],
    [252,265,258.5], [252,265,258.5], [252,264,258], [252,264,258], [251,264,257.5], [251,263,257], [251,263,257], [251,263,257],
    [250,262,256], [249,261,255], [249,261,255], [248,260,254], [247,260,253.5], [247,259,253], [246,259,252.5], [245,258,251.5],
    [244,258,251], [244,257,250.5], [244,257,250.5], [242,256,249], [242,255,248.5], [241,254,247.5], [241,253,247], [241,252,246.5],
    [240,251,245.5], [239,251,245], [239,250,244.5], [238,249,243.5], [238,249,243.5], [237,248,242.5], [237,247,242], [237,247,242],
    [236,247,241.5], [235,246,240.5], [235,246,240.5], [234,245,239.5], [234,244,239], [233,243,238], [232,243,237.5], [231,243,237],
    [230,241,235.5], [229,240,234.5], [229,240,234.5], [228,240,234], [227,239,233], [227,238,232.5], [226,238,232], [225,237,231],
    [225,236,230.5], [224,235,229.5], [223,235,229], [222,234,228], [222,233,227.5], [221,232,226.5], [220,231,225.5], [218,230,224],
    [217,230,223.5], [216,230,223], [215,229,222], [215,228,221.5], [215,227,221], [213,226,219.5], [212,225,218.5], [211,224,217.5],
    [211,223,217], [210,222,216], [209,221,215], [209,220,214.5], [208,219,213.5], [207,218,212.5], [207,218,212.5], [206,217,211.5],
    [205,216,210.5], [204,216,210], [204,215,209.5], [203,214,208.5], [201,213,207], [200,212,206], [199,211,205], [198,210,204],
    [197,209,203], [195,208,201.5], [193,207,200], [190,206,198], [188,205,196.5], [184,204,194], [183,203,193], [180,202,191],
    [177,201,189], [176,200,188], [175,198,186.5], [174,197,185.5], [173,194,183.5], [172,193,182.5], [171,189,180], [170,187,178.5],
    [170,183,176.5], [170,182,176], [169,181,175], [168,178,173], [168,178,173], [167,177,172], [166,176,171], [165,176,170.5],
    [164,175,169.5], [164,175,169.5], [163,174,168.5], [163,173,168], [162,172,167], [161,172,166.5], [160,171,165.5], [160,171,165.5],
    [159,169,164], [159,169,164], [158,169,163.5], [157,168,162.5], [156,168,162], [155,167,161], [154,166,160], [152,166,159],
    [149,165,157], [142,165,153.5], [140,163,151.5], [137,161,149], [136,160,148], [135,159,147], [134,158,146], [133,156,144.5],
    [133,155,144], [133,152,142.5], [131,151,141], [130,149,139.5], [130,148,139], [128,146,137], [128,144,136], [127,144,135.5],
    [126,143,134.5], [124,142,133], [124,141,132.5], [123,140,131.5], [122,139,130.5], [121,136,128.5], [120,136,128], [119,134,126.5],
    [116,132,124], [115,131,123], [113,129,121], [111,128,119.5], [109,127,118], [105,125,115], [104,123,113.5], [101,120,110.5],
    [99,119,109], [98,117,107.5], [97,116,106.5], [96,115,105.5], [96,112,104], [95,109,102], [94,106,100], [93,104,98.5],
    [93,104,98.5], [92,104,98], [91,103,97], [91,102,96.5], [91,101,96], [90,100,95], [90,100,95], [90,100,95],
    [89,100,94.5], [89,100,94.5], [89,100,94.5], [89,99,94], [88,99,93.5], [88,99,93.5], [88,99,93.5], [88,99,93.5],
    [88,99,93.5], [87,98,92.5], [87,98,92.5], [87,97,92], [86,97,91.5], [86,96,91], [85,96,90.5], [85,95,90],
    [84,94,89], [84,94,89], [83,94,88.5], [83,93,88], [83,92,87.5], [82,92,87], [81,91,86], [81,90,85.5],
    [80,90,85], [80,90,85], [79,89,84], [79,89,84], [79,89,84], [78,88,83], [78,88,83], [77,88,82.5],
    [77,87,82], [77,87,82], [77,87,82], [76,87,81.5], [76,87,81.5], [76,86,81], [76,86,81], [76,86,81],
    [75,86,80.5], [75,86,80.5], [75,86,80.5], [75,86,80.5], [75,86,80.5], [75,86,80.5], [75,86,80.5], [75,86,80.5],
    [74,85,79.5], [74,84,79], [74,84,79], [74,84,79], [74,84,79], [73,83,78], [72,83,77.5], [72,83,77.5],
    [72,83,77.5], [71,82,76.5], [71,81,76], [70,80,75], [70,80,75], [70,80,75], [70,79,74.5], [70,79,74.5],
    [70,79,74.5], [70,79,74.5], [69,79,74], [69,79,74], [69,79,74], [69,78,73.5], [69,77,73], [68,77,72.5],
    [67,77,72], [67,77,72], [67,76,71.5], [67,76,71.5], [66,75,70.5], [65,75,70], [65,74,69.5], [64,73,68.5],
    [64,73,68.5], [63,72,67.5], [63,72,67.5], [62,71,66.5], [61,70,65.5], [60,70,65], [59,69,64], [59,69,64],
    [58,68,63], [57,68,62.5], [57,67,62], [57,67,62], [57,66,61.5], [57,66,61.5], [57,66,61.5], [57,65,61],
    [57,65,61], [57,65,61], [57,65,61], [57,65,61], [57,65,61], [57,65,61], [57,65,61], [57,65,61],
    [57,65,61], [57,65,61], [57,65,61], [57,65,61], [57,65,61], [57,65,61], [57,65,61], [57,65,61],
    [57,64,60.5], [57,64,60.5], [57,63,60], [57,63,60], [57,64,60.5], null, null, null
  ];

  const prepareAnalysisLayers = () => {
    const canvases = [maskCanvas, skeletonCanvas, distanceCanvas, scanCanvas, maxCanvas];
    if (canvases.some(canvas => !canvas)) return false;
    const contexts = canvases.map(canvas => canvas.getContext('2d'));
    if (contexts.some(context => !context || context.isContextLost?.())) return false;
    const [maskContext, skeletonContext, distanceContext, scanContext, maxContext] = contexts;
    const width = maskCanvas.width;
    const height = maskCanvas.height;
    const rows = analysisRows.map(row => row && ({ left: row[0], right: row[1], center: row[2] }));

    const maskImage = maskContext.createImageData(width, height);
    const distanceImage = distanceContext.createImageData(width, height);

    rows.forEach((row, y) => {
      if (!row) return;
      const left = clamp(Math.floor(row.left) - 1, 0, width - 1);
      const right = clamp(Math.ceil(row.right) + 1, 0, width - 1);
      const halfWidth = Math.max(1, (right - left) / 2);

      for (let x = left; x <= right; x += 1) {
        const offset = ((y * width) + x) * 4;
        maskImage.data[offset] = 22;
        maskImage.data[offset + 1] = 70;
        maskImage.data[offset + 2] = 255;
        maskImage.data[offset + 3] = 212;

        const normalizedDistance = clamp(Math.min(x - left, right - x) / halfWidth, 0, 1);
        const [red, green, blue] = jet(normalizedDistance);
        distanceImage.data[offset] = red;
        distanceImage.data[offset + 1] = green;
        distanceImage.data[offset + 2] = blue;
        distanceImage.data[offset + 3] = 230;
      }
    });

    maskContext.putImageData(maskImage, 0, 0);
    distanceContext.putImageData(distanceImage, 0, 0);

    skeletonContext.clearRect(0, 0, width, height);
    skeletonContext.beginPath();
    let started = false;
    rows.forEach((row, y) => {
      if (!row) {
        started = false;
        return;
      }
      if (!started) {
        skeletonContext.moveTo(row.center, y);
        started = true;
      } else {
        skeletonContext.lineTo(row.center, y);
      }
    });
    skeletonContext.strokeStyle = 'rgba(255, 218, 221, 0.98)';
    skeletonContext.lineWidth = 2;
    skeletonContext.lineJoin = 'round';
    skeletonContext.lineCap = 'round';
    skeletonContext.stroke();

    const candidates = [];
    for (let y = 14; y < height - 14; y += 13) {
      const row = rows[y];
      if (!row) continue;
      const left = clamp(row.left - 1, 0, width - 1);
      const right = clamp(row.right + 1, 0, width - 1);
      candidates.push({ left, right, y, width: right - left });
    }

    scanContext.clearRect(0, 0, width, height);
    scanContext.strokeStyle = 'rgba(255, 255, 255, 0.86)';
    scanContext.lineWidth = 1;
    candidates.forEach((candidate) => {
      scanContext.beginPath();
      scanContext.moveTo(candidate.left, candidate.y);
      scanContext.lineTo(candidate.right, candidate.y);
      scanContext.stroke();
    });

    const widest = candidates.reduce((current, candidate) => (
      !current || candidate.width > current.width ? candidate : current
    ), null);

    if (widest) {
      maxContext.clearRect(0, 0, width, height);
      maxContext.strokeStyle = '#ffd45a';
      maxContext.fillStyle = '#ffd45a';
      maxContext.lineWidth = 3;
      maxContext.beginPath();
      maxContext.moveTo(widest.left, widest.y);
      maxContext.lineTo(widest.right, widest.y);
      maxContext.stroke();
      [widest.left, widest.right].forEach((x) => {
        maxContext.beginPath();
        maxContext.arc(x, widest.y, 3, 0, Math.PI * 2);
        maxContext.fill();
      });
    }
    return true;
  };

  const restoreAnalysisLayers = () => {
    // A restored 2D context contains an empty bitmap. Do not cache a successful
    // initialization forever; also repaint after navigation / tab restoration.
    try {
      story.dataset.analysisReady = String(prepareAnalysisLayers());
    } catch {
      // Context loss during painting must not stop the scroll / recovery hooks.
      story.dataset.analysisReady = 'false';
    }
  };

  prepareEventWaveform();
  prepareEventSummary();
  [maskCanvas, skeletonCanvas, distanceCanvas, scanCanvas, maxCanvas].forEach(canvas => {
    if (!canvas) return;
    canvas.addEventListener('contextlost', () => { story.dataset.analysisReady = 'false'; });
    canvas.addEventListener('contextrestored', () => {
      restoreAnalysisLayers();
      queueUpdate();
    });
  });
  window.addEventListener('pageshow', () => {
    restoreAnalysisLayers();
    morphGeometry = null;
    queueUpdate();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      restoreAnalysisLayers();
      queueUpdate();
    }
  });
  updateFromScroll();

  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', () => {
    morphGeometry = null;
    queueUpdate();
  });
})();
