// ============================================
// Court Access — Legal Research Tab
// ============================================

import { Card } from '../../components/common/Card';
import { Search, BookOpen, ExternalLink } from 'lucide-react';
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

      <div className="grid md:grid-cols-2 gap-4">
        <Card hover>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">PC 459 — Burglary</h3>
              <p className="text-sm text-gray-500 mt-1">California Penal Code Section 459 — Every person who enters any building with intent to commit grand or petit larceny...</p>
              <button className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
                View full statute <ExternalLink size={10} />
              </button>
            </div>
          </div>
        </Card>
        <Card hover>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">PC 1538.5 — Motion to Suppress</h3>
              <p className="text-sm text-gray-500 mt-1">Motion to return property or suppress as evidence any tangible or intangible thing obtained as a result of a search or seizure...</p>
              <button className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
                View full statute <ExternalLink size={10} />
              </button>
            </div>
          </div>
        </Card>
        <Card hover>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">CALCRIM 1700 — Burglary Elements</h3>
              <p className="text-sm text-gray-500 mt-1">Jury instruction for burglary charges. The defendant is charged with burglary in violation of Penal Code section 459...</p>
              <button className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
                View instruction <ExternalLink size={10} />
              </button>
            </div>
          </div>
        </Card>
        <Card hover>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen size={20} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">People v. Montoya (2004)</h3>
              <p className="text-sm text-gray-500 mt-1">Key case regarding intent requirements for first-degree burglary and the distinction between entry and remaining inside...</p>
              <button className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
                View case <ExternalLink size={10} />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
