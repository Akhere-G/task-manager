import { useState } from "react";
import { FormInput } from "../components/ui";
import axios from "axios";
import type { LoginUserInput } from "../features/auth/types";
import { authService } from "../services/api";
import { useAuthContext } from "../context/AuthContext";
import { validateUser, type UserData } from "../utils/validators";

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
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  }) 

  const [isLoading, setIsloading] = useState(false)

  const { login } = useAuthContext()

  const validateForm = (data: UserData) => {
      setErrorMessages({...defaultErrorMessages, ...validateUser(data, false) })
    }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>){
    const { name, value } = e.target;
    const newFormData = ({...formData, [name]: value})
    setFormData(newFormData)
    validateForm(newFormData)
  }

  function handleBlur(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>){
    const { name } = e.target;
    setTouched(prev => ({...prev, [name]: true}))
  }

  const defaultErrorMessages = {
    email: "",
    password: "",
    general: ""
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
    e.preventDefault()
    setTouched({
        email: true,
        password: true,
    })

    if (Object.entries(errorMessages).some(([k, v]) => v !== "" && k !== "general")) return 

    try {
      setIsloading(true)
      
      const { token } = await authService.login(formData)
      login(token)

    } catch (err) {
      console.log(err)
      if (!axios.isAxiosError(err)){
          return
      }
      
      else if (err.status === 400){
        const errors: Partial<ErrorMesageType> = err.response?.data?.errors;
        setErrorMessages(({ ...defaultErrorMessages, ...errors, general: err.response?.data?.error ?? "" }))
      } else {
        setErrorMessages({...errorMessages, general: "Sorry... Something went wrong."})
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
            touched={touched.email}
            handleBlur={handleBlur}
          />
          <FormInput 
            handleChange={handleChange}
            label="Password"
            name="password"
            value={formData.password}
            errorMessage={errorMessages.password}
            type="password"
            touched={touched.password}
            handleBlur={handleBlur}
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
