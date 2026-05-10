# Userscript 仕様書：AtCoder-TimeTracker

競技プログラミングの精進における「時間の使い道」を可視化・記録する Tampermonkey スクリプト。

---

## 1. 基本コンセプト

- 最小限のクリック操作でフェーズを切り替え、計測を完結させる（集中力の維持）
- 既存サイトUI（時計部分）に溶け込む低ノイズなデザイン

---

## 2. 対象要素

```html
<p id="fixed-server-timer" class="contest-timer" style="opacity: 1;">
  2026-05-09 (土)<br>20:15:30 -05:00
</p>
```

- セレクタ: `#fixed-server-timer`
- この要素は**そのまま残し**、直下にオーバーレイ要素を追加する

---

## 3. 状態定義

| State | 表示テキスト | 意味 | アクセント色 |
|-------|-------------|------|-------------|
| `None` | `(時刻表示)` | 非計測中（通常状態） | デフォルト |
| `Thinking` | `💡 Thinking` | 考察フェーズ | 青 |
| `Designing` | `📝 Designing` | 設計・アルゴリズム構築 | 緑 |
| `Coding` | `💻 Coding` | 実装中 | 黄 |
| `Debugging` | `🐞 Debugging` | バグ修正・検証中 | 赤 |

---

## 4. UI レイアウト

### None（非計測中）

```
[ 2026-05-09 (土)  20:15:30 -05:00 ]
```

時刻表示のみ。クリック可能（→ Thinking へ遷移）。

### 計測中（Thinking / Designing / Coding / Debugging）

```
[ 💡 Thinking ]
```

- **フェーズ名のみ**表示（経過時間は表示しない）
- 背景色またはアクセント色で現在フェーズを表現
- クリックで次フェーズへ遷移

---

## 5. 状態遷移

### 5.1 左クリック（正方向サイクル）

```
None → Thinking → Designing → Coding → Debugging → None（＋リザルト表示）
```

- 一方向のみ。同じフェーズへの戻りは不可。
- `Debugging → None` 遷移時にリザルトダイアログを表示する。

### 5.2 右クリック（コンテキストメニュー）

```
右クリック → 「計測を破棄して None に戻る」
```

- 確認ダイアログ（`confirm()`）を挟み、誤操作を防止する
- 破棄した場合、localStorage のデータも消去する

---

## 6. 内部データ構造

```js
// localStorage キー: "atcoder_timetracker"
{
  state: "Coding",          // 現在の State
  startedAt: 1746834000,    // 計測全体の開始 UNIX タイムスタンプ
  phaseStartedAt: 1746834300, // 現在フェーズの開始 UNIX タイムスタンプ
  accumulated: {
    Thinking:  600,   // 各フェーズの累積秒数
    Designing: 300,
    Coding:    0,
    Debugging: 0
  }
}
```

### 保存タイミング

| イベント | 処理 |
|---------|------|
| フェーズ遷移時 | 直前フェーズの滞在時間を `accumulated` に加算して保存 |
| ページロード時 | localStorage を読み込み、計測を自動再開 |
| 計測破棄時 | localStorage を消去、State を `None` に |
| リザルト表示後（None 遷移） | リザルト表示後に localStorage を消去 |

---

## 7. リザルトダイアログ

`Debugging → None` 遷移時にモーダルダイアログを表示する。

### 7.1 表示項目

```
┌─────────────────────────────────────┐
│  📊 精進記録                      ×  │
│                                     │
│  Total:     45 分                   │
│                                     │
│  💡 Thinking   10 分  (22%)         │
│  📝 Designing   5 分  (11%)         │
│  💻 Coding     20 分  (44%)         │
│  🐞 Debugging  10 分  (22%)         │
│                                     │
│         [🐦 ツイート]               │
└─────────────────────────────────────┘
```

- **トータル所要時間**（分単位、小数切り捨て）
- **各フェーズの時間（分）と構成比率（%）**
- **ツイートボタン**

### 7.2 閉じる操作

- **× ボタン**（右上）または**背景クリック**でダイアログを閉じる

### 7.3 ツイートボタン

以下のフォーマットで `https://x.com/intent/tweet?text=...` を別タブで開く。

```
【精進記録】Total: 45min (Thinking: 10m / Designing: 5m / Coding: 20m / Debugging: 10m) #CPTimeTracker
```

---

## 8. ページ遷移対応

- `localStorage` に状態を保存することで、AtCoder 内のページ遷移（問題A → 問題B など）をまたいで計測を継続する
- ページロード時に `localStorage` を確認し、データが存在すれば計測を自動再開する

---

## 9. 未決定事項・補足

| 項目 | 内容 |
|------|------|
| スクリプト適用ページ | `@match` の範囲（例: `https://atcoder.jp/contests/*` のみ？） |
| 経過時間の更新間隔 | 1 秒ごとに UI を再描画 |
| 分表示の丸め | 小数切り捨て（例: 89秒 → 1分） |
