import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { PageIntro, SectionHeading } from "../../components/public-content";
import { PublicShell } from "../../components/public-shell";

export default function ContactPage() {
  return (
    <PublicShell>
      <main className="px-5 pb-24 lg:px-8">
        <section className="pt-20 lg:pt-28">
          <PageIntro eyebrow="Contact" title="Let’s talk about what you’re building." description="Tell us what you want to explore with HexaWave, or start with the product and developer resources." />
        </section>
        <section className="mx-auto mt-14 grid max-w-6xl gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-7 sm:p-9">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] text-cyan-200"><MessageSquareText size={19} /></span>
            <h2 className="mt-6 text-xl font-semibold">Get in touch</h2>
            <p className="mt-3 text-sm leading-7 text-white/45">Contact delivery is not connected in this build yet. We’re avoiding a form that appears to send a message without a configured destination.</p>
            <p className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4 text-xs leading-6 text-white/40">For now, explore the product, create a project, or review the API documentation. A real contact channel can be connected when the team’s preferred address or CRM endpoint is available.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/product" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-xs font-bold text-black hover:bg-cyan-100">Explore product <ArrowRight size={13} /></Link>
              <Link href="/developers" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-xs font-semibold text-white/75 hover:text-white">Developer resources</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/[0.06] to-blue-500/[0.025] p-7 sm:p-9">
            <SectionHeading eyebrow="Start building" title="Try the software factory." description="Describe a project, generate its workspace, and continue in the AI Developer IDE." />
            <Link href="/projects/new" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-white">Create a project <ArrowRight size={14} /></Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
