// ==UserScript==
// @name         AtCoder TimeTracker
// @namespace    https://github.com/openai/chatgpt
// @version      1.0.0
// @description  競プロの精進時間をフェーズ別に記録・可視化する userscript
// @match        https://atcoder.jp/contests/*
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const STORAGE_KEY = 'atcoder_timetracker';
  const TIMER_SELECTOR = '#fixed-server-timer';
  const PHASES = ['Thinking', 'Designing', 'Coding', 'Debugging'];
  const PHASE_META = {
    Thinking:  { label: '💡 Thinking',  color: '#3b82f6' },
    Designing: { label: '📝 Designing', color: '#22c55e' },
    Coding:    { label: '💻 Coding',    color: '#eab308' },
    Debugging: { label: '🐞 Debugging',  color: '#ef4444' },
  };

  let state = loadState();
  let timerEl = null;
  let overlayEl = null;
  let modalEl = null;
  let tickTimer = null;
  let hasInitialized = false;

  function nowSec() {
    return Math.floor(Date.now() / 1000);
  }

  function defaultData() {
    return {
      state: 'None',
      startedAt: null,
      phaseStartedAt: null,
      accumulated: {
        Thinking: 0,
        Designing: 0,
        Coding: 0,
        Debugging: 0,
      },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      const base = defaultData();
      if (!parsed || typeof parsed !== 'object') return base;
      base.state = typeof parsed.state === 'string' ? parsed.state : 'None';
      base.startedAt = Number.isFinite(parsed.startedAt) ? parsed.startedAt : null;
      base.phaseStartedAt = Number.isFinite(parsed.phaseStartedAt) ? parsed.phaseStartedAt : null;
      if (parsed.accumulated && typeof parsed.accumulated === 'object') {
        for (const p of PHASES) {
          const v = parsed.accumulated[p];
          base.accumulated[p] = Number.isFinite(v) ? v : 0;
        }
      }
      if (base.state !== 'None' && !PHASES.includes(base.state)) {
        return defaultData();
      }
      return base;
    } catch {
      return defaultData();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
    state = defaultData();
  }

  function getNextState(current) {
    if (current === 'None') return 'Thinking';
    const idx = PHASES.indexOf(current);
    if (idx === -1) return 'Thinking';
    return idx === PHASES.length - 1 ? 'None' : PHASES[idx + 1];
  }

  function ensureStarted() {
    const t = nowSec();
    if (!Number.isFinite(state.startedAt)) state.startedAt = t;
    if (!Number.isFinite(state.phaseStartedAt)) state.phaseStartedAt = t;
  }

  function accumulateCurrentPhase() {
    if (!PHASES.includes(state.state)) return;
    if (!Number.isFinite(state.phaseStartedAt)) return;
    const elapsed = Math.max(0, nowSec() - state.phaseStartedAt);
    state.accumulated[state.state] += elapsed;
    state.phaseStartedAt = nowSec();
  }

  function setPhase(nextState) {
    if (nextState === state.state) return;

    if (PHASES.includes(state.state)) {
      accumulateCurrentPhase();
    }

    if (nextState === 'None') {
      const snapshot = buildSnapshotWithCurrentElapsed();
      saveState();
      render();
      showResultModal(snapshot);
      clearState();
      render();
      return;
    }

    state.state = nextState;
    ensureStarted();
    state.phaseStartedAt = nowSec();
    saveState();
    render();
  }

  function buildSnapshotWithCurrentElapsed() {
    const snapshot = {
      startedAt: state.startedAt,
      accumulated: { ...state.accumulated },
    };

    if (PHASES.includes(state.state) && Number.isFinite(state.phaseStartedAt)) {
      const elapsed = Math.max(0, nowSec() - state.phaseStartedAt);
      snapshot.accumulated[state.state] += elapsed;
    }
    return snapshot;
  }

  function totalSeconds(accumulated) {
    return PHASES.reduce((sum, p) => sum + (accumulated[p] || 0), 0);
  }

  function floorMin(sec) {
    return Math.floor(sec / 60);
  }

  function percent(part, total) {
    if (!total) return 0;
    return Math.floor((part / total) * 100);
  }

  function formatClockLikeOriginal() {
    return timerEl ? timerEl.innerHTML : '';
  }

  function render() {
    if (!timerEl || !overlayEl) return;

    if (state.state === 'None') {
      overlayEl.className = 'attt-overlay attt-none';
      overlayEl.innerHTML = `<span class="attt-none-text">${formatClockLikeOriginal()}</span>`;
      timerEl.style.opacity = '1';
      return;
    }

    const meta = PHASE_META[state.state];
    overlayEl.className = 'attt-overlay attt-active';
    overlayEl.style.setProperty('--attt-accent', meta.color);
    overlayEl.innerHTML = `<span class="attt-phase">${meta.label}</span>`;
    timerEl.style.opacity = '1';
  }

  function injectStyles() {
    if (document.getElementById('attt-style')) return;
    const style = document.createElement('style');
    style.id = 'attt-style';
    style.textContent = `
      .attt-overlay {
        margin-top: 2px;
        cursor: pointer;
        user-select: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 8px;
        border-radius: 8px;
        transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
        font: inherit;
        line-height: 1.2;
        white-space: nowrap;
      }
      .attt-overlay:hover {
        transform: translateY(-1px);
      }
      .attt-none {
        background: transparent;
        color: inherit;
      }
      .attt-none-text {
        font: inherit;
      }
      .attt-active {
        background: color-mix(in srgb, var(--attt-accent) 16%, transparent);
        color: var(--attt-accent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--attt-accent) 30%, transparent);
        font-weight: 700;
      }
      .attt-active:active, .attt-none:active {
        transform: translateY(0);
      }

      .attt-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.42);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
      }
      .attt-modal {
        width: min(92vw, 420px);
        background: #fff;
        color: #111;
        border-radius: 16px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
        overflow: hidden;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .attt-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px 10px;
        border-bottom: 1px solid rgba(0,0,0,0.08);
        font-weight: 700;
      }
      .attt-modal-close {
        appearance: none;
        border: 0;
        background: transparent;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        color: inherit;
      }
      .attt-modal-body {
        padding: 16px;
      }
      .attt-total {
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 12px;
      }
      .attt-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 4px 0;
        font-size: 14px;
      }
      .attt-row .name {
        flex: 1;
      }
      .attt-row .value {
        white-space: nowrap;
      }
      .attt-modal-footer {
        padding: 0 16px 16px;
        display: flex;
        justify-content: center;
      }
      .attt-tweet {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 10px 16px;
        cursor: pointer;
        background: #111;
        color: #fff;
        font-weight: 700;
      }
      .attt-tweet:hover {
        opacity: 0.92;
      }
    `;
    document.head.appendChild(style);
  }

  function getAnchorContainer() {
    timerEl = document.querySelector(TIMER_SELECTOR);
    if (!timerEl) return null;

    let wrapper = timerEl.nextElementSibling;
    if (!wrapper || !wrapper.classList || !wrapper.classList.contains('attt-overlay')) {
      wrapper = document.createElement('div');
      wrapper.className = 'attt-overlay attt-none';
      timerEl.insertAdjacentElement('afterend', wrapper);
    }
    overlayEl = wrapper;
    return wrapper;
  }

  function closeModal() {
    if (modalEl) {
      modalEl.remove();
      modalEl = null;
    }
  }

  function openTweet(snapshot) {
    const total = floorMin(totalSeconds(snapshot.accumulated));
    const parts = PHASES.map((p) => `${p}: ${floorMin(snapshot.accumulated[p] || 0)}m`).join(' / ');
    const text = `【精進記録】Total: ${total}min (${parts}) #CPTimeTracker`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function showResultModal(snapshot) {
    closeModal();

    const total = totalSeconds(snapshot.accumulated);
    const totalMin = floorMin(total);
    const rows = PHASES.map((p) => {
      const sec = snapshot.accumulated[p] || 0;
      const min = floorMin(sec);
      const pct = percent(sec, total);
      return `<div class="attt-row"><span class="name">${PHASE_META[p].label}</span><span class="value">${min} 分 (${pct}%)</span></div>`;
    }).join('');

    const backdrop = document.createElement('div');
    backdrop.className = 'attt-modal-backdrop';
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    const modal = document.createElement('div');
    modal.className = 'attt-modal';
    modal.addEventListener('click', (e) => e.stopPropagation());
    modal.innerHTML = `
      <div class="attt-modal-header">
        <div>📊 精進記録</div>
        <button class="attt-modal-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="attt-modal-body">
        <div class="attt-total">Total: ${totalMin} 分</div>
        ${rows}
      </div>
      <div class="attt-modal-footer">
        <button class="attt-tweet" type="button">🐦 ツイート</button>
      </div>
    `;

    modal.querySelector('.attt-modal-close').addEventListener('click', closeModal);
    modal.querySelector('.attt-tweet').addEventListener('click', () => openTweet(snapshot));
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    modalEl = backdrop;
  }

  function bindEvents() {
    if (!overlayEl || overlayEl.dataset.atttBound === '1') return;
    overlayEl.dataset.atttBound = '1';

    overlayEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = getNextState(state.state);
      setPhase(next);
    });

    overlayEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ok = confirm('計測を破棄して None に戻しますか？');
      if (!ok) return;
      clearState();
      render();
      closeModal();
    });
  }

  function startTicker() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      if (PHASES.includes(state.state)) {
        render();
      }
    }, 1000);
  }

  function init() {
    if (hasInitialized) return;
    const anchor = getAnchorContainer();
    if (!anchor) return;

    injectStyles();
    bindEvents();
    render();
    startTicker();
    hasInitialized = true;
  }

  function waitForTimer() {
    const attempt = () => {
      if (document.querySelector(TIMER_SELECTOR)) {
        init();
        return true;
      }
      return false;
    };

    if (attempt()) return;

    const obs = new MutationObserver(() => {
      if (attempt()) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForTimer, { once: true });
  } else {
    waitForTimer();
  }
})();
