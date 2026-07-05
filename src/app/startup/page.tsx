import { ModuleView } from "@/components/ModuleView";

export const metadata = { title: "Startup Intelligence — Argus" };

export default function StartupPage() {
  return (
    <ModuleView
      module="startup"
      title="Startup Intelligence"
      subtitle="Trending GitHub repositories (README rendered in-app), Hacker News launches"
      refreshSeconds={600}
    />
  );
}
