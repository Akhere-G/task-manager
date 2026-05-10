import { Views, type Event, type View } from "react-big-calendar";

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
  return <div className="text-[0.7rem]">{title}</div>;
}
