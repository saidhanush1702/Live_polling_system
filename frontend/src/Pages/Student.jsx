// src/pages/Student.jsx
import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";

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

  // Save student name
  const saveName = () => {
    if (!nameInput.trim()) return;
    localStorage.setItem("studentName", nameInput);
    setStudentName(nameInput);
    socket.emit("join", { name: nameInput, role: "student" });
  };

  // Fetch latest poll on load
  const fetchActivePoll = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/polls/latest");
      if (res.data) {
        setActivePoll(res.data);
        setResults(
          res.data.options.map((opt) => ({ option: opt.text, count: opt.votes || 0 }))
        );
      } else {
        setActivePoll(null);
      }
    } catch (err) {
      console.error("Error fetching latest poll:", err);
    }
  };

  useEffect(() => {
    fetchActivePoll();

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

    return () => {
      socket.off("newPoll");
      socket.off("pollResults");
    };
  }, []);

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

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Student Dashboard</h1>

      {/* Step 1: Enter Name */}
      {!studentName && (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl mb-2">Enter Your Name</h2>
          <input
            className="border p-2 w-full mb-2 rounded"
            placeholder="Your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <button
            onClick={saveName}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Save
          </button>
        </div>
      )}

      {/* Step 2: Waiting screen if no poll */}
      {studentName && !activePoll && (
        <div className="bg-gray-100 p-6 rounded shadow mt-4 text-center">
          <h2 className="text-xl font-semibold text-gray-700">
            ⏳ Waiting for teacher to start a poll...
          </h2>
        </div>
      )}

      {/* Step 3: Poll Question */}
      {studentName && activePoll && !answered && (
        <div className="bg-white p-4 rounded shadow mt-4">
          <h2 className="text-xl font-semibold mb-2">{activePoll.question}</h2>
          <div className="space-y-2">
            {activePoll.options.map((opt, idx) => (
              <label
                key={idx}
                className={`block p-3 border rounded cursor-pointer ${
                  selectedOption === opt.text ? "bg-blue-100 border-blue-500" : ""
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
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Submit Answer
            </button>
            <span className="text-gray-600">⏱ {timeLeft}s left</span>
          </div>
        </div>
      )}

      {/* Step 4: Show Results */}
      {studentName && (answered || timeLeft <= 0) && results.length > 0 && (
        <div className="bg-white p-4 rounded shadow mt-4">
          <h2 className="text-xl font-semibold mb-2">Live Results</h2>
          <div className="space-y-2">
            {results.map((res, idx) => {
              const totalVotes = results.reduce((sum, r) => sum + r.count, 0);
              const percentage = totalVotes ? (res.count / totalVotes) * 100 : 0;

              return (
                <div
                  key={idx}
                  className="relative border rounded p-3 bg-gray-100 overflow-hidden"
                >
                  {/* Background fill bar */}
                  <div
                    className="absolute top-0 left-0 h-full bg-blue-500 opacity-50"
                    style={{ width: `${percentage}%` }}
                  ></div>

                  {/* Option text */}
                  <span className="relative z-10 font-medium">{res.option}</span>

                  {/* Percentage text */}
                  <span className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 text-sm font-medium">
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
