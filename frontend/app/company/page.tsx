import { Compass, Cpu, HeartHandshake, Rocket } from "lucide-react";
import { FeatureCard, PageIntro, SectionHeading } from "../../components/public-content";
import { PublicShell } from "../../components/public-shell";

export default function CompanyPage() {
  return (
    <PublicShell>
      <main>
        <section className="px-5 pt-20 lg:px-8 lg:pt-28">
          <PageIntro eyebrow="Company" title="Make software creation feel possible." description="HexaWave is building an AI-native software factory to help people move from a product idea to a working, inspectable project." />
        </section>
        <section className="px-5 py-14 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2">
            <FeatureCard icon={Compass} title="About HexaWave" description="We bring planning, architecture, implementation, testing, and project execution into one focused product." />
            <FeatureCard icon={HeartHandshake} title="Our mission" description="Lower the distance between having an idea and being able to explore it as real software." />
            <FeatureCard icon={Cpu} title="Our technology" description="A browser IDE, project backend, and AI service coordinate the software creation lifecycle." />
            <FeatureCard icon={Rocket} title="Careers" description="We are shaping a new way to build with software. Career information will be shared as roles open." />
          </div>
        </section>
        <section className="border-y border-white/[0.06] bg-[#080b11] px-5 py-16 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow="Our approach" title="AI should make the work more inspectable, not less." description="HexaWave keeps project files, build feedback, and the running application visible so people can understand and shape what is being made." />
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
