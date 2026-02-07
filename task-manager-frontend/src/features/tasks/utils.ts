export const formatDate = (dateStr?: string) => {
  if (!dateStr){
    return new Date().toISOString().substring(0, 10)
  }
  return new Date(dateStr).toISOString().substring(0, 10)
}