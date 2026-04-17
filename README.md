# arrival

目的地を設定しておくと、**今出たら何時に着くか** と **何時に出発すればよいか** を常にリアルタイムに表示する Web アプリです。

> iPhone / Apple Watch への展開を将来見据えた、Next.js 製のプロトタイプ版です。

## 何ができるのか

- 家 → 最寄り駅 → 電車 → 目的地までの経路パラメータ（徒歩時間・乗車時間・電車の発車時刻表・バッファ）を保存します（`localStorage`）。
- 1 秒ごとに現在時刻から再計算し、
  - 「**今出たら到着**」時刻
  - 「**出発するなら**」時刻（= 出発時刻 − バッファ）
  - 次の電車と その次 までの一覧
  - 以下のようなニュアンスのアドバイス/警告を表示します:
    - 「今すぐ出たほうがいいですよ」
    - 「ギリギリ間に合うかもしれないけれど、今の方が確実ですよ」
    - 「次を逃しても大丈夫です」
    - 「次の電車には間に合いません」

目標到着時刻を任意で設定すると、そちらを基準にしたアドバイスになります。

## 開発

```bash
npm install
npm run dev       # http://localhost:3000 で起動
npm run build     # 本番ビルド
npm run lint      # ESLint (next lint)
npm test          # lib/schedule.ts の単体テスト
```

## 構成

- `app/` — Next.js App Router。`layout.tsx` と `page.tsx`。
- `components/ArrivalClock.tsx` — 1 秒ごとに更新されるメインのライブ表示。
- `components/SettingsForm.tsx` — 設定フォーム。
- `lib/schedule.ts` — 到着/出発時刻とアドバイスを計算する純関数群。UI から独立してテスト可能。
- `lib/schedule.test.ts` — `node:test` ベースのユニットテスト。
