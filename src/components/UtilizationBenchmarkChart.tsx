import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { Info } from 'lucide-react';

interface UtilizationBenchmarkChartProps {
  projectUtilization: number; // e.g. 1.155 (115.5%)
  stateUtilization: number;   // e.g. 0.605 (60.5%)
  nationalAvg: number;        // e.g. 0.547 (54.7%)
  stateName: string;
}

export const UtilizationBenchmarkChart: React.FC<UtilizationBenchmarkChartProps> = ({
  projectUtilization,
  stateUtilization,
  nationalAvg,
  stateName
}) => {
  const chartData = [
    {
      name: 'This Project',
      rate: Number((projectUtilization * 100).toFixed(1)),
      color: projectUtilization > 1.1 ? '#F04438' : '#12355B'
    },
    {
      name: `${stateName} State Avg`,
      rate: Number((stateUtilization * 100).toFixed(1)),
      color: '#1D4E89'
    },
    {
      name: 'National Avg',
      rate: Number((nationalAvg * 100).toFixed(1)),
      color: '#667085'
    }
  ];

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-xs">
      <div className="flex items-start justify-between pb-3 border-b border-[#F0F2F5] mb-4">
        <div>
          <h3 className="text-base font-bold text-[#12355B]">
            Fund Utilization vs. Benchmark
          </h3>
          <p className="text-xs text-[#667085]">
            Comparison against state and national baseline rates (from MoSPI MPLAD statistical benchmarks).
          </p>
        </div>

        <div className="flex items-center space-x-1 px-2.5 py-1 bg-[#EAF2F8] text-[#1D4E89] text-[11px] font-semibold rounded">
          <Info className="w-3.5 h-3.5" />
          <span>Display-Only Context</span>
        </div>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475467' }} />
            <YAxis
              tick={{ fontSize: 11, fill: '#475467' }}
              tickFormatter={val => `${val}%`}
              domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax + 10))]}
            />
            <Tooltip
              cursor={{ fill: 'rgba(18, 53, 91, 0.05)' }}
              formatter={(val: any) => [`${val}%`, 'Utilization Rate']}
              contentStyle={{
                backgroundColor: '#12355B',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '12px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <ReferenceLine y={100} stroke="#D92D20" strokeDasharray="3 3" label={{ value: '100% Sanction Limit', position: 'top', fill: '#D92D20', fontSize: 10 }} />
            <Bar dataKey="rate" name="Utilization Rate" radius={[4, 4, 0, 0]} maxBarSize={45} activeBar={false}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 p-2 bg-[#F5F7FA] rounded text-[11px] text-[#475467] flex items-center justify-between">
        <span>* Sanctioned baseline: 100% represents the initial approved technical estimate.</span>
        <span className="font-semibold text-[#12355B]">Source: MPLAD MIS Benchmark Model</span>
      </div>
    </div>
  );
};
