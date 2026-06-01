export type NodeType =
  | 'objective'
  | 'endpoint'
  | 'estimand'
  | 'assessment'
  | 'visit'
  | 'soa-row'
  | 'study-arm'
  | 'population'
  | 'eligibility'
  | 'intervention'
  | 'statistical-analysis'
  | 'biomarker'
  | 'safety-assessment'
  | 'protocol-section';

export type NodeStatus = 'complete' | 'incomplete' | 'validation-issue' | 'ai-recommendation' | 'recently-modified';

export interface DependencyNode {
  id: string;
  type: NodeType;
  name: string;
  status: NodeStatus[];
  sectionId?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ImpactAnalysis {
  directImpacts: string[];
  indirectImpacts: string[];
  affectedSections: string[];
}

export type GraphViewMode = 'protocol-structure' | 'clinical-design' | 'regulatory';

export interface GraphFilters {
  nodeTypes: NodeType[];
  statusFilters: NodeStatus[];
  searchQuery: string;
}
