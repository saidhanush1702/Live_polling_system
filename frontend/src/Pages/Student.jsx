// src/pages/Student.jsx
import React, { useState, useEffect } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

export default function Student() {
  const [studentName, setStudentName] = useState(
    localStorage.getItem("studentName") || ""
  );
  const [nameInput, setNameInput] = useState("");
  const [activePoll, setActivePoll] = useState(null);
  const [selectedOption, setSelectedOption] = useState("");
  const [results, setResults] = useState([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [answered, setAnswered] = useState(false);
  const [kicked, setKicked] = useState(false);

  // Save student name and emit join
  const saveName = () => {
    if (!nameInput.trim()) return;
    localStorage.setItem("studentName", nameInput);
    setStudentName(nameInput);
    socket.emit("join", { name: nameInput, role: "student" });
  };

  // On mount: listen for events
  useEffect(() => {
    if (studentName) {
      socket.emit("join", { name: studentName, role: "student" });
    }

    socket.on("newPoll", (poll) => {
      setActivePoll(poll);
      setAnswered(false);
      setSelectedOption("");
      setTimeLeft(poll.duration || 60);
      setResults(poll.options.map((opt) => ({ option: opt.text, count: opt.votes || 0 })));
    });

    socket.on("pollResults", (poll) => {
      setResults(poll.options.map((opt) => ({ option: opt.text, count: opt.votes || 0 })));
    });

    socket.on("kicked", () => {
      setKicked(true);
      setStudentName("");
      localStorage.removeItem("studentName");
      setActivePoll(null);
      setSelectedOption("");
      setAnswered(false);
      alert("You have been removed by the teacher.");
    });

    return () => {
      socket.off("newPoll");
      socket.off("pollResults");
      socket.off("kicked");
    };
  }, [studentName]);

  // Countdown timer
  useEffect(() => {
    if (!activePoll || answered) return;
    if (timeLeft <= 0) {
      setAnswered(true);
      return;
    }
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, activePoll, answered]);

  // Submit answer
  const submitAnswer = () => {
    if (!selectedOption || !studentName || !activePoll) return;

    const optionIndex = activePoll.options.findIndex(
      (opt) => opt.text === selectedOption
    );

    socket.emit("submitAnswer", {
      pollId: activePoll._id,
      optionIndex,
    });

    setAnswered(true);
  };

  if (kicked) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl text-red-600 font-semibold">
          You have been removed by the teacher.
        </h2>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-[#4F0DCE] text-3xl font-bold mb-4">Student Dashboard</h1>

      {/* Step 1: Enter Name */}
      {!studentName && (
        <div className="bg-[#F2F2F2] p-4 rounded shadow">
          <h2 className="text-[#373737] text-xl mb-2">Enter Your Name</h2>
          <input
            className="border p-2 w-full mb-2 rounded text-[#373737]"
            placeholder="Your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <button
            onClick={saveName}
            className="bg-[#4F0DCE] text-white px-4 py-2 rounded"
          >
            Save
          </button>
        </div>
      )}

      {/* Waiting screen if no active poll */}
      {studentName && !activePoll && (
        <div className="bg-[#F2F2F2] p-6 rounded shadow mt-4 text-center">
          <h2 className="text-xl font-semibold text-[#6E6E6E]">
            ⏳ Waiting for teacher to start a poll...
          </h2>
        </div>
      )}

      {/* Poll Question */}
      {studentName && activePoll && !answered && (
        <div className="bg-[#F2F2F2] p-4 rounded shadow mt-4">
          <h2 className="text-xl font-semibold mb-2 text-[#373737]">{activePoll.question}</h2>
          <div className="space-y-2">
            {activePoll.options.map((opt, idx) => (
              <label
                key={idx}
                className={`block p-3 border rounded cursor-pointer ${
                  selectedOption === opt.text
                    ? "bg-[#7765DA] text-white border-[#4F0DCE]"
                    : "bg-[#F2F2F2] border-[#6E6E6E] text-[#373737]"
                }`}
              >
                <input
                  type="radio"
                  name="answer"
                  value={opt.text}
                  checked={selectedOption === opt.text}
                  onChange={() => setSelectedOption(opt.text)}
                  className="mr-2"
                />
                {opt.text}
              </label>
            ))}
          </div>
          <div className="flex justify-between items-center mt-3">
            <button
              onClick={submitAnswer}
              className="bg-[#4F0DCE] text-white px-4 py-2 rounded"
            >
              Submit Answer
            </button>
            <span className="text-[#6E6E6E]">⏱ {timeLeft}s left</span>
          </div>
        </div>
      )}

      {/* Show Results only after answering */}
      {studentName && activePoll && answered && results.length > 0 && (
        <div className="bg-[#F2F2F2] p-4 rounded shadow mt-4">
          <h2 className="text-xl font-semibold mb-2 text-[#373737]">Live Results</h2>
          <div className="space-y-2">
            {results.map((res, idx) => {
              const totalVotes = results.reduce((sum, r) => sum + r.count, 0);
              const percentage = totalVotes ? (res.count / totalVotes) * 100 : 0;

              return (
                <div
                  key={idx}
                  className="relative border rounded p-3 bg-[#EAEAEA] overflow-hidden"
                >
                  <div
                    className="absolute top-0 left-0 h-full bg-[#7765DA] opacity-50"
                    style={{ width: `${percentage}%` }}
                  ></div>
                  <span className="relative z-10 font-medium text-[#373737]">{res.option}</span>
                  <span className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 text-sm font-medium text-[#6E6E6E]">
                    {Math.round(percentage)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
