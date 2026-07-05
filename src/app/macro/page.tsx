"use client";

// Macro Economics — World Bank headline indicators (keyless), FRED US rates
// and EIA energy prices (free keys). Standard module layout via ModuleView.

import { ModuleView } from "@/components/ModuleView";

export default function MacroPage() {
  return (
    <ModuleView
      module="macro"
      title="Macro Economics"
      subtitle="GDP growth, inflation, unemployment (World Bank) · US rates (FRED) · oil spot (EIA) — evidence context, not investment advice"
      refreshSeconds={1800}
    />
  );
}
