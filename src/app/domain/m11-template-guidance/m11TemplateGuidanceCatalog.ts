import type { M11SectionGuidance } from './m11TemplateGuidanceTypes';

/** Explicit ICH M11 Template guidance keyed by protocol section id (ICH_Step4_M11_Final_Template_2025_1119.pdf). */
export const GUIDANCE_SECTION_OVERRIDES: Record<string, Partial<M11SectionGuidance>> = {
  '1': {
    headingOnly: true,
    guidanceText: ['No text is intended here (heading only).'],
    sourceReference: { templatePage: 8, sourceText: '1 PROTOCOL SUMMARY' },
  },
  '1.1': {
    headingOnly: false,
    guidanceText: [
      'The protocol synopsis is a short summary of the key points of the trial.',
      'Cross references to full details in the main body are acceptable.',
    ],
    insertionPrompts: ['Summarize trial purpose, population, interventions, endpoints, and duration.'],
    sourceReference: { templatePage: 8 },
  },
  '1.1.1': {
    guidanceText: [
      'Summarize primary and secondary objectives and associated estimands in natural, nontechnical language.',
      'If objectives and estimands exceed half a page, refer readers to Section 3 for full detail.',
    ],
    insertionPrompts: [
      'Primary objective in plain language',
      'Associated estimand summary',
      'Secondary objectives and estimands',
    ],
    tableGuidance: ['Use estimand attribute tables when the template provides structured slots.'],
  },
  '1.1.2': {
    guidanceText: ['Provide key aspects of the overall trial design in concise summary form.'],
    insertionPrompts: [
      'Intervention',
      'Population type',
      'Intervention model',
      'Control type',
      'Population age',
      'Site distribution / geographic scope',
      'Assignment method',
      'Blinding',
      'Committees',
      'Duration',
    ],
    controlledTerminologyPrompts: [
      'Intervention model',
      'Control type',
      'Trial blinding schema',
      'Trial phase',
    ],
  },
  '1.2': {
    guidanceText: [
      'Provide a visual depiction of trial design, arms, epochs, participant flow, milestones, and explanatory notes.',
    ],
    insertionPrompts: ['Insert or reference trial schema figure/diagram.'],
  },
  '1.3': {
    excludedFromGuidanceUi: true,
    guidanceText: ['Schedule of Activities is authored through the SoA configuration tooling, not narrative text here.'],
  },
  '2': {
    headingOnly: true,
    guidanceText: ['No text is intended here (heading only).'],
  },
  '2.1': {
    guidanceText: [
      'Explain why the trial is needed and why the research question is important.',
      'Do not restate objectives or estimands.',
      'Do not restate the Investigator’s Brochure; cross-reference the IB if applicable.',
    ],
    insertionPrompts: ['State the medical/scientific rationale for conducting this trial.'],
  },
  '2.2': {
    guidanceText: ['Summarize risks, benefits, mitigation strategies, and overall risk-benefit conclusion.'],
  },
  '2.2.1': {
    guidanceText: ['Summarize known and potential risks of trial interventions and procedures and mitigation strategies.'],
  },
  '2.2.2': {
    guidanceText: ['Summarize anticipated benefits to participants and/or society.'],
  },
  '2.2.3': {
    guidanceText: ['Provide the overall risk-benefit assessment for the trial.'],
  },
  '3': {
    headingOnly: true,
    guidanceText: ['No text is intended here (heading only).'],
  },
  '3.1.1': {
    guidanceText: [
      'State the primary objective and associated estimand(s) using the template structure.',
      'Describe estimand attributes (population, variable, intercurrent events, summary measure) clearly.',
    ],
    insertionPrompts: [
      'Primary objective text',
      'Estimand population',
      'Estimand variable / endpoint',
      'Intercurrent event handling',
      'Summary measure',
    ],
    tableGuidance: [
      'Complete estimand characteristics table rows when provided in the template.',
      'Replace template placeholders before finalizing the protocol.',
    ],
    controlledTerminologyPrompts: ['Endpoint type', 'Estimand intercurrent event strategy'],
  },
  '3.2.1': {
    guidanceText: ['State each secondary objective and associated estimand(s) per template structure.'],
    tableGuidance: ['Complete estimand characteristics for each secondary objective instance.'],
  },
  '3.3.1': {
    optionalSection: true,
    allowsNotApplicable: true,
    optionalityNotes: ['Exploratory objectives are optional — include only if applicable.'],
    guidanceText: ['State exploratory objective(s) when applicable.'],
  },
  '4': {
    headingOnly: true,
    guidanceText: ['No text is intended here (heading only).'],
  },
  '4.1': {
    guidanceText: [
      'Describe the trial design including intervention(s), population, control, randomization, blinding, and duration.',
      'Ensure consistency with Sections 1.1.2, 6, and 10.',
    ],
    insertionPrompts: [
      'Trial design overview',
      'Treatment arms and epochs',
      'Randomization and stratification',
      'Blinding approach',
    ],
  },
  '4.2': {
    guidanceText: ['Provide rationale for major trial design choices and link to objectives/estimands where relevant.'],
  },
  '5.2': {
    guidanceText: ['List all inclusion criteria; each criterion should be unambiguous and verifiable at screening.'],
    insertionPrompts: ['Inclusion criterion 1', 'Inclusion criterion 2'],
  },
  '5.3': {
    guidanceText: ['List all exclusion criteria with clear thresholds and timing (screening vs. randomization).'],
    insertionPrompts: ['Exclusion criterion 1', 'Exclusion criterion 2'],
  },
  '8': {
    headingOnly: true,
    guidanceText: ['No text is intended here (heading only).'],
  },
  '8.1': {
    guidanceText: [
      'Describe general considerations for trial assessments and procedures, including timing relative to visits.',
    ],
  },
  '8.2': {
    guidanceText: ['Describe screening and baseline assessments and procedures.'],
  },
  '8.3': {
    guidanceText: ['Describe efficacy assessments and procedures, including methods, timing, and analysis readiness.'],
  },
  '8.4': {
    guidanceText: [
      'Describe safety assessments and procedures performed during the trial.',
      'Include physical examination, vital signs, ECGs, clinical laboratory testing, pregnancy testing, and suicidal ideation monitoring as applicable.',
    ],
    insertionPrompts: [
      'Physical examination schedule and scope',
      'Vital signs collection timepoints',
      'ECG methodology and timing',
      'Clinical laboratory panels and central/local lab approach',
    ],
  },
  '8.4.1': {
    guidanceText: ['Specify physical examination scope, frequency, and clinically significant finding handling.'],
  },
  '8.4.2': {
    guidanceText: ['Specify vital signs parameters, collection conditions, and schedule.'],
  },
  '8.4.3': {
    guidanceText: ['Specify ECG acquisition method, lead configuration, reader/blinding approach, and schedule.'],
  },
  '8.4.4': {
    guidanceText: ['Describe clinical laboratory assessments, panels, fasting requirements, and reference ranges.'],
  },
  '8.5': {
    allowsNotApplicable: true,
    conditionalityNotes: ['Include pharmacokinetics assessments only when applicable to the trial.'],
    guidanceText: ['Describe pharmacokinetic sampling and bioanalytical methods when applicable.'],
  },
  '8.6': {
    allowsNotApplicable: true,
    conditionalityNotes: ['Include biomarker assessments only when applicable.'],
  },
  '10': {
    headingOnly: true,
    guidanceText: ['No text is intended here (heading only).'],
  },
  '10.11': {
    guidanceText: [
      'Provide statistical assumptions, effect size, variability estimates, alpha, power, dropout, and resulting sample size with justification.',
    ],
  },
  '11': {
    headingOnly: true,
    guidanceText: ['No text is intended here (heading only).'],
  },
  '12': {
    headingOnly: true,
    guidanceText: ['No text is intended here (heading only).'],
  },
  '12.3': {
    guidanceText: ['Summarize prior protocol amendments when the current document is not the original protocol.'],
  },
};
