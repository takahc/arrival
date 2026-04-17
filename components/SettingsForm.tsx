"use client";

import { useState } from "react";
import type { Settings } from "@/lib/schedule";

interface Props {
  value: Settings;
  onSave: (next: Settings) => void;
}

export default function SettingsForm({ value, onSave }: Props) {
  const [draft, setDraft] = useState<Settings>(value);

  function update<K extends keyof Settings>(key: K, v: Settings[K]) {
    setDraft((d) => ({ ...d, [key]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(draft);
  }

  return (
    <form className="settings" onSubmit={handleSubmit}>
      <label className="full">
        目的地
        <input
          type="text"
          value={draft.destinationName}
          onChange={(e) => update("destinationName", e.target.value)}
          placeholder="例: オフィス"
        />
      </label>

      <label>
        家 → 駅の徒歩 (分)
        <input
          type="number"
          min={0}
          value={draft.walkToStationMin}
          onChange={(e) =>
            update("walkToStationMin", Number(e.target.value) || 0)
          }
        />
      </label>

      <label>
        乗車時間 (分)
        <input
          type="number"
          min={0}
          value={draft.rideTimeMin}
          onChange={(e) => update("rideTimeMin", Number(e.target.value) || 0)}
        />
      </label>

      <label>
        降車駅 → 目的地の徒歩 (分)
        <input
          type="number"
          min={0}
          value={draft.walkFromStationMin}
          onChange={(e) =>
            update("walkFromStationMin", Number(e.target.value) || 0)
          }
        />
      </label>

      <label>
        バッファ (分)
        <input
          type="number"
          min={0}
          value={draft.bufferMin}
          onChange={(e) => update("bufferMin", Number(e.target.value) || 0)}
        />
      </label>

      <label className="full">
        電車の発車時刻（1行に1つ、例: 08:12）
        <textarea
          value={draft.trainDepartures.join("\n")}
          onChange={(e) =>
            update(
              "trainDepartures",
              e.target.value
                .split(/\s+/)
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          placeholder={"08:02\n08:17\n08:32\n08:47"}
        />
      </label>

      <label className="full">
        目標到着時刻 (任意)
        <input
          type="time"
          value={draft.targetArrivalTime ?? ""}
          onChange={(e) =>
            update("targetArrivalTime", e.target.value || undefined)
          }
        />
      </label>

      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={() => setDraft(value)}
        >
          元に戻す
        </button>
        <button type="submit">保存</button>
      </div>
    </form>
  );
}
