export interface FormInputprops {
  label?: string;
  name: string;
  id?: string;
  type?: string;
  value: string | number;
  handleChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  handleBlur?: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  touched?: boolean;
  errorMessage?: string;
  options?: { name: string; value: string }[];
  formClassNames?: string;
  textarea?: boolean;
  optional?: boolean;
}

export default function FormInput({
  label,
  name,
  id = name,
  type = "text",
  value,
  handleChange,
  handleBlur = () => {},
  touched = true,
  errorMessage,
  options,
  formClassNames = "",
  textarea = false,
  optional = false,
}: FormInputprops) {
  return (
    <div className={"group flex flex-col text-text-main " + formClassNames}>
      {label && (
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <label
            htmlFor={id}
            className="group-focus-within:text-accent text-sm font-bold text-text-main"
          >
            {label}
          </label>
          {optional && <span className="text-xs text-text-sub">Optional</span>}
        </div>
      )}
      {!options && !textarea && (
        <input
          id={id}
          className="w-full p-3 rounded-xl border border-border-light focus:outline-none focus:border-brand bg-bg-secondary text-text-main transition-all placeholder:text-text-sub/50"
          name={name}
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      )}
      {options && !textarea && (
        <select
          className="w-full p-3 rounded-xl border border-border-light focus:outline-none focus:border-brand bg-bg-secondary text-text-main transition-all placeholder:text-text-sub/50"
          id={id}
          name={name}
          value={value}
          onChange={(e) => handleChange(e)}
          onBlur={handleBlur}
        >
          {options.map(({ name, value }) => (
            <option key={name} value={value}>
              {name}
            </option>
          ))}
        </select>
      )}
      {textarea && !options && (
        <textarea
          className="w-full p-3 rounded-xl border border-border-light focus:outline-none focus:border-brand bg-bg-secondary text-text-main transition-all resize-none"
          id={id}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={6}
        />
      )}
      {errorMessage && touched && (
        <p className="mt-4 text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
