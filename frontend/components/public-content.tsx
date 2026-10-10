import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
        {eyebrow}
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">
        {title}
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
        {description}
      </p>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-sm leading-7 text-white/45">{description}</p>
      )}
    </div>
  );
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition hover:border-cyan-300/20 hover:bg-white/[0.04]">
      {Icon && (
        <span className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] text-cyan-200">
          <Icon size={18} />
        </span>
      )}
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-white/45">{description}</p>
      {children}
    </article>
  );
}
