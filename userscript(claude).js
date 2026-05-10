// ==UserScript==
// @name         AtCoder-TimeTracker
// @namespace    https://atcoder.jp/
// @version      1.0.0
// @description  競プロの精進フェーズ（Thinking/Designing/Coding/Debugging）を計測・記録するTampermonkeyスクリプト
// @author       AtCoder-TimeTracker
// @match        https://atcoder.jp/contests/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ─── 定数 ───────────────────────────────────────────────────────────────────

  const LS_KEY = 'atcoder_timetracker';

  const PHASES = ['None', 'Thinking', 'Designing', 'Coding', 'Debugging'];

  const PHASE_META = {
    None:      { emoji: '',   label: '',          color: 'transparent',  text: '#333' },
    Thinking:  { emoji: '💡', label: 'Thinking',  color: '#3b82f6',      text: '#fff' },
    Designing: { emoji: '📝', label: 'Designing', color: '#22c55e',      text: '#fff' },
    Coding:    { emoji: '💻', label: 'Coding',    color: '#eab308',      text: '#1a1a1a' },
    Debugging: { emoji: '🐞', label: 'Debugging', color: '#ef4444',      text: '#fff' },
  };

  // ─── 状態 ────────────────────────────────────────────────────────────────────

  let currentState = {
    state: 'None',
    startedAt: null,
    phaseStartedAt: null,
    accumulated: { Thinking: 0, Designing: 0, Coding: 0, Debugging: 0 },
  };

  // ─── localStorage ────────────────────────────────────────────────────────────

  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(currentState));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) currentState = JSON.parse(raw);
    } catch (_) {
      clearState();
    }
  }

  function clearState() {
    currentState = {
      state: 'None',
      startedAt: null,
      phaseStartedAt: null,
      accumulated: { Thinking: 0, Designing: 0, Coding: 0, Debugging: 0 },
    };
    localStorage.removeItem(LS_KEY);
  }

  // ─── フェーズ遷移 ────────────────────────────────────────────────────────────

  function nextPhase() {
    const now = Math.floor(Date.now() / 1000);
    const idx = PHASES.indexOf(currentState.state);

    // 現在フェーズの滞在時間を accumulated に加算
    if (currentState.state !== 'None' && currentState.phaseStartedAt) {
      currentState.accumulated[currentState.state] += now - currentState.phaseStartedAt;
    }

    const nextIdx = (idx + 1) % PHASES.length;
    const nextState = PHASES[nextIdx];

    if (nextState === 'None') {
      // 計測終了 → リザルト表示
      const snapshot = { ...currentState };
      clearState();
      renderWidget();
      showResult(snapshot);
      return;
    }

    // 計測開始
    if (currentState.state === 'None') {
      currentState.startedAt = now;
    }

    currentState.state = nextState;
    currentState.phaseStartedAt = now;
    saveState();
    renderWidget();
  }

  function discardMeasurement() {
    if (currentState.state === 'None') return;
    const ok = confirm('現在の計測を破棄して None に戻しますか？');
    if (ok) {
      clearState();
      renderWidget();
    }
  }

  // ─── UI 構築 ─────────────────────────────────────────────────────────────────

  let widget = null;

  function createWidget() {
    const el = document.createElement('div');
    el.id = 'tt-widget';
    el.style.cssText = `
      display: inline-block;
      margin-top: 4px;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      user-select: none;
      transition: background 0.2s, color 0.2s;
      letter-spacing: 0.03em;
    `;

    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      nextPhase();
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      discardMeasurement();
    });

    return el;
  }

  function renderWidget() {
    if (!widget) return;
    const meta = PHASE_META[currentState.state];

    if (currentState.state === 'None') {
      widget.textContent = '';
      widget.style.background = 'transparent';
      widget.style.color = '#333';
      widget.style.display = 'none';
    } else {
      widget.textContent = `${meta.emoji} ${meta.label}`;
      widget.style.background = meta.color;
      widget.style.color = meta.text;
      widget.style.display = 'inline-block';
    }
  }

  // ─── リザルトダイアログ ───────────────────────────────────────────────────────

  function formatMin(seconds) {
    return Math.floor(seconds / 60);
  }

  function buildTweetText(acc, total) {
    const t = formatMin(acc.Thinking);
    const d = formatMin(acc.Designing);
    const c = formatMin(acc.Coding);
    const g = formatMin(acc.Debugging);
    return `【精進記録】Total: ${total}min (Thinking: ${t}m / Designing: ${d}m / Coding: ${c}m / Debugging: ${g}m) #CPTimeTracker`;
  }

  function pct(sec, total) {
    if (total === 0) return '0%';
    return `${Math.round((sec / total) * 100)}%`;
  }

  function showResult(snapshot) {
    const acc = snapshot.accumulated;
    const totalSec = Object.values(acc).reduce((a, b) => a + b, 0);
    const totalMin = formatMin(totalSec);
    const tweetText = buildTweetText(acc, totalMin);

    // オーバーレイ
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999;
    `;

    // ダイアログ
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: #fff;
      border-radius: 10px;
      padding: 28px 32px 24px;
      min-width: 320px;
      max-width: 90vw;
      box-shadow: 0 8px 32px rgba(0,0,0,0.22);
      position: relative;
      font-family: sans-serif;
    `;

    // × ボタン
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute; top: 10px; right: 14px;
      background: none; border: none;
      font-size: 20px; cursor: pointer; color: #888;
      line-height: 1; padding: 0;
    `;
    closeBtn.addEventListener('click', () => overlay.remove());

    // タイトル
    const title = document.createElement('div');
    title.textContent = '📊 精進記録';
    title.style.cssText = 'font-size: 17px; font-weight: bold; margin-bottom: 16px; color: #222;';

    // トータル
    const totalEl = document.createElement('div');
    totalEl.textContent = `Total:  ${totalMin} 分`;
    totalEl.style.cssText = 'font-size: 15px; margin-bottom: 14px; color: #333;';

    // フェーズ内訳
    const phaseColors = {
      Thinking: '#3b82f6', Designing: '#22c55e',
      Coding: '#eab308', Debugging: '#ef4444',
    };
    const phaseEmoji = { Thinking: '💡', Designing: '📝', Coding: '💻', Debugging: '🐞' };

    const list = document.createElement('div');
    list.style.cssText = 'margin-bottom: 20px; display: flex; flex-direction: column; gap: 7px;';

    ['Thinking', 'Designing', 'Coding', 'Debugging'].forEach((phase) => {
      const sec = acc[phase];
      const min = formatMin(sec);
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 14px;';

      // カラーバッジ
      const badge = document.createElement('span');
      badge.style.cssText = `
        display: inline-block; width: 10px; height: 10px;
        border-radius: 50%; background: ${phaseColors[phase]};
        flex-shrink: 0;
      `;

      const label = document.createElement('span');
      label.style.cssText = 'min-width: 85px; color: #444;';
      label.textContent = `${phaseEmoji[phase]} ${phase}`;

      const time = document.createElement('span');
      time.style.cssText = 'min-width: 48px; color: #222; font-weight: bold;';
      time.textContent = `${min} 分`;

      const ratio = document.createElement('span');
      ratio.style.cssText = 'color: #888; font-size: 12px;';
      ratio.textContent = `(${pct(sec, totalSec)})`;

      row.append(badge, label, time, ratio);
      list.appendChild(row);
    });

    // ツイートボタン
    const tweetBtn = document.createElement('button');
    tweetBtn.textContent = '🐦 ツイート';
    tweetBtn.style.cssText = `
      display: block; margin: 0 auto;
      background: #1d9bf0; color: #fff;
      border: none; border-radius: 6px;
      padding: 8px 20px; font-size: 14px;
      cursor: pointer; font-weight: bold;
    `;
    tweetBtn.addEventListener('click', () => {
      const url = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
      window.open(url, '_blank');
    });

    dialog.append(closeBtn, title, totalEl, list, tweetBtn);
    overlay.appendChild(dialog);

    // 背景クリックで閉じる
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  // ─── マウント ────────────────────────────────────────────────────────────────

  function mount() {
    const timer = document.getElementById('fixed-server-timer');
    if (!timer) return;

    widget = createWidget();
    timer.insertAdjacentElement('afterend', widget);

    loadState();
    renderWidget();
  }

  // DOMが準備できてからマウント
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

})();
