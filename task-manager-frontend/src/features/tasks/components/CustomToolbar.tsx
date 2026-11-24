import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  isSameMonth,
  isSameYear,
  startOfWeek,
} from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Views, type View } from "react-big-calendar";
import { FormInput } from "../../../components/ui";

interface CustomToolbarInterface {
  view: View;
  currentDate: Date;
  setCurrentDate: (newDate: Date) => void;
  setView: (view: View) => void;
}
export default function CustomToolbar({
  view,
  currentDate,
  setCurrentDate,
  setView,
}: CustomToolbarInterface) {
  const shift = (direction: 1 | -1) => {
    if (view === Views.MONTH) setCurrentDate(addMonths(currentDate, direction));
    else if (view === Views.WEEK)
      setCurrentDate(addWeeks(currentDate, direction));
    else setCurrentDate(addDays(currentDate, direction));
  };
  const goToBack = () => shift(-1);
  const goToNext = () => shift(1);
  let dateStr = format(currentDate, "MMMM yyyy");

  if (view === Views.WEEK) {
    const startWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
    const endWeek = endOfWeek(currentDate, { weekStartsOn: 1 });
    const sameMonth = isSameMonth(endWeek, startWeek);
    const sameYear = isSameYear(endWeek, startWeek);
    let formatStr = "do";
    if (!sameMonth) formatStr += " MMM";
    if (!sameYear) formatStr += " yyyy";
    dateStr = `${format(startWeek, formatStr)} - ${format(endWeek, "do MMM yyyy")}`;
  }
  if (view === Views.DAY) {
    dateStr = format(currentDate, "do MMM yyyy");
  }

  return (
    <div className="flex justify-between items-center mb-4 flex-col gap-2 md:flex-row">
      <div className="flex items-center gap-2">
        <CalendarIcon className="text-brand" size={20} />
        <h2 className="text-lg md:text-2xl font-bold text-text-main">
          {dateStr}
        </h2>
      </div>

      <div className="flex gap-4 items ">
        <FormInput
          value={view}
          handleChange={(e) => setView(e.target.value as View)}
          name="view"
          options={[
            { value: Views.MONTH, name: "Month" },
            { value: Views.WEEK, name: "Week" },
            { value: Views.DAY, name: "Day" },
          ]}
        />

        <div className="flex h-11.5  bg-brand px-1 rounded-lg border border-border-light shadow-sm text-text-inverse">
          <button
            aria-label={`Go to previous ${view === Views.MONTH ? "month" : view === Views.WEEK ? "week" : "day"}`}
            onClick={goToBack}
            className="btn-primary"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="Go to current date"
            onClick={() => setCurrentDate(new Date())}
            className="btn-primary rounded-none  border-x"
          >
            Today
          </button>
          <button
            aria-label={`Go to next ${view === Views.MONTH ? "month" : view === Views.WEEK ? "week" : "day"}`}
            onClick={goToNext}
            className="btn-primary"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
