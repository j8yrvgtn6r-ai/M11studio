import type { FieldDefinition } from '../../../types/protocol';
import type { ValidationAgentOutput } from '../../../agents/validationRules';
import { resolveControlledTerminologyMessage } from '../../../agents/validationRules';
import { validateM11ControlledTerm } from '../ichM11/ichM11ControlledTerminology';
import {
  isTitlePageFieldVisible,
  listVisibleTitlePageFieldSpecs,
  normalizeTitlePageFieldValue,
  readTitlePageFieldValues,
  TITLE_PAGE_FIELD_CATALOG,
  TITLE_PAGE_FIELD_SPECS_BY_ID,
  TITLE_PAGE_SECTION_ID,
  type TitlePageFieldSpec,
} from './titlePageModel';

export interface TitlePageValidationFinding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  fieldId?: string;
  ruleId?: string;
}

export interface TitlePageValidationResult {
  findings: TitlePageValidationFinding[];
  status: 'failed' | 'proposed' | 'passed';
  visibleFieldIds: string[];
  missingRequiredFieldIds: string[];
}

function isFieldValuePresent(spec: TitlePageFieldSpec, value: unknown): boolean {
  if (spec.repeatable || spec.cardinality === 'one_to_many') {
    const entries = Array.isArray(value) ? value : value ? [value] : [];
    return entries.some((entry) => normalizeTitlePageFieldValue(entry).length > 0);
  }
  return normalizeTitlePageFieldValue(value).length > 0;
}

function evaluateRule(
  ruleId: string,
  spec: TitlePageFieldSpec,
  values: Record<string, unknown>,
): TitlePageValidationFinding[] {
  const findings: TitlePageValidationFinding[] = [];
  const value = values[spec.id];
  const visible = isTitlePageFieldVisible(spec, values);

  switch (ruleId) {
    case 'must_not_be_blank':
    case 'must_have_at_least_one_non_space_character':
      if (spec.conformance === 'required' && !isFieldValuePresent(spec, value)) {
        findings.push({
          code: 'required_field_missing',
          severity: 'error',
          message: `${spec.label} is required.`,
          fieldId: spec.id,
          ruleId,
        });
      }
      break;
    case 'required_when_visible':
      if (visible && spec.conformance === 'conditional' && !isFieldValuePresent(spec, value)) {
        findings.push({
          code: 'conditional_field_missing',
          severity: 'error',
          message: `${spec.label} is required when visible.`,
          fieldId: spec.id,
          ruleId,
        });
      }
      break;
    case 'controlled_terminology_required':
      if (spec.conformance === 'required' && !isFieldValuePresent(spec, value)) {
        findings.push({
          code: 'required_field_missing',
          severity: 'error',
          message: `${spec.label} is required.`,
          fieldId: spec.id,
          ruleId,
        });
      }
      break;
    case 'if_no_then_amendment_fields_required': {
      const original = normalizeTitlePageFieldValue(values['title_page.original_protocol_indicator']);
      if (['No', 'C49487'].includes(original)) {
        for (const dependentId of ['title_page.amendment_identifier', 'title_page.amendment_scope']) {
          const dependent = TITLE_PAGE_FIELD_SPECS_BY_ID[dependentId as keyof typeof TITLE_PAGE_FIELD_SPECS_BY_ID];
          if (dependent && !isFieldValuePresent(dependent, values[dependentId])) {
            findings.push({
              code: 'conditional_field_missing',
              severity: 'error',
              message: `${dependent.label} is required when Original Protocol is No.`,
              fieldId: dependentId,
              ruleId,
            });
          }
        }
      }
      break;
    }
    case 'if_not_global_then_scope_identifiers_required': {
      const scope = normalizeTitlePageFieldValue(values['title_page.amendment_scope']);
      if (scope === 'Not Global' || scope === 'C217026') {
        for (const dependentId of [
          'title_page.country_identifier',
          'title_page.region_identifier',
          'title_page.site_identifier',
        ]) {
          const dependent = TITLE_PAGE_FIELD_SPECS_BY_ID[dependentId as keyof typeof TITLE_PAGE_FIELD_SPECS_BY_ID];
          if (dependent && isTitlePageFieldVisible(dependent, values) && !isFieldValuePresent(dependent, values[dependentId])) {
            findings.push({
              code: 'conditional_field_missing',
              severity: 'error',
              message: `${dependent.label} is required when Amendment Scope is Not Global.`,
              fieldId: dependentId,
              ruleId,
            });
          }
        }
      }
      break;
    }
    default:
      break;
  }

  return findings;
}

/** Metadata-driven Title Page validation derived from M11 field conformance and rules. */
export function validateTitlePageModel(fields: FieldDefinition[]): TitlePageValidationResult {
  const titleFields = fields.filter((field) => field.sectionId === TITLE_PAGE_SECTION_ID);
  const values = readTitlePageFieldValues(titleFields);
  const visibleSpecs = listVisibleTitlePageFieldSpecs(values);
  const findings: TitlePageValidationFinding[] = [];
  const missingRequiredFieldIds: string[] = [];

  for (const spec of TITLE_PAGE_FIELD_CATALOG) {
    if (!isTitlePageFieldVisible(spec, values)) {
      continue;
    }

    if (spec.conformance === 'required' && !isFieldValuePresent(spec, values[spec.id])) {
      missingRequiredFieldIds.push(spec.id);
      findings.push({
        code: 'required_field_missing',
        severity: 'error',
        message: `${spec.label} is required.`,
        fieldId: spec.id,
        ruleId: 'conformance_required',
      });
    }

    for (const ruleId of spec.validationRuleIds) {
      findings.push(...evaluateRule(ruleId, spec, values));
    }

    if (spec.controlledTerminologyCodeList && isFieldValuePresent(spec, values[spec.id])) {
      const result = validateM11ControlledTerm(
        spec.controlledTerminologyCodeList,
        normalizeTitlePageFieldValue(values[spec.id]),
      );
      if (!result.valid) {
        findings.push({
          code: 'controlled_terminology_invalid',
          severity: 'error',
          message: `${spec.label}: ${result.message}`,
          fieldId: spec.id,
          ruleId: 'controlled_terminology',
        });
      }
    }
  }

  const deduped = findings.filter(
    (finding, index, list) =>
      list.findIndex(
        (candidate) =>
          candidate.code === finding.code &&
          candidate.fieldId === finding.fieldId &&
          candidate.message === finding.message,
      ) === index,
  );

  const hasError = deduped.some((finding) => finding.severity === 'error');
  return {
    findings: deduped,
    status: hasError ? 'failed' : 'proposed',
    visibleFieldIds: visibleSpecs.map((spec) => spec.id),
    missingRequiredFieldIds,
  };
}

export function buildTitlePageValidationOutput(fields: FieldDefinition[]): ValidationAgentOutput {
  const result = validateTitlePageModel(fields);
  const narrative = titleFieldsToNarrative(fields);

  if (result.status === 'failed') {
    return {
      originalText: narrative,
      validatedText: narrative,
      changes: [],
      findings: result.findings.map((finding) => ({
        code: finding.code,
        severity: finding.severity,
        message: finding.message,
      })),
      terminologySuggestions: [],
      structuralSuggestions: [],
      validationSummary: {
        changeCount: 0,
        findingCount: result.findings.length,
        terminologyCount: 0,
        structuralCount: 0,
        status: 'failed',
      },
    };
  }

  const infoFindings = result.findings.length
    ? result.findings
    : [
        {
          code: 'title_page_structure',
          severity: 'info' as const,
          message: 'Title Page fields satisfy M11 conformance metadata.',
        },
      ];

  return {
    originalText: narrative,
    validatedText: narrative,
    changes: [],
    findings: [
      ...infoFindings.map((finding) => ({
        code: finding.code,
        severity: finding.severity,
        message: finding.message,
      })),
      {
        code: 'controlled_terminology',
        severity: 'info' as const,
        message: resolveControlledTerminologyMessage([]),
      },
    ],
    terminologySuggestions: [],
    structuralSuggestions: [],
    validationSummary: {
      changeCount: 0,
      findingCount: infoFindings.length + 1,
      terminologyCount: 0,
      structuralCount: 0,
      status: 'proposed',
    },
  };
}

/** Serializes visible title page fields in canonical M11 sequence. */
export function titleFieldsToNarrative(fields: FieldDefinition[]): string {
  const titleFields = fields.filter((field) => field.sectionId === TITLE_PAGE_SECTION_ID);
  const values = readTitlePageFieldValues(titleFields);
  const lines: string[] = [];

  for (const spec of TITLE_PAGE_FIELD_CATALOG) {
    if (!isTitlePageFieldVisible(spec, values)) {
      continue;
    }
    const raw = values[spec.id];
    const rendered = Array.isArray(raw)
      ? raw.map((entry) => normalizeTitlePageFieldValue(entry)).filter(Boolean).join('; ')
      : normalizeTitlePageFieldValue(raw);
    if (rendered) {
      lines.push(`${spec.label}: ${rendered}`);
    }
  }

  return lines.join('\n');
}
