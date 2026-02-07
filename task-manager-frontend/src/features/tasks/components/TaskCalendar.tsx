import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid' 
import { useState } from 'react'
import type {  Task } from '../types';
import {  Popup } from '../../../components/ui';
import { formatDate } from '../utils';
import TaskCard from './TaskCard';
import interactionPlugin from '@fullcalendar/interaction';

interface CalendarProps {
  tasks: Task[]
  handleConfirmDelete: (id: number) => void;
  handleConfirmEdit: (id: number) => void;
  updateTask: (id: number, task: Partial<Task>) => Promise<void>;
  setIsCompleted: (id: number, isCompleted: boolean) => Promise<void>,
}
interface Info {
    event: { id: string; startStr: string };
    revert: () => void;
}

export default function TaskCalendar({ 
  handleConfirmDelete, 
  handleConfirmEdit,
  setIsCompleted,
  tasks,
  updateTask
}: CalendarProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  function selectTask(id: string){
    if (!tasks) return
    
    const selectedTask = tasks.find(task => task.id === Number(id))
    if (selectedTask)
      setSelectedTaskId(selectedTask.id)
  }

  const events = tasks.map(task => ({ title: task.title, date: formatDate(task.dueDate), id: String(task.id), extendedProps: task }))

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  async function handleEventDrop(info: Info) {
    const { event } = info;

    const newDueDate = event.startStr; // This gives you the new YYYY-MM-DD
    const taskId = Number(event.id);

    try {
      await updateTask(taskId, { dueDate: newDueDate })
    } catch (err) {
      // 3. Revert on Error
      console.log(err)
      info.revert(); // FullCalendar provides this handy function to snap the task back
      alert("Failed to move the task. Please try again.");
    }
}

  return (
    <div className='card'>
    <FullCalendar
      plugins={[ dayGridPlugin, interactionPlugin ]}
      initialView="dayGridMonth"
      events={events}
      editable
      eventDrop={handleEventDrop}
      eventClick={({event}) => selectTask(event.id)}
      eventContent={({ event }) => {
        return (
          <div 
              draggable
              className={
                `px-2 py-0.5 rounded text-xs transition-all shadow-sm cursor-pointer active:cursor-grabbing 
                truncate hover:brightness-95
                ${
                event.extendedProps.isCompleted 
                  ? 'bg-surface-muted text-text-sub border-l-4 border-surface-muted/90 hover:brightness-125' 
                  : 'bg-brand text-text-inverse border-l-4 border-brand/5 hover:brightness-125'
              }`}
          >
      <span className="font-semibold">{event.title}</span>
    </div>
        )
      }}
      />
      {selectedTask && (
        <Popup 
          title="" 
          close={() => setSelectedTaskId(null)}
          showCloseButton={false}
          sleek
        >
          <TaskCard 
            {...selectedTask} 
            onDelete={id => {
              handleConfirmDelete(id)
              setSelectedTaskId(null)
            }} 
            onEdit={handleConfirmEdit}
            setIsCompleted={(id, isCompleted) => {
              setIsCompleted(id, isCompleted);
            }}
          />
        </Popup>
      )}
    </div>
  )
}