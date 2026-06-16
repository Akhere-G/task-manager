import apiClient from "../../services/api";

export interface ContactEnquiry {
  fullName: string;
  email: string;
  subject: string;
  message: string;
}

export const contactService = {
  sendEnquiry: async (enquiryData: ContactEnquiry) => {
    const response = await apiClient.post("/contact", enquiryData);
    return response.data;
  },
};
