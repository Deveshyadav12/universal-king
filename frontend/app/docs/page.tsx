import Link from "next/link";
import { ArrowRight, BookOpen, Code2, FolderKanban, Rocket, Sparkles } from "lucide-react";
import { FeatureCard, PageIntro } from "../../components/public-content";
import { PublicShell } from "../../components/public-shell";

const guideLinks = [
  ["Getting Started", "Create a project, describe the outcome, and enter the AI Developer workspace.", "/projects/new", Sparkles],
  ["Projects", "Understand project workspaces, files, generation, builds, and downloads.", "/developers", FolderKanban],
  ["AI Developer", "Explore the IDE panels, terminal, preview, and project lifecycle controls.", "/product", Code2],
  ["API", "Use the project API to manage workspace lifecycle operations.", "/developers", BookOpen],
  ["Deployment", "Prepare your project for the next deployment workflow.", "/platform", Rocket],
] as const;

const faqs = [
  ["Where do generated project files live?", "Each generated project is stored in a persistent workspace managed by the AI service."],
  ["Can I edit generated files?", "Yes. Open a project in the AI Developer workspace, edit files, and save changes to its workspace."],
  ["How does preview work?", "Run starts the project's configured development or start script on an available local port."],
  ["Where should AI credentials be configured?", "Keep model credentials in the AI service environment. They must never be exposed in browser code."],
];

export default function DocsPage() {
  return (
    <PublicShell>
      <main>
        <section className="px-5 pt-20 lg:px-8 lg:pt-28">
          <PageIntro eyebrow="Documentation" title="Learn the HexaWave workflow." description="Find the essentials for creating projects, working in the AI Developer, and integrating with the project API." />
        </section>
        <section className="px-5 py-14 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guideLinks.map(([title, description, href, icon]) => (
              <Link key={title} href={href} className="group">
                <FeatureCard icon={icon} title={title} description={description}>
                  <span className="mt-5 inline-flex items-center gap-2 text-[10px] font-semibold text-cyan-200 group-hover:text-white">Open guide <ArrowRight size={12} /></span>
                </FeatureCard>
              </Link>
            ))}
          </div>
        </section>
        <section className="border-y border-white/[0.06] bg-[#080b11] px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
            <div className="mt-7 divide-y divide-white/[0.08]">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="cursor-pointer list-none text-sm font-medium text-white/80 marker:hidden">{question}<span className="float-right text-cyan-300 group-open:rotate-45">+</span></summary>
                  <p className="mt-3 max-w-3xl text-xs leading-6 text-white/45">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
