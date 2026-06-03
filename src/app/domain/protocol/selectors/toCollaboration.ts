import type { AuditEvent, Comment } from '../../../types/protocol';
import type { ProtocolDocument } from '../types';

/** Match legacy mockData Date parsing (local time, no Z suffix). */
export function toLegacyDate(timestamp: string): Date {
  const normalized = timestamp.replace('.000Z', '').replace('Z', '');
  return new Date(normalized);
}

export function selectComments(document: ProtocolDocument): Comment[] {
  return document.collaboration.comments.map(
    ({ id, timestamp, user, sectionId, elementId, content, resolved }) => ({
      id,
      timestamp: toLegacyDate(timestamp),
      user,
      sectionId,
      ...(elementId !== undefined ? { fieldId: elementId } : {}),
      content,
      resolved,
    })
  );
}

export function selectAuditEvents(document: ProtocolDocument): AuditEvent[] {
  return document.collaboration.auditEvents.map(
    ({ id, timestamp, user, action, sectionId, elementId, details }) => ({
      id,
      timestamp: toLegacyDate(timestamp),
      user,
      action,
      ...(sectionId !== undefined ? { sectionId } : {}),
      ...(elementId !== undefined ? { fieldId: elementId } : {}),
      details,
    })
  );
}
