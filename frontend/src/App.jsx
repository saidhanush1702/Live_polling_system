import React, { useState } from "react";
import Teacher from "./Pages/Teacher";
import Student from "./pages/Student";

export default function App() {
  const [role, setRole] = useState(null); // 'teacher' | 'student'
  const [confirmed, setConfirmed] = useState(false);

  if (!confirmed) {
    // Role selection screen
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <h1 className="text-4xl font-bold mb-2">Welcome to the Live Polling System</h1>
        <p className="text-lg mb-8">Please select your role to continue</p>

        <div className="flex space-x-6 mb-6">
          {/* Teacher */}
          <div
            onClick={() => setRole("teacher")}
            className={`cursor-pointer w-72 flex flex-col justify-center border-2 rounded-lg transition-colors
      ${role === "teacher" ? "border-blue-500 bg-white bg-opacity-20" : "border-black bg-transparent"} py-6 px-4`}
          >
            <span className="text-xl font-semibold mt-2">I'm a Teacher</span>
            <p className="text-sm text-gray-600 mt-2">
              Manage polls and view live results
            </p>
          </div>

          {/* Student */}
          <div
            onClick={() => setRole("student")}
            className={`cursor-pointer w-72 flex flex-col justify-center border-2 rounded-lg transition-colors
      ${role === "student" ? "border-blue-500 bg-white bg-opacity-20" : "border-black bg-transparent"} py-6 px-4`}
          >
            <span className="text-xl font-semibold mt-2">I'm a Student</span>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Participate in polls and view live results
            </p>
          </div>
        </div>

        <button
          onClick={() => role && setConfirmed(true)}
          disabled={!role}
          className={`px-6 py-3 rounded-lg text-lg text-white transition-colors
            ${role ? "bg-blue-500 hover:bg-blue-600" : "bg-gray-400 cursor-not-allowed"}`}
        >
          Continue
        </button>
      </div>
    );
  }

  // Render selected role after confirmation
  return (
    <div className="min-h-screen bg-gray-50">
      {role === "teacher" && <Teacher />}
      {role === "student" && <Student />}
    </div>
  );
}
