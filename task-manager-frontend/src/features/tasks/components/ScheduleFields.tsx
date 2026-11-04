import { ArrowRight } from "lucide-react";
import { FormInput } from "../../../components/ui";

type ChangeHandler = React.ComponentProps<typeof FormInput>["handleChange"];

interface ScheduleFieldsProps {
  startAt: string;
  endAt: string;
  startError: string;
  endError: string;
  startTouched: boolean;
  endTouched: boolean;
  onStartChange: ChangeHandler;
  onEndChange: ChangeHandler;
  onBlur: NonNullable<React.ComponentProps<typeof FormInput>["handleBlur"]>;
}

export default function ScheduleFields({
  startAt,
  endAt,
  startError,
  endError,
  startTouched,
  endTouched,
  onStartChange,
  onEndChange,
  onBlur,
}: ScheduleFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <FormInput
          formClassNames="md:flex-1"
          label="Start At"
          name="startAt"
          type="datetime-local"
          value={startAt}
          handleChange={onStartChange}
          errorMessage={startError}
          touched={startTouched}
          handleBlur={onBlur}
        />
        <ArrowRight
          aria-hidden="true"
          size={16}
          className="hidden shrink-0 self-center text-text-sub md:block"
        />
        <FormInput
          formClassNames="md:flex-1"
          label="End At"
          name="endAt"
          type="datetime-local"
          value={endAt}
          handleChange={onEndChange}
          errorMessage={endError}
          touched={endTouched}
          handleBlur={onBlur}
        />
      </div>
    </>
  );
}
