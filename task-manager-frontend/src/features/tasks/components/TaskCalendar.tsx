import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid' 
import { useState } from 'react'
import type { Task } from '../types';
import {  Popup } from '../../../components/ui';
import { formatDate } from '../utils';
import TaskCard from './TaskCard';

interface CalendarProps {
  tasks: Task[]
  handleConfirmDelete: (id: number) => void;
  handleConfirmEdit: (id: number) => void;
  setIsCompleted: (id: number, isCompleted: boolean) => Promise<void>,
}

export default function TaskCalendar({ 
  handleConfirmDelete, 
  handleConfirmEdit,
  setIsCompleted,
  tasks
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

  return (
    <div className='card'>
    <FullCalendar
      plugins={[ dayGridPlugin ]}
      initialView="dayGridMonth"
      events={events}
      eventClick={({event}) => selectTask(event.id)}
      eventContent={({ event }) => {
        return (
          <div 
              className={`px-2 py-0.5 rounded text-xs transition-all shadow-sm ${
                event.extendedProps.isCompleted 
                  ? 'bg-surface-muted text-text-sub border-l-4 border-surface-muted/90 hover:brightness-125' 
                  : 'bg-brand text-text-inverse border-l-4 border-brand/5 hover:brightness-125'
              } truncate cursor-pointer hover:brightness-95`}
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