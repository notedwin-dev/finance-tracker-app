import React, { useState } from 'react';
import { Account, Transaction, Category } from '../types';
import { getFinancialAdvice } from '../services/gemini';
import { SparklesIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';

interface Props {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
}

const AIInsights: React.FC<Props> = ({ accounts, transactions, categories }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse(null);
    try {
      const result = await getFinancialAdvice(accounts, transactions, categories, query);
      setResponse(result);
    } catch (err) {
      setResponse("Sorry, something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "How much did I spend on food this month?",
    "Am I over my budget for entertainment?",
    "What is my biggest expense recently?",
    "Give me advice on saving money."
  ];

  return (
    <div className="h-full flex flex-col pb-20">
      <div className="flex items-center gap-2 mb-6">
        <SparklesIcon className="w-6 h-6 text-purple-400" />
        <h2 className="text-xl font-bold text-white">AI Financial Assistant</h2>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar">
        {!response && !loading && (
          <div className="text-center mt-10 px-6">
             <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
               <SparklesIcon className="w-8 h-8 text-purple-500" />
             </div>
             <p className="text-gray-400 mb-6">Ask me anything about your spending habits, budgets, or account balances.</p>
             
             <div className="grid gap-2">
               {suggestions.map((s, i) => (
                 <button 
                   key={i}
                   onClick={() => setQuery(s)}
                   className="text-sm bg-surface p-3 rounded-xl text-left hover:bg-slate-700 text-gray-300 transition-colors border border-gray-800"
                 >
                   "{s}"
                 </button>
               ))}
             </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-48 space-y-4">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
             <p className="text-sm text-purple-400 animate-pulse">Analyzing your finances...</p>
          </div>
        )}

        {response && (
          <div className="bg-surface border border-purple-500/20 rounded-2xl p-6 shadow-lg shadow-purple-900/10">
            <h3 className="text-xs font-bold text-purple-400 uppercase mb-2">Analysis Result</h3>
            <div className="prose prose-invert prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: response.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleAsk} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about your finances..."
          className="w-full bg-surface border border-gray-700 rounded-full py-4 pl-6 pr-14 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-lg"
        />
        <button 
          type="submit" 
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 rounded-full text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <PaperAirplaneIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

export default AIInsights;