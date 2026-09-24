import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Printer,
  CheckCircle2,
  Calendar,
  ShieldAlert,
  Filter,
  Layers,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { BreadcrumbContextStrip } from "../components/BreadcrumbContextStrip";
import { Project } from "../types";

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState("vigilance_summary");
  const [selectedState, setSelectedState] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedFY, setSelectedFY] = useState("2023-24");
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [metrics, setMetrics] = useState<{
    worksEvaluated?: number;
    sanctionedValue?: number;
    spentValue?: number;
    flaggedCount?: number;
    underReviewCount?: number;
    elevatedRiskCount?: number;
    duplicateAlertsCount?: number;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedDate, setGeneratedDate] = useState<string>(
    new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  );

  // Load available states and categories on mount
  useEffect(() => {
    fetch("/api/states")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const names = data
            .filter((s: any) => s.projectCount > 0)
            .map((s: any) => s.state);
          setAvailableStates(names);
        }
      })
      .catch((err) => console.warn("Could not load states list:", err));

    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const names = data
            .filter((c: any) => c.count > 0)
            .map((c: any) => c.category);
          setAvailableCategories(names);
        }
      })
      .catch((err) => console.warn("Could not load categories list:", err));
  }, []);

  // Fetch report data on parameter changes
  useEffect(() => {
    let isMounted = true;
    async function loadReport() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          type: reportType,
          state: selectedState,
          category: selectedCategory,
          financialYear: selectedFY,
          includeDuplicates: "true",
        });
        const res = await fetch(`/api/reports?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Report generation failed with status ${res.status}`);
        }
        const data = await res.json();
        if (isMounted) {
          setProjects(data.projects || []);
          setMetrics(data.metrics || {});
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to generate report from server.");
          setLoading(false);
        }
      }
    }

    loadReport();
    return () => {
      isMounted = false;
    };
  }, [reportType, selectedState, selectedCategory, selectedFY]);

  const handleExportCSV = () => {
    if (projects.length === 0) return;
    let csvContent =
      "data:text/csv;charset=utf-8,Project_ID,Title,State,District,Sanctioned_INR,Spent_INR,Risk_Score,Severity,Status,Audit_Observation\n";
    projects.forEach((p) => {
      const observation = (
        p.reason ||
        (p.flags && p.flags.length > 0
          ? p.flags.join("; ")
          : "Routine parameter tracking")
      ).replace(/"/g, '""');
      const row = [
        p.project_id,
        `"${p.project_name.replace(/"/g, '""')}"`,
        p.state,
        p.district,
        p.sanctioned_amount,
        p.actual_expenditure,
        p.risk_score ?? 0,
        p.severity ?? "low",
        p.status,
        `"${observation}"`,
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `MPLAD_Audit_Report_${reportType}_${selectedState}_${selectedCategory}_${selectedFY}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const evaluatedCount = metrics.worksEvaluated ?? projects.length;
  const sanctionedVal =
    metrics.sanctionedValue ??
    projects.reduce((s, p) => s + p.sanctioned_amount, 0);
  const elevatedCount =
    metrics.flaggedCount ??
    metrics.elevatedRiskCount ??
    projects.filter((p) => p.severity === "high").length;
  const underReviewCount =
    metrics.underReviewCount ??
    projects.filter((p) => p.severity === "medium").length;
  const duplicateCount =
    metrics.duplicateAlertsCount ??
    projects.filter((p) => p.is_potential_duplicate).length;

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[{ label: "Audit & Vigilance Reports" }]}
        contextDescription="Generate official compliance briefs, expenditure reconciliation dossiers, and anomaly logs."
      />

      <main className="max-w-portal mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Report Configuration Bar */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
          <h3 className="text-sm font-bold text-[#12355B] uppercase tracking-wide mb-3">
            Select Report Template & Parameters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block text-[#475467] font-semibold mb-1">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full p-2 bg-white border border-[#D0D5DD] rounded-md text-[#263238] focus:border-[#12355B]"
              >
                <option value="vigilance_summary">
                  Vigilance & Anomaly Executive Summary
                </option>
                <option value="procurement_audit">
                  Procurement & Tender Compliance Audit
                </option>
                <option value="duplicate_cluster">
                  Duplicate Proposal Cluster Dossier
                </option>
                <option value="fund_utilization">
                  State-wise Fund Utilization Reconciliation
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[#475467] font-semibold mb-1">
                State / Territory
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full p-2 bg-white border border-[#D0D5DD] rounded-md text-[#263238] focus:border-[#12355B]"
              >
                <option value="All">All States (National Dossier)</option>
                {availableStates.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#475467] font-semibold mb-1">
                Work Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 bg-white border border-[#D0D5DD] rounded-md text-[#263238] focus:border-[#12355B]"
              >
                <option value="All">All Categories</option>
                {(availableCategories.length > 0
                  ? availableCategories
                  : [
                      "Other Public Facilities",
                      "Railways, Roads, Pathways & Bridges",
                      "Others",
                      "Education",
                      "Drinking Water Facility",
                      "Sanitation & Public Health",
                    ]
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#475467] font-semibold mb-1">
                Financial Year
              </label>
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="w-full p-2 bg-white border border-[#D0D5DD] rounded-md text-[#263238] focus:border-[#12355B]"
              >
                <option value="2023-24">FY 2023-24</option>
                <option value="2022-23">FY 2022-23</option>
                <option value="2021-22">FY 2021-22</option>
              </select>
            </div>

            <div className="flex items-end space-x-2">
              <button
                onClick={handleExportCSV}
                disabled={loading || projects.length === 0}
                className="flex-1 bg-[#12355B] hover:bg-[#1D4E89] disabled:bg-gray-400 text-white font-semibold py-2 px-3 rounded-md flex items-center justify-center space-x-1 transition-colors shadow-2xs cursor-pointer disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handlePrint}
                className="bg-white hover:bg-gray-50 text-[#344054] border border-[#D0D5DD] font-semibold py-2 px-3 rounded-md flex items-center justify-center space-x-1 transition-colors shadow-2xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Dossier</span>
              </button>
            </div>
          </div>
        </div>

        {/* Printable Official Report Paper */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-8 shadow-sm max-w-5xl mx-auto space-y-6 print:border-none print:shadow-none">
          {/* Official Letterhead Header */}
          <div className="border-b-2 border-[#12355B] pb-5 text-center space-y-1">
            <div className="text-xs font-bold uppercase tracking-widest text-[#12355B]">
              भारत सरकार | GOVERNMENT OF INDIA
            </div>
            <div className="text-sm font-semibold text-[#263238]">
              MINISTRY OF STATISTICS AND PROGRAMME IMPLEMENTATION
            </div>
            <div className="text-xs text-[#667085]">
              MPLADS Vigilance, Financial Integrity & Performance Audit
              Directorate
            </div>
            <h2 className="text-xl font-serif-report font-bold text-[#12355B] pt-3">
              {reportType === "vigilance_summary" &&
                "Quarterly MPLAD Scheme Vigilance & Anomaly Dossier"}
              {reportType === "procurement_audit" &&
                "Statutory Tender & Procurement Compliance Audit"}
              {reportType === "duplicate_cluster" &&
                "Inter-Constituency Duplicate Work Detection Dossier"}
              {reportType === "fund_utilization" &&
                "Consolidated State Fund Allocation & Utilization Report"}
            </h2>
            <div className="text-xs text-[#667085] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1">
              <span>
                Jurisdiction:{" "}
                <strong>
                  {selectedState === "All"
                    ? "All States (National)"
                    : selectedState}
                </strong>
              </span>
              <span>•</span>
              <span>
                Category:{" "}
                <strong>
                  {selectedCategory === "All"
                    ? "All Categories"
                    : selectedCategory}
                </strong>
              </span>
              <span>•</span>
              <span>
                Financial Year: <strong>{selectedFY}</strong>
              </span>
              <span>•</span>
              <span>
                Date of Issue: <strong>{generatedDate}</strong>
              </span>
            </div>
          </div>

          {/* Executive Overview */}
          <div className="prose prose-sm text-[#344054] max-w-none text-xs leading-relaxed space-y-2">
            <p>
              This official dossier synthesizes computational vigilance findings
              generated under SIH Problem Statement 26102. All anomaly
              indicators, expenditure velocities, and tender filings have been
              evaluated through the Government of India MPLAD Monitoring Portal
              isolation forest model and rule engine.
            </p>
          </div>

          {/* Key Metric Summary Boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            <div className="p-3 bg-[#F5F7FA] border border-[#E5E7EB] rounded">
              <span className="text-[#667085] block">Works Evaluated</span>
              <span className="text-base font-bold text-[#12355B] font-mono">
                {loading ? "..." : evaluatedCount}
              </span>
            </div>
            <div className="p-3 bg-[#F5F7FA] border border-[#E5E7EB] rounded">
              <span className="text-[#667085] block">Sanctioned Value</span>
              <span className="text-base font-bold text-[#12355B] font-mono">
                {loading
                  ? "..."
                  : `₹${(sanctionedVal / 10000000).toFixed(2)} Cr`}
              </span>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <span className="text-[#D92D20] block font-semibold">
                High Risk (Flagged)
              </span>
              <span className="text-base font-bold text-[#D92D20] font-mono">
                {loading ? "..." : `${elevatedCount} Works`}
              </span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded">
              <span className="text-amber-800 block font-semibold">
                Under Review (Medium)
              </span>
              <span className="text-base font-bold text-amber-800 font-mono">
                {loading ? "..." : `${underReviewCount} Works`}
              </span>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded">
              <span className="text-purple-700 block font-semibold">
                Duplicate Alerts
              </span>
              <span className="text-base font-bold text-purple-700 font-mono">
                {loading ? "..." : `${duplicateCount} Works`}
              </span>
            </div>
          </div>

          {/* Loading / Error States */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#667085]">
              <Loader2 className="w-8 h-8 animate-spin text-[#12355B] mb-2" />
              <p className="text-sm font-medium">
                Generating dossier from live registry...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-center text-sm text-[#D92D20]">
              <AlertCircle className="w-5 h-5 mx-auto mb-1" />
              <p className="font-semibold">Unable to compile report</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded text-sm text-[#667085]">
              <p className="font-semibold text-gray-700">
                No records found matching parameters
              </p>
              <p className="text-xs text-gray-500 mt-1">
                No works found for Jurisdiction: {selectedState} and Financial
                Year: {selectedFY}. Try selecting a different jurisdiction or
                year.
              </p>
            </div>
          ) : (
            /* Audit Findings Table */
            <div className="border border-[#E5E7EB] rounded overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#12355B] text-white uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Project Code</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Constituency</th>
                    <th className="py-2.5 px-3 font-mono">Sanctioned (₹)</th>
                    <th className="py-2.5 px-3 font-mono">Spent (₹)</th>
                    <th className="py-2.5 px-3">Risk Score</th>
                    <th className="py-2.5 px-3">Audit Observation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-[#263238]">
                  {projects.map((p) => {
                    const isHigh =
                      (p.risk_score || 0) >= 70 || p.severity === "high";
                    return (
                      <tr key={p.project_id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono font-bold whitespace-nowrap">
                          <Link
                            to={`/projects/${p.project_id}`}
                            className="text-[#12355B] hover:underline"
                          >
                            {p.project_id}
                          </Link>
                        </td>
                        <td
                          className="py-2 px-3 font-medium max-w-xs truncate"
                          title={p.project_name}
                        >
                          {p.project_name}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {p.district}, {p.state}
                        </td>
                        <td className="py-2 px-3 font-mono whitespace-nowrap">
                          ₹{(p.sanctioned_amount / 100000).toFixed(2)}L
                        </td>
                        <td
                          className={`py-2 px-3 font-mono whitespace-nowrap ${p.actual_expenditure > p.sanctioned_amount ? "text-[#D92D20] font-semibold" : ""}`}
                        >
                          ₹{(p.actual_expenditure / 100000).toFixed(2)}L
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`font-bold ${isHigh ? "text-[#D92D20]" : (p.risk_score || 0) >= 40 ? "text-amber-700" : "text-emerald-700"}`}
                          >
                            {p.risk_score !== undefined
                              ? `${p.risk_score}/100`
                              : "Pending"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[#475467] max-w-sm text-[11px] leading-relaxed">
                          {p.reason ||
                            (p.flags && p.flags.length > 0
                              ? p.flags.join(", ")
                              : "Normal operational velocity")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Statutory Verification Sign-off */}
          <div className="pt-8 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#667085]">
            <div>
              <p className="font-semibold text-[#12355B]">
                Verified by MoSPI Vigilance Division
              </p>
              <p>Certified Electronic Record Under IT Act 2000</p>
            </div>
            <div className="text-right">
              <div className="h-8 w-24 border-b border-gray-400 mb-1 ml-auto" />
              <p className="font-semibold text-[#263238]">
                Senior Audit Officer
              </p>
              <p>Government of India</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
