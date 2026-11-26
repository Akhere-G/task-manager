import { useState, useMemo } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type Event,
  type View,
} from "react-big-calendar";
import withDragAndDrop, {
  type DragFromOutsideItemArgs,
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  isSameDay,
  addMilliseconds,
} from "date-fns";
import { enGB } from "date-fns/locale/en-GB";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import { PopupModes, useTaskContext } from "../../../context/TaskContext";
import type { Task } from "../types";
import EventCard from "./EventCard";
import CustomToolbar from "./CustomToolbar";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import { useNavigate, useSearchParams } from "react-router-dom";
import useRescheduleTask from "../hooks/useRescheduleTask";
import useSavingTaskIds from "../optimistic/useSavingTaskIds";
import { useTheme } from "../../users/ThemeContext";
import { trackEvent } from "../../../services/analytics";

import {
  taskTargetId,
  getDayClassName,
  getEventClassName,
  getEventStyle,
  mapTasksToCalendarEvents,
} from "../utils";
import MobileTaskSection from "./MobileTaskSelection";
import useProjects from "../../projects/hooks/useProjects";

const locales = { "en-GB": enGB };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const CALENDAR_VIEWS: View[] = [Views.MONTH, Views.WEEK, Views.DAY];

const DnDCalendar = withDragAndDrop(Calendar);

interface MovedTask {
  id: number;
  times: { startAt: string; endAt: string };
}

interface TaskCalendarProps {
  tasks: Task[];
  currentDate: Date;
  setCurrentDate: (newDate: Date) => void;
}

export default function TaskCalendar({
  tasks,
  currentDate,
  setCurrentDate,
}: TaskCalendarProps) {
  const [moved, setMoved] = useState<MovedTask | null>(null);
  const { mutate: rescheduleTask, isError: rescheduleFailed } =
    useRescheduleTask();
  const { openPopup } = useTaskContext();
  const savingIds = useSavingTaskIds();
  const isMovable = (event: Event) =>
    !savingIds.has(taskTargetId(event.resource as Task));
  const { darkMode } = useTheme();
  const { data: projects = [] } = useProjects();

  const [searchParams, setSearchParams] = useSearchParams();
  const calParam = searchParams.get("cal");
  const [draggedEvent, setDraggedEvent] = useState<Task | null>(null);

  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const isMobile = ["xs", "sm"].includes(breakpoint);

  const view = CALENDAR_VIEWS.find((v) => v === calParam) ?? Views.MONTH;
  const setView = (view: View) => {
    const next = new URLSearchParams(searchParams);
    next.set("cal", view);
    setSearchParams(next);
  };

  const drillDown = (date: Date) => {
    const next = new URLSearchParams(searchParams);
    next.set("current_date", date.toISOString());
    next.set("page", "1");
    if (!isMobile) next.set("cal", Views.DAY);
    setSearchParams(next);
  };

  const allTasks = useMemo(
    () =>
      moved
        ? tasks.map((task) =>
            task.id === moved.id ? { ...task, ...moved.times } : task,
          )
        : tasks,
    [tasks, moved],
  );

  const events = useMemo(
    () => mapTasksToCalendarEvents(allTasks, isMobile, view),
    [allTasks, isMobile, view],
  );

  const tasksForSelectedDay = allTasks.filter(
    (t) => !!t.startAt && isSameDay(new Date(t.startAt), currentDate),
  );

  const handleTaskDateChange = (task: Task, start: Date, end: Date) => {
    const startAt = format(start, "yyyy-MM-dd HH:mm:ss");
    const endAt = format(end, "yyyy-MM-dd HH:mm:ss");

    setMoved({ id: task.id, times: { startAt, endAt } });
    rescheduleTask(
      {
        id: taskTargetId(task),
        rescheduleData: {
          previousStartAt: task.startAt ?? startAt,
          startAt,
          endAt,
          isGhost: task.isGhost ?? false,
        },
      },
      {
        onSuccess: () => trackEvent("calendar_task_rescheduled"),
        onSettled: () => setMoved(null),
      },
    );
  };

  const onEventDrop = ({ event, start, end }: EventInteractionArgs<Event>) => {
    const newStart = new Date(start as Date);
    const newEnd = new Date(end as Date);
    const task = event.resource as Task;

    handleTaskDateChange(task, newStart, newEnd);
  };

  function onDropFromOutside(day: DragFromOutsideItemArgs) {
    if (!draggedEvent?.startAt || !draggedEvent.endAt) return;

    const startAt = new Date(draggedEvent.startAt);
    const endAt = new Date(draggedEvent.endAt);

    const newStartAt = new Date(day.start);
    newStartAt.setHours(startAt.getHours());
    newStartAt.setMinutes(startAt.getMinutes());

    const newEndAt = addMilliseconds(
      newStartAt,
      endAt.getTime() - startAt.getTime(),
    );

    handleTaskDateChange(draggedEvent, newStartAt, newEndAt);
    setDraggedEvent(null);
  }

  function onEventResize(e: EventInteractionArgs<Event>) {
    const { start, end, event } = e;
    const task: Task = event.resource;

    handleTaskDateChange(task, new Date(start), new Date(end));
  }

  return (
    <div className="space-y-6">
      {rescheduleFailed && (
        <p role="alert" className="text-failure">
          Could not move the task
        </p>
      )}
      <div className="card px-0 md:px-2 h-112.5 md:h-175">
        <DnDCalendar
          localizer={localizer}
          events={events}
          date={currentDate}
          onDrillDown={drillDown}
          onNavigate={(date) => setCurrentDate(date)}
          onSelectSlot={({ start, end, action }) => {
            switch (action) {
              case "click":
                setCurrentDate(start as Date);
                break;
              case "select":
                navigate("/addtask", {
                  state: { startAt: start, endAt: end },
                });
            }
          }}
          handleDragStart={(event: Event) => {
            setDraggedEvent(event.resource);
          }}
          formats={{
            dayFormat: (date: Date) =>
              isMobile ? format(date, "dd") : format(date, "EEE dd/MM"),
            timeGutterFormat: (date) =>
              isMobile ? format(date, "HH") : format(date, "p"),

            eventTimeRangeFormat: ({ start, end }) =>
              isMobile
                ? `${format(start, "H")} - ${format(end, "H")}`
                : `${format(start, "p")} - ${format(end, "p")}`,
          }}
          selectable
          popup={!isMobile}
          view={view}
          views={CALENDAR_VIEWS}
          draggableAccessor={isMovable}
          resizableAccessor={isMovable}
          onEventDrop={onEventDrop}
          onDropFromOutside={onDropFromOutside}
          onEventResize={onEventResize}
          onSelectEvent={(event: Event) => {
            if (!isMobile || view !== Views.MONTH)
              openPopup(event.resource as Task, PopupModes.View);
          }}
          dayPropGetter={(date) => {
            return {
              className: getDayClassName(date, currentDate),
            };
          }}
          components={{
            toolbar: () => (
              <CustomToolbar
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                view={view}
                setView={setView}
              />
            ),
            event: ({ title, event }) => (
              <EventCard
                title={title}
                event={event}
                isMobile={isMobile}
                view={view}
              />
            ),
          }}
          eventPropGetter={(event: Event) => ({
            className: getEventClassName(event, isMobile, view),
            style: getEventStyle(event, isMobile, view, darkMode, projects),
          })}
        />
      </div>

      <MobileTaskSection
        currentDate={currentDate}
        tasks={tasksForSelectedDay}
        onSelectTask={(task) => openPopup(task, PopupModes.View)}
        setDraggedEvent={setDraggedEvent}
      />
    </div>
  );
}
