// M11 Studio - Status Color Utilities
import type { StatusType, SeverityType } from '../types/protocol';

export const statusColors = {
  complete: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-600 dark:text-green-400',
    dot: 'bg-green-500',
  },
  inProgress: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  requiredMissing: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  conditionalMissing: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  aiSuggestion: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    text: 'text-violet-600 dark:text-violet-400',
    dot: 'bg-violet-500',
  },
  reusedLinkedContent: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
  amended: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
};

export const severityColors = {
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500',
    text: 'text-red-600 dark:text-red-400',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    icon: 'text-amber-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    icon: 'text-blue-500',
  },
};

export function getStatusColor(status: StatusType) {
  return statusColors[status];
}

export function getSeverityColor(severity: SeverityType) {
  return severityColors[severity];
}

export function getStatusLabel(status: StatusType): string {
  const labels: Record<StatusType, string> = {
    complete: 'Complete',
    inProgress: 'In Progress',
    requiredMissing: 'Required Missing',
    conditionalMissing: 'Conditional Missing',
    aiSuggestion: 'AI Suggestion',
    reusedLinkedContent: 'Reused/Linked',
    amended: 'Amended',
  };
  return labels[status];
}
