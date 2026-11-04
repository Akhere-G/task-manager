import { FormInput } from "../../../components/ui";
import type { RepeatDay } from "../recurrence";
import RecurrencePicker from "./RecurrencePicker";

type ChangeHandler = React.ComponentProps<typeof FormInput>["handleChange"];

export const repeatByOptions = [
  { name: "Daily", value: "daily" },
  { name: "Weekly", value: "weekly" },
  { name: "Monthly", value: "monthly" },
  { name: "Yearly", value: "yearly" },
];

interface RepeatFieldsProps {
  repeatBy: string;
  repeatUntil: string;
  interval: number;
  days: RepeatDay[] | null;
  errors: {
    repeatBy?: string;
    repeatUntil?: string;
    repeatInterval?: string;
    repeatDays?: string;
  };
  touched: { repeatBy: boolean; repeatUntil: boolean };
  onChange: ChangeHandler;
  onBlur: NonNullable<React.ComponentProps<typeof FormInput>["handleBlur"]>;
  onIntervalChange: (interval: number) => void;
  onDaysChange: (days: RepeatDay[]) => void;
}

export default function RepeatFields({
  repeatBy,
  repeatUntil,
  interval,
  days,
  errors,
  touched,
  onChange,
  onBlur,
  onIntervalChange,
  onDaysChange,
}: RepeatFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row">
        <FormInput
          formClassNames="md:flex-1"
          name="repeatBy"
          label="Frequency"
          value={repeatBy}
          handleChange={onChange}
          errorMessage={errors.repeatBy}
          touched={touched.repeatBy}
          options={repeatByOptions}
        />
        <FormInput
          formClassNames="md:flex-1"
          name="repeatUntil"
          label="Repeat Until"
          value={repeatUntil}
          handleChange={onChange}
          handleBlur={onBlur}
          errorMessage={errors.repeatUntil}
          touched={touched.repeatUntil}
          type="date"
        />
      </div>
      <RecurrencePicker
        repeatBy={repeatBy}
        interval={interval}
        days={days}
        intervalError={errors.repeatInterval}
        daysError={errors.repeatDays}
        onIntervalChange={onIntervalChange}
        onDaysChange={onDaysChange}
      />
    </>
  );
}
