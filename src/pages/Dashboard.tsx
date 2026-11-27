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
const API_BASE_URL = "";

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
  const [alarmHistory, setAlarmHistory] =
    useState<AlarmEvent[]>(readAlarmHistory);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const previousAlarmState = useRef<Record<number, boolean>>({});

  const handleResetAlarmHistory = () => {
    if (!window.confirm("Hapus seluruh histori alarm?")) {
      return;
    }

    clearAlarmHistory();
    setAlarmHistory([]);
  };

  const handleResetLoggerHistory = () => {
    if (!window.confirm("Hapus seluruh data logger?")) {
      return;
    }

    setLoggerHistory([]);
  };


  // Histori: satu polling setiap 10 detik (tanpa useEffect duplikat).
  useEffect(() => {
    let mounted = true;
    let busy = false;
    const loadHistory = async () => {
      if (busy) return;
      busy = true;
      try {
        const data = unwrapData(await fetchApi("/api/power/history?limit=500"));
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
        if (mounted) setLoggerHistory(history);
      } catch (error) {
        console.error("Gagal mengambil histori:", error);
      } finally {
        busy = false;
      }
    };
    void loadHistory();
    const interval = window.setInterval(() => void loadHistory(), 10000);
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
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(timestamp));

  const northLoggerHistory = loggerHistory.filter((meter) => meter.gen_id === 1);
  const southLoggerHistory = loggerHistory.filter((meter) => meter.gen_id === 2);

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
          HISTORI
      ========================== */}
      <section
        id="histori"
        className="scroll-mt-[95px] p-4 sm:p-6"
      >
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            Histori Data
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Data parameter kelistrikan direkam setiap 1 jam.
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
              PLN Utara
            </h3>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  exportLoggerHistory(northLoggerHistory, "pln-utara")
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Export CSV
              </button>
              <button type="button" onClick={handleResetLoggerHistory} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700">
                Reset
              </button>
            </div>
          </div>

          <div className="hide-scrollbar max-h-[480px] overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-[750px] w-full text-sm">

              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    Waktu
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Tegangan
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Arus
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    kW
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    E Del
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Faktor Daya
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Frekuensi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {northLoggerHistory.map((meter) => (
                  <tr key={`${meter.id}-${meter.timestamp}`} className="text-gray-700">
                    <td className="px-4 py-3">{formatAlarmDate(meter.timestamp)}</td>
                    <td className="px-4 py-3">{formatValue(meter.voltage, 2)} V</td>
                    <td className="px-4 py-3">{formatValue(meter.current, 2)} A</td>
                    <td className="px-4 py-3">{formatValue(meter.power, 3)} kW</td>
                    <td className="px-4 py-3">{formatValue(meter.mwh, 3)} MWh</td>
                    <td className="px-4 py-3">{formatValue(meter.pf, 3)}</td>
                    <td className="px-4 py-3">{formatValue(meter.freq, 2)} Hz</td>
                  </tr>
                ))}
                {northLoggerHistory.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                      Belum ada data logger.
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
          </div>
        </div>

        <div
          className="
            mt-6
            rounded-xl
            border border-gray-200
            bg-white
            p-5
            shadow-sm
          "
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              PLN Selatan
            </h3>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  exportLoggerHistory(southLoggerHistory, "pln-selatan")
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Export CSV
              </button>
              <button type="button" onClick={handleResetLoggerHistory} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700">
                Reset
              </button>
            </div>
          </div>

          <div className="hide-scrollbar max-h-[480px] overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-[750px] w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Waktu</th>
                  <th className="px-4 py-3 text-left font-medium">Tegangan</th>
                  <th className="px-4 py-3 text-left font-medium">Arus</th>
                  <th className="px-4 py-3 text-left font-medium">kW</th>
                  <th className="px-4 py-3 text-left font-medium">E Del</th>
                  <th className="px-4 py-3 text-left font-medium">Faktor Daya</th>
                  <th className="px-4 py-3 text-left font-medium">Frekuensi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {southLoggerHistory.map((meter) => (
                  <tr key={`${meter.id}-${meter.timestamp}`} className="text-gray-700">
                    <td className="px-4 py-3">{formatAlarmDate(meter.timestamp)}</td>
                    <td className="px-4 py-3">{formatValue(meter.voltage, 2)} V</td>
                    <td className="px-4 py-3">{formatValue(meter.current, 2)} A</td>
                    <td className="px-4 py-3">{formatValue(meter.power, 3)} kW</td>
                    <td className="px-4 py-3">{formatValue(meter.mwh, 3)} MWh</td>
                    <td className="px-4 py-3">{formatValue(meter.pf, 3)}</td>
                    <td className="px-4 py-3">{formatValue(meter.freq, 2)} Hz</td>
                  </tr>
                ))}
                {southLoggerHistory.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                      Belum ada data logger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

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

    </div>
  );
}

export default Dashboard;