import { AlertTriangle, BellRing } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  ALARM_CURRENT_THRESHOLD,
  ALARM_HISTORY_UPDATED_EVENT,
  clearAlarmHistory,
  type AlarmEvent,
  readAlarmHistory,
  saveAlarmEvent,
} from "../lib/alarm";

interface PowerMeterData {
  id: number;
  timestamp: string;
  gen_id: number;
  voltage: number;
  current: number;
  power: number;
  mwh: number;
  pf: number;
  pf_type: string | null;
  freq: number;
}

type PowerSource =
  | "pln_utara"
  | "pln_selatan"
  | "generator_1"
  | "generator_2"
  | "generator_3";

type ApiPowerMeterData = {
  id?: number;
  gen_id?: number;
  time?: string;
  timestamp?: string;
  sumber?: string;
  tegangan?: number | string | null;
  arus?: number | string | null;
  daya?: number | string | null;
  e_del?: number | string | null;
  faktor_daya?: number | string | null;
  frekuensi?: number | string | null;
  voltage?: number | string | null;
  current?: number | string | null;
  power?: number | string | null;
  mwh?: number | string | null;
  pf?: number | string | null;
  pf_type?: string | null;
  freq?: number | string | null;
};

const POWER_SOURCES: Array<{
  key: PowerSource;
  name: string;
  genId: number;
}> = [
  { key: "pln_utara", name: "PLN Utara", genId: 1 },
  { key: "pln_selatan", name: "PLN Selatan", genId: 2 },
  { key: "generator_1", name: "Generator 1", genId: 3 },
  { key: "generator_2", name: "Generator 2", genId: 4 },
  { key: "generator_3", name: "Generator 3", genId: 5 },
];

// Set VITE_API_BASE_URL pada .env frontend (Vite), tanpa suffix /api/power.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const HISTORY_RESET_KEY = "madubaru-history-reset-v1";

const readHistoryResetTimes = (): Partial<Record<PowerSource, string>> => {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_RESET_KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      POWER_SOURCES.flatMap(({ key }) => {
        const timestamp = value[key];
        return typeof timestamp === "string" && Number.isFinite(Date.parse(timestamp))
          ? [[key, timestamp]]
          : [];
      })
    ) as Partial<Record<PowerSource, string>>;
  } catch {
    return {};
  }
};

const toNumber = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Nilai numerik API tidak valid.");
  return parsed;
};

const mapApiMeter = (data: ApiPowerMeterData, genId: number): PowerMeterData => ({
  id: data.id ?? genId,
  timestamp: data.time ?? data.timestamp ?? new Date().toISOString(),
  gen_id: genId,
  voltage: toNumber(data.tegangan ?? data.voltage),
  current: toNumber(data.arus ?? data.current),
  power: toNumber(data.daya ?? data.power),
  mwh: toNumber(data.e_del ?? data.mwh),
  pf: toNumber(data.faktor_daya ?? data.pf),
  pf_type: data.pf_type ?? null,
  freq: toNumber(data.frekuensi ?? data.freq),
});

const sourceFromItem = (item: ApiPowerMeterData): typeof POWER_SOURCES[number] | undefined => {
  const name = (item.sumber ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  return POWER_SOURCES.find(({ key, genId }) => key === name || genId === item.gen_id);
};


const fetchApi = async (path: string): Promise<unknown> => {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${path})`);
    }

    return await response.json();

  } finally {
    window.clearTimeout(timeoutId);
  }
};


// Mendukung respons {data: ...} atau respons data langsung.
const unwrapData = (payload: unknown): unknown => {
  if (!payload || typeof payload !== "object") throw new Error("Respons API tidak valid.");
  const obj = payload as Record<string, unknown>;
  if (obj.status === "error" || obj.status === "failed") {
    throw new Error(typeof obj.message === "string" ? obj.message : "API melaporkan kesalahan.");
  }
  return obj.data ?? payload;
};

function Dashboard() {
  const [meters, setMeters] =
    useState<Record<PowerSource, PowerMeterData | null>>({
      pln_utara: null,
      pln_selatan: null,
      generator_1: null,
      generator_2: null,
      generator_3: null,
    });
  const [loggerHistory, setLoggerHistory] =
    useState<PowerMeterData[]>([]);
  const [historyResetTimes, setHistoryResetTimes] = useState(readHistoryResetTimes);
  const [resetHistorySource, setResetHistorySource] = useState<PowerSource | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [alarmHistory, setAlarmHistory] =
    useState<AlarmEvent[]>(readAlarmHistory);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const previousAlarmState = useRef<Record<number, boolean>>({});

const [showResetAlarmModal, setShowResetAlarmModal] = useState(false);

  const handleResetAlarmHistory = () => {
    setShowResetAlarmModal(true);
  };

  const confirmResetAlarmHistory = () => {
    clearAlarmHistory();
    setAlarmHistory([]);
    setShowResetAlarmModal(false);
  };

  const handleResetLoggerHistory = () => {
    if (!resetHistorySource) return;
    const next = { ...historyResetTimes, [resetHistorySource]: new Date().toISOString() };
    localStorage.setItem(HISTORY_RESET_KEY, JSON.stringify(next));
    setHistoryResetTimes(next);
    setResetHistorySource(null);
  };


  // Histori sudah direkap oleh Telegraf; polling API cukup sekali per menit.
  useEffect(() => {
    let mounted = true;
    let busy = false;
    const loadHistory = async () => {
      if (busy) return;
      busy = true;
      try {
        const data = unwrapData(await fetchApi("/api/power/history?days=30"));
        const items = Array.isArray(data)
          ? data
          : data && typeof data === "object" && Array.isArray((data as { records?: unknown[] }).records)
            ? (data as { records: ApiPowerMeterData[] }).records
            : null;
        if (!items) throw new Error("Format histori API bukan array.");
        const history = (items as ApiPowerMeterData[]).flatMap((item) => {
          const source = sourceFromItem(item);
          return source ? [mapApiMeter(item, source.genId)] : [];
        });
        if (mounted) {
          setLoggerHistory(history);
          setHistoryError(null);
        }
      } catch (error) {
        console.error("Gagal mengambil histori:", error);
        if (mounted) setHistoryError(error instanceof Error ? error.message : "Gagal mengambil histori.");
      } finally {
        busy = false;
        if (mounted) setHistoryLoading(false);
      }
    };
    void loadHistory();
    const interval = window.setInterval(() => void loadHistory(), 60000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, []);

  // Data real-time: satu polling setiap 3 detik.
  useEffect(() => {
    let mounted = true;
    let busy = false;
    const loadMeters = async () => {
      if (busy) return;
      busy = true;
      try {
        const data = unwrapData(await fetchApi("/api/power/all"));
        const next = Object.fromEntries(
          POWER_SOURCES.map(({ key }) => [key, null])
        ) as Record<PowerSource, PowerMeterData | null>;

        if (Array.isArray(data)) {
          for (const item of data as ApiPowerMeterData[]) {
            const source = sourceFromItem(item);
            if (source) next[source.key] = mapApiMeter(item, source.genId);
          }
        } else if (data && typeof data === "object") {
          const records = data as Record<string, unknown>;
          for (const source of POWER_SOURCES) {
            const item = records[source.key];
            if (item && typeof item === "object" && !Array.isArray(item)) {
              next[source.key] = mapApiMeter(item as ApiPowerMeterData, source.genId);
            }
          }
        }

        if (!Object.values(next).some(Boolean)) {
          throw new Error("Tidak ditemukan data meter. Periksa struktur JSON dan nama sumber.");
        }
        if (mounted) {
          setMeters(next);
          setConnectionError(null);
        }
      } catch (error) {
        if (mounted) {
          const message = error instanceof Error ? error.message : "Kesalahan tidak diketahui";
          setConnectionError(`Data real-time tidak tersedia: ${message}`);
          console.error("Gagal mengambil data power meter:", error);
        }
      } finally {
        busy = false;
      }
    };
    void loadMeters();
    const interval = window.setInterval(() => void loadMeters(), 3000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, []);

  const currentMeters = POWER_SOURCES.map(({ key }) => meters[key]).filter(
    (meter): meter is PowerMeterData => meter !== null
  );
  const activeAlarmMeters = currentMeters.filter(
    (meter) => meter.current > ALARM_CURRENT_THRESHOLD
  );

  useEffect(() => {
    const updateAlarmHistory = () => {
      setAlarmHistory(readAlarmHistory());
    };

    window.addEventListener(
      ALARM_HISTORY_UPDATED_EVENT,
      updateAlarmHistory
    );

    return () => {
      window.removeEventListener(
        ALARM_HISTORY_UPDATED_EVENT,
        updateAlarmHistory
      );
    };
  }, []);

  useEffect(() => {
    activeAlarmMeters.forEach((meter) => {
      const wasInAlarm =
        previousAlarmState.current[meter.gen_id] ?? false;

      if (wasInAlarm) {
        return;
      }

      saveAlarmEvent({
        id: `${meter.gen_id}-${Date.now()}`,
        timestamp: meter.timestamp,
        deviceName:
          POWER_SOURCES.find(({ genId }) => genId === meter.gen_id)?.name ??
          `Sumber ${meter.gen_id}`,
        current: meter.current,
        threshold: ALARM_CURRENT_THRESHOLD,
        message: `Arus melebihi batas ${ALARM_CURRENT_THRESHOLD} A`,
      });

      try {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + 0.6
        );
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.6);
        oscillator.addEventListener("ended", () => {
          void audioContext.close();
        });
      } catch (error) {
        console.error("Bunyi alarm tidak dapat diputar.", error);
      }
    });

    previousAlarmState.current = Object.fromEntries(
      currentMeters.map((meter) => [
        meter.gen_id,
        meter.current > ALARM_CURRENT_THRESHOLD,
      ])
    );
  }, [activeAlarmMeters, currentMeters]);

  // ==========================================
  // DEVICES
  // ==========================================
  const devices = POWER_SOURCES.map(({ key, name }) => {
    const meter = meters[key];

    return {
      name,
      voltage: meter?.voltage ?? null,
      current: meter?.current ?? null,
      kwh: meter?.power ?? null,
      mwh: meter?.mwh ?? null,
      powerFactor: meter?.pf ?? null,
      pfType: meter?.pf_type ?? null,
      frequency: meter?.freq ?? null,
      online: meter !== null,
    };
  });

  // ==========================================
  // FORMAT ANGKA
  // ==========================================
  const formatValue = (
    value: number | null,
    decimals = 2
  ) => {
    if (value === null) {
      return "-";
    }

    return Number(value).toFixed(decimals);
  };

  const formatAlarmDate = (timestamp: string) =>
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(timestamp));

  const getSourceLoggerHistory = (source: typeof POWER_SOURCES[number]) => {
    const cutoff = historyResetTimes[source.key];
    return loggerHistory.filter((meter) =>
      meter.gen_id === source.genId &&
      (!cutoff || new Date(meter.timestamp).getTime() > new Date(cutoff).getTime())
    );
  };

  const exportLoggerHistory = (
    history: PowerMeterData[],
    sourceName: string
  ) => {
    const headers = [
      "Waktu",
      "Tegangan (V)",
      "Arus (A)",
      "Daya (kW)",
      "E Del (MWh)",
      "Faktor Daya",
      "Frekuensi (Hz)",
    ];
    const rows = history.map((meter) => [
      formatAlarmDate(meter.timestamp),
      formatValue(meter.voltage, 2),
      formatValue(meter.current, 2),
      formatValue(meter.power, 3),
      formatValue(meter.mwh, 3),
      formatValue(meter.pf, 3),
      formatValue(meter.freq, 2),
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(";")
      )
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `histori-${sourceName.toLowerCase().replaceAll(" ", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-full bg-gray-100">

      {/* =========================
          DASHBOARD
      ========================== */}
      <section
        id="dashboard"
        className="min-h-[calc(100vh-95px)] scroll-mt-[95px] p-4 sm:p-6"
      >
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            Monitoring Parameter Kelistrikan
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Informasi kondisi kelistrikan secara real-time.
          </p>
          {connectionError && (
            <p className="mt-2 text-sm font-medium text-red-600" role="alert">
              {connectionError}
            </p>
          )}
        </div>

        <div
          className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${
            activeAlarmMeters.length > 0
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
          role={activeAlarmMeters.length > 0 ? "alert" : "status"}
        >
          {activeAlarmMeters.length > 0 ? (
            <BellRing className="mt-0.5 shrink-0" size={22} />
          ) : (
            <AlertTriangle className="mt-0.5 shrink-0" size={22} />
          )}
          <div>
            <p className="font-semibold">
              {activeAlarmMeters.length > 0
                ? "Peringatan alarm aktif"
                : "Status alarm aman"}
            </p>
            <p className="mt-1 text-sm">
              {activeAlarmMeters.length > 0
                ? "Arus melebihi batas yang ditentukan."
                : `Alarm akan berbunyi jika arus melebihi ${ALARM_CURRENT_THRESHOLD} A.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {devices.map((device) => (
            <div
              key={device.name}
              className="
                rounded-xl
                border border-gray-200
                bg-white
                p-5
                shadow-sm
              "
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {device.name}
                </h3>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      device.online
                        ? "bg-green-500"
                        : "bg-gray-400"
                    }`}
                  />

                  <span
                    className={`text-xs font-medium ${
                      device.online
                        ? "text-green-600"
                        : "text-gray-500"
                    }`}
                  >
                    {device.online
                      ? "Online"
                      : "Offline"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">

                {/* TEGANGAN */}
                <div className="rounded-lg bg-gray-100 p-3">
                  <p className="text-xs text-gray-500">
                    Tegangan
                  </p>

                  <p className="mt-1 font-semibold text-gray-900">
                    {device.voltage !== null
                      ? `${formatValue(
                          device.voltage,
                          2
                        )} V`
                      : "-"}
                  </p>
                </div>

                {/* ARUS */}
                <div className="rounded-lg bg-gray-100 p-3">
                  <p className="text-xs text-gray-500">
                    Arus
                  </p>

                  <p className="mt-1 font-semibold text-gray-900">
                    {device.current !== null
                      ? `${formatValue(
                          device.current,
                          2
                        )} A`
                      : "-"}
                  </p>
                </div>

                {/* Daya */}
                <div className="rounded-lg bg-gray-100 p-3">
                  <p className="text-xs text-gray-500">
                    Daya
                  </p>

                  <p className="mt-1 font-semibold text-gray-900">
                    {device.kwh !== null
                      ? `${formatValue(
                          device.kwh,
                          3
                        )} kW`
                      : "-"}
                  </p>
                </div>

                {/* ENERGI */}
                <div className="rounded-lg bg-gray-100 p-3">
                  <p className="text-xs text-gray-500">
                    E Del
                  </p>

                  <p className="mt-1 font-semibold text-gray-900">
                    {device.mwh !== null
                      ? `${formatValue(
                          device.mwh,
                          3
                        )} MWh`
                      : "-"}
                  </p>
                </div>

                {/* POWER FACTOR */}
                <div className="rounded-lg bg-gray-100 p-3">
                  <p className="text-xs text-gray-500">
                    Faktor Daya
                  </p>

                  <p className="mt-1 font-semibold text-gray-900">
                    {device.powerFactor !== null
                      ? formatValue(
                          device.powerFactor,
                          3
                        )
                      : "-"}
                  </p>

                  {device.pfType && (
                    <p className="mt-1 text-xs text-blue-600">
                      {device.pfType}
                    </p>
                  )}
                </div>

                {/* FREKUENSI */}
                <div className="rounded-lg bg-gray-100 p-3">
                  <p className="text-xs text-gray-500">
                    Frekuensi
                  </p>

                  <p className="mt-1 font-semibold text-gray-900">
                    {device.frequency !== null
                      ? `${formatValue(
                          device.frequency,
                          2
                        )} Hz`
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* =========================
          HISTORI - LIMA SUMBER
      ========================== */}
      <section id="histori" className="scroll-mt-[95px] p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Histori Data</h2>
          <p className="mt-1 text-sm text-gray-500">Data parameter kelistrikan direkap setiap 1 jam.</p>
          {historyError && <p role="alert" className="mt-2 text-sm text-red-600">Gagal mengambil histori: {historyError}</p>}
        </div>
        <div className="space-y-6">
          {POWER_SOURCES.map((source) => {
            const rows = getSourceLoggerHistory(source);
            return (
              <div key={source.key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{source.name}</h3>
                    {source.genId >= 3 && !meters[source.key] && rows.length === 0 && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">Belum aktif</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={rows.length === 0}
                      onClick={() => exportLoggerHistory(rows, source.key)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      disabled={rows.length === 0}
                      onClick={() => setResetHistorySource(source.key)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="hide-scrollbar max-h-[480px] overflow-auto rounded-lg border border-gray-200">
                  <table className="min-w-[750px] w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600">
                      <tr>
                        {["Waktu", "Tegangan", "Arus", "kW", "E Del", "Faktor Daya", "Frekuensi"].map((header) => (
                          <th key={header} className="px-4 py-3 text-left font-medium">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {rows.map((meter) => (
                        <tr key={`${source.key}-${meter.timestamp}`} className="text-gray-700">
                          <td className="whitespace-nowrap px-4 py-3">{formatAlarmDate(meter.timestamp)}</td>
                          <td className="px-4 py-3">{formatValue(meter.voltage, 2)} V</td>
                          <td className="px-4 py-3">{formatValue(meter.current, 2)} A</td>
                          <td className="px-4 py-3">{formatValue(meter.power, 3)} kW</td>
                          <td className="px-4 py-3">{formatValue(meter.mwh, 3)} MWh</td>
                          <td className="px-4 py-3">{formatValue(meter.pf, 3)}</td>
                          <td className="px-4 py-3">{formatValue(meter.freq, 2)} Hz</td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                            {historyLoading ? "Memuat histori..." : source.genId >= 3 ? "Belum ada data histori generator." : "Belum ada data histori."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-gray-500">Total: {rows.length} data</p>
              </div>
            );
          })}
        </div>
        {resetHistorySource && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-history-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h3
                id="reset-history-title"
                className="text-lg font-semibold text-gray-900"
              >
                Reset Histori Data?
              </h3>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                Apakah kamu yakin ingin mereset histori{" "}
                <strong>
                  {POWER_SOURCES.find(
                    ({ key }) => key === resetHistorySource
                  )?.name}
                </strong>
                ?
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetHistorySource(null)}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-100"
                >
                  Tidak
                </button>

                <button
                  type="button"
                  onClick={handleResetLoggerHistory}
                  className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-red-700"
                >
                  Ya, Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
      <section
        id="alarm-history"
        className="scroll-mt-[95px] p-4 sm:p-6"
      >
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            Histori Alarm
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Riwayat peringatan ketika arus melebihi batas.
          </p>
        </div>

        <div
          className="
            rounded-xl
            border border-gray-200
            bg-white
            p-5
            shadow-sm
          "
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Histori Alarm
            </h3>

            <button
              type="button"
              onClick={handleResetAlarmHistory}
              className="
                rounded-lg
                bg-red-600
                px-4 py-2
                text-sm
                font-medium
                text-white
                transition
                hover:bg-red-700
              "
            >
              Reset
            </button>
          </div>

          <div className="hide-scrollbar max-h-[480px] overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-[700px] w-full text-sm">

              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    Tanggal dan waktu
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Perangkat
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Arus
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Peringatan
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {alarmHistory.length > 0 ? (
                  alarmHistory.map((alarm) => (
                    <tr key={alarm.id} className="text-gray-700">
                      <td className="px-4 py-3">{formatAlarmDate(alarm.timestamp)}</td>
                      <td className="px-4 py-3">{alarm.deviceName}</td>
                      <td className="px-4 py-3 font-medium text-red-600">{formatValue(alarm.current, 2)} A</td>
                      <td className="px-4 py-3">{alarm.message}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>
                      Belum ada histori alarm.
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
          </div>
        </div>
      </section>
        {showResetAlarmModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-alarm-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h3
                id="reset-alarm-title"
                className="text-lg font-semibold text-gray-900"
              >
                Reset Histori Alarm?
              </h3>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                Apakah kamu yakin ingin menghapus seluruh histori alarm?
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetAlarmModal(false)}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-100"
                >
                  Tidak
                </button>

                <button
                  type="button"
                  onClick={confirmResetAlarmHistory}
                  className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-red-700"
                >
                  Ya, Reset
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default Dashboard;