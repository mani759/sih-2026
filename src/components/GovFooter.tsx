import React from 'react';
import { Link } from 'react-router-dom';
import { ChakraLogo } from './ChakraLogo';
import { useAuth } from '../context/AuthContext';

export const GovFooter: React.FC = () => {
  const { user } = useAuth();

  const portalLinks = user
    ? [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Projects', path: '/projects' },
        { label: 'Funds', path: '/funds' },
        { label: 'Reports', path: '/reports' },
        { label: 'Trend Analysis', path: '/trend-analysis' },
      ]
    : [
        { label: 'Home', path: '/' },
        { label: 'Officer Sign In', path: '/login' },
      ];

  return (
    <footer className="mt-auto">
      <div className="gov-tricolour" />

      <div className="bg-[#12355B] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <ChakraLogo variant="white" className="w-10 h-10" />
              <div className="border-l-2 border-[#FF9933] pl-3">
                <p lang="hi" className="text-xs text-blue-100">एमपीलैड निगरानी पोर्टल</p>
                <p className="text-base font-bold leading-tight">MPLAD Monitoring Portal</p>
                <p className="text-xs text-blue-100">Ministry of Statistics &amp; Programme Implementation</p>
              </div>
            </div>
            <p className="text-xs text-blue-100 leading-relaxed mt-4 max-w-md">
              Monitoring of works under the Members of Parliament Local Area Development Scheme (MPLADS), with
              ML-based risk scoring, duplicate detection and an auditable review workflow.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#FFB366] mb-3">Portal</h2>
            <ul className="space-y-1.5 text-sm">
              {portalLinks.map(link => (
                <li key={link.path}>
                  <Link to={link.path} className="text-blue-50 hover:text-white hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#FFB366] mb-3">Information</h2>
            <ul className="space-y-1.5 text-sm">
              <li><Link to="/about" className="text-blue-50 hover:text-white hover:underline">About MPLADS</Link></li>
              <li><Link to="/how-it-works" className="text-blue-50 hover:text-white hover:underline">How It Works</Link></li>
              <li>
                <a href="#main-content" className="text-blue-50 hover:text-white hover:underline">Skip to Main Content</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15 bg-[#0B2542]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-blue-100">
            <p>
              Prototype developed for Smart India Hackathon (Problem Statement ID 26102). Not an official Government of India website.
            </p>
            <p className="whitespace-nowrap">Version 1.0.4</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
