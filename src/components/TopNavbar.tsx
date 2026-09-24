import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { User, LogOut, Menu, X, Bot, Sparkles, Home } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ChakraLogo } from "./ChakraLogo";

interface TopNavbarProps {
  onOpenAssistant?: () => void;
}

// A- / A / A+ text-size control (GIGW accessibility requirement)
const FONT_SIZES = { small: "14px", normal: "16px", large: "18px" } as const;
type FontSizeKey = keyof typeof FONT_SIZES;
const FONT_SIZE_STORAGE_KEY = "mplad-font-size";

function readStoredFontSize(): FontSizeKey {
  try {
    const stored = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (stored === "small" || stored === "normal" || stored === "large") return stored;
  } catch {
    // storage unavailable; fall back to default
  }
  return "normal";
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onOpenAssistant }) => {
  const { user, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [fontSize, setFontSize] = useState<FontSizeKey>(readStoredFontSize);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[fontSize];
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
    } catch {
      // storage unavailable; setting still applies for this visit
    }
  }, [fontSize]);

  const handleLogout = async () => {
    await logout();
    setProfileDropdownOpen(false);
    navigate("/login");
  };

  const allNavItems = [
    {
      label: "Dashboard",
      path: "/dashboard",
      match: (p: string) => p === "/dashboard",
    },
    {
      label: "Projects",
      path: "/projects",
      match: (p: string) => p.startsWith("/projects"),
    },
    {
      label: "Funds",
      path: "/funds",
      match: (p: string) => p.startsWith("/funds"),
    },
    {
      label: "Anomalies",
      path: "/anomalies",
      match: (p: string) => p.startsWith("/anomalies"),
      adminOnly: true,
    },
    {
      label: "Transactions",
      path: "/transactions",
      match: (p: string) => p.startsWith("/transactions"),
      adminOnly: true,
    },
    {
      label: "Reports",
      path: "/reports",
      match: (p: string) => p.startsWith("/reports"),
    },
    {
      label: "Trend Analysis",
      path: "/trend-analysis",
      match: (p: string) => p.startsWith("/trend-analysis"),
    },
    {
      label: "Test",
      path: "/ml-tester",
      match: (p: string) => p.startsWith("/ml-tester"),
    },
    {
      label: "Settings",
      path: "/settings",
      match: (p: string) => p.startsWith("/settings"),
      adminOnly: true,
    },
  ];

  const publicNavItems = [
    { label: "Home", path: "/", match: (p: string) => p === "/" },
    { label: "About MPLADS", path: "/about", match: (p: string) => p === "/about" },
    { label: "How It Works", path: "/how-it-works", match: (p: string) => p === "/how-it-works" },
    { label: "Officer Sign In", path: "/login", match: (p: string) => p === "/login" },
  ];

  // Strictly filter out admin-only items for non-ADMIN users
  const navItems = user
    ? allNavItems.filter((item) => !item.adminOnly || isAdmin)
    : publicNavItems;

  const fontButtonClass = (key: FontSizeKey) =>
    `px-1.5 py-0.5 leading-none border border-[#C9D2DC] ${
      fontSize === key
        ? "bg-[#12355B] text-white border-[#12355B]"
        : "bg-white text-[#12355B] hover:bg-[#EAF2F8]"
    }`;

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="w-full bg-white">
        {/* A) Tricolour strip */}
        <div className="gov-tricolour" />

        {/* B) Government utility bar */}
        <div className="w-full bg-[#F1F3F6] border-b border-[#DDE3EA] text-xs text-[#263238]">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 truncate">
              <span lang="hi" className="font-semibold">भारत सरकार</span>
              <span className="text-[#98A2B3]">|</span>
              <span className="font-semibold">Government of India</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <a href="#main-content" className="hidden sm:inline hover:underline text-[#1D4E89] font-medium">
                Skip to Main Content
              </a>
              <span className="hidden sm:inline text-[#98A2B3]">|</span>
              <div className="flex items-center" role="group" aria-label="Text size">
                <button type="button" onClick={() => setFontSize("small")} className={fontButtonClass("small")} aria-label="Decrease text size" aria-pressed={fontSize === "small"}>
                  A<sup>-</sup>
                </button>
                <button type="button" onClick={() => setFontSize("normal")} className={`${fontButtonClass("normal")} border-l-0`} aria-label="Normal text size" aria-pressed={fontSize === "normal"}>
                  A
                </button>
                <button type="button" onClick={() => setFontSize("large")} className={`${fontButtonClass("large")} border-l-0`} aria-label="Increase text size" aria-pressed={fontSize === "large"}>
                  A<sup>+</sup>
                </button>
              </div>
              <span className="hidden md:inline text-[#98A2B3]">|</span>
              <span className="hidden md:inline font-medium text-[#475467]">SIH PS ID: 26102</span>
            </div>
          </div>
        </div>

        {/* C) Identity band: emblem + bilingual portal name + ministry */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              to={user ? "/dashboard" : "/"}
              className="flex items-center gap-3 min-w-0 group"
            >
              <ChakraLogo className="w-11 h-11 sm:w-14 sm:h-14 flex-shrink-0" />
              <div className="flex flex-col min-w-0 border-l-2 border-[#FF9933] pl-3">
                <span lang="hi" className="text-xs sm:text-sm font-semibold text-[#475467] leading-tight truncate">
                  एमपीलैड निगरानी पोर्टल
                </span>
                <span className="text-base sm:text-xl font-bold text-[#12355B] leading-tight tracking-tight group-hover:text-[#1D4E89] transition-colors truncate">
                  MPLAD Monitoring Portal
                </span>
                <span className="text-[11px] sm:text-xs text-[#667085] leading-tight truncate">
                  Ministry of Statistics &amp; Programme Implementation
                </span>
              </div>
            </Link>

            {/* Right: AI Assistant + Profile / Sign in + mobile menu */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {user && onOpenAssistant && (
                <button
                  id="ai-assistant-navbar-button"
                  onClick={onOpenAssistant}
                  className="inline-flex items-center gap-1.5 bg-white text-[#12355B] border border-[#12355B] hover:bg-[#12355B] hover:text-white px-2 py-1.5 sm:px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap"
                  title="Ask AI Assistant"
                >
                  <Bot className="w-4 h-4 text-inherit" />
                  <span className="hidden sm:inline">AI Assistant</span>
                  <Sparkles className="w-3 h-3 text-[#FF9933]" />
                </button>
              )}

              {user ? (
                <div className="relative">
                  <button
                    id="navbar-profile-menu-button"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-1.5 text-xs text-[#263238] font-medium bg-[#F5F7FA] hover:bg-[#EAF2F8] px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md border border-[#D0D5DD] transition-colors whitespace-nowrap"
                  >
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] text-white flex-shrink-0 ${
                        isAdmin ? "bg-[#B54708]" : "bg-[#12355B]"
                      }`}
                    >
                      {user.name ? user.name.charAt(0) : "U"}
                    </div>
                    <div className="text-left hidden xl:block leading-none max-w-[140px]">
                      <span className="block font-semibold text-xs text-[#12355B] truncate">
                        {user.name}
                      </span>
                      <span
                        className={`block text-[10px] font-bold uppercase ${
                          isAdmin ? "text-[#B54708]" : "text-[#1D4E89]"
                        }`}
                      >
                        {isAdmin ? "ADMIN" : "PUBLIC"}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#667085]">▾</span>
                  </button>

                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-[#D0D5DD] rounded-md shadow-md py-2 z-[60] text-sm">
                      <div className="px-3.5 py-2.5 border-b border-[#E5E7EB]">
                        <p className="font-bold text-[#12355B] truncate">
                          {user.name}
                        </p>
                        <p className="text-xs text-[#667085] truncate">
                          {user.email}
                        </p>
                        <div className="mt-2">
                          {isAdmin ? (
                            <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-800 border border-amber-200 font-bold px-2.5 py-1 rounded">
                              <ChakraLogo className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>ROLE: ADMIN (Full Control)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-800 border border-blue-200 font-semibold px-2.5 py-1 rounded">
                              <ChakraLogo className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>ROLE: PUBLIC (Read-Only)</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5">
                          {isAdmin
                            ? "Designated Officer Account with Anomaly Investigation and Action authorization."
                            : "Public Citizen / Researcher read-only access to monitoring data."}
                        </p>
                      </div>

                      {/* Only show Settings link to ADMIN role */}
                      {isAdmin && (
                        <Link
                          to="/settings"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3.5 py-2 text-[#263238] hover:bg-[#EAF2F8]"
                        >
                          <User className="w-4 h-4 text-[#667085]" />
                          <span>Security &amp; Admin Settings</span>
                        </Link>
                      )}

                      <button
                        id="navbar-logout-btn"
                        onClick={handleLogout}
                        className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[#D92D20] hover:bg-red-50 border-t border-[#E5E7EB]"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="hidden sm:inline-block bg-[#12355B] text-white text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-md hover:bg-[#1D4E89] transition-colors"
                >
                  Sign In
                </Link>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-md text-[#12355B] hover:bg-[#EAF2F8]"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* D) Primary navigation bar (sticky) */}
      <nav
        className="w-full bg-[#12355B] sticky top-0 z-50 shadow-sm"
        aria-label="Primary"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          {/* Desktop */}
          <div className="hidden lg:flex items-stretch text-[13px] xl:text-sm font-semibold">
            <Link
              to={user ? "/dashboard" : "/"}
              className="flex items-center px-3 text-white/90 hover:bg-white/10 border-b-[3px] border-transparent"
              aria-label="Home"
            >
              <Home className="w-4 h-4" />
            </Link>
            {navItems.map((item) => {
              const isActive = item.match(location.pathname);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center px-3 xl:px-3.5 py-2.5 whitespace-nowrap border-b-[3px] transition-colors ${
                    isActive
                      ? "bg-[#0B2542] text-white border-[#FF9933]"
                      : "text-white/90 hover:bg-white/10 hover:text-white border-transparent"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile: current section label */}
          <div className="lg:hidden py-2 text-sm font-semibold text-white truncate">
            {navItems.find((item) => item.match(location.pathname))?.label || "Menu"}
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-[#D0D5DD] shadow-md">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 space-y-0.5">
              {user && (
                <div className="px-3.5 py-1.5 mb-1.5 text-xs text-gray-600 bg-gray-50 rounded-md">
                  Logged in as <strong>{user.email}</strong> ({isAdmin ? "ADMIN" : "PUBLIC"})
                </div>
              )}
              {navItems.map((item) => {
                const isActive = item.match(location.pathname);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3.5 py-2 text-sm font-medium border-l-[3px] ${
                      isActive
                        ? "bg-[#EAF2F8] text-[#12355B] font-semibold border-[#FF9933]"
                        : "text-[#263238] hover:bg-[#F5F7FA] border-transparent"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </>
  );
};
