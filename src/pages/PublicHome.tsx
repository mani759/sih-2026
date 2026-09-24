import React from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  FileCheck2,
  Layers,
  TrendingUp,
  ArrowRight,
  Award,
  ChevronRight,
  LogIn,
  BookOpen,
  Info
} from 'lucide-react';
import { ChakraLogo } from '../components/ChakraLogo';

const SCHEME_FACTS = [
  { label: 'Annual entitlement per MP', value: '₹5.00 Crore' },
  { label: 'Lok Sabha constituencies', value: '543' },
  { label: 'Rajya Sabha members', value: '245' },
  { label: 'Operating guidelines', value: 'MPLADS 2023' }
];

const SERVICES = [
  {
    icon: Cpu,
    title: 'ML Risk Scoring',
    text: 'Isolation Forest model trained on expenditure velocities, milestone delays, and tender presence to compute an objective 0-100 risk score.'
  },
  {
    icon: Layers,
    title: 'Duplicate Work Detection',
    text: 'TF-IDF text embeddings and location proximity clustering intercept duplicate proposals for community halls and desilting works.'
  },
  {
    icon: TrendingUp,
    title: 'Utilization Benchmarking',
    text: 'Contextual comparison of district expenditure rates against state averages and national performance baselines.'
  },
  {
    icon: FileCheck2,
    title: 'Immutable Audit Trail',
    text: 'Every verification, escalation, and clarification request generates an unalterable chronological audit log.'
  }
];

const QUICK_LINKS = [
  { icon: LogIn, label: 'Officer / Citizen Sign In', path: '/login' },
  { icon: Info, label: 'About the MPLAD Scheme', path: '/about' },
  { icon: BookOpen, label: 'ML Architecture & Methodology', path: '/how-it-works' }
];

export const PublicHome: React.FC = () => {
  return (
    <div className="bg-[#F5F7FA] min-h-screen">
      {/* Hero banner */}
      <section className="relative overflow-hidden bg-[#12355B] text-white">
        <ChakraLogo
          variant="white"
          className="absolute -right-24 -top-24 w-[28rem] h-[28rem] opacity-[0.07] animate-rotate-chakra pointer-events-none"
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#FFB366]">
              <Cpu className="w-3.5 h-3.5" />
              Smart India Hackathon • Problem Statement 26102
            </p>
            <p lang="hi" className="mt-4 text-lg sm:text-xl font-semibold text-blue-100">
              संसद सदस्य स्थानीय क्षेत्र विकास योजना — निगरानी एवं सतर्कता
            </p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
              AI-Powered Detection of Anomalies, Inefficiencies &amp; Fraud in MPLAD Scheme Implementation
            </h1>
            <p className="mt-4 text-base text-blue-100 leading-relaxed">
              An operational intelligence portal for the Ministry of Statistics and Programme Implementation (MoSPI) and
              District Nodal Authorities, combining machine learning anomaly isolation, duplicate clustering, and explainable
              audit reasoning.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="bg-[#FF9933] hover:bg-[#F08A1C] text-[#1B1B1B] text-sm font-bold px-6 py-3 rounded-md flex items-center gap-2 transition-colors"
              >
                <span>Access Vigilance Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/how-it-works"
                className="bg-transparent hover:bg-white/10 text-white border border-white/60 text-sm font-semibold px-5 py-3 rounded-md transition-colors"
              >
                View Methodology
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Scheme facts strip */}
      <section className="bg-white border-b border-[#DDE3EA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-[#E5E7EB]">
          {SCHEME_FACTS.map(fact => (
            <div key={fact.label} className="py-5 pr-4 lg:px-5 lg:first:pl-0">
              <p className="text-2xl font-bold text-[#12355B]">{fact.value}</p>
              <p className="text-xs text-[#667085] mt-0.5">{fact.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services + information panel */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="border-l-4 border-[#FF9933] pl-3 mb-5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#12355B]">Portal Services</h2>
            <p className="text-sm text-[#667085] mt-0.5">
              Addressing monitoring vulnerabilities identified in CAG performance audits of MPLADS.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SERVICES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-white border border-[#DDE3EA] border-t-[3px] border-t-[#12355B] p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-md bg-[#EAF2F8] text-[#12355B] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#12355B]">{title}</h3>
                </div>
                <p className="text-sm text-[#475467] leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="bg-white border border-[#DDE3EA]">
            <h2 className="bg-[#12355B] text-white text-sm font-bold uppercase tracking-wide px-4 py-2.5">
              Quick Links
            </h2>
            <ul className="divide-y divide-[#E5E7EB]">
              {QUICK_LINKS.map(({ icon: Icon, label, path }) => (
                <li key={path}>
                  <Link
                    to={path}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[#12355B] hover:bg-[#EAF2F8] transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-[#667085]" />
                      {label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#98A2B3]" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-[#DDE3EA]">
            <h2 className="bg-[#12355B] text-white text-sm font-bold uppercase tracking-wide px-4 py-2.5">
              Access Levels
            </h2>
            <ul className="px-4 py-3 space-y-3 text-sm text-[#475467]">
              <li>
                <span className="font-semibold text-[#12355B]">Public (read-only):</span> browse projects, funds,
                reports and trend analysis.
              </li>
              <li>
                <span className="font-semibold text-[#12355B]">Admin (designated officer):</span> review anomalies,
                transactions and take workflow actions.
              </li>
            </ul>
          </div>
        </aside>
      </section>

      {/* Statutory mandate note */}
      <section className="bg-white border-t border-[#DDE3EA] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-[#475467]">
            <Award className="w-6 h-6 text-[#12355B] flex-shrink-0" />
            <span>
              Developed in accordance with the <strong>Members of Parliament Local Area Development Scheme (MPLADS) Guidelines 2023</strong> and
              Central Vigilance Commission operating directives.
            </span>
          </div>
          <Link
            to="/login"
            className="text-sm font-semibold text-[#1D4E89] hover:text-[#12355B] flex items-center gap-1 whitespace-nowrap"
          >
            <span>Proceed to Sign-In</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};
