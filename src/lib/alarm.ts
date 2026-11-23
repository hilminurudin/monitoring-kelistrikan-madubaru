export const ALARM_CURRENT_THRESHOLD = 1600;
export const ALARM_HISTORY_STORAGE_KEY = "powermeter-alarm-history";
export const ALARM_HISTORY_UPDATED_EVENT = "powermeter-alarm-history-updated";

export interface AlarmEvent {
  id: string;
  timestamp: string;
  deviceName: string;
  current: number;
  threshold: number;
  message: string;
}

export function readAlarmHistory(): AlarmEvent[] {
  const storedHistory = localStorage.getItem(ALARM_HISTORY_STORAGE_KEY);

  if (!storedHistory) {
    return [];
  }

  try {
    const parsedHistory: unknown = JSON.parse(storedHistory);

    if (!Array.isArray(parsedHistory)) {
      console.error("Format histori alarm tidak valid.");
      return [];
    }

    return parsedHistory.filter(
      (item): item is AlarmEvent =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.timestamp === "string" &&
        typeof item.deviceName === "string" &&
        typeof item.current === "number" &&
        typeof item.threshold === "number" &&
        typeof item.message === "string"
    );
  } catch (error) {
    console.error("Histori alarm tidak dapat dibaca.", error);
    return [];
  }
}

export function saveAlarmEvent(event: AlarmEvent): void {
  const history = [event, ...readAlarmHistory()].slice(0, 100);

  localStorage.setItem(
    ALARM_HISTORY_STORAGE_KEY,
    JSON.stringify(history)
  );
  window.dispatchEvent(
    new CustomEvent(ALARM_HISTORY_UPDATED_EVENT)
  );
}

export function clearAlarmHistory(): void {
  localStorage.removeItem(ALARM_HISTORY_STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent(ALARM_HISTORY_UPDATED_EVENT)
  );
}
