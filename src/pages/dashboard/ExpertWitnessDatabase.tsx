// Phase 252 — Expert Witness Database
// Route: /dashboard/expert-witnesses

import { useState, useMemo } from 'react';
import { Users, Search, Star, MapPin, Award, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card } from '../../components/common/Card';

interface ExpertWitness {
  id: string;
  name: string;
  fieldOfExpertise: string;
  location: string;
  credentials: string;
  priorTestimony: number;
  contact: string;
  rating: number;
  category: string;
}

type SortField = 'name' | 'fieldOfExpertise' | 'location' | 'priorTestimony' | 'rating';
type SortDir = 'asc' | 'desc';

const CATEGORIES = [
  'All', 'Forensic Science', 'Ballistics', 'Use of Force', 'Accident Reconstruction',
  'DNA', 'Psychology', 'Medical Examiner', 'Digital Forensics',
];

function getMockExperts(): ExpertWitness[] {
  const experts: ExpertWitness[] = [
    { id: '1', name: 'Dr. Sarah Chen', fieldOfExpertise: 'Forensic Science', location: 'Los Angeles, CA', credentials: 'PhD Forensic Chemistry, ABFT Certified', priorTestimony: 142, contact: 'schen@forensiclab.com', rating: 4.8, category: 'Forensic Science' },
    { id: '2', name: 'Col. James Rivera', fieldOfExpertise: 'Ballistics', location: 'San Diego, CA', credentials: 'MS Mechanical Engineering, AFTE Fellow', priorTestimony: 89, contact: 'jrivera@ballisticsexp.com', rating: 4.6, category: 'Ballistics' },
    { id: '3', name: 'Dr. Michael Thompson', fieldOfExpertise: 'Use of Force', location: 'Sacramento, CA', credentials: 'PhD Criminal Justice, 25yr LEO', priorTestimony: 210, contact: 'mthompson@uofexpert.com', rating: 4.9, category: 'Use of Force' },
    { id: '4', name: 'Dr. Lisa Park', fieldOfExpertise: 'Accident Reconstruction', location: 'San Francisco, CA', credentials: 'PhD Physics, PE Licensed', priorTestimony: 67, contact: 'lpark@accidentrecon.com', rating: 4.5, category: 'Accident Reconstruction' },
    { id: '5', name: 'Dr. Robert Williams', fieldOfExpertise: 'DNA Analysis', location: 'Oakland, CA', credentials: 'PhD Molecular Biology, ABMGG Board', priorTestimony: 156, contact: 'rwilliams@dnaforensics.com', rating: 4.7, category: 'DNA' },
    { id: '6', name: 'Dr. Emily Foster', fieldOfExpertise: 'Forensic Psychology', location: 'Irvine, CA', credentials: 'PsyD, ABPP Board Certified', priorTestimony: 98, contact: 'efoster@psychexpert.com', rating: 4.4, category: 'Psychology' },
    { id: '7', name: 'Dr. David Nakamura', fieldOfExpertise: 'Medical Examiner', location: 'Fresno, CA', credentials: 'MD Pathology, NAME Fellow', priorTestimony: 320, contact: 'dnakamura@pathology.com', rating: 4.9, category: 'Medical Examiner' },
    { id: '8', name: 'Agent Chris Martinez', fieldOfExpertise: 'Digital Forensics', location: 'San Jose, CA', credentials: 'MS Cybersecurity, EnCE Certified', priorTestimony: 54, contact: 'cmartinez@digitalforensics.com', rating: 4.3, category: 'Digital Forensics' },
    { id: '9', name: 'Dr. Angela Brooks', fieldOfExpertise: 'Forensic Toxicology', location: 'Long Beach, CA', credentials: 'PhD Pharmacology, ABFT Diplomate', priorTestimony: 112, contact: 'abrooks@toxlab.com', rating: 4.6, category: 'Forensic Science' },
    { id: '10', name: 'Sgt. Kevin OBrien', fieldOfExpertise: 'Use of Force Training', location: 'Riverside, CA', credentials: 'POST Master Instructor, 30yr LEO', priorTestimony: 175, contact: 'kobrien@uoftraining.com', rating: 4.8, category: 'Use of Force' },
  ];
  return experts;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={12} className={star <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export function ExpertWitnessDatabase() {
  const [experts] = useState<ExpertWitness[]>(() => getMockExperts());
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let items = [...experts];
    if (categoryFilter !== 'All') items = items.filter(e => e.category === categoryFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(e => e.name.toLowerCase().includes(q) || e.fieldOfExpertise.toLowerCase().includes(q));
    }
    if (sortField) {
      items.sort((a, b) => {
        const av = a[sortField]; const bv = b[sortField];
        let cmp = 0;
        if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv);
        else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return items;
  }, [experts, searchTerm, categoryFilter, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-gray-400 ml-1 inline" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-blue-600 ml-1 inline" /> : <ArrowDown size={12} className="text-blue-600 ml-1 inline" />;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expert Witness Database</h1>
            <p className="text-sm text-gray-500">National expert directory with {experts.length} verified professionals</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><div className="flex items-center gap-3"><Award size={20} className="text-blue-600" /><div><p className="text-sm text-gray-500">Total Experts</p><p className="text-2xl font-bold">{experts.length}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><MapPin size={20} className="text-green-600" /><div><p className="text-sm text-gray-500">Categories</p><p className="text-2xl font-bold">{CATEGORIES.length - 1}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><Star size={20} className="text-yellow-500" /><div><p className="text-sm text-gray-500">Avg Rating</p><p className="text-2xl font-bold">{(experts.reduce((s, e) => s + e.rating, 0) / experts.length).toFixed(1)}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><Users size={20} className="text-purple-600" /><div><p className="text-sm text-gray-500">Total Testimony</p><p className="text-2xl font-bold">{experts.reduce((s, e) => s + e.priorTestimony, 0).toLocaleString()}</p></div></div></Card>
      </div>

      <Card>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search experts..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 text-gray-500 font-medium cursor-pointer" onClick={() => handleSort('name')}>Expert Name <SortIcon field="name" /></th>
                <th className="text-left py-3 px-3 text-gray-500 font-medium cursor-pointer" onClick={() => handleSort('fieldOfExpertise')}>Field of Expertise <SortIcon field="fieldOfExpertise" /></th>
                <th className="text-left py-3 px-3 text-gray-500 font-medium cursor-pointer" onClick={() => handleSort('location')}>Location <SortIcon field="location" /></th>
                <th className="text-left py-3 px-3 text-gray-500 font-medium">Credentials</th>
                <th className="text-right py-3 px-3 text-gray-500 font-medium cursor-pointer" onClick={() => handleSort('priorTestimony')}>Prior Testimony <SortIcon field="priorTestimony" /></th>
                <th className="text-left py-3 px-3 text-gray-500 font-medium">Contact</th>
                <th className="text-center py-3 px-3 text-gray-500 font-medium cursor-pointer" onClick={() => handleSort('rating')}>Rating <SortIcon field="rating" /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(expert => (
                <tr key={expert.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-medium text-gray-900">{expert.name}</td>
                  <td className="py-3 px-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{expert.fieldOfExpertise}</span></td>
                  <td className="py-3 px-3 text-gray-600 text-xs">{expert.location}</td>
                  <td className="py-3 px-3 text-gray-500 text-xs max-w-[200px] truncate">{expert.credentials}</td>
                  <td className="py-3 px-3 text-right font-medium text-gray-700">{expert.priorTestimony}</td>
                  <td className="py-3 px-3 text-xs text-blue-600">{expert.contact}</td>
                  <td className="py-3 px-3"><StarRating rating={expert.rating} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-gray-500">No experts match the current filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
