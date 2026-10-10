import { Braces, Code2, GitBranch, Terminal } from "lucide-react";
import { FeatureCard, PageIntro, SectionHeading } from "../../components/public-content";
import { PublicShell } from "../../components/public-shell";

const apiExample = `curl -X POST http://localhost:4000/api/projects \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My first project",
    "type": "Web App",
    "stack": "Next.js + TypeScript",
    "description": "A small product site"
  }'`;

export default function DevelopersPage() {
  return (
    <PublicShell>
      <main>
        <section className="px-5 pt-20 lg:px-8 lg:pt-28">
          <PageIntro eyebrow="Developers" title="Build with HexaWave, not around it." description="Explore the project API and the integration surfaces that connect the factory to your development workflow." />
        </section>
        <section className="px-5 py-14 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon={Braces} title="API" description="Use the backend project endpoints to create, generate, inspect, build, run, stop, and download projects." />
            <FeatureCard icon={Code2} title="SDK" description="A dedicated published SDK package is not available yet. The HTTP API is the current integration surface." />
            <FeatureCard icon={Terminal} title="CLI" description="A standalone HexaWave CLI is not available yet. Run project lifecycle actions from the IDE or API." />
            <FeatureCard icon={GitBranch} title="Integrations" description="Keep your existing codebase and toolchain in the loop through project files and HTTP APIs." />
          </div>
        </section>
        <section className="border-y border-white/[0.06] bg-[#080b11] px-5 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <SectionHeading eyebrow="API example" title="Create a project over HTTP." description="The API is served by the NestJS backend. Configure its base URL for your environment before calling it." />
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#05070b]">
              <div className="border-b border-white/[0.07] px-4 py-3 text-[10px] text-white/35">Create project · cURL</div>
              <pre className="overflow-x-auto p-5 text-[10px] leading-6 text-cyan-100/80"><code>{apiExample}</code></pre>
            </div>
          </div>
          <div className="mx-auto mt-8 grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {["POST /api/projects", "POST /api/projects/:id/generate", "GET /api/projects/:id/files", "POST /api/projects/:id/run"].map((route) => <div key={route} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-3 font-mono text-[9px] text-white/55">{route}</div>)}
          </div>
        </section>
        <section className="px-5 py-16 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-2xl border border-amber-300/15 bg-amber-300/[0.035] p-5 text-xs leading-6 text-white/50">
            <strong className="text-amber-100">Integration note:</strong> project generation requires the AI service and its server-side model configuration. Keep credentials in backend/AI service environments; never place model keys in browser code.
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
