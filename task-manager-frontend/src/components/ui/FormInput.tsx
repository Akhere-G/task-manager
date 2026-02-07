export interface FormInputprops {
  label: string;
  name: string;
  type?: string;
  value: string | number;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  errorMessage?: string;
  options?: {name: string; value: string}[];
  formClassNames?: string
}


export default function FormInput({ 
  label, 
  name, 
  type="text", 
  value, 
  handleChange, 
  errorMessage, 
  options,
  formClassNames = ""
  }: FormInputprops){

  return (
    <div className={"group flex flex-col text-text-main " + formClassNames}>
      <label htmlFor={name} className="group-focus-within:text-accent text-xs text-text-sub">{label}</label>
      {!options && ( 
        <input
          id={name}
          className="rounded-md px-3 py-2 my-1 outline-accent bg-surface-muted"
          name={name}
          type={type}
          value={value} 
          onChange={handleChange}
        />
      )}
      {options && (
        <select 
          className="rounded-md px-3 py-2 my-1 outline-accent bg-surface-muted"
          id={name}
          name={name}
          value={value}
          onChange={(e) => handleChange(e)}
          >
          {options.map(({name, value}) => <option key={name} value={value}>{name}</option>)}
        </select>
      )}
      {errorMessage && (
        <p 
          className="text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4"
        >
          {errorMessage}
        </p>
        )}
    </div>
  )
}