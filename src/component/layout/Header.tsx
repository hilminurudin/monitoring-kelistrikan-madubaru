import { LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Header() {
  const navigate = useNavigate();

  // ==========================================
  // STATE
  // ==========================================
  const [currentTime, setCurrentTime] = useState(new Date());

  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem("powermeter-theme") === "dark"
  );

  // ==========================================
  // DARK MODE
  // ==========================================
  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      isDarkMode
    );

    localStorage.setItem(
      "powermeter-theme",
      isDarkMode ? "dark" : "light"
    );
  }, [isDarkMode]);

  // ==========================================
  // REAL-TIME CLOCK
  // ==========================================
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ==========================================
  // DATE & TIME FORMAT
  // ==========================================

  // Tanggal lengkap untuk desktop
  const date = currentTime.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Tanggal singkat untuk mobile
  const shortDate = currentTime.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Jam real-time
  const time = currentTime.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // ==========================================
  // LOGOUT
  // ==========================================
  const handleLogout = () => {
    localStorage.removeItem("powermeter-authenticated");
    localStorage.removeItem("powermeter-username");

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <header
      className="
        fixed inset-x-0 top-0 z-50
        flex h-[72px] items-center
        border-b border-gray-200
        bg-white
        px-3 py-2
        md:left-60 md:right-0 md:px-6 md:py-3
        dark:border-gray-700 dark:bg-gray-900
        transition-colors duration-200
      "
    >
      {/* ======================================
          RIGHT SECTION
      ====================================== */}
      <div
        className="
          flex w-full items-center gap-2
          md:ml-auto md:w-auto md:gap-4
        "
      >
        {/* ======================================
            DATE, TIME & DEVICE STATUS
        ====================================== */}
        <div
          className="
            mr-auto min-w-0
            md:mr-0 md:text-right
          "
        >
          {/* Desktop Date & Time */}
          <p
            className="
              hidden whitespace-nowrap
              text-xs font-medium
              text-gray-600
              dark:text-gray-300
              lg:block
            "
          >
            {date} • {time}
          </p>

          {/* Mobile & Tablet Date Time */}
          <div className="lg:hidden">
            <p
              className="
                text-sm font-semibold
                tabular-nums
                text-gray-800
                dark:text-gray-100
              "
            >
              {time}
            </p>

            <p
              className="
                text-[10px]
                text-gray-500
                dark:text-gray-400
              "
            >
              {shortDate}
            </p>
          </div>

          {/* Device Status */}
          <div
            className="
              mt-0.5 flex items-center gap-1.5
              md:justify-end
              lg:mt-1
            "
          >
            <span
              className="
                h-2 w-2 shrink-0
                rounded-full bg-green-500
              "
            />

            <span
              className="
                whitespace-nowrap
                text-[10px] font-medium
                text-green-600
                dark:text-green-400
                md:text-[11px]
              "
            >
              Device Online
            </span>
          </div>
        </div>

        {/* ======================================
            THEME TOGGLE
        ====================================== */}
        <button
          type="button"
          onClick={() =>
            setIsDarkMode((previous) => !previous)
          }
          aria-label={
            isDarkMode
              ? "Aktifkan mode terang"
              : "Aktifkan mode gelap"
          }
          title={
            isDarkMode
              ? "Mode terang"
              : "Mode gelap"
          }
          className="
            flex h-10 w-10 shrink-0
            items-center justify-center
            rounded-lg
            border border-gray-200
            text-gray-600
            transition
            hover:bg-gray-100
            hover:text-gray-900
            dark:border-gray-600
            dark:text-gray-300
            dark:hover:bg-gray-700
            dark:hover:text-white
          "
        >
          {isDarkMode ? (
            <Sun size={18} strokeWidth={1.8} />
          ) : (
            <Moon size={18} strokeWidth={1.8} />
          )}
        </button>

        {/* ======================================
            LOGOUT BUTTON
        ====================================== */}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Keluar"
          title="Keluar"
          className="
            flex h-10 shrink-0
            items-center justify-center gap-2
            rounded-lg
            border border-red-200
            px-3 sm:px-4
            text-sm font-medium
            text-red-500
            transition
            hover:border-red-500
            hover:bg-red-500
            hover:text-white
            dark:border-red-800
            dark:text-red-400
            dark:hover:border-red-500
            dark:hover:bg-red-500
            dark:hover:text-white
          "
        >
          <LogOut
            size={16}
            strokeWidth={1.8}
          />

          <span className="hidden sm:inline">
            Keluar
          </span>
        </button>
      </div>
    </header>
  );
}

export default Header;