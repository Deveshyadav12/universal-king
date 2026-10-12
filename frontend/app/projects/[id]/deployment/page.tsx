import { Suspense } from "react";
import DeploymentSettingsClientPage from "./deployment-client";

export const instant = false;

export default function DeploymentSettingsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#070a10]" />}>
      <DeploymentSettingsClientPage />
    </Suspense>
  );
}
