import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";

import Sidebar from "./component/layout/Sidebar";
import Header from "./component/layout/Header";
import Footer from "./component/layout/Footer";

import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import { supabase } from "./lib/supabase";

function SupabaseConfigurationError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
      <section className="w-full max-w-xl rounded-xl border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-red-700">
          Konfigurasi Supabase belum lengkap
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          Isi nilai <code>VITE_SUPABASE_ANON_KEY</code> dengan anon/publishable
          key dari Supabase pada file <code>.env.local</code>, lalu restart
          server Vite.
        </p>
        <p className="mt-3 text-sm text-gray-500">
          Jangan gunakan service role key di aplikasi frontend.
        </p>
      </section>
    </main>
  );
}

function ProtectedLayout() {
  const isAuthenticated =
    localStorage.getItem("powermeter-authenticated") === "true";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!supabase) {
    return <SupabaseConfigurationError />;
  }

  return (
    <div className="app-shell flex min-h-screen bg-gray-100 text-gray-900">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main className="flex-1 bg-gray-100 pt-18">
          <Outlet />
        </main>

        <Footer />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* DEFAULT */}
        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        {/* PROTECTED */}
        <Route element={<ProtectedLayout />}>
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />
        </Route>

        {/* FALLBACK */}
        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;