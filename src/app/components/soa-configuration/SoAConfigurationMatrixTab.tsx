import { GeneratedSoAMatrix } from './GeneratedSoAMatrix';

interface SoAConfigurationMatrixTabProps {
  onCellClick: (visitId: string, assessmentId: string) => void;
}

export function SoAConfigurationMatrixTab({ onCellClick }: SoAConfigurationMatrixTabProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 h-[calc(100vh-11rem)] rounded-lg border overflow-hidden">
      <GeneratedSoAMatrix onCellClick={onCellClick} />
    </div>
  );
}
