import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";
import ResetPassword from "./components/ResetPassword";
import Dashboard from "./components/Dashboard";
import "./App.css";

// Navigation chips rendered at the top of the authentication pages
function NavigationChips() {
  const location = useLocation();
  const path = location.pathname;

  // Do not display the navigation chips when the user has entered the secure dashboard
  if (path === "/dashboard") return null;

  return (
    <nav className="auth-chips-nav" aria-label="Authentication Screens">
      <Link 
        to="/signin" 
        className={`auth-chip ${(path === "/signin" || path === "/") ? "active" : ""}`}
      >
        Sign In
      </Link>
      <Link 
        to="/signup" 
        className={`auth-chip ${path === "/signup" ? "active" : ""}`}
      >
        Sign Up
      </Link>
      <Link 
        to="/reset" 
        className={`auth-chip ${path === "/reset" ? "active" : ""}`}
      >
        Reset Password
      </Link>
    </nav>
  );
}

// Inner application component to consume the router context safely
function AppContent() {
  return (
    <div className="auth-container">
      <NavigationChips />
      <main style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <Routes>
          <Route path="/" element={<Navigate to="/signin" replace />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}

// Main entry wrapper setting up the Routing Context
function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
