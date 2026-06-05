/**
 * Static ICH M11 Template (CeSHarP) section hierarchy from:
 * ICH_Step4_M11_Final_Template_2025_1119.pdf
 * — Clinical Electronic Structured Harmonised Protocol (CeSHarP), M11 Template (Final, adopted 19 Nov 2025)
 *
 * Used as the authoritative source for Protocol Explorer structure.
 */

import type { IchM11SectionSpec, IchM11SourceDocumentMeta } from './types';

export const ICH_M11_TEMPLATE_META: IchM11SourceDocumentMeta = {
  documentKind: 'template',
  title: 'Clinical Electronic Structured Harmonised Protocol (CeSHarP), M11 Template',
  version: 'Final',
  status: 'static-local',
  sourceFilename: 'ICH_Step4_M11_Final_Template_2025_1119.pdf',
  adoptedDate: '2025-11-19',
  loadedAt: '2026-06-04T12:00:00.000Z',
  description:
    'Authoritative Table of Contents for Protocol Explorer. Section 1.3 defines Schedule of Activities requirements (procedures per visit/participant contact, eligibility/randomization/stratification/discontinuation tests, allowable windows).',
  incompleteAreas: [
    'Placeholder objective slots (<#>) are represented as single template nodes; repeating instances are not expanded.',
    'Appendix 12.X is a single placeholder node for additional appendices.',
    'Element-level data definitions from the PDF are not extracted into protocol elements.',
    'Country/region-specific appendix variants are not expanded beyond template headings.',
  ],
};

/** Section 1.3 — SoA authoring guidance from the template (display only). */
export const ICH_M11_TEMPLATE_SECTION_13_GUIDANCE =
  'The Schedule of Activities must capture procedures at each trial visit and all participant contact, including tests used for eligibility, randomization, stratification, or decisions on trial intervention discontinuation. Allowable windows should be stated for all visits and procedures.';

type SpecInput = {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
  sectionType?: IchM11SectionSpec['sectionType'];
  conformance?: IchM11SectionSpec['conformance'];
  metadata?: Record<string, unknown>;
};

function body(
  { id, title, parentId, order, sectionType = 'body', conformance = 'required', metadata }: SpecInput,
): IchM11SectionSpec {
  return {
    id,
    number: id,
    title,
    sectionType,
    parentId,
    order,
    conformance,
    metadata,
  };
}

function instruction(id: string, title: string, parentId: string | null, order: number): IchM11SectionSpec {
  return body({
    id,
    title,
    parentId,
    order,
    sectionType: 'template-instruction',
    conformance: 'optional',
    metadata: { protocolRole: 'instruction' },
  });
}

function appendix(id: string, title: string, parentId: string | null, order: number): IchM11SectionSpec {
  return body({
    id,
    title,
    parentId,
    order,
    sectionType: 'appendix',
    metadata: { protocolRole: 'appendix' },
  });
}

function frontMatter(
  id: string,
  title: string,
  order: number,
  conformance: IchM11SectionSpec['conformance'] = 'required',
): IchM11SectionSpec {
  return body({ id, title, parentId: null, order, sectionType: 'front-matter', conformance });
}

const foreword: IchM11SectionSpec[] = [
  instruction('0', '0 Foreword', null, 0),
  instruction('0.1', '0.1 Template Revision History', '0', 1),
  instruction('0.2', '0.2 Intended Use of Template', '0', 2),
  instruction('0.3', '0.3 Template Conventions and General Instructions', '0', 3),
  instruction('0.4', '0.4 Abbreviations Used in This Template', '0', 4),
];

const front: IchM11SectionSpec[] = [
  frontMatter('title', 'Title Page', 10),
  frontMatter('amendment', 'Amendment Details', 11, 'conditional'),
];

const section1: IchM11SectionSpec[] = [
  body({ id: '1', title: '1 PROTOCOL SUMMARY', parentId: null, order: 20 }),
  body({ id: '1.1', title: '1.1 Protocol Synopsis', parentId: '1', order: 1 }),
  body({ id: '1.1.1', title: '1.1.1 Primary and Secondary Objectives and Estimands', parentId: '1.1', order: 1 }),
  body({ id: '1.1.2', title: '1.1.2 Overall Design', parentId: '1.1', order: 2 }),
  body({ id: '1.2', title: '1.2 Trial Schema', parentId: '1', order: 2 }),
  body({
    id: '1.3',
    title: '1.3 Schedule of Activities',
    parentId: '1',
    order: 3,
    metadata: {
      viewKind: 'schedule-of-activities',
      templateGuidance: ICH_M11_TEMPLATE_SECTION_13_GUIDANCE,
    },
  }),
];

const section2: IchM11SectionSpec[] = [
  body({ id: '2', title: '2 INTRODUCTION', parentId: null, order: 30 }),
  body({ id: '2.1', title: '2.1 Purpose of Trial', parentId: '2', order: 1 }),
  body({ id: '2.2', title: '2.2 Assessment of Risks and Benefits', parentId: '2', order: 2 }),
  body({ id: '2.2.1', title: '2.2.1 Risk Summary and Mitigation Strategy', parentId: '2.2', order: 1 }),
  body({ id: '2.2.2', title: '2.2.2 Benefit Summary', parentId: '2.2', order: 2 }),
  body({ id: '2.2.3', title: '2.2.3 Overall Risk-Benefit Assessment', parentId: '2.2', order: 3 }),
];

const section3: IchM11SectionSpec[] = [
  body({ id: '3', title: '3 TRIAL OBJECTIVES AND ASSOCIATED ESTIMANDS', parentId: null, order: 40 }),
  body({ id: '3.1', title: '3.1 Primary Objective(s) and Associated Estimand(s)', parentId: '3', order: 1 }),
  body({ id: '3.1.1', title: '3.1.1 Primary Objective <#>', parentId: '3.1', order: 1 }),
  body({ id: '3.2', title: '3.2 Secondary Objective(s) and Associated Estimand(s)', parentId: '3', order: 2 }),
  body({ id: '3.2.1', title: '3.2.1 Secondary Objective <#>', parentId: '3.2', order: 1 }),
  body({ id: '3.3', title: '3.3 Exploratory Objective(s)', parentId: '3', order: 3, conformance: 'optional' }),
  body({ id: '3.3.1', title: '3.3.1 Exploratory Objective <#>', parentId: '3.3', order: 1, conformance: 'optional' }),
];

const section4: IchM11SectionSpec[] = [
  body({ id: '4', title: '4 TRIAL DESIGN', parentId: null, order: 50 }),
  body({ id: '4.1', title: '4.1 Description of Trial Design', parentId: '4', order: 1 }),
  body({ id: '4.1.1', title: '4.1.1 Stakeholder Input into Design', parentId: '4.1', order: 1 }),
  body({ id: '4.2', title: '4.2 Rationale for Trial Design', parentId: '4', order: 2 }),
  body({ id: '4.2.1', title: '4.2.1 Rationale for Estimand(s)', parentId: '4.2', order: 1 }),
  body({ id: '4.2.2', title: '4.2.2 Rationale for Intervention Model', parentId: '4.2', order: 2 }),
  body({ id: '4.2.3', title: '4.2.3 Rationale for Control Type', parentId: '4.2', order: 3 }),
  body({ id: '4.2.4', title: '4.2.4 Rationale for Trial Duration', parentId: '4.2', order: 4 }),
  body({ id: '4.2.5', title: '4.2.5 Rationale for Adaptive or Novel Trial Design', parentId: '4.2', order: 5 }),
  body({ id: '4.2.6', title: '4.2.6 Rationale for Interim Analysis', parentId: '4.2', order: 6 }),
  body({ id: '4.2.7', title: '4.2.7 Rationale for Other Trial Design Aspects', parentId: '4.2', order: 7 }),
  body({ id: '4.3', title: '4.3 Trial Stopping Rules', parentId: '4', order: 3 }),
  body({ id: '4.4', title: '4.4 Start of Trial and End of Trial', parentId: '4', order: 4 }),
  body({ id: '4.5', title: '4.5 Access to Trial Intervention After End of Trial', parentId: '4', order: 5 }),
];

const section5: IchM11SectionSpec[] = [
  body({ id: '5', title: '5 TRIAL POPULATION', parentId: null, order: 60 }),
  body({ id: '5.1', title: '5.1 Description of Trial Population and Rationale', parentId: '5', order: 1 }),
  body({ id: '5.2', title: '5.2 Inclusion Criteria', parentId: '5', order: 2 }),
  body({ id: '5.3', title: '5.3 Exclusion Criteria', parentId: '5', order: 3 }),
  body({ id: '5.4', title: '5.4 Contraception', parentId: '5', order: 4 }),
  body({ id: '5.4.1', title: '5.4.1 Definitions Related to Childbearing Potential', parentId: '5.4', order: 1 }),
  body({ id: '5.4.2', title: '5.4.2 Contraception Requirements', parentId: '5.4', order: 2 }),
  body({ id: '5.5', title: '5.5 Lifestyle Restrictions', parentId: '5', order: 5 }),
  body({ id: '5.5.1', title: '5.5.1 Meals and Dietary Restrictions', parentId: '5.5', order: 1 }),
  body({ id: '5.5.2', title: '5.5.2 Caffeine, Alcohol, Tobacco, and Other Restrictions', parentId: '5.5', order: 2 }),
  body({ id: '5.5.3', title: '5.5.3 Physical Activity Restrictions', parentId: '5.5', order: 3 }),
  body({ id: '5.5.4', title: '5.5.4 Other Activity Restrictions', parentId: '5.5', order: 4 }),
  body({ id: '5.6', title: '5.6 Screen Failure and Rescreening', parentId: '5', order: 6 }),
];

const section6: IchM11SectionSpec[] = [
  body({ id: '6', title: '6 TRIAL INTERVENTION AND CONCOMITANT THERAPY', parentId: null, order: 70 }),
  body({ id: '6.1', title: '6.1 Description of Investigational Trial Intervention', parentId: '6', order: 1 }),
  body({ id: '6.2', title: '6.2 Rationale for Investigational Trial Intervention Dose and Regimen', parentId: '6', order: 2 }),
  body({ id: '6.3', title: '6.3 Investigational Trial Intervention Administration', parentId: '6', order: 3 }),
  body({ id: '6.4', title: '6.4 Investigational Trial Intervention Dose Modification', parentId: '6', order: 4 }),
  body({ id: '6.5', title: '6.5 Management of Investigational Trial Intervention Overdose', parentId: '6', order: 5 }),
  body({ id: '6.6', title: '6.6 Preparation, Storage, Handling and Accountability of Investigational Trial Intervention', parentId: '6', order: 6 }),
  body({ id: '6.6.1', title: '6.6.1 Preparation of Investigational Trial Intervention', parentId: '6.6', order: 1 }),
  body({ id: '6.6.2', title: '6.6.2 Storage and Handling of Investigational Trial Intervention', parentId: '6.6', order: 2 }),
  body({ id: '6.6.3', title: '6.6.3 Accountability of Investigational Trial Intervention', parentId: '6.6', order: 3 }),
  body({ id: '6.7', title: '6.7 Investigational Trial Intervention Assignment, Randomisation and Blinding', parentId: '6', order: 7 }),
  body({ id: '6.7.1', title: '6.7.1 Participant Assignment to Investigational Trial Intervention', parentId: '6.7', order: 1 }),
  body({ id: '6.7.2', title: '6.7.2 Randomisation', parentId: '6.7', order: 2 }),
  body({ id: '6.7.3', title: '6.7.3 Measures to Maintain Blinding', parentId: '6.7', order: 3 }),
  body({ id: '6.7.4', title: '6.7.4 Emergency Unblinding at the Site', parentId: '6.7', order: 4 }),
  body({ id: '6.8', title: '6.8 Investigational Trial Intervention Adherence', parentId: '6', order: 8 }),
  body({ id: '6.9', title: '6.9 Description of Noninvestigational Trial Intervention', parentId: '6', order: 9 }),
  body({ id: '6.9.1', title: '6.9.1 Background Trial Intervention', parentId: '6.9', order: 1 }),
  body({ id: '6.9.2', title: '6.9.2 Rescue Therapy', parentId: '6.9', order: 2 }),
  body({ id: '6.9.3', title: '6.9.3 Other Noninvestigational Trial Intervention', parentId: '6.9', order: 3 }),
  body({ id: '6.10', title: '6.10 Concomitant Therapy', parentId: '6', order: 10 }),
  body({ id: '6.10.1', title: '6.10.1 Prohibited Concomitant Therapy', parentId: '6.10', order: 1 }),
  body({ id: '6.10.2', title: '6.10.2 Permitted Concomitant Therapy', parentId: '6.10', order: 2 }),
];

const section7: IchM11SectionSpec[] = [
  body({
    id: '7',
    title: '7 PARTICIPANT DISCONTINUATION OF TRIAL INTERVENTION AND DISCONTINUATION OR WITHDRAWAL FROM TRIAL',
    parentId: null,
    order: 80,
  }),
  body({ id: '7.1', title: '7.1 Discontinuation of Trial Intervention for Individual Participants', parentId: '7', order: 1 }),
  body({ id: '7.1.1', title: '7.1.1 Permanent Discontinuation of Trial Intervention', parentId: '7.1', order: 1 }),
  body({ id: '7.1.2', title: '7.1.2 Temporary Discontinuation of Trial Intervention', parentId: '7.1', order: 2 }),
  body({ id: '7.1.3', title: '7.1.3 Rechallenge', parentId: '7.1', order: 3 }),
  body({ id: '7.2', title: '7.2 Participant Discontinuation or Withdrawal from the Trial', parentId: '7', order: 2 }),
  body({ id: '7.3', title: '7.3 Management of Loss to Follow-Up', parentId: '7', order: 3 }),
];

const section8: IchM11SectionSpec[] = [
  body({ id: '8', title: '8 TRIAL ASSESSMENTS AND PROCEDURES', parentId: null, order: 90 }),
  body({ id: '8.1', title: '8.1 Trial Assessments and Procedures Considerations', parentId: '8', order: 1 }),
  body({ id: '8.2', title: '8.2 Screening/Baseline Assessments and Procedures', parentId: '8', order: 2 }),
  body({ id: '8.3', title: '8.3 Efficacy Assessments and Procedures', parentId: '8', order: 3 }),
  body({ id: '8.4', title: '8.4 Safety Assessments and Procedures', parentId: '8', order: 4 }),
  body({ id: '8.4.1', title: '8.4.1 Physical Examination', parentId: '8.4', order: 1 }),
  body({ id: '8.4.2', title: '8.4.2 Vital Signs', parentId: '8.4', order: 2 }),
  body({ id: '8.4.3', title: '8.4.3 Electrocardiograms', parentId: '8.4', order: 3 }),
  body({ id: '8.4.4', title: '8.4.4 Clinical Laboratory Assessments', parentId: '8.4', order: 4 }),
  body({ id: '8.4.5', title: '8.4.5 Pregnancy Testing', parentId: '8.4', order: 5 }),
  body({ id: '8.4.6', title: '8.4.6 Suicidal Ideation and Behaviour Risk Monitoring', parentId: '8.4', order: 6 }),
  body({ id: '8.5', title: '8.5 Pharmacokinetics', parentId: '8', order: 5, conformance: 'conditional' }),
  body({ id: '8.6', title: '8.6 Biomarkers', parentId: '8', order: 6, conformance: 'conditional' }),
  body({ id: '8.6.1', title: '8.6.1 Genetics, Genomics, Pharmacogenetics, and Pharmacogenomics', parentId: '8.6', order: 1 }),
  body({ id: '8.6.2', title: '8.6.2 Pharmacodynamic Biomarkers', parentId: '8.6', order: 2 }),
  body({ id: '8.6.3', title: '8.6.3 Other Biomarkers', parentId: '8.6', order: 3 }),
  body({ id: '8.7', title: '8.7 Immunogenicity Assessments', parentId: '8', order: 7, conformance: 'conditional' }),
  body({
    id: '8.8',
    title: '8.8 Medical Resource Utilisation and Health Economics',
    parentId: '8',
    order: 8,
    conformance: 'conditional',
  }),
];

const section9: IchM11SectionSpec[] = [
  body({
    id: '9',
    title:
      '9 ADVERSE EVENTS, SERIOUS ADVERSE EVENTS, PRODUCT COMPLAINTS, PREGNANCY AND POSTPARTUM INFORMATION, AND SPECIAL SAFETY SITUATIONS',
    parentId: null,
    order: 100,
  }),
  body({ id: '9.1', title: '9.1 Definitions', parentId: '9', order: 1 }),
  body({ id: '9.1.1', title: '9.1.1 Definitions of Adverse Events', parentId: '9.1', order: 1 }),
  body({ id: '9.1.2', title: '9.1.2 Definitions of Serious Adverse Events', parentId: '9.1', order: 2 }),
  body({ id: '9.1.3', title: '9.1.3 Definitions of Product Complaints', parentId: '9.1', order: 3 }),
  body({ id: '9.1.3.1', title: '9.1.3.1 Definitions of Medical Device Product Complaints', parentId: '9.1.3', order: 1 }),
  body({ id: '9.2', title: '9.2 Timing and Procedures for Collection and Reporting', parentId: '9', order: 2 }),
  body({ id: '9.2.1', title: '9.2.1 Timing', parentId: '9.2', order: 1 }),
  body({ id: '9.2.2', title: '9.2.2 Collection Procedures', parentId: '9.2', order: 2 }),
  body({ id: '9.2.3', title: '9.2.3 Reporting', parentId: '9.2', order: 3 }),
  body({ id: '9.2.3.1', title: '9.2.3.1 Regulatory Reporting Requirements', parentId: '9.2.3', order: 1 }),
  body({ id: '9.2.4', title: '9.2.4 Adverse Events of Special Interest', parentId: '9.2', order: 4 }),
  body({ id: '9.2.5', title: '9.2.5 Disease-Related Events or Outcomes Not Qualifying as AEs or SAEs', parentId: '9.2', order: 5 }),
  body({ id: '9.3', title: '9.3 Pregnancy and Postpartum Information', parentId: '9', order: 3 }),
  body({ id: '9.3.1', title: '9.3.1 Participants Who Become Pregnant During the Trial', parentId: '9.3', order: 1 }),
  body({ id: '9.3.2', title: '9.3.2 Participants Whose Partners Become Pregnant During the Trial', parentId: '9.3', order: 2 }),
  body({ id: '9.4', title: '9.4 Special Safety Situations', parentId: '9', order: 4 }),
];

const section10: IchM11SectionSpec[] = [
  body({ id: '10', title: '10 STATISTICAL CONSIDERATIONS', parentId: null, order: 110 }),
  body({ id: '10.1', title: '10.1 General Considerations', parentId: '10', order: 1 }),
  body({ id: '10.2', title: '10.2 Analysis Sets', parentId: '10', order: 2 }),
  body({ id: '10.3', title: '10.3 Analyses of Demographics and Other Baseline Variables', parentId: '10', order: 3 }),
  body({ id: '10.4', title: '10.4 Analyses Associated with the Primary Objective(s)', parentId: '10', order: 4 }),
  body({ id: '10.4.1', title: '10.4.1 Primary Objective <#>', parentId: '10.4', order: 1 }),
  body({ id: '10.4.1.1', title: '10.4.1.1 Statistical Analysis Method', parentId: '10.4.1', order: 1 }),
  body({ id: '10.4.1.2', title: '10.4.1.2 Handling of Data in Relation to Primary Estimand(s)', parentId: '10.4.1', order: 2 }),
  body({ id: '10.4.1.3', title: '10.4.1.3 Handling of Missing Data in Relation to Primary Estimand(s)', parentId: '10.4.1', order: 3 }),
  body({ id: '10.4.1.4', title: '10.4.1.4 Sensitivity Analysis', parentId: '10.4.1', order: 4 }),
  body({ id: '10.4.1.5', title: '10.4.1.5 Supplementary Analysis', parentId: '10.4.1', order: 5 }),
  body({ id: '10.5', title: '10.5 Analyses Associated with the Secondary Objective(s)', parentId: '10', order: 5 }),
  body({ id: '10.5.1', title: '10.5.1 Secondary Objective <#>', parentId: '10.5', order: 1 }),
  body({ id: '10.5.1.1', title: '10.5.1.1 Statistical Analysis Method', parentId: '10.5.1', order: 1 }),
  body({ id: '10.5.1.2', title: '10.5.1.2 Handling of Data in Relation to Secondary Estimand(s)', parentId: '10.5.1', order: 2 }),
  body({ id: '10.5.1.3', title: '10.5.1.3 Handling of Missing Data in Relation to Secondary Estimand(s)', parentId: '10.5.1', order: 3 }),
  body({ id: '10.5.1.4', title: '10.5.1.4 Sensitivity Analysis', parentId: '10.5.1', order: 4 }),
  body({ id: '10.5.1.5', title: '10.5.1.5 Supplementary Analysis', parentId: '10.5.1', order: 5 }),
  body({ id: '10.6', title: '10.6 Analyses Associated with the Exploratory Objective(s)', parentId: '10', order: 6, conformance: 'optional' }),
  body({ id: '10.7', title: '10.7 Safety Analyses', parentId: '10', order: 7 }),
  body({ id: '10.8', title: '10.8 Other Analyses', parentId: '10', order: 8, conformance: 'optional' }),
  body({ id: '10.9', title: '10.9 Interim Analyses', parentId: '10', order: 9, conformance: 'conditional' }),
  body({ id: '10.10', title: '10.10 Multiplicity Adjustments', parentId: '10', order: 10 }),
  body({ id: '10.11', title: '10.11 Sample Size Determination', parentId: '10', order: 11 }),
];

const section11: IchM11SectionSpec[] = [
  body({ id: '11', title: '11 TRIAL OVERSIGHT AND OTHER GENERAL CONSIDERATIONS', parentId: null, order: 120 }),
  body({ id: '11.1', title: '11.1 Regulatory and Ethical Considerations', parentId: '11', order: 1 }),
  body({ id: '11.2', title: '11.2 Trial Oversight', parentId: '11', order: 2 }),
  body({ id: '11.2.1', title: '11.2.1 Investigator Responsibilities', parentId: '11.2', order: 1 }),
  body({ id: '11.2.2', title: '11.2.2 Sponsor Responsibilities', parentId: '11.2', order: 2 }),
  body({ id: '11.3', title: '11.3 Informed Consent Process', parentId: '11', order: 3 }),
  body({ id: '11.3.1', title: '11.3.1 Informed Consent for Rescreening', parentId: '11.3', order: 1 }),
  body({
    id: '11.3.2',
    title: '11.3.2 Informed Consent for Use of Remaining Samples in Exploratory Research',
    parentId: '11.3',
    order: 2,
  }),
  body({ id: '11.4', title: '11.4 Committees', parentId: '11', order: 4 }),
  body({ id: '11.5', title: '11.5 Insurance and Indemnity', parentId: '11', order: 5 }),
  body({ id: '11.6', title: '11.6 Risk-Based Quality Management', parentId: '11', order: 6 }),
  body({ id: '11.7', title: '11.7 Data Governance', parentId: '11', order: 7 }),
  body({ id: '11.8', title: '11.8 Data Protection', parentId: '11', order: 8 }),
  body({ id: '11.9', title: '11.9 Source Records', parentId: '11', order: 9 }),
  body({ id: '11.10', title: '11.10 Protocol Deviations', parentId: '11', order: 10 }),
  body({ id: '11.11', title: '11.11 Early Site Closure', parentId: '11', order: 11 }),
  body({ id: '11.12', title: '11.12 Data Dissemination', parentId: '11', order: 12 }),
];

const section12to14: IchM11SectionSpec[] = [
  appendix('12', '12 APPENDIX: SUPPORTING DETAILS', null, 130),
  appendix('12.1', '12.1 Clinical Laboratory Tests', '12', 1),
  appendix('12.2', '12.2 Country/Region-Specific Differences', '12', 2),
  appendix('12.3', '12.3 Prior Protocol Amendment(s)', '12', 3),
  appendix('12.x', '12.X Additional Appendices', '12', 4),
  appendix('13', '13 APPENDIX: GLOSSARY OF TERMS AND ABBREVIATIONS', null, 140),
  appendix('14', '14 APPENDIX: REFERENCES', null, 150),
];

/** Flat ordered list — build Protocol Explorer tree via parentId. */
export const ICH_M11_TEMPLATE_SECTION_SPECS: IchM11SectionSpec[] = [
  ...foreword,
  ...front,
  ...section1,
  ...section2,
  ...section3,
  ...section4,
  ...section5,
  ...section6,
  ...section7,
  ...section8,
  ...section9,
  ...section10,
  ...section11,
  ...section12to14,
];

export function countIchM11TemplateSections(
  specs: IchM11SectionSpec[] = ICH_M11_TEMPLATE_SECTION_SPECS,
): number {
  return specs.length;
}

export function getIchM11TemplateSpecById(id: string): IchM11SectionSpec | undefined {
  return ICH_M11_TEMPLATE_SECTION_SPECS.find((spec) => spec.id === id);
}
