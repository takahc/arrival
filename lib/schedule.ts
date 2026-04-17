// Pure scheduling/arrival-time computation used by the UI.
// Designed so it can also be unit-tested with `node --test`.

export interface Settings {
  /** Destination label shown in the UI. */
  destinationName: string;
  /** Minutes to walk from home to the departure station. */
  walkToStationMin: number;
  /** List of train departure times at the home station, in "HH:MM" (24h). */
  trainDepartures: string[];
  /** Minutes the train ride itself takes. */
  rideTimeMin: number;
  /** Minutes to walk from the arrival station to the destination. */
  walkFromStationMin: number;
  /**
   * Safety buffer (minutes) subtracted from the latest-acceptable
   * "leave now" time. E.g. if 2, the app will urge you to leave 2 min
   * before the strict deadline.
   */
  bufferMin: number;
  /** Optional target arrival time at the destination, "HH:MM" (24h). */
  targetArrivalTime?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  destinationName: "",
  walkToStationMin: 10,
  trainDepartures: [],
  rideTimeMin: 20,
  walkFromStationMin: 5,
  bufferMin: 1,
};

/**
 * Parse an "HH:MM" string into a Date on the same calendar day as `anchor`.
 * Returns null when the input isn't a valid time.
 */
export function parseTimeOnDate(hhmm: string, anchor: Date): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  const d = new Date(anchor);
  d.setHours(h, min, 0, 0);
  return d;
}

/** Format a Date as "HH:MM". */
export function formatHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Format a number of minutes as "m分" or "h時間m分". */
export function formatDurationMin(totalMin: number): string {
  const sign = totalMin < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalMin));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}分`;
  if (m === 0) return `${sign}${h}時間`;
  return `${sign}${h}時間${m}分`;
}

export interface TrainPlan {
  /** Departure time of the train at the home station. */
  departure: Date;
  /** Arrival time at the destination (train arrival + walk). */
  arrival: Date;
  /** Latest time you can leave home to still catch this train. */
  latestLeaveBy: Date;
  /**
   * Recommended time to leave home (= latestLeaveBy - bufferMin),
   * shown to the user as "leave by".
   */
  recommendedLeaveBy: Date;
}

/** Build a plan for a specific train departure. */
export function buildPlan(departure: Date, settings: Settings): TrainPlan {
  const latestLeaveBy = new Date(
    departure.getTime() - settings.walkToStationMin * 60_000,
  );
  const recommendedLeaveBy = new Date(
    latestLeaveBy.getTime() - settings.bufferMin * 60_000,
  );
  const arrival = new Date(
    departure.getTime() +
      (settings.rideTimeMin + settings.walkFromStationMin) * 60_000,
  );
  return { departure, arrival, latestLeaveBy, recommendedLeaveBy };
}

/**
 * Return the upcoming train plans relative to `now`, ordered by departure.
 * A train is "upcoming" if it is still physically catchable — i.e. leaving
 * immediately and walking to the station would reach it before it departs.
 *
 * If none of today's listed trains are catchable, we roll over and list
 * tomorrow's trains so the app still shows something useful late at night.
 */
export function upcomingTrains(now: Date, settings: Settings): TrainPlan[] {
  const parsed = settings.trainDepartures
    .map((t) => parseTimeOnDate(t, now))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const walkMs = settings.walkToStationMin * 60_000;
  const catchable = parsed.filter((d) => d.getTime() - walkMs >= now.getTime());

  if (catchable.length > 0) {
    return catchable.map((d) => buildPlan(d, settings));
  }

  // Roll over to tomorrow.
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next = settings.trainDepartures
    .map((t) => parseTimeOnDate(t, tomorrow))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  return next.map((d) => buildPlan(d, settings));
}

export type AdviceLevel = "ok" | "soon" | "urgent" | "late";

export interface Advice {
  level: AdviceLevel;
  /** Short, primary message, e.g. "今すぐ出たほうがいいですよ". */
  message: string;
  /** Optional secondary line with context. */
  detail?: string;
}

/**
 * Decide what to tell the user, given the next and next-next trains.
 */
export function buildAdvice(
  now: Date,
  trains: TrainPlan[],
  settings: Settings,
): Advice {
  if (trains.length === 0) {
    return {
      level: "late",
      message: "本日の電車は終わりました",
      detail: "時刻表を確認してください。",
    };
  }

  const next = trains[0];
  const nextNext = trains[1];
  const minToLatest = (next.latestLeaveBy.getTime() - now.getTime()) / 60_000;

  const target = settings.targetArrivalTime
    ? parseTimeOnDate(settings.targetArrivalTime, now)
    : null;

  if (minToLatest < 0) {
    return {
      level: "late",
      message: "次の電車には間に合いません",
      detail: nextNext
        ? `次の次（${formatHHMM(nextNext.departure)}発）なら ${formatHHMM(
            nextNext.arrival,
          )}着です。`
        : undefined,
    };
  }

  // Target-arrival-based guidance takes priority when configured.
  if (target) {
    const earlyMin = (target.getTime() - next.arrival.getTime()) / 60_000;
    if (earlyMin < 0) {
      return {
        level: "urgent",
        message: "もう目標時刻には間に合いません",
        detail: `次の電車でも ${formatDurationMin(-earlyMin)}遅刻します。`,
      };
    }
    if (earlyMin < 2 && minToLatest <= settings.bufferMin) {
      return {
        level: "urgent",
        message: `${formatDurationMin(
          earlyMin,
        )}前に着くので、今すぐ出たほうがいいですよ`,
        detail: `${formatHHMM(next.departure)}発に乗れば ${formatHHMM(
          next.arrival,
        )}着。`,
      };
    }
    if (nextNext) {
      const nextNextEarlyMin =
        (target.getTime() - nextNext.arrival.getTime()) / 60_000;
      if (nextNextEarlyMin >= 0) {
        return {
          level: "ok",
          message: "次を逃しても間に合います。今はそんなに急がなくても大丈夫",
          detail: `次の次（${formatHHMM(
            nextNext.departure,
          )}発）でも ${formatHHMM(nextNext.arrival)}着、目標の${formatDurationMin(
            nextNextEarlyMin,
          )}前。`,
        };
      }
      if (nextNextEarlyMin > -2) {
        return {
          level: "soon",
          message: "ギリギリ間に合うかもしれないけれど、今の方が確実ですよ",
          detail: `次を逃すと ${formatDurationMin(-nextNextEarlyMin)}遅刻します。`,
        };
      }
      // Next-next would be clearly late. Warn the user that missing the
      // current train has a real cost, even though there's still slack now.
      return {
        level: "soon",
        message: "次を逃すと目標時刻に間に合いません",
        detail: `次の次（${formatHHMM(
          nextNext.departure,
        )}発）だと ${formatHHMM(nextNext.arrival)}着で${formatDurationMin(
          -nextNextEarlyMin,
        )}遅刻。${formatHHMM(next.recommendedLeaveBy)}までに出発を。`,
      };
    }
  }

  if (minToLatest <= 0) {
    return {
      level: "urgent",
      message: "今すぐ出てください",
      detail: `${formatHHMM(next.departure)}発を逃すと到着は${
        nextNext ? formatHHMM(nextNext.arrival) : "未定"
      }になります。`,
    };
  }
  if (minToLatest <= settings.bufferMin) {
    return {
      level: "urgent",
      message: "今すぐ出たほうがいいですよ",
      detail: `${formatHHMM(next.departure)}発に乗れば ${formatHHMM(
        next.arrival,
      )}着。`,
    };
  }
  if (minToLatest <= settings.bufferMin + 3) {
    return {
      level: "soon",
      message: `あと${formatDurationMin(minToLatest)}で出発です`,
      detail: `${formatHHMM(next.departure)}発に乗れば ${formatHHMM(
        next.arrival,
      )}着。`,
    };
  }

  if (nextNext) {
    const gapMin =
      (nextNext.arrival.getTime() - next.arrival.getTime()) / 60_000;
    if (gapMin <= 5) {
      return {
        level: "ok",
        message: "次を逃しても大丈夫です",
        detail: `次の次（${formatHHMM(
          nextNext.departure,
        )}発）でも ${formatHHMM(nextNext.arrival)}着（+${formatDurationMin(
          gapMin,
        )}）。`,
      };
    }
  }
  return {
    level: "ok",
    message: `${formatDurationMin(minToLatest)}後に出発でOK`,
    detail: `${formatHHMM(next.departure)}発に乗れば ${formatHHMM(
      next.arrival,
    )}着。`,
  };
}
