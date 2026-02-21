import { useState } from "react";
import { FormInput } from "../components/ui";
import axios from "axios";
import type { RegisterUserInput } from "../features/auth/types";
import { authService } from "../services/api";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";

type ErrorMesageType = { [P in keyof RegisterUserInput]: string;  } & { general: string }


export default function Register() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: ""
  }) 
  const [errorMessages, setErrorMessages] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    general: ""
  }) 
  const [isLoading, setIsloading] = useState(false)

  const navigate = useNavigate()
  const { login } = useAuthContext()

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>){
    const { name, value } = e.target;
    setFormData(prev => ({...prev, [name]: value}))
  }

  const defaultErrorMessages = {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    general: ""
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
    e.preventDefault()
    try {
      setIsloading(true)
      
      const { token } = await authService.register(formData)
      login(token)

      navigate("/")
    } catch (err) {
      console.log(err)
      if (!axios.isAxiosError(err)){
          return
      }
      if (err.status === 400){
        const errors: Partial<ErrorMesageType> = err.response?.data?.errors;
        setErrorMessages(({ ...defaultErrorMessages, ...errors}))
      } else {
        setErrorMessages({...errorMessages, general: "Could not make account"})
      }
    } finally {
      setIsloading(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h1 className="text-3xl font-bold text-text-main transition-colors">Register</h1>
        <p className="text-text-sub">Start managing your productivity today</p>

        <form 
          className="mt-6 flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          {errorMessages.general && (
            <p 
              className="mt-4 text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4"
            >
              {errorMessages.general}
            </p>
          )}
          <FormInput 
            handleChange={handleChange}
            label="First Name"
            name="firstName"
            value={formData.firstName}
            errorMessage={errorMessages.firstName}
          />
          <FormInput 
            handleChange={handleChange}
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            errorMessage={errorMessages.lastName}
          />
          <FormInput 
            handleChange={handleChange}
            label="Email"
            name="email"
            value={formData.email}
            errorMessage={errorMessages.email}
            type="email"
          />
          <FormInput 
            handleChange={handleChange}
            label="Password"
            name="password"
            value={formData.password}
            errorMessage={errorMessages.password}
            type="password"
          />
          <FormInput 
            handleChange={handleChange}
            label="Confirm Password"
            name="confirmPassword"
            value={formData.confirmPassword}
            errorMessage={errorMessages.confirmPassword}
            type="password"
          />
          <button 
            className={isLoading ? "self-end btn-primary-disabled": "self-end btn-primary"}
            disabled={isLoading}
          >
            Register
          </button>
        </form>
      </div>
    </div>

  )
}
