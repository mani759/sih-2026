import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Receipt, 
  ArrowRight, 
  FileText, 
  Building2, 
  Search, 
  CheckCircle, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { BreadcrumbContextStrip } from '../components/BreadcrumbContextStrip';
import { FilterBar } from '../components/FilterBar';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingState, EmptyState, ErrorState } from '../components/StateComponents';
import { Transaction } from '../types';

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: page.toString(),
      limit: '10',
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter }),
      ...(categoryFilter && { category: categoryFilter })
    });

    try {
      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Could not fetch transaction register.');

      const data = await res.json();
      setTransactions(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Error fetching transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, statusFilter, categoryFilter]);

  const handleSearchSubmit = () => {
    setPage(1);
    fetchTransactions();
  };

  const handleReset = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setPage(1);
  };

  return (
    <div className="bg-[#F5F7FA] min-h-screen pb-12">
      <BreadcrumbContextStrip
        items={[{ label: 'Financial Disbursements & Vouchers' }]}
        contextDescription="Contractor payments, material supply invoices, and milestone vouchers linked to MPLAD project codes."
      />

      <FilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by Voucher ID, vendor name, or invoice number..."
        onApplyFilters={handleSearchSubmit}
        onResetFilters={handleReset}
        filterFields={[
          {
            id: 'tx-status',
            label: 'Audit Status',
            value: statusFilter,
            onChange: v => { setStatusFilter(v); setPage(1); },
            options: [
              { label: 'All Statuses', value: '' },
              { label: 'FLAGGED', value: 'FLAGGED' },
              { label: 'VERIFIED', value: 'VERIFIED' },
              { label: 'PENDING', value: 'PENDING' },
              { label: 'UNDER REVIEW', value: 'UNDER_REVIEW' }
            ]
          },
          {
            id: 'tx-category',
            label: 'Payment Category',
            value: categoryFilter,
            onChange: v => { setCategoryFilter(v); setPage(1); },
            options: [
              { label: 'All Categories', value: '' },
              { label: 'Civil Works', value: 'Civil Works' },
              { label: 'Equipment & Hardware', value: 'Equipment & Hardware' },
              { label: 'Electrical Works', value: 'Electrical Works' },
              { label: 'Technical Consultancy', value: 'Technical Consultancy' }
            ]
          }
        ]}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="flex items-center justify-between text-xs text-[#667085] bg-white px-4 py-2.5 rounded-lg border border-[#E5E7EB]">
          <div>
            Showing <strong className="text-[#12355B] font-mono">{transactions.length}</strong> of{' '}
            <strong className="text-[#12355B] font-mono">{total}</strong> vouchers
          </div>
          <div>
            Payment Gateway: <strong>PFMS (Public Financial Management System)</strong>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Querying disbursement ledger..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchTransactions} />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No disbursements found"
            description="No transaction vouchers matched the selected filter criteria."
            actionText="Reset Filters"
            onAction={handleReset}
          />
        ) : (
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5F7FA] text-[#667085] font-semibold border-b border-[#E5E7EB] uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Voucher ID & Date</th>
                    <th className="py-3 px-4">Vendor / Payee</th>
                    <th className="py-3 px-4">Project Association</th>
                    <th className="py-3 px-4">Disbursed Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Audit Flag</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2F5] text-[#263238]">
                  {transactions.map(tx => (
                    <tr key={tx.transaction_id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Link
                          to={`/transactions/${tx.transaction_id}`}
                          className="font-mono font-bold text-[#1D4E89] hover:underline"
                        >
                          {tx.transaction_id}
                        </Link>
                        <div className="text-[11px] text-[#667085]">{tx.transaction_date}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-[#263238]">{tx.vendor_name}</div>
                        <div className="text-[11px] text-[#667085]">Inv: {tx.invoice_number}</div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <Link
                          to={`/projects/${tx.project_id}`}
                          className="text-[#12355B] hover:text-[#1D4E89] font-medium line-clamp-1"
                        >
                          {tx.project_name}
                        </Link>
                        <span className="font-mono text-[10px] text-gray-500">{tx.project_id}</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-mono">
                        <span className="font-bold text-[#12355B]">₹{(tx.amount / 100000).toFixed(2)}L</span>
                        <div className="text-[10px] text-[#667085]">{tx.payment_mode}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={tx.workflow_status} size="sm" />
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {tx.anomaly_flag ? (
                          <span className="inline-flex items-center text-[10px] font-bold bg-red-100 text-[#D92D20] px-2 py-0.5 rounded">
                            {tx.anomaly_flag}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#027A48] font-medium">
                            Clear
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <Link
                          to={`/transactions/${tx.transaction_id}`}
                          className="inline-flex items-center text-xs font-semibold text-[#1D4E89] bg-[#EAF2F8] hover:bg-[#D0E2EC] px-2.5 py-1 rounded transition-colors"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-3 bg-white border-t border-[#E5E7EB] flex items-center justify-between">
              <span className="text-xs text-[#667085]">
                Page <strong className="font-mono text-[#12355B]">{page}</strong> of <strong className="font-mono text-[#12355B]">{totalPages}</strong>
              </span>

              <div className="flex items-center space-x-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-white border border-[#D0D5DD] rounded text-xs text-[#344054] disabled:opacity-40 hover:bg-gray-50 flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Previous</span>
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 bg-white border border-[#D0D5DD] rounded text-xs text-[#344054] disabled:opacity-40 hover:bg-gray-50 flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
