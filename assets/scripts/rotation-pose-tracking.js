(() => {
  'use strict';
  const player = document.querySelector('[data-rpt-player]');
  if (!player) return;
  const video = player.querySelector('video');
  const controls = player.querySelector('[data-rpt-controls]');
  const play = player.querySelector('[data-rpt-play]');
  const videoPlay = player.querySelector('[data-rpt-video-play]');
  const replay = player.querySelector('[data-rpt-replay]');
  const seek = player.querySelector('[data-rpt-seek]');
  const speed = player.querySelector('[data-rpt-speed]');
  const clock = player.querySelector('[data-rpt-time]');
  const count = player.querySelector('[data-rpt-count]');
  const status = player.querySelector('[data-rpt-status]');
  const fullscreen = player.querySelector('[data-rpt-fullscreen]');
  const loadNote = document.querySelector('[data-rpt-load-note]');
  const svgNS = 'http://www.w3.org/2000/svg';
  let samples = [];
  let charts = [];
  let plotEnd = 0;
  let latestTime = 0;
  let callback = null;
  let callbackMode = null;
  let shownSample = -1;
  let lastAnnouncement = '';

  function announce(message) {
    if (message !== lastAnnouncement) { status.textContent = message; lastAnnouncement = message; }
  }
  function svgElement(name, attributes, text) {
    const node = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attributes || {})) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function timeLabel(time) {
    const safe = Math.max(0, Number.isFinite(time) ? time : 0);
    const centiseconds = Math.floor((safe + 1e-7) * 100);
    const minutes = Math.floor(centiseconds / 6000);
    const seconds = Math.floor(centiseconds / 100) % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
  }
  function nearestSample(time) {
    let left = 0, right = samples.length - 1;
    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (samples[middle][0] < time) left = middle + 1;
      else right = middle;
    }
    if (left > 0 && time - samples[left - 1][0] < samples[left][0] - time) left--;
    return left;
  }
  function tickStep(span, count) {
    const rough = span / count;
    const base = 10 ** Math.floor(Math.log10(rough));
    const fraction = rough / base;
    return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * base;
  }

  function createChart(container, key, yRange) {
    const host = container.querySelector('.rpt-chart');
    const output = container.querySelector('[data-rpt-value]');
    const column = key === 'X' ? 1 : 2;
    const color = key === 'X' ? '#b3332c' : '#25252a';
    const svg = svgElement('svg', { role: 'img', 'aria-labelledby': `rpt-chart-${key}-title rpt-chart-${key}-description` });
    svg.append(svgElement('title', { id: `rpt-chart-${key}-title` }, `${key} history synchronized with the recording`));
    svg.append(svgElement('desc', { id: `rpt-chart-${key}-description` }, `Complete ${key === 'X' ? 'translation in millimetres' : 'rotation in degrees'} history from the confirmed result CSV. Grey steps show visible marker count on the right axis. A blue cursor marks the recording time. Missing pose samples remain gaps.`));
    const defs = svgElement('defs');
    const clip = svgElement('clipPath', { id: `rpt-played-${key}`, clipPathUnits: 'userSpaceOnUse' });
    const clipRect = svgElement('rect');
    clip.append(clipRect); defs.append(clip); svg.append(defs);
    const fixed = svgElement('g'); svg.append(fixed);
    const cursor = svgElement('line', { class: 'rpt-cursor' });
    const dot = svgElement('circle', { class: 'rpt-dot', r: 3.5 });
    svg.append(cursor, dot);
    let geometry;
    const chart = { key, output, svg, column, update, render };
    host.querySelector('img').hidden = true;
    host.append(svg);

    function render() {
      const width = Math.max(200, host.getBoundingClientRect().width);
      const height = svg.getBoundingClientRect().height;
      const box = { left: 45, top: 23, right: width - 29, bottom: height - 34 };
      const x = time => box.left + Math.min(plotEnd, Math.max(0, time)) / plotEnd * (box.right - box.left);
      const y = value => box.bottom - (value - yRange[0]) / (yRange[1] - yRange[0]) * (box.bottom - box.top);
      const markerY = value => box.bottom - value / 5 * (box.bottom - box.top);
      geometry = { box, x, y };
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      fixed.replaceChildren();
      const yStep = tickStep(yRange[1] - yRange[0], 4);
      for (let value = Math.ceil(yRange[0] / yStep) * yStep; value <= yRange[1]; value += yStep) {
        fixed.append(svgElement('line', { x1: box.left, x2: box.right, y1: y(value), y2: y(value), class: 'rpt-grid' }));
        fixed.append(svgElement('text', { x: box.left - 9, y: y(value) + 4, 'text-anchor': 'end', class: 'rpt-axis-text' }, `${Math.round(value * 100) / 100}`));
      }
      const xStep = width < 350 ? 40 : 20;
      for (let time = 0; time <= plotEnd; time += xStep) {
        fixed.append(svgElement('line', { x1: x(time), x2: x(time), y1: box.top, y2: box.bottom, class: 'rpt-grid' }));
        fixed.append(svgElement('text', { x: x(time), y: box.bottom + 18, 'text-anchor': 'middle', class: 'rpt-axis-text' }, String(time)));
      }
      for (const value of [0, 2, 4]) fixed.append(svgElement('text', { x: box.right + 8, y: markerY(value) + 4, class: 'rpt-axis-text' }, String(value)));
      fixed.append(svgElement('text', { x: box.left, y: 12, class: 'rpt-axis-text' }, key === 'X' ? 'mm' : 'deg'));
      fixed.append(svgElement('text', { x: box.right, y: 12, 'text-anchor': 'end', class: 'rpt-axis-text' }, 'Markers'));
      fixed.append(svgElement('text', { x: (box.left + box.right) / 2, y: height - 1, 'text-anchor': 'middle', class: 'rpt-axis-text' }, 'Time (s)'));
      fixed.append(svgElement('path', { d: `M${box.left} ${box.top}V${box.bottom}H${box.right}V${box.top}`, fill: 'none', class: 'rpt-axis' }));
      let history = '', markers = '', connected = false;
      samples.forEach((row, index) => {
        const px = x(row[0]).toFixed(2);
        if (row[column] === null) connected = false;
        else { history += `${connected ? 'L' : 'M'}${px} ${y(row[column]).toFixed(2)}`; connected = true; }
        markers += index === 0 ? `M${px} ${markerY(row[3]).toFixed(2)}` : `H${px}V${markerY(row[3]).toFixed(2)}`;
      });
      fixed.append(svgElement('path', { d: markers, class: 'rpt-count-path' }));
      fixed.append(svgElement('path', { d: history, stroke: color, 'stroke-opacity': .38, class: 'rpt-history' }));
      fixed.append(svgElement('path', { d: history, stroke: color, class: 'rpt-history', 'clip-path': `url(#rpt-played-${key})` }));
      clipRect.setAttribute('x', box.left - 2); clipRect.setAttribute('y', box.top - 2); clipRect.setAttribute('height', box.bottom - box.top + 4);
      update(latestTime, nearestSample(latestTime));
    }
    function update(time, sampleIndex) {
      if (!geometry) return;
      const { box, x, y } = geometry;
      const px = x(time);
      clipRect.setAttribute('width', Math.max(0, px - box.left + 2));
      cursor.setAttribute('x1', px); cursor.setAttribute('x2', px); cursor.setAttribute('y1', box.top); cursor.setAttribute('y2', box.bottom);
      const value = samples[sampleIndex][column];
      dot.hidden = value === null;
      // SVG elements need visibility rather than HTML's hidden behavior.
      dot.setAttribute('visibility', value === null ? 'hidden' : 'visible');
      if (value !== null) { dot.setAttribute('cx', x(samples[sampleIndex][0])); dot.setAttribute('cy', y(value)); }
    }
    const observer = new ResizeObserver(render); observer.observe(host);
    render();
    return chart;
  }

  function update(time) {
    latestTime = Math.min(Math.max(0, time), video.duration || plotEnd);
    const index = nearestSample(latestTime);
    for (const chart of charts) chart.update(latestTime, index);
    if (index !== shownSample) {
      for (const chart of charts) {
        const value = samples[index][chart.column];
        chart.output.textContent = value === null ? `— ${chart.key === 'X' ? 'mm' : '°'}` : `${Math.abs(value) < .005 ? '0.00' : value.toFixed(2)} ${chart.key === 'X' ? 'mm' : '°'}`;
      }
      count.textContent = String(samples[index][3]);
      shownSample = index;
    }
    seek.value = String(latestTime);
    seek.setAttribute('aria-valuetext', `${latestTime.toFixed(2)} seconds`);
    clock.textContent = `${timeLabel(latestTime)} / ${timeLabel(video.duration || Number(seek.max))}`;
    player.dataset.rptTime = String(latestTime);
  }
  function cancelFrameLoop() {
    if (callback !== null) {
      if (callbackMode === 'video') video.cancelVideoFrameCallback(callback);
      else cancelAnimationFrame(callback);
      callback = null;
    }
  }
  function frameLoop() {
    cancelFrameLoop();
    if (document.hidden) return;
    if (video.requestVideoFrameCallback) {
      callbackMode = 'video';
      callback = video.requestVideoFrameCallback((now, metadata) => { callback = null; update(metadata.mediaTime); frameLoop(); });
    } else if (!video.paused && !video.ended) {
      callbackMode = 'animation';
      callback = requestAnimationFrame(() => { callback = null; update(video.currentTime); frameLoop(); });
    }
  }
  async function start() {
    if (video.ended) video.currentTime = 0;
    try { await video.play(); }
    catch { announce('Playback could not start. Try Play again.'); }
  }
  function playbackState() {
    play.textContent = video.paused || video.ended ? 'Play' : 'Pause';
    videoPlay.textContent = video.paused || video.ended ? 'Play recording' : 'Pause recording';
    player.dataset.rptPlaying = String(!video.paused && !video.ended);
    announce(video.ended ? 'End of recording' : video.paused ? 'Paused' : 'Playing');
    frameLoop();
  }

  async function initialize() {
    try {
      const response = await fetch('/rotation-pose-tracking/data/tracking.json');
      if (!response.ok) throw new Error('Result data unavailable');
      const data = await response.json();
      samples = data.samples;
      if (!Array.isArray(samples) || samples.length < 2 || samples.some((row, index) => !Number.isFinite(row[0]) || index > 0 && row[0] <= samples[index - 1][0] || [1, 2].some(column => row[column] !== null && !Number.isFinite(row[column])) || !Number.isFinite(row[3]))) throw new Error('Result data invalid');
      plotEnd = samples[samples.length - 1][0];
      charts = [...player.querySelectorAll('[data-rpt-plot]')].map(container => createChart(container, container.dataset.rptPlot, data.axes[container.dataset.rptPlot]));
      controls.hidden = false;
      videoPlay.hidden = false;
      video.controls = false;
      if (Number.isFinite(video.duration)) seek.max = String(video.duration);
      video.addEventListener('loadedmetadata', () => { seek.max = String(video.duration); update(video.currentTime); });
      for (const event of ['play', 'pause', 'ended']) video.addEventListener(event, playbackState);
      for (const event of ['timeupdate', 'seeked']) video.addEventListener(event, () => { if (!video.requestVideoFrameCallback) update(video.currentTime); });
      video.addEventListener('playing', () => { announce('Playing'); frameLoop(); });
      video.addEventListener('waiting', () => announce('Loading recording…'));
      video.addEventListener('seeking', () => { if (!video.requestVideoFrameCallback) update(video.currentTime); });
      video.addEventListener('error', () => { announce('Recording unavailable'); video.controls = true; });
      play.addEventListener('click', () => video.paused ? start() : video.pause());
      videoPlay.addEventListener('click', () => video.paused ? start() : video.pause());
      replay.addEventListener('click', () => { video.currentTime = 0; if (!video.requestVideoFrameCallback) update(0); start(); });
      seek.addEventListener('input', () => { video.currentTime = Number(seek.value); if (!video.requestVideoFrameCallback) update(video.currentTime); });
      speed.addEventListener('change', () => { video.playbackRate = Number(speed.value); });
      if (document.fullscreenEnabled && player.requestFullscreen) {
        fullscreen.hidden = false;
        fullscreen.addEventListener('click', async () => {
          try { if (document.fullscreenElement === player) await document.exitFullscreen(); else await player.requestFullscreen(); }
          catch { announce('Full screen is unavailable in this browser.'); }
        });
        document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement === player ? 'Exit full screen' : 'Full screen'; charts.forEach(chart => chart.render()); });
      }
      document.addEventListener('visibilitychange', () => { if (document.hidden) cancelFrameLoop(); else { if (!video.requestVideoFrameCallback) update(video.currentTime); frameLoop(); } });
      update(video.currentTime);
      frameLoop();
    } catch (error) {
      controls.hidden = true; videoPlay.hidden = true; video.controls = true;
      for (const container of player.querySelectorAll('[data-rpt-plot]')) {
        container.querySelector('img').hidden = false;
        container.querySelector('svg')?.remove();
      }
      loadNote.hidden = false;
      loadNote.textContent = 'Synchronized charts could not load. You can still play the recording and inspect the original plots or download the CSV.';
    }
  }
  initialize();
})();
