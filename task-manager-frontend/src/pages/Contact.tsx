import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { contactService, type ContactEnquiry } from '../services/api';
import { isAxiosError } from 'axios';
import { FormInput } from '../components/ui';

export default function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});

  // Controlled form state
  const [formData, setFormData] = useState<ContactEnquiry>({
    fullName: '',
    email: '',
    subject: 'General Support',
    message: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for a field when the user starts typing in it again
    if (errorMessages[name]) {
      setErrorMessages(prev => {
        const newErrors = { ...prev };
        newErrors[name] = "";
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessages({});

    try {
      await contactService.sendEnquiry(formData);
      setStatus('success');
      setFormData({ fullName: '', email: '', subject: 'General Support', message: '' });
    } catch (error: unknown) {
      setStatus('idle');
      if (isAxiosError(error) && error.response && error.response.status === 400) {
        setErrorMessages(error.response.data.errors);
      } else {
        console.error("Submission failed:", error);
        alert("An unexpected error occurred. Please try again later.");
      }
    }
  };

  const subjectOptions = [
    { name: 'General Support', value: 'General Support' },
    { name: 'Feature Suggestion', value: 'Feature Suggestion' },
    { name: 'Bug Report', value: 'Bug Report' },
    { name: 'Account & Data', value: 'Account & Data' }
  ];

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <section className="mb-10">
        <h1 className="text-4xl font-extrabold text-text-main mb-3 tracking-tight">
          Contact <span className="text-brand">Support.</span>
        </h1>
        <p className="text-text-sub text-lg leading-relaxed">
          Need help <strong>optimising</strong> your workflow or have a feature <strong>enquiry</strong>?
        </p>
      </section>

      <form onSubmit={handleSubmit} className="card p-8 bg-surface border border-border-light shadow-sm rounded-2xl flex flex-col gap-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput 
            label="Full Name"
            name="fullName"
            value={formData.fullName}
            handleChange={handleChange}
            errorMessage={errorMessages.fullName}
            formClassNames="w-full"
          />
          <FormInput 
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            handleChange={handleChange}
            errorMessage={errorMessages.email}
            formClassNames="w-full"
          />
        </div>

        <FormInput 
          label="Subject of Enquiry"
          name="subject"
          value={formData.subject}
          handleChange={handleChange}
          options={subjectOptions}
          errorMessage={errorMessages.subject}
        />
        <FormInput 
          label="Message"
          name="message"
          value={formData.message}
          handleChange={handleChange}
          errorMessage={errorMessages.message}
          textarea
        />

        <div className="flex justify-end pt-2">
          <button 
            type="submit" 
            disabled={status !== 'idle'}
            className="w-full md:w-max px-12 py-3 bg-brand text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-brand-dark transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {status === 'idle' && <><Send size={18} /> Send Enquiry</>}
            {status === 'sending' && "Processing..."}
            {status === 'success' && "Message Sent!"}
          </button>
        </div>
      </form>
    </div>
  );
}