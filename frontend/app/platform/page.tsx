import { Bot, Braces, CheckCircle2, Compass, DraftingCompass, Hammer, Rocket, TestTube2 } from "lucide-react";
import { FeatureCard, PageIntro, SectionHeading } from "../../components/public-content";
import { PublicShell } from "../../components/public-shell";

const agents = [
  ["Planner", "Clarifies the request and outlines scope.", Compass],
  ["Architect", "Shapes the system structure and technology direction.", DraftingCompass],
  ["Developer", "Creates the project files and implementation.", Braces],
  ["Tester", "Checks generated files and reports issues.", TestTube2],
  ["Builder", "Installs dependencies and runs the configured build.", Hammer],
  ["Deployment", "Helps prepare the application for delivery.", Rocket],
] as const;

export default function PlatformPage() {
  return (
    <PublicShell>
      <main>
        <section className="px-5 pt-20 lg:px-8 lg:pt-28">
          <PageIntro eyebrow="Platform" title="A coordinated team of AI agents." description="HexaWave organizes software creation into clear roles, then brings their work together in a persistent project workspace." />
        </section>
        <section className="px-5 py-14 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map(([title, description, icon]) => <FeatureCard key={title} icon={icon} title={title} description={description} />)}
          </div>
        </section>
        <section className="border-y border-white/[0.06] bg-[#080b11] px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <SectionHeading eyebrow="Deployment architecture" title="A connected path through the factory." description="The browser talks to the application backend, which coordinates project operations with the AI service." />
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ["01", "Browser IDE", "Project files · chat · terminal · preview"],
                ["02", "Application API", "Projects · lifecycle · runner controls"],
                ["03", "AI service", "Plan · architect · generate · validate"],
              ].map(([number, title, description], index) => (
                <div key={title} className="relative rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                  <p className="text-[10px] font-bold text-cyan-300">{number}</p>
                  <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-white/40">{description}</p>
                  {index < 2 && <div className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#080b11] text-cyan-300 sm:flex"><CheckCircle2 size={13} /></div>}
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-white/35"><Bot size={14} className="text-cyan-300" /> Lifecycle states and build output stay visible in the workspace.</div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
