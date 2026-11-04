import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { beforeReminder } from "../reminders";
import ReminderPicker from "./ReminderPicker";

describe("ReminderPicker", () => {
  it("marks the chosen presets and adds another when pressed", async () => {
    const onChange = vi.fn();
    render(<ReminderPicker value={[beforeReminder(30)]} onChange={onChange} />);

    expect(
      screen.getByRole("button", { name: "30 minutes before" }),
    ).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(
      screen.getByRole("button", { name: "1 hour before" }),
    );

    expect(onChange).toHaveBeenCalledWith([
      beforeReminder(30),
      beforeReminder(60),
    ]);
  });

  it("removes a reminder that is pressed again", async () => {
    const onChange = vi.fn();
    render(<ReminderPicker value={[beforeReminder(30)]} onChange={onChange} />);

    await userEvent.click(
      screen.getByRole("button", { name: "30 minutes before" }),
    );

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("adds a clock reminder at the chosen time", async () => {
    const onChange = vi.fn();
    render(<ReminderPicker value={[]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Add reminder" }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "clock",
        daysBefore: 0,
        timeOfDay: "09:00",
      }),
    ]);
  });

  it("does not add a clock reminder while the time is empty", async () => {
    const onChange = vi.fn();
    render(<ReminderPicker value={[]} onChange={onChange} />);

    await userEvent.clear(screen.getByLabelText("At time"));
    const add = screen.getByRole("button", { name: "Add reminder" });
    await userEvent.click(add);

    expect(add).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
