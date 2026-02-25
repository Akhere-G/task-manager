import React from "react";
import {
  Target,
  BarChart3,
  Activity,
  PieChart,
  Clock,
  Timer,
  Cpu,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="text-center mb-20">
        <h1 className="text-5xl font-extrabold text-text-main mb-6 tracking-tight">
          Visualise Your <span className="text-brand">Workflow.</span>
        </h1>
        <p className="text-xl text-text-sub max-w-2xl mx-auto leading-relaxed">
          A high-performance task engine designed to turn raw productivity data
          into actionable insights. Track your progress, manage your energy, and
          master your time.
        </p>
      </section>

      {/* Core Methodology Grid */}
      <h2 className="text-3xl font-bold text-text-main mb-10 text-left border-b border-border-light pb-4">
        Core Methodology
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
        <FeatureCard
          icon={<Target className="text-brand" size={28} />}
          title="Task Status"
          description="A real-time snapshot of your backlog health, categorising items into Completed, Overdue, and Pending statuses."
        />
        <FeatureCard
          icon={<BarChart3 className="text-brand" size={28} />}
          title="Productivity Trends"
          description="Visualise your monthly output velocity to identify peak performance windows and maintain long-term consistency."
        />
        <FeatureCard
          icon={<Activity className="text-brand" size={28} />}
          title="Activity Map"
          description="A high-density heatmap documenting every completed task over the last 365 days to monitor behavioural patterns."
        />
        <FeatureCard
          icon={<PieChart className="text-brand" size={28} />}
          title="Active Balance"
          description="Monitor your cognitive load across categories. See exactly where your pending commitments are currently concentrated."
        />
        <FeatureCard
          icon={<Clock className="text-brand" size={28} />}
          title="Time Allocation"
          description="Analyse the actual minutes invested into each category for completed work to ensure effort matches your priorities."
        />
        <FeatureCard
          icon={<Timer className="text-brand" size={28} />}
          title="Pomodoro Engine"
          description="Utilise structured focus intervals to boost concentration, with automated session syncing to your time-tracking metrics."
        />
      </div>

      {/* Technology Section */}
      <section className="card p-8 bg-bg-secondary rounded-2xl border border-border-light shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="text-brand" size={24} />
              <h2 className="text-2xl font-bold text-text-main">
                The Architecture
              </h2>
            </div>
            <p className="text-text-sub leading-relaxed text-lg">
              Our system utilises a robust <strong>Python & Flask</strong> REST
              API on the backend, delivering highly structured data to a
              reactive <strong>TypeScript</strong> frontend. This ensures that
              complex calculations—such as <strong>visualising</strong> yearly
              activity and <strong>categorising</strong> workload balance—are
              rendered with surgical precision.
            </p>
          </div>

          {/* Reverted Tech Pills */}
          <div className="flex flex-wrap gap-3 justify-start lg:justify-end max-w-xs">
            {[
              "Python",
              "Flask",
              "React",
              "TypeScript",
              "Recharts",
              "Tailwind CSS",
            ].map((tech) => (
              <span
                key={tech}
                className="px-4 py-1.5 bg-brand/10 text-brand text-sm font-semibold rounded-full border border-brand/20"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group p-8 bg-surface rounded-2xl border border-border-light shadow-sm hover:border-brand/40 hover:shadow-md transition-all duration-300">
      <div className="mb-5 p-3 bg-brand/5 rounded-xl w-fit group-hover:bg-brand/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-text-main mb-3">{title}</h3>
      <p className="text-text-sub leading-relaxed">{description}</p>
    </div>
  );
}
