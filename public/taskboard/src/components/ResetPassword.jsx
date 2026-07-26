import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

function ResetPassword() {
  const navigate = useNavigate();
  
  // Flow states
  const [step, setStep] = useState(1); // 1 = Request Code, 2 = Enter Code & Reset
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [apiSuccess, setApiSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Validate step 1
  const validateStep1 = () => {
    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate step 2
  const validateStep2 = () => {
    const newErrors = {};
    if (!code.trim()) {
      newErrors.code = "Verification code is required";
    } else if (code.trim().length !== 6) {
      newErrors.code = "Code must be exactly 6 digits";
    }

    if (!newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters long";
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Step 1 Submit
  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!validateStep1()) return;

    setIsLoading(true);
    setApiError("");
    setApiSuccess("");

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/reset-request`, {
        email: email.trim()
      });
      setApiSuccess(response.data.message);
      setStep(2); // Go to code verification step
    } catch (err) {
      console.error("Reset Request API Error:", err);
      setApiError(err.response?.data?.message || "Failed to request code. Check server connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Step 2 Submit
  const handleResetConfirm = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setIsLoading(true);
    setApiError("");
    setApiSuccess("");

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/reset-confirm`, {
        email: email.trim(),
        code: code.trim(),
        newPassword
      });

      setApiSuccess(response.data.message);
      // Wait 3 seconds and redirect to signin
      setTimeout(() => {
        navigate("/signin");
      }, 3000);
    } catch (err) {
      console.error("Reset Confirm API Error:", err);
      setApiError(err.response?.data?.message || "Failed to reset password. Check details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field === "email") setEmail(value);
    if (field === "code") setCode(value);
    if (field === "newPassword") setNewPassword(value);
    if (field === "confirmPassword") setConfirmPassword(value);

    // Clear errors on edit
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
    <div className="auth-card" id="reset-card">
      <h2>Reset password</h2>
      <p className="subtitle">
        {step === 1 
          ? "Enter your email and we'll send you a verification code" 
          : "Enter the code sent to your email and choose a new password"}
      </p>

      {/* API Success Banner */}
      {apiSuccess && (
        <div className="success-banner" style={{ marginBottom: "20px" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <div>
            <strong>Success</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "inherit", opacity: 0.9 }}>
              {apiSuccess}
            </p>
          </div>
        </div>
      )}

      {/* API Error Banner */}
      {apiError && (
        <div className="error-text" style={{ marginBottom: "20px", padding: "10px", background: "rgba(244, 63, 94, 0.05)", borderRadius: "8px", border: "1px solid rgba(244, 63, 94, 0.15)", display: "flex", gap: "8px", alignItems: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span style={{ fontSize: "13px" }}>{apiError}</span>
        </div>
      )}

      {step === 1 ? (
        /* STEP 1 FORM: Request Reset Code */
        <form onSubmit={handleRequestCode} noValidate>
          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label className="form-label" htmlFor="reset-email">
              Email Address
            </label>
            <div className="input-wrapper">
              <input
                type="email"
                id="reset-email"
                className={errors.email ? "invalid-field" : ""}
                placeholder="name@company.com"
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

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? "Requesting..." : "Send Verification Code"}
          </button>
        </form>
      ) : (
        /* STEP 2 FORM: Enter Code & New Password */
        <form onSubmit={handleResetConfirm} noValidate>
          {/* Verification Code */}
          <div className="form-group">
            <label className="form-label" htmlFor="verification-code">
              Verification Code (6-digit)
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="verification-code"
                maxLength="6"
                className={errors.code ? "invalid-field" : ""}
                placeholder="123456"
                value={code}
                onChange={(e) => handleInputChange("code", e.target.value)}
                disabled={isLoading}
              />
            </div>
            {errors.code && (
              <span className="error-text">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {errors.code}
              </span>
            )}
          </div>

          {/* New Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">
              New Password
            </label>
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="new-password"
                className={errors.newPassword ? "invalid-field" : ""}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => handleInputChange("newPassword", e.target.value)}
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
            {errors.newPassword && (
              <span className="error-text">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {errors.newPassword}
              </span>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label className="form-label" htmlFor="confirm-password">
              Confirm New Password
            </label>
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="confirm-password"
                className={errors.confirmPassword ? "invalid-field" : ""}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                disabled={isLoading}
              />
            </div>
            {errors.confirmPassword && (
              <span className="error-text">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {errors.confirmPassword}
              </span>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? "Verifying..." : "Reset Password"}
          </button>
        </form>
      )}

      <div className="auth-footer" style={{ marginTop: "20px" }}>
        {step === 2 && (
          <button 
            type="button" 
            onClick={() => { setStep(1); setApiSuccess(""); setApiError(""); }} 
            className="auth-link" 
            style={{ background: "none", border: "none", cursor: "pointer", display: "block", margin: "0 auto 12px auto" }}
          >
            ← Request a new code
          </button>
        )}
        Back to{" "}
        <Link to="/signin" className="auth-link">
          Sign In
        </Link>
      </div>
    </div>
  );
}

export default ResetPassword;
