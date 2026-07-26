import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

function SignUp() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tos, setTos] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Live strength calculation
  const getStrength = (pwd) => {
    if (!pwd) return { score: 0, label: "Very Weak" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    let label = "Very Weak";
    if (score === 1) label = "Weak";
    if (score === 2) label = "Medium";
    if (score === 3) label = "Strong";
    if (score === 4) label = "Very Strong";

    return { score, label };
  };

  const strength = getStrength(password);

  const validate = () => {
    const newErrors = {};
    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    
    if (!email.trim()) {
      newErrors.email = "Work email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
    }

    if (!tos) {
      newErrors.tos = "You must agree to the Terms of Service";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setApiError("");

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        firstName,
        lastName,
        email,
        password,
      });

      // Save token and user details to localStorage
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      // Redirect to main dashboard workspace
      navigate("/dashboard");
    } catch (error) {
      console.error("Sign Up API Error:", error);
      setApiError(
        error.response?.data?.message || 
        "Unable to connect to the authentication server. Please check if your server is running."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field === "firstName") setFirstName(value);
    if (field === "lastName") setLastName(value);
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);
    if (field === "tos") setTos(value);

    // Clear errors when typing
    setApiError("");
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="auth-card" id="signup-card">
      <h2>Create an account</h2>
      <p className="subtitle">Get started - it's completely free</p>

      {apiError && (
        <div className="error-text" style={{ marginBottom: "16px", padding: "10px", background: "rgba(244, 63, 94, 0.05)", borderRadius: "8px", border: "1px solid rgba(244, 63, 94, 0.15)", display: "flex", gap: "8px", alignItems: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span style={{ fontSize: "13px" }}>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* First & Last Name */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="first-name">
              First Name
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="first-name"
                className={errors.firstName ? "invalid-field" : ""}
                placeholder="Jane"
                value={firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                disabled={isLoading}
              />
            </div>
            {errors.firstName && (
              <span className="error-text">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {errors.firstName}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="last-name">
              Last Name
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="last-name"
                className={errors.lastName ? "invalid-field" : ""}
                placeholder="Doe"
                value={lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                disabled={isLoading}
              />
            </div>
            {errors.lastName && (
              <span className="error-text">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {errors.lastName}
              </span>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label" htmlFor="signup-email">
            Work Email
          </label>
          <div className="input-wrapper">
            <input
              type="email"
              id="signup-email"
              className={errors.email ? "invalid-field" : ""}
              placeholder="jane@company.com"
              value={email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              disabled={isLoading}
            />
          </div>
          {errors.email && (
            <span className="error-text">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {errors.email}
            </span>
          )}
        </div>

        {/* Password & Strength Meter */}
        <div className="form-group">
          <label className="form-label" htmlFor="signup-password">
            Password
          </label>
          <div className="input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              id="signup-password"
              className={`${errors.password ? "invalid-field" : ""} password-field`}
              placeholder="••••••••"
              value={password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isLoading}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
          {errors.password && (
            <span className="error-text">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {errors.password}
            </span>
          )}

          {/* Live password strength meter */}
          {password && (
            <div className={`strength-meter strength-${strength.score}`}>
              <div className="strength-bars">
                <div className="strength-bar-seg"></div>
                <div className="strength-bar-seg"></div>
                <div className="strength-bar-seg"></div>
                <div className="strength-bar-seg"></div>
              </div>
              <div className="strength-text">
                <span>Strength: <strong>{strength.label}</strong></span>
                <span>{strength.score}/4 criteria met</span>
              </div>
            </div>
          )}
        </div>

        {/* ToS Checkbox */}
        <div className="form-group" style={{ marginBottom: "24px" }}>
          <label className={`checkbox-group ${errors.tos ? "invalid-checkbox" : ""}`} htmlFor="tos-checkbox">
            <input
              type="checkbox"
              id="tos-checkbox"
              checked={tos}
              onChange={(e) => handleInputChange("tos", e.target.checked)}
              disabled={isLoading}
            />
            <span>
              I agree to the <a href="#" onClick={(e) => e.preventDefault()} className="auth-link">Terms of Service</a> & <a href="#" onClick={(e) => e.preventDefault()} className="auth-link">Privacy Policy</a>
            </span>
          </label>
          {errors.tos && (
            <span className="error-text">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {errors.tos}
            </span>
          )}
        </div>

        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? "Creating Account..." : "Sign Up"}
        </button>
      </form>

      <div className="auth-footer">
        Already have an account?{" "}
        <Link to="/signin" className="auth-link">
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default SignUp;
