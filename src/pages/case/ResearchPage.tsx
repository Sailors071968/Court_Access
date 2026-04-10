// ============================================
// Court Access — Legal Research Tab
// ============================================

import { Search, BookOpen } from 'lucide-react';
import { useState } from 'react';

export function ResearchPage() {
  const [query, setQuery] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Legal Research</h2>
        <p className="text-sm text-gray-500 mt-1">Search statutes, case law, and legal resources</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search statutes, case law, CALCRIM instructions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Legal research search"
        />
      </div>

      <div className="text-center py-12">
        <BookOpen size={48} className="text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">No research results yet. Use the search bar above to find statutes, case law, and CALCRIM instructions.</p>
      </div>
    </div>
  );
}
