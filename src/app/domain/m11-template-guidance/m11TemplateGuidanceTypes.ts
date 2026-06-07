export interface M11SectionGuidanceSourceReference {
  templatePage?: number;
  sourceText?: string;
}

export interface M11SectionGuidance {
  sectionId: string;
  sectionTitle: string;
  headingOnly: boolean;
  guidanceText: string[];
  insertionPrompts: string[];
  controlledTerminologyPrompts: string[];
  optionalityNotes: string[];
  conditionalityNotes: string[];
  notApplicableGuidance?: string;
  tableGuidance?: string[];
  sourceReference?: M11SectionGuidanceSourceReference;
  /** When true, guidance UI is suppressed (Title Page, Amendment Details, SoA). */
  excludedFromGuidanceUi?: boolean;
  /** Optional section per M11 conformance metadata. */
  optionalSection?: boolean;
  /** User may insert "Not applicable." when section does not apply. */
  allowsNotApplicable?: boolean;
}

export type M11TemplateGuidanceCatalog = ReadonlyMap<string, M11SectionGuidance>;
