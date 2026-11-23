import {
  BellRing,
  LayoutDashboard,
  History,
} from "lucide-react";

import { useEffect, useState } from "react";

import logo from "../../assets/logo.svg";

const menuItems = [
  {
    name: "Dashboard",
    id: "dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Histori",
    id: "histori",
    icon: History,
  },
  {
    name: "Alarm",
    id: "alarm-history",
    icon: BellRing,
  },
];

function Sidebar() {
  const [activeSection, setActiveSection] =
    useState("dashboard");

  /* ==================================
     DETEKSI SECTION SAAT SCROLL
  ================================== */
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        "dashboard",
        "histori",
        "alarm-history",
      ]
        .map((id) => {
          const element = document.getElementById(id);

          if (!element) {
            return null;
          }

          return {
            id,
            top:
              element.getBoundingClientRect().top +
              window.scrollY,
          };
        })
        .filter(
          (section): section is { id: string; top: number } =>
            section !== null
        );

      if (sections.length === 0) {
        return;
      }

      const isNearPageBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 40;

      if (isNearPageBottom) {
        setActiveSection("alarm-history");
        return;
      }

      const referencePosition = window.scrollY + 95;
      const activeSection = sections
        .filter((section) => section.top <= referencePosition)
        .at(-1);

      setActiveSection(activeSection?.id ?? sections[0].id);
    };

    window.addEventListener(
      "scroll",
      handleScroll
    );

    // Cek posisi pertama kali halaman dibuka
    handleScroll();

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );
    };
  }, []);

  /* ==================================
     CLICK MENU
  ================================== */
  const handleNavigation = (id: string) => {
    // Langsung ubah menu aktif
    setActiveSection(id);

    const section =
      document.getElementById(id);

    if (!section) return;

    section.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    window.history.replaceState(
      null,
      "",
      `/dashboard#${id}`
    );
  };

  return (
    <aside
      className="
        sticky
        top-0
        hidden
        h-screen
        w-[240px]
        shrink-0
        flex-col
        border-r
        border-gray-200
        bg-white
        md:flex
      "
    >
      {/* LOGO + JUDUL */}
      <div
        className="
          flex
          min-h-[90px]
          items-center
          gap-3
          px-4
        "
      >
        <img
          src={logo}
          alt="Logo Madubaru"
          className="
            h-11
            w-11
            shrink-0
            object-contain
          "
        />

        <div className="min-w-0">
          <p
            className="
              text-[12px]
              font-semibold
              leading-[1.35]
              text-black
              dark:text-white
            "
          >
            Dashboard Monitoring
            <br />
            Parameter Kelistrikan
          </p>
        </div>
      </div>

      {/* MENU */}
      <nav
        className="
          flex
          flex-col
          gap-1.5
          p-2
        "
      >
        {menuItems.map((item) => {
          const Icon = item.icon;

          const isActive =
            activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                handleNavigation(item.id)
              }
              className={`
                flex
                w-full
                items-center
                gap-3
                rounded-md
                px-3
                py-2.5
                text-left
                text-[13px]
                font-medium
                transition

                ${
                  isActive
                    ? "bg-[#0b4eab] text-white"
                    : "text-gray-800 hover:bg-gray-100 hover:text-black"
                }
              `}
            >
              <Icon size={18} />

              <span>
                {item.name}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;