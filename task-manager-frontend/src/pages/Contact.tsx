import React, { useState } from "react";
import { Send } from "lucide-react";
import { contactService, type ContactEnquiry } from "../services/api";
import { isAxiosError } from "axios";
import { FormInput } from "../components/ui";
import { validateContactRequest, type ContactData } from "../utils/validators";

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({
    fullName: "",
    email: "",
    subject: "",
    message: "",
    general: "",
  });

  const [formData, setFormData] = useState<ContactEnquiry>({
    fullName: "",
    email: "",
    subject: "General Support",
    message: "",
  });

  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    subject: false,
    message: false,
  });

  const defaultErrorMessages = {
    fullName: "",
    email: "",
    subject: "",
    message: "",
    general: "",
  };

  const validateForm = (data: ContactData) => {
    setErrorMessages({
      ...defaultErrorMessages,
      ...validateContactRequest(data),
    });
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);
    validateForm(newFormData);
  };

  function handleBlur(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setStatus("sending");
    setTouched({
      fullName: true,
      email: true,
      subject: true,
      message: true,
    });

    if (
      Object.entries(errorMessages).some(
        ([k, v]) => v !== "" && k !== "general",
      )
    )
      return;

    try {
      await contactService.sendEnquiry(formData);
      setStatus("success");
      setFormData({
        fullName: "",
        email: "",
        subject: "General Support",
        message: "",
      });
      setErrorMessages({ ...defaultErrorMessages });
    } catch (error: unknown) {
      setStatus("idle");
      if (
        isAxiosError(error) &&
        error.response &&
        error.response.status === 400
      ) {
        setErrorMessages({
          ...defaultErrorMessages,
          ...error?.response?.data.errors,
        });
      } else {
        setErrorMessages((prev) => ({
          ...prev,
          general: "Sorry! Something went wrong...",
        }));
      }
    }
  };

  const subjectOptions = [
    { name: "General Support", value: "General Support" },
    { name: "Feature Suggestion", value: "Feature Suggestion" },
    { name: "Bug Report", value: "Bug Report" },
    { name: "Account & Data", value: "Account & Data" },
  ];

  return (
    <div>
      <section className="mb-10">
        <h1 className="text-4xl font-extrabold text-text-main mb-3 tracking-tight">
          Contact <span className="text-brand">Support.</span>
        </h1>
        <p className="text-text-sub text-lg leading-relaxed">
          Need help <strong>optimising</strong> your workflow or have a feature{" "}
          <strong>enquiry</strong>?
        </p>
      </section>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-6">
        {errorMessages.general && (
          <p className="mt-4 text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4">
            {errorMessages.general}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput
            label="Full Name"
            name="fullName"
            formClassNames="w-full"
            value={formData.fullName}
            handleChange={handleChange}
            errorMessage={errorMessages.fullName}
            touched={touched.fullName}
            handleBlur={handleBlur}
          />
          <FormInput
            label="Email Address"
            name="email"
            type="email"
            formClassNames="w-full"
            value={formData.email}
            handleChange={handleChange}
            errorMessage={errorMessages.email}
            touched={touched.email}
            handleBlur={handleBlur}
          />
        </div>

        <FormInput
          label="Subject of Enquiry"
          name="subject"
          value={formData.subject}
          handleChange={handleChange}
          options={subjectOptions}
          errorMessage={errorMessages.subject}
          touched={touched.subject}
          handleBlur={handleBlur}
        />
        <FormInput
          label="Message"
          name="message"
          value={formData.message}
          handleChange={handleChange}
          errorMessage={errorMessages.message}
          textarea
          touched={touched.message}
          handleBlur={handleBlur}
        />

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={status !== "idle"}
            className="w-full md:w-max px-12 py-3 bg-brand text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-brand-dark transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {status === "idle" && (
              <>
                <Send size={18} /> Send Enquiry
              </>
            )}
            {status === "sending" && "Processing..."}
            {status === "success" && "Message Sent!"}
          </button>
        </div>
      </form>
    </div>
  );
}
