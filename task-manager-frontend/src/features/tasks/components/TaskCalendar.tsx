import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid' 
import { useEffect, useState } from 'react'
import { taskService } from '../../../services/api';
import type { Task } from '../types';
import { EmptyState, ErrorState, LoadingState, Popup } from '../../../components/ui';
import { formatDate } from '../utils';
import TaskCard from './TaskCard';

export default function Calendar() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  useEffect(() => {
    async function fetchTasks(){
      setIsLoading(true)
      try {
        const { tasks } = await taskService.getAll()
        setTasks(tasks)
        setError("")
      } catch (err) {
        console.log(err)
        setError("Could not fetch")
      } finally {
        setIsLoading(false)
      }
    }
    fetchTasks()
  }, [])

  function selectTask(id: string){
    if (!tasks) return
    
    const selectedTask = tasks.find(task => task.id === Number(id))
    if (selectedTask)
      setSelectedTask(selectedTask)
  }


  if (isLoading){
    return <LoadingState />
  }

  if (error){
    return <ErrorState error={error} />
  }

  if (!tasks || tasks.length === 0){
    return <EmptyState searchMessage='No Tasks' />
  }

  const events = tasks.map(task => ({ title: task.title, date: formatDate(task.dueDate), id: String(task.id) }))

  console.log(events)
  return (
    <>
    <FullCalendar
      plugins={[ dayGridPlugin ]}
      initialView="dayGridMonth"
      events={events}
      
      eventContent={({ event }) => {
        return (
          <div 
          className='bg-brand truncate' 
          onClick={() => selectTask(event.id)}
          >
            <b className='truncate'>{event.title}</b>
            <i>{event.start && ""}</i>
          </div>
        )
      }}
      />
      {selectedTask && (
        <Popup 
          title="" 
          close={() => setSelectedTask(null)}
          showCloseButton={false}
          sleek
        >
          <TaskCard {...selectedTask} />
        </Popup>
      )}
    </>
  )
}

function CalendarTask(){

}