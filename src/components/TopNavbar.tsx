import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  User, 
  LogOut, 
  Menu, 
  X, 
  Bot, 
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChakraLogo } from './ChakraLogo';

interface TopNavbarProps {
  onOpenAssistant?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onOpenAssistant }) => {
  const { user, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    setProfileDropdownOpen(false);
    navigate('/login');
  };

  const allNavItems = [
    { label: 'Dashboard', path: '/dashboard', match: (p: string) => p === '/dashboard' },
    { label: 'Projects', path: '/projects', match: (p: string) => p.startsWith('/projects') },
    { label: 'Funds', path: '/funds', match: (p: string) => p.startsWith('/funds') },
    { label: 'Anomalies', path: '/anomalies', match: (p: string) => p.startsWith('/anomalies'), adminOnly: true },
    { label: 'Transactions', path: '/transactions', match: (p: string) => p.startsWith('/transactions'), adminOnly: true },
    { label: 'Reports', path: '/reports', match: (p: string) => p.startsWith('/reports') },
    { label: 'Trend Analysis', path: '/trend-analysis', match: (p: string) => p.startsWith('/trend-analysis') },
    { label: 'Settings', path: '/settings', match: (p: string) => p.startsWith('/settings'), adminOnly: true }
  ];

  // Strictly filter out admin-only items for non-ADMIN users
  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <header className="w-full bg-white border-b border-[#E5E7EB] sticky top-0 z-50 shadow-2xs">
      {/* A) Thin full-width Government of India strip at the very top */}
      <div className="w-full bg-[#12355B] text-white text-xs py-1.5 px-3 sm:px-4 lg:px-6 leading-tight">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3 truncate">
            <ChakraLogo variant="white" className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-semibold tracking-wide text-white whitespace-nowrap">
              Government of India / भारत सरकार
            </span>
            <span className="text-blue-300">|</span>
            <span className="text-blue-100 font-normal truncate hidden sm:inline">
              Ministry of Statistics &amp; Programme Implementation (MoSPI)
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs font-mono whitespace-nowrap flex-shrink-0">
            <span className="bg-[#1D4E89] text-blue-100 px-2 py-0.5 rounded text-xs border border-blue-400/20">
              SIH PS ID: 26102
            </span>
            <span className="inline-flex items-center space-x-1.5 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="hidden md:inline">Portal Online</span>
            </span>
          </div>
        </div>
      </div>

      {/* B) Main navbar directly below */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5">
        <div className="flex items-center justify-between gap-2 lg:gap-3">
          {/* Left: emblem/icon + Title + Subtitle - always fully visible before and after login */}
          <Link to={user ? "/dashboard" : "/"} className="flex items-center space-x-2 sm:space-x-2.5 flex-shrink-0 group">
            <div className="w-8 h-8 sm:w-9 sm:h-9 min-w-[32px] min-h-[32px] flex items-center justify-center flex-shrink-0">
              <ChakraLogo className="w-8 h-8 sm:w-9 sm:h-9 min-w-[32px] min-h-[32px] group-hover:scale-105 transition-transform" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm sm:text-base font-bold text-[#12355B] leading-tight tracking-tight group-hover:text-[#1D4E89] transition-colors whitespace-nowrap">
                MPLAD Monitoring Portal
              </span>
              <span className="text-[11px] text-[#667085] leading-tight font-medium hidden 2xl:block whitespace-nowrap">
                AI-Powered Fund Monitoring &amp; Vigilance Subsystem
              </span>
            </div>
          </Link>

          {/* Center/Right Navigation for Authenticated User */}
          <nav className="hidden lg:flex items-center space-x-0.5 xl:space-x-1 text-xs xl:text-[13px] 2xl:text-sm font-medium">
            {user ? (
              navItems.map((item) => {
                const isActive = item.match(location.pathname);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-2 xl:px-2.5 py-1.5 rounded transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#12355B] text-white font-semibold border border-[#12355B] shadow-2xs'
                        : 'text-[#263238] hover:text-[#12355B] hover:bg-[#EAF2F8] border border-transparent'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })
            ) : (
              <>
                <Link
                  to="/"
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    location.pathname === '/'
                      ? 'bg-[#12355B] text-white font-semibold'
                      : 'text-[#263238] hover:bg-[#EAF2F8]'
                  }`}
                >
                  Overview
                </Link>
                <Link
                  to="/about"
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    location.pathname === '/about'
                      ? 'bg-[#12355B] text-white font-semibold'
                      : 'text-[#263238] hover:bg-[#EAF2F8]'
                  }`}
                >
                  About MPLAD
                </Link>
                <Link
                  to="/how-it-works"
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    location.pathname === '/how-it-works'
                      ? 'bg-[#12355B] text-white font-semibold'
                      : 'text-[#263238] hover:bg-[#EAF2F8]'
                  }`}
                >
                  How It Works
                </Link>
              </>
            )}
          </nav>

          {/* Far Right: AI Assistant + Profile / Logout */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
            {user && onOpenAssistant && (
              <button
                id="ai-assistant-navbar-button"
                onClick={onOpenAssistant}
                className="inline-flex items-center space-x-1.5 bg-[#EAF2F8] text-[#1D4E89] border border-[#1D4E89]/25 hover:bg-[#1D4E89] hover:text-white px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-semibold transition-all shadow-2xs whitespace-nowrap"
                title="Ask AI Assistant"
              >
                <Bot className="w-3.5 h-3.5 text-inherit" />
                <span className="hidden sm:inline">AI Assistant</span>
                <Sparkles className="w-3 h-3 text-amber-500" />
              </button>
            )}

            {/* Profile Dropdown / Login */}
            {user ? (
              <div className="relative">
                <button
                  id="navbar-profile-menu-button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-1.5 text-xs text-[#263238] font-medium bg-[#F5F7FA] hover:bg-[#EAF2F8] px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md border border-[#E5E7EB] transition-colors whitespace-nowrap"
                >
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center font-bold text-[11px] text-white flex-shrink-0 ${
                    isAdmin ? 'bg-amber-600' : 'bg-[#12355B]'
                  }`}>
                    {user.name ? user.name.charAt(0) : 'U'}
                  </div>
                  <div className="text-left hidden xl:block leading-none max-w-[120px]">
                    <span className="block font-semibold text-xs text-[#12355B] truncate">{user.name}</span>
                    <span className={`block text-[10px] font-mono font-bold uppercase ${
                      isAdmin ? 'text-amber-700' : 'text-blue-700'
                    }`}>
                      {isAdmin ? 'ADMIN' : 'PUBLIC'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#667085]">▾</span>
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E5E7EB] rounded-lg shadow-lg py-2 z-50 text-sm">
                    <div className="px-3.5 py-2.5 border-b border-[#E5E7EB]">
                      <p className="font-bold text-[#12355B] truncate">{user.name}</p>
                      <p className="text-xs text-[#667085] truncate">{user.email}</p>
                      <div className="mt-2">
                        {isAdmin ? (
                          <span className="inline-flex items-center space-x-1.5 text-xs bg-amber-50 text-amber-800 border border-amber-200 font-bold px-2.5 py-1 rounded">
                            <ChakraLogo className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>ROLE: ADMIN (Full Control)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 text-xs bg-blue-50 text-blue-800 border border-blue-200 font-semibold px-2.5 py-1 rounded">
                            <ChakraLogo className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>ROLE: PUBLIC (Read-Only)</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        {isAdmin 
                          ? 'Designated Officer Account with Anomaly Investigation and Action authorization.'
                          : 'Public Citizen / Researcher read-only access to monitoring data.'}
                      </p>
                    </div>

                    {/* Only show Settings link to ADMIN role */}
                    {isAdmin && (
                      <Link
                        to="/settings"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center space-x-2.5 px-3.5 py-2 text-[#263238] hover:bg-[#EAF2F8]"
                      >
                        <User className="w-4 h-4 text-[#667085]" />
                        <span>Security &amp; Admin Settings</span>
                      </Link>
                    )}

                    <button
                      id="navbar-logout-btn"
                      onClick={handleLogout}
                      className="w-full text-left flex items-center space-x-2.5 px-3.5 py-2 text-[#D92D20] hover:bg-red-50 border-t border-[#E5E7EB]"
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
                className="bg-[#12355B] text-white text-xs sm:text-sm font-semibold px-3 sm:px-3.5 py-1.5 rounded-md hover:bg-[#1D4E89] transition-colors"
              >
                Sign In
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded text-[#263238] hover:bg-[#EAF2F8]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-[#12355B]" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-[#E5E7EB] pb-2 space-y-1">
            <div className="flex items-center space-x-2.5 px-3 py-2 bg-[#EAF2F8] rounded-md mb-2">
              <ChakraLogo className="w-6 h-6 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#12355B]">MPLAD Monitoring Portal</span>
                <span className="text-[10px] text-[#475467]">Government of India • MoSPI</span>
              </div>
            </div>
            {user ? (
              <>
                <div className="px-3.5 py-1.5 mb-1.5 text-xs font-mono text-gray-600 bg-gray-50 rounded">
                  Logged in as <strong>{user.email}</strong> ({isAdmin ? 'ADMIN' : 'PUBLIC'})
                </div>
                {navItems.map((item) => {
                  const isActive = item.match(location.pathname);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3.5 py-2 text-sm rounded font-medium ${
                        isActive
                          ? 'bg-[#12355B] text-white font-semibold'
                          : 'text-[#263238] hover:bg-[#EAF2F8]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </>
            ) : (
              <>
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3.5 py-2 text-sm text-[#263238] hover:bg-[#EAF2F8] rounded"
                >
                  Overview
                </Link>
                <Link
                  to="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3.5 py-2 text-sm text-[#263238] hover:bg-[#EAF2F8] rounded"
                >
                  About MPLAD
                </Link>
                <Link
                  to="/how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3.5 py-2 text-sm text-[#263238] hover:bg-[#EAF2F8] rounded"
                >
                  How It Works
                </Link>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3.5 py-2 text-sm text-[#12355B] font-bold"
                >
                  Official Sign In
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
