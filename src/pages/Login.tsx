import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.svg";
import webBackground from "../assets/webbg.png";

const Login = () => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Username dan password wajib diisi.");
      return;
    }

    const validUsername = "ksomadubaru";
    const validPassword = "KsoMadubaru2027";

    if (
      username === validUsername &&
      password === validPassword
    ) {
      localStorage.setItem("powermeter-authenticated", "true");
      localStorage.setItem("powermeter-username", username);

      setError("");
      navigate("/dashboard", { replace: true });
    } else {
      setError("Username atau password salah.");
    }
  };
  
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white">
      <img
        src={webBackground}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-[center_bottom]"
      />

      {/* Logo */}
      <div className="absolute left-5 top-5 z-20 sm:left-8 sm:top-7 md:left-10 md:top-8">
        <div className="flex items-center gap-2.5 text-slate-900">
          <img
            src={logo}
            alt="Logo Madubaru"
            className="h-10 w-10 object-contain sm:h-11 sm:w-11"
          />

          <div className="leading-tight">
            <p className="text-xs font-semibold sm:text-[13px]">
              PT MADUBARU
            </p>

            <p className="text-xs font-semibold sm:text-[13px]">
              PG-PS MADUKISMO
            </p>
          </div>
        </div>
      </div>

      {/* Login container */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-20">
        <div
          className="
            w-full max-w-[360px]
            rounded-2xl
            border border-white/50
            bg-white/25
            px-6 py-6
            shadow-[0_8px_24px_rgba(0,0,0,0.2)]
            backdrop-blur-md
            sm:px-7 sm:py-7
          "
        >
          <h1 className="mb-6 text-center text-2xl font-medium text-neutral-600">
            Login
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="flex h-12 items-center rounded-full border border-black bg-white/20 px-4">
              <User
                size={21}
                strokeWidth={1.8}
                className="shrink-0 text-black"
              />

              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="
                  ml-3 h-full w-full
                  bg-transparent
                  text-xs text-black
                  outline-none
                  placeholder:text-neutral-800
                "
              />
            </div>

            {/* Password */}
            <div className="flex h-12 items-center rounded-full border border-black bg-white/20 px-4">
              <LockKeyhole
                size={20}
                strokeWidth={1.8}
                className="shrink-0 text-black"
              />

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="
                  ml-3 h-full w-full
                  bg-transparent
                  text-xs text-black
                  outline-none
                  placeholder:text-neutral-800
                "
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="ml-3 flex shrink-0 items-center justify-center"
              >
                {showPassword ? (
                  <EyeOff size={19} strokeWidth={1.7} />
                ) : (
                  <Eye size={19} strokeWidth={1.7} />
                )}
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="
                h-12 w-full
                rounded-full
                bg-[#f54b1c]
                text-xs font-semibold text-white
                shadow-[0_4px_10px_rgba(245,75,28,0.35)]
                transition-all duration-200
                hover:bg-[#df4016]
                active:scale-[0.99]
              "
            >
              Login
            </button>

            {error && (
              <p className="text-center text-sm font-medium text-red-600" role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;