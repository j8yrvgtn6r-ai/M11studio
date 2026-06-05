import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { SoAConfigurationScheduleRulesPlaceholder } from './SoAConfigurationScheduleRulesPlaceholder';
import { SoAConfigurationVisitsSchedulePanel } from './SoAConfigurationVisitsSchedulePanel';

export function SoAConfigurationVisitsTab() {
  return (
    <Tabs defaultValue="schedule" className="gap-4">
      <TabsList>
        <TabsTrigger value="schedule">Schedule</TabsTrigger>
        <TabsTrigger value="schedule-rules">Schedule Rules</TabsTrigger>
      </TabsList>
      <TabsContent value="schedule" className="mt-0 outline-none">
        <SoAConfigurationVisitsSchedulePanel />
      </TabsContent>
      <TabsContent value="schedule-rules" className="mt-0 outline-none">
        <SoAConfigurationScheduleRulesPlaceholder />
      </TabsContent>
    </Tabs>
  );
}
