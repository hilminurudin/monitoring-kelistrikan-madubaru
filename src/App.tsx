
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

function ProtectedLayout() {
  const isAuthenticated =
    localStorage.getItem("powermeter-authenticated") === "true";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
          element={<Navigate to="/dashboard" replace />}
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
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
