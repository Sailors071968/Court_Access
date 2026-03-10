// Phase 253 — Motion Library
// Route: /dashboard/motion-library

import { useState, useMemo } from 'react';
import { BookOpen, Search, FileText, Scale, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { Card } from '../../components/common/Card';

interface Motion {
  id: string;
  title: string;
  motionType: string;
  applicableCharges: string;
  jurisdiction: string;
  summary: string;
  templateDocument: string;
}

type SortField = 'title' | 'motionType' | 'jurisdiction';
type SortDir = 'asc' | 'desc';

const MOTION_TYPES = ['All', 'Suppression', 'Discovery', 'Dismissal', 'Personnel Records', 'Brady/Disclosure', 'Exclusion', 'Continuance'];

function getMockMotions(): Motion[] {
  return [
    { id: '1', title: 'Motion to Suppress Evidence', motionType: 'Suppression', applicableCharges: 'Drug Possession, Weapons', jurisdiction: 'California', summary: 'Seeks to exclude evidence obtained through unlawful search and seizure under the 4th Amendment.', templateDocument: 'motion_suppress_evidence.docx' },
    { id: '2', title: 'Pitchess Motion', motionType: 'Personnel Records', applicableCharges: 'Excessive Force, False Arrest', jurisdiction: 'California', summary: 'Request for disclosure of law enforcement personnel records showing pattern of misconduct.', templateDocument: 'pitchess_motion.docx' },
    { id: '3', title: 'Brady Motion', motionType: 'Brady/Disclosure', applicableCharges: 'All Criminal Charges', jurisdiction: 'Federal / All States', summary: 'Compels prosecution to disclose exculpatory evidence favorable to the defense.', templateDocument: 'brady_motion.docx' },
    { id: '4', title: 'Motion to Dismiss', motionType: 'Dismissal', applicableCharges: 'All Criminal Charges', jurisdiction: 'California', summary: 'Requests dismissal based on insufficient evidence, due process violations, or speedy trial.', templateDocument: 'motion_dismiss.docx' },
    { id: '5', title: 'Motion for Discovery', motionType: 'Discovery', applicableCharges: 'All Criminal Charges', jurisdiction: 'California', summary: 'Requests all evidence, witness lists, and materials in possession of prosecution.', templateDocument: 'motion_discovery.docx' },
    { id: '6', title: 'Motion to Exclude Evidence', motionType: 'Exclusion', applicableCharges: 'DUI, Drug Cases', jurisdiction: 'California', summary: 'Seeks exclusion of specific evidence due to chain of custody issues or testing irregularities.', templateDocument: 'motion_exclude.docx' },
    { id: '7', title: 'Motion to Suppress Statements', motionType: 'Suppression', applicableCharges: 'All Criminal Charges', jurisdiction: 'Federal / All States', summary: 'Seeks to suppress defendant statements obtained in violation of Miranda rights.', templateDocument: 'motion_suppress_statements.docx' },
    { id: '8', title: 'Motion for Continuance', motionType: 'Continuance', applicableCharges: 'All Criminal Charges', jurisdiction: 'California', summary: 'Requests additional time to prepare defense, obtain evidence, or secure witnesses.', templateDocument: 'motion_continuance.docx' },
    { id: '9', title: 'Motion to Compel DNA Testing', motionType: 'Discovery', applicableCharges: 'Violent Crimes, Sexual Assault', jurisdiction: 'California', summary: 'Requests court-ordered DNA testing of evidence not previously tested.', templateDocument: 'motion_dna_testing.docx' },
    { id: '10', title: 'Motion to Suppress Identification', motionType: 'Suppression', applicableCharges: 'Robbery, Assault', jurisdiction: 'California', summary: 'Challenges eyewitness identification obtained through suggestive procedures.', templateDocument: 'motion_suppress_id.docx' },
  ];
}

export function MotionLibrary() {
  const [motions] = useState<Motion[]>(() => getMockMotions());
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let items = [...motions];
    if (typeFilter !== 'All') items = items.filter(m => m.motionType === typeFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(m => m.title.toLowerCase().includes(q) || m.summary.toLowerCase().includes(q) || m.applicableCharges.toLowerCase().includes(q));
    }
    if (sortField) {
      items.sort((a, b) => {
        const cmp = String(a[sortField]).localeCompare(String(b[sortField]));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return items;
  }, [motions, searchTerm, typeFilter, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-gray-400 ml-1 inline" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-blue-600 ml-1 inline" /> : <ArrowDown size={12} className="text-blue-600 ml-1 inline" />;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Motion Library</h1>
            <p className="text-sm text-gray-500">Searchable library of {motions.length} legal motion templates</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><div className="flex items-center gap-3"><FileText size={20} className="text-blue-600" /><div><p className="text-sm text-gray-500">Total Motions</p><p className="text-2xl font-bold">{motions.length}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><Scale size={20} className="text-purple-600" /><div><p className="text-sm text-gray-500">Motion Types</p><p className="text-2xl font-bold">{MOTION_TYPES.length - 1}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><BookOpen size={20} className="text-green-600" /><div><p className="text-sm text-gray-500">Jurisdictions</p><p className="text-2xl font-bold">2</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><Download size={20} className="text-orange-600" /><div><p className="text-sm text-gray-500">Templates</p><p className="text-2xl font-bold">{motions.length}</p></div></div></Card>
      </div>

      <Card>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search motions..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {MOTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 text-gray-500 font-medium cursor-pointer" onClick={() => handleSort('title')}>Motion Title <SortIcon field="title" /></th>
                <th className="text-left py-3 px-3 text-gray-500 font-medium cursor-pointer" onClick={() => handleSort('motionType')}>Motion Type <SortIcon field="motionType" /></th>
                <th className="text-left py-3 px-3 text-gray-500 font-medium">Applicable Charges</th>
                <th className="text-left py-3 px-3 text-gray-500 font-medium cursor-pointer" onClick={() => handleSort('jurisdiction')}>Jurisdiction <SortIcon field="jurisdiction" /></th>
                <th className="text-left py-3 px-3 text-gray-500 font-medium">Summary</th>
                <th className="text-center py-3 px-3 text-gray-500 font-medium">Template</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(motion => (
                <tr key={motion.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-medium text-gray-900">{motion.title}</td>
                  <td className="py-3 px-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">{motion.motionType}</span></td>
                  <td className="py-3 px-3 text-gray-600 text-xs max-w-[150px]">{motion.applicableCharges}</td>
                  <td className="py-3 px-3 text-gray-600 text-xs">{motion.jurisdiction}</td>
                  <td className="py-3 px-3 text-gray-500 text-xs max-w-[250px] truncate">{motion.summary}</td>
                  <td className="py-3 px-3 text-center"><button className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100 transition-colors"><Download size={10} /> Download</button></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-gray-500">No motions match the current filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
