// =============================================================================
// CourtAccess — Master Component Library (Program 18)
// Single import surface for the entire design system.
// =============================================================================

// Core UI primitives
export * from './ui';

// Brand
export { BrandLogo } from './brand/BrandLogo';
export { TrustBar } from './brand/TrustBar';

// Iconography (Program 19)
export { Icon, ICON_REGISTRY, ICON_LABELS, ICON_VARIANT_CLASS, type IconName, type IconVariant } from './icons/registry';

// Intelligence panels (Program 8)
export { IntelligencePanel, IntelligenceGrid, PANEL_META } from './intelligence/IntelligencePanel';

// Indicators
export {
  ConfidenceIndicator,
  RiskIndicator,
  StatusBadge,
  OcrStatus,
  EvidenceStatus,
  HumanReviewBanner,
  UnknownIndicator,
  CitationIndicator,
} from './indicators/indicators';

// Cards
export { ExpandableCard } from './cards/ExpandableCard';
export {
  ProgressCard,
  TimelineCard,
  EvidenceCard,
  DocumentCard,
  WitnessCard,
  AuthorityCard,
  ReportCard,
} from './cards/domain-cards';

// Data
export { DataTable, Pagination, type Column } from './data/data-table';

// Charts & containers
export { Sparkline, BarChart, DonutChart, KnowledgeGraphContainer, TimelineContainer } from './charts/charts';

// Layout
export { SplitPane } from './layout/split-pane';

// Global search (Program 25)
export { GlobalSearchProvider, useGlobalSearch } from './search/GlobalSearch';
export { SearchResultRow } from './search/SearchResultRow';

// Timeline engine (Program 26)
export { TimelineEngine, fromApiTimelineEvents, fromGenericEvents } from './timeline';
export type { TimelineEvent, TimelineVariant, TimelineGrouping } from './timeline';

// Knowledge Graph engine (Program 27)
export { KnowledgeGraph, KnowledgeGraphWorkspace, NodeDetailPanel, fromWorkbenchGraph, SAMPLE_GRAPH, analyzeGraph } from './graph';
export type { GraphNode, GraphEdge, GraphNodeType, KnowledgeGraphData } from './graph';
