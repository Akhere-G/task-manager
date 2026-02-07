import { TaskCalendar } from "../features/tasks/components";

export default function CalendarView() {
  return (
    <section className="flex flex-col gap-6 min-h-full card">
      <header className="grow-[0.9] shrink-0 w-full  flex flex-col items-center sm:items-start">
        <h1 className="text-3xl font-bold text-text-main transition-colors">Tasks Calendar</h1>
        <p className="text-text-sub">Manage your daily goals.</p>
      </header>
      <TaskCalendar/>
    </section>
  )
}
