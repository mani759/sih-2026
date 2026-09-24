import React, { useState } from 'react';
import { Bot, Sparkles, Send, X, AlertTriangle, ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; relatedProjectIds?: string[] }>>([
    {
      role: 'assistant',
      text: 'Greetings. I am the MoSPI MPLAD Scheme Vigilance AI Assistant. You can ask me natural language queries about anomalous disbursements, duplicate proposals, state fund utilization, or specific project flags (e.g., "Show high-risk projects in Telangana" or "Which projects have missing tenders?").'
    }
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || loading) return;

    const userText = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userText })
      });

      if (!res.ok) throw new Error('Query could not be processed.');

      const data = await res.json();
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          relatedProjectIds: data.relatedProjectIds
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: 'Unable to communicate with the AI Assistant service. Please verify your query parameter format.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-2xl w-full flex flex-col h-[600px] max-h-[90vh] shadow-2xl border border-[#E5E7EB] overflow-hidden animate-in fade-in">
        {/* Header */}
        <div className="bg-[#12355B] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-[#1D4E89] rounded">
              <Bot className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center space-x-1">
                <span>MPLAD Scheme Vigilance AI Assistant</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h3>
              <p className="text-[11px] text-blue-100">
                Grounded strictly in verified scheme database records & ML anomaly metrics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1 rounded hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F7FA]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3.5 text-xs sm:text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#12355B] text-white'
                    : 'bg-white text-[#263238] border border-[#E5E7EB] shadow-2xs'
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>
                {m.relatedProjectIds && m.relatedProjectIds.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-100">
                    <span className="text-[11px] font-bold text-[#1D4E89] block mb-1">
                      Referenced Project Records:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {m.relatedProjectIds.map(pid => (
                        <Link
                          key={pid}
                          to={`/projects/${pid}`}
                          onClick={onClose}
                          className="inline-flex items-center text-[10px] font-mono bg-[#EAF2F8] text-[#12355B] hover:bg-[#12355B] hover:text-white px-2 py-0.5 rounded border border-[#1D4E89]/20 transition-colors"
                        >
                          <span>{pid}</span>
                          <ExternalLink className="w-2.5 h-2.5 ml-1" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 text-xs text-[#667085] flex items-center space-x-2">
                <div className="w-3 h-3 border-2 border-[#12355B] border-t-transparent rounded-full animate-spin" />
                <span>Searching verified project database slice...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick query suggestion pills */}
        <div className="p-2.5 bg-white border-t border-[#E5E7EB] flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-gray-500 font-medium whitespace-nowrap pl-1">Examples:</span>
          <button
            onClick={() => setQuery('Show high-risk projects in Telangana')}
            className="px-2 py-1 bg-[#F5F7FA] hover:bg-[#EAF2F8] text-[#1D4E89] rounded border border-gray-200 whitespace-nowrap"
          >
            Telangana High Risk
          </button>
          <button
            onClick={() => setQuery('Which projects have missing tenders on file?')}
            className="px-2 py-1 bg-[#F5F7FA] hover:bg-[#EAF2F8] text-[#1D4E89] rounded border border-gray-200 whitespace-nowrap"
          >
            Missing Tenders
          </button>
          <button
            onClick={() => setQuery('Show projects with cost overruns')}
            className="px-2 py-1 bg-[#F5F7FA] hover:bg-[#EAF2F8] text-[#1D4E89] rounded border border-gray-200 whitespace-nowrap"
          >
            Cost Overruns
          </button>
        </div>

        {/* Input area */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-[#E5E7EB] flex items-center space-x-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask a vigilance question or enter search parameters..."
            className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-[#F5F7FA] border border-[#D0D5DD] rounded-md focus:outline-hidden focus:border-[#12355B] focus:bg-white"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="bg-[#12355B] hover:bg-[#1D4E89] disabled:opacity-40 text-white p-2.5 rounded-md transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
