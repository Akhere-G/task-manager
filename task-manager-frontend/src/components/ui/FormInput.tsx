export interface FormInputprops {
  label: string;
  name: string;
  type?: string;
  value: string | number;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  errorMessage?: string;
  options?: {name: string; value: string}[];
  formClassNames?: string;
  textarea?: boolean
}


export default function FormInput({ 
  label, 
  name, 
  type="text", 
  value, 
  handleChange, 
  errorMessage, 
  options,
  formClassNames = "",
  textarea = false
  }: FormInputprops){

  return (
    <div className={"group flex flex-col text-text-main " + formClassNames}>
      <label htmlFor={name} className="group-focus-within:text-accent text-sm font-bold text-text-main mb-2">{label}</label>
      {!options && ! textarea && ( 
        <input
          id={name}
          className="w-full p-3 rounded-xl border border-border-light focus:outline-none focus:border-brand bg-bg-secondary text-text-main transition-all placeholder:text-text-sub/50"
          name={name}
          type={type}
          value={value} 
          onChange={handleChange}
        />
      )}
      {options && !textarea && (
        <select 
          className="w-full p-3 rounded-xl border border-border-light focus:outline-none focus:border-brand bg-bg-secondary text-text-main transition-all placeholder:text-text-sub/50"
          id={name}
          name={name}
          value={value}
          onChange={(e) => handleChange(e)}
          >
          {options.map(({name, value}) => <option key={name} value={value}>{name}</option>)}
        </select>
      )}
      {
        textarea && !options && (
          <textarea 
            className="w-full p-3 rounded-xl border border-border-light focus:outline-none focus:border-brand bg-bg-secondary text-text-main transition-all resize-none"
            id={name}
            name={name}
            value={value}
            onChange={handleChange}
            rows={6}
          />
          
        )
      }
      {errorMessage && (
        <p 
          className="mt-4 text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4"
        >
          {errorMessage}
        </p>
        )}
    </div>
  )
}