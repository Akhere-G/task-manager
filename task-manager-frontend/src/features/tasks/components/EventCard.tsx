import { Views, type Event, type View } from "react-big-calendar";
import type { Task } from "../types";
import PriorityFlag from "./PriorityFlag";

interface EventCardProps {
  title: string;
  event: Event;
  isMobile: boolean;
  view: View;
}
export default function EventCard({
  title = "",
  event,
  isMobile,
  view,
}: EventCardProps) {
  if (isMobile && view === Views.MONTH) {
    const count = Math.min(9, (event as Event).resource);
    return (
      <div className="flex justify-center gap-0.5 mt-1 flex-wrap">
        {new Array(count).fill(1).map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full bg-brand`} />
        ))}
      </div>
    );
  }
  const task = event.resource as Task | undefined;
  return (
    <div className="flex items-center gap-1 text-[0.7rem]">
      <PriorityFlag priority={task?.priority} size={10} />
      <span className="truncate">{title}</span>
    </div>
  );
}
