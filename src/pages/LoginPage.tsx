import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  User,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { LoginBackgroundAnimation } from "../components/LoginBackgroundAnimation";
import { ChakraLogo } from "../components/ChakraLogo";

export const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login, signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    if (activeTab === "signup") {
      const result = await signup(email, password, name);
      setLoading(false);
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(
          result.error ||
            "Registration failed. Please try a different email or check password.",
        );
      }
    } else {
      const result = await login(email, password);
      setLoading(false);
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(
          result.error ||
            "Authentication failed. Please verify email and password.",
        );
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setGoogleLoading(false);
      setError(err.message || "Failed to initiate Google sign-in.");
    }
  };

  const handleQuickLogin = async (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setError(null);
    setLoading(true);
    const result = await login(presetEmail, presetPass);
    setLoading(false);
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || "Authentication failed.");
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-100px)] flex items-center justify-center p-4 sm:p-6 bg-[#F5F7FA] overflow-hidden">
      {/* Ambient animated background */}
      <LoginBackgroundAnimation />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-xl border border-[#E5E7EB] shadow-xl p-6 sm:p-8">
        {/* National Emblem Header */}
        <div className="text-center pb-5 border-b border-[#F0F2F5]">
          <div className="flex justify-center mb-3">
            <ChakraLogo className="w-14 h-14" />
          </div>
          <span className="text-[11px] font-bold tracking-widest text-[#12355B] uppercase block">
            Government of India • MoSPI
          </span>
          <h1 className="text-xl font-bold text-[#12355B] mt-0.5">
            MPLAD Monitoring Portal
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Two-Tier Role-Based Access Control (PUBLIC / ADMIN)
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="flex border-b border-[#E5E7EB] my-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab("signin");
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === "signin"
                ? "border-[#12355B] text-[#12355B]"
                : "border-transparent text-[#667085] hover:text-[#12355B]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("signup");
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === "signup"
                ? "border-[#12355B] text-[#12355B]"
                : "border-transparent text-[#667085] hover:text-[#12355B]"
            }`}
          >
            Create Account / Sign Up
          </button>
        </div>

        {/* Google OAuth Button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center space-x-3 px-4 py-2.5 bg-white border border-[#D0D5DD] hover:bg-gray-50 text-[#344054] text-xs font-semibold rounded-md shadow-2xs transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {googleLoading
                ? "Redirecting to Google..."
                : "Continue with Google"}
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex py-2 items-center">
          <div className="grow border-t border-[#E5E7EB]"></div>
          <span className="shrink mx-3 text-[11px] text-[#667085] uppercase">
            or with email &amp; password
          </span>
          <div className="grow border-t border-[#E5E7EB]"></div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-[#D92D20] flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-700 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {activeTab === "signup" && (
            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="signup-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#D0D5DD] rounded-md text-[#263238] focus:outline-hidden focus:border-[#12355B] focus:ring-1 focus:ring-[#12355B]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com or officer@nic.in"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#D0D5DD] rounded-md text-[#263238] focus:outline-hidden focus:border-[#12355B] focus:ring-1 focus:ring-[#12355B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password-input"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#D0D5DD] rounded-md text-[#263238] focus:outline-hidden focus:border-[#12355B] focus:ring-1 focus:ring-[#12355B]"
              />
            </div>
          </div>

          <button
            id="login-submit-button"
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-[#12355B] hover:bg-[#1D4E89] text-white text-xs font-bold py-2.5 rounded-md flex items-center justify-center space-x-2 transition-colors shadow-2xs disabled:opacity-50"
          >
            {loading ? (
              <span>Processing request...</span>
            ) : (
              <>
                <span>
                  {activeTab === "signup"
                    ? "Create Account (PUBLIC Role)"
                    : "Sign In"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Informational RBAC Note */}
        <div className="mt-5 p-3 bg-blue-50/70 border border-blue-200 rounded-md text-[11px] text-[#1D4E89]">
          <div className="flex items-start space-x-2">
            <ChakraLogo className="w-4 h-4 text-[#1D4E89] shrink-0 mt-0.5" />
            <div>
              <strong className="block text-[#12355B]">Access Model:</strong>
              Anyone can sign in or register to browse projects, funds, reports,
              and trend analysis in read-only mode (<strong>PUBLIC</strong>{" "}
              role). Full investigation and action privileges are automatically
              assigned to the designated <strong>ADMIN</strong> account.
            </div>
          </div>
        </div>

        {/* Quick Testing helper for public account testing */}
        <div className="mt-4 pt-3 border-t border-[#F0F2F5] text-center">
          <span className="text-[10px] text-[#667085] block mb-1.5 uppercase font-semibold">
            One-Click Public Account Test:
          </span>
          <button
            type="button"
            onClick={() =>
              handleQuickLogin("citizen.researcher@gov.in", "Password#2024")
            }
            className="px-3 py-1.5 bg-[#F5F7FA] hover:bg-[#EAF2F8] text-[#12355B] text-[11px] font-semibold rounded border border-[#D0D5DD] transition-colors inline-block"
          >
            Sign In as Public Citizen (Read-Only)
          </button>
        </div>
      </div>
    </div>
  );
};
