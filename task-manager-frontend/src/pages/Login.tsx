import { useState } from "react";
import { FormInput } from "../components/ui";
import axios from "axios";
import type { LoginUserInput } from "../features/auth/types";
import { authService } from "../services/api";
import { useAuthContext } from "../context/AuthContext";

type ErrorMesageType = { [P in keyof LoginUserInput]: string;  } & { general: string }


export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  }) 
  const [errorMessages, setErrorMessages] = useState({
    email: "",
    password: "",
    general: ""
  }) 
  const [isLoading, setIsloading] = useState(false)

  const { login } = useAuthContext()

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>){
    const { name, value } = e.target;
    setFormData(prev => ({...prev, [name]: value}))
  }

  const defaultErrorMessages = {
    email: "",
    password: "",
    general: ""
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
    e.preventDefault()
    try {
      setIsloading(true)
      
      const { token } = await authService.login(formData)
      login(token)

    } catch (err) {
      console.log(err)
      if (!axios.isAxiosError(err)){
          return
      }
      
      if (err.status === 401) {
        setErrorMessages({...defaultErrorMessages, general: "Email or password is incorrect"})
      }
      else if (err.status === 400){
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
        <h1 className="text-3xl font-bold text-text-main transition-colors">Login</h1>
        <p className="text-text-sub">Increase your productivity today</p>

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
          <button 
            className={isLoading ? "self-end btn-primary-disabled": "self-end btn-primary"}
            disabled={isLoading}
          >
            Login
          </button>
        </form>
      </div>
    </div>

  )
}
