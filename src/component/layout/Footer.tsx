function Footer() {
  return (
    <footer
      className="
        flex flex-wrap
        items-center
        justify-between
        gap-x-5
        gap-y-2
        border-t border-gray-200
        bg-white
        px-5 py-3
        text-[11px]
        text-gray-500
      "
    >
      <span>
        Sampling Rate:{" "}
        <strong className="font-semibold text-gray-800">
          1 detik
        </strong>
      </span>

      <span className="text-gray-700">
        Power Meter: Schneider Electric PowerLogic PM5350
      </span>

      <span className="text-gray-500">
        Versi Dashboard 1.0.0
      </span>
    </footer>
  );
}

export default Footer;