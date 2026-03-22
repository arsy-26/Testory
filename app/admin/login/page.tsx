"use client";

import { useActionState } from "react";
import { adminLoginAction } from "@/actions/admin-login";

const initialState = {
  success: false,
  message: "",
  errors: {},
};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(
    adminLoginAction,
    initialState,
  );

  return (
    <div className="h-screen flex justify-center items-center bg-gray-100">
      <div className="bg-white p-10 rounded-xl shadow-lg w-96">
        <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800">
          Admin Login
        </h2>

        <form action={formAction} className="flex flex-col gap-4">
          <input
            type="text"
            name="email"
            placeholder="Email"
            className="px-4 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {state?.errors?.email && (
            <p className="text-red-500 text-sm">{state.errors.email[0]}</p>
          )}

          <input
            type="password"
            name="password"
            placeholder="Password"
            className="px-4 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {state?.errors?.password && (
            <p className="text-red-500 text-sm">{state.errors.password[0]}</p>
          )}

          {state?.message && (
            <p className="text-red-500 text-sm mt-2 text-center">
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className={`mt-4 py-2 rounded-md text-white font-medium transition-colors ${
              pending
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {pending ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
