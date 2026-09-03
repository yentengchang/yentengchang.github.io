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
  const eventStory = story.querySelector('.crack-event-story');
  const eventWave = story.querySelector('.crack-event-wave path');
  const eventTrigger = story.querySelector('.crack-event-trigger');
  const eventTriggerLabel = story.querySelector('.crack-event-trigger-label');
  const eventTracks = [...story.querySelectorAll('.crack-event-tracks span')];
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

    if (state === 'wall') morphGeometry = null;

    copySections.forEach((section) => {
      const isActive = section.dataset.crackCopy === state;
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
    if (eventStory) {
      eventStory.style.opacity = '0';
      eventStory.style.transform = 'translateY(0.8rem)';
    }
    if (eventWave) eventWave.style.strokeDashoffset = '1';
    if (eventTrigger) eventTrigger.style.opacity = '0';
    if (eventTriggerLabel) eventTriggerLabel.style.opacity = '0';
    eventTracks.forEach((track) => {
      track.style.clipPath = 'inset(0 100% 0 0)';
    });
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

  const updateEventSequence = (progress) => {
    if (!v1Window || !v2Window || !eventStory) return;
    const windowShift = smoothstep(remap(progress, 0.02, 0.42));
    const eventReveal = smoothstep(remap(progress, 0.1, 0.34));
    const waveReveal = smoothstep(remap(progress, 0.16, 0.64));
    const triggerReveal = smoothstep(remap(progress, 0.25, 0.36));

    v1Window.style.opacity = '0';
    v1Window.style.pointerEvents = 'none';
    v2Window.style.opacity = '1';
    v2Window.style.pointerEvents = 'auto';
    v2Window.style.transform = `translateY(${-5 * windowShift}%) scale(${mix(1, 0.72, windowShift)})`;
    wallFigures.forEach((figure) => {
      figure.style.opacity = '1';
      figure.style.transform = 'none';
    });

    eventStory.style.opacity = String(eventReveal);
    eventStory.style.transform = `translateY(${(1 - eventReveal) * 0.8}rem)`;
    if (eventWave) eventWave.style.strokeDashoffset = String(1 - waveReveal);
    if (eventTrigger) eventTrigger.style.opacity = String(triggerReveal);
    if (eventTriggerLabel) eventTriggerLabel.style.opacity = String(triggerReveal);
    eventTracks.forEach((track, index) => {
      const trackReveal = smoothstep(remap(progress, 0.32 + (index * 0.055), 0.78 + (index * 0.04)));
      track.style.clipPath = `inset(0 ${(1 - trackReveal) * 100}% 0 0)`;
    });
  };

  const updateVisualProgress = (state, progress) => {
    const motionProgress = remap(progress, 0, 0.74);
    resetVisuals();
    updateAnalysis(state, motionProgress);
    if (state === 'wall') updateWallTransition(motionProgress);
    if (state === 'event') updateEventSequence(motionProgress);
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

  const getClusters = (positions) => {
    if (!positions.length) return [];
    const clusters = [];
    let cluster = [positions[0]];

    for (let index = 1; index < positions.length; index += 1) {
      if (positions[index] - positions[index - 1] <= 2) {
        cluster.push(positions[index]);
      } else {
        clusters.push(cluster);
        cluster = [positions[index]];
      }
    }

    clusters.push(cluster);
    return clusters;
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

  const prepareAnalysisLayers = () => {
    const maskCanvas = story.querySelector('.crack-mask-canvas');
    const skeletonCanvas = story.querySelector('.crack-skeleton-canvas');
    const distanceCanvas = story.querySelector('.crack-distance-canvas');
    const scanCanvas = story.querySelector('.crack-width-scan-canvas');
    const maxCanvas = story.querySelector('.crack-width-max-canvas');
    if (!maskCanvas || !skeletonCanvas || !distanceCanvas || !scanCanvas || !maxCanvas) return;

    const width = maskCanvas.width;
    const height = maskCanvas.height;
    const source = new Image();

    source.addEventListener('load', () => {
      const scratch = document.createElement('canvas');
      scratch.width = width;
      scratch.height = height;
      const scratchContext = scratch.getContext('2d', { willReadFrequently: true });

      /*
       * The reference is the actual v1 result screenshot supplied for this project.
       * Its camera image occupies x=22..897 and y=40..915 in the 924×932 capture.
       */
      scratchContext.drawImage(source, 22, 40, 875, 875, 0, 0, width, height);
      const sourcePixels = scratchContext.getImageData(0, 0, width, height).data;
      const bluePixelsByRow = Array.from({ length: height }, () => []);
      const columnCounts = new Uint16Array(width);
      const rowCounts = new Uint16Array(height);

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const offset = ((y * width) + x) * 4;
          const red = sourcePixels[offset];
          const green = sourcePixels[offset + 1];
          const blue = sourcePixels[offset + 2];
          const isSegmentationBlue = blue > 105 && blue - red > 28 && blue - green > 16;

          if (isSegmentationBlue) {
            bluePixelsByRow[y].push(x);
            columnCounts[x] += 1;
            rowCounts[y] += 1;
          }
        }
      }

      const straightColumns = new Set();
      const straightRows = new Set();
      columnCounts.forEach((count, x) => {
        if (count > height * 0.48) straightColumns.add(x);
      });
      rowCounts.forEach((count, y) => {
        if (count > width * 0.48) straightRows.add(y);
      });

      const rows = Array.from({ length: height }, () => null);
      let previousCenter = null;

      for (let y = height - 1; y >= 0; y -= 1) {
        const cleaned = bluePixelsByRow[y].filter((x) => {
          if (straightRows.has(y)) return false;
          if ([...straightColumns].some((column) => Math.abs(column - x) <= 2)) return false;
          if (y < 17 && x < 240) return false;
          return true;
        });
        const clusters = getClusters(cleaned).filter((cluster) => cluster.length >= 2);
        if (!clusters.length) continue;

        const ranked = clusters
          .map((cluster) => {
            const left = cluster[0];
            const right = cluster[cluster.length - 1];
            const center = (left + right) / 2;
            const continuity = previousCenter === null ? 0 : Math.abs(center - previousCenter);
            return { left, right, center, score: cluster.length - (continuity * 1.4) };
          })
          .sort((a, b) => b.score - a.score);

        const selected = previousCenter === null
          ? ranked.sort((a, b) => b.right - b.left - (a.right - a.left))[0]
          : ranked.find((candidate) => Math.abs(candidate.center - previousCenter) < 34) || ranked[0];

        rows[y] = selected;
        previousCenter = selected.center;
      }

      let previousKnown = null;
      for (let y = 0; y < height; y += 1) {
        if (rows[y]) {
          previousKnown = y;
          continue;
        }

        let nextKnown = y + 1;
        while (nextKnown < height && !rows[nextKnown]) nextKnown += 1;
        if (previousKnown === null || nextKnown >= height || nextKnown - previousKnown > 16) continue;

        const ratio = (y - previousKnown) / (nextKnown - previousKnown);
        rows[y] = {
          left: rows[previousKnown].left + ((rows[nextKnown].left - rows[previousKnown].left) * ratio),
          right: rows[previousKnown].right + ((rows[nextKnown].right - rows[previousKnown].right) * ratio),
          center: rows[previousKnown].center + ((rows[nextKnown].center - rows[previousKnown].center) * ratio)
        };
      }

      const maskContext = maskCanvas.getContext('2d');
      const maskImage = maskContext.createImageData(width, height);
      const distanceContext = distanceCanvas.getContext('2d');
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

      const skeletonContext = skeletonCanvas.getContext('2d');
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

      const scanContext = scanCanvas.getContext('2d');
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
        const maxContext = maxCanvas.getContext('2d');
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
    });

    source.src = '/assets/images/crack-monitoring/segmentation-reference.png';
  };

  prepareEventWaveform();
  prepareAnalysisLayers();
  updateFromScroll();

  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', () => {
    morphGeometry = null;
    queueUpdate();
  });
})();
