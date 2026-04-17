"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  buildAdvice,
  formatDurationMin,
  formatHHMM,
  upcomingTrains,
  type Settings,
} from "@/lib/schedule";
import SettingsForm from "./SettingsForm";

const STORAGE_KEY = "arrival.settings.v1";

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export default function ArrivalClock() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [now, setNow] = useState<Date | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Hydrate from localStorage on mount, then tick every second.
  useEffect(() => {
    setSettings(loadSettings());
    setNow(new Date());
    setHydrated(true);
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const configured =
    settings.trainDepartures.length > 0 &&
    settings.walkToStationMin >= 0 &&
    settings.rideTimeMin >= 0;

  const trains = useMemo(
    () => (now && configured ? upcomingTrains(now, settings) : []),
    [now, settings, configured],
  );
  const advice = useMemo(
    () => (now && configured ? buildAdvice(now, trains, settings) : null),
    [now, trains, settings, configured],
  );

  const next = trains[0];

  function handleSave(nextSettings: Settings) {
    setSettings(nextSettings);
    saveSettings(nextSettings);
    if (detailsRef.current) detailsRef.current.open = false;
  }

  return (
    <>
      <header className="app-header">
        <h1>
          🚶→🚆→
          {settings.destinationName
            ? `📍 ${settings.destinationName}`
            : "目的地"}
        </h1>
        <span className="clock" aria-live="off">
          {hydrated && now ? formatHHMM(now) : "--:--"}
        </span>
      </header>

      {!configured ? (
        <div className="card">
          <h2>セットアップ</h2>
          <p className="empty">
            目的地と電車の発車時刻を設定すると、「今出たら何時に着くか」「何時に出ればいいか」が常時表示されます。
          </p>
          <SettingsForm value={settings} onSave={handleSave} />
        </div>
      ) : (
        <>
          {advice && (
            <div className={`card advice ${advice.level}`}>
              <span className="level-badge">
                {advice.level === "ok" && "OK"}
                {advice.level === "soon" && "SOON"}
                {advice.level === "urgent" && "NOW"}
                {advice.level === "late" && "LATE"}
              </span>
              <p className="message">{advice.message}</p>
              {advice.detail && <p className="detail">{advice.detail}</p>}
            </div>
          )}

          <div className="card hero">
            <div className="stat">
              <span className="label">今出たら到着</span>
              <span className="value">
                {next ? formatHHMM(next.arrival) : "--:--"}
              </span>
              <span className="sub">
                {next && now
                  ? `あと${formatDurationMin(
                      (next.arrival.getTime() - now.getTime()) / 60_000,
                    )}`
                  : "—"}
              </span>
            </div>
            <div className="stat">
              <span className="label">出発するなら</span>
              <span className="value">
                {next ? formatHHMM(next.recommendedLeaveBy) : "--:--"}
              </span>
              <span className="sub">
                {next && now
                  ? (() => {
                      const diff =
                        (next.recommendedLeaveBy.getTime() - now.getTime()) /
                        60_000;
                      if (diff <= 0) return "もう出発時刻です";
                      return `あと${formatDurationMin(diff)}`;
                    })()
                  : "—"}
              </span>
            </div>
          </div>

          <div className="card">
            <h2>次の電車</h2>
            {trains.length === 0 ? (
              <p className="empty">催行可能な電車がありません。</p>
            ) : (
              <ul className="train-list">
                {trains.slice(0, 4).map((t, i) => (
                  <li key={t.departure.toISOString()}>
                    <span className="idx">{i === 0 ? "次" : `+${i}`}</span>
                    <span className="times">
                      🚆 <strong>{formatHHMM(t.departure)}</strong>発 →{" "}
                      <strong>{formatHHMM(t.arrival)}</strong>着
                    </span>
                    <span className="leave">
                      {formatHHMM(t.recommendedLeaveBy)}までに出発
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <details className="settings-toggle" ref={detailsRef}>
            <summary>設定を変更</summary>
            <div className="card">
              <SettingsForm value={settings} onSave={handleSave} />
            </div>
          </details>
        </>
      )}

      <footer className="app-footer">
        iPhone / Apple Watch 展開を想定した Web プロトタイプ版
      </footer>
    </>
  );
}
