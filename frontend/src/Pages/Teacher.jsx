// src/pages/Teacher.jsx
import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";

const socket = io("http://localhost:5000");

export default function Teacher() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState(30); // default 30 seconds
  const [activePoll, setActivePoll] = useState(null);
  const [results, setResults] = useState([]);
  const [pastPolls, setPastPolls] = useState([]);

  // Fetch past polls
  useEffect(() => {
    fetchPastPolls();
  }, []);

  const fetchPastPolls = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/polls");
      setPastPolls(res.data);
    } catch (err) {
      console.error("Error fetching past polls:", err);
    }
  };

  // Socket listeners
  useEffect(() => {
    socket.on("pollResults", (data) => {
      setResults(
        data.options.map((opt) => ({ option: opt.text, count: opt.votes }))
      );
    });

    socket.on("newPoll", (poll) => {
      setActivePoll(poll);
      setResults(
        poll.options.map((opt) => ({ option: opt.text, count: opt.votes }))
      );
    });

    socket.on("pollEnded", (poll) => {
      setActivePoll(null);
      fetchPastPolls();
    });

    return () => {
      socket.off("pollResults");
      socket.off("newPoll");
      socket.off("pollEnded");
    };
  }, []);

  // Add option field
  const addOption = () => setOptions([...options, ""]);

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  // Create poll
  const createPoll = () => {
    if (!question || options.some((opt) => !opt.trim())) return;

    socket.emit("createPoll", { question, options, duration });

    setQuestion("");
    setOptions(["", ""]);
    setDuration(30);
  };

  // End poll manually
  const endPoll = () => {
    socket.emit("endPoll"); // send event to backend
    setActivePoll(null);
    fetchPastPolls();
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Teacher Dashboard</h1>

      {/* Create Poll */}
      {!activePoll && (
        <div className="bg-white p-4 rounded shadow mb-6">
          <h2 className="text-xl font-semibold mb-2">Create New Poll</h2>
          <input
            className="border p-2 w-full mb-2 rounded"
            placeholder="Enter question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          {options.map((opt, idx) => (
            <input
              key={idx}
              className="border p-2 w-full mb-2 rounded"
              placeholder={`Option ${idx + 1}`}
              value={opt}
              onChange={(e) => updateOption(idx, e.target.value)}
            />
          ))}
          <button
            onClick={addOption}
            className="bg-gray-300 px-3 py-1 rounded mr-2"
          >
            + Add Option
          </button>

          {/* Poll Duration */}
          <input
            type="number"
            className="border p-2 w-full mb-2 rounded"
            placeholder="Duration in seconds"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />

          <button
            onClick={createPoll}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Create Poll
          </button>
        </div>
      )}

      {/* Active Poll Results */}
      {activePoll && (
        <div className="bg-white p-4 rounded shadow mb-6">
          <h2 className="text-xl font-semibold mb-2">{activePoll.question}</h2>
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

          <button
            onClick={endPoll}
            className="bg-red-500 text-white px-4 py-2 rounded mt-4"
          >
            End Poll
          </button>
        </div>
      )}

      {/* Past Polls */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Past Polls</h2>
        {pastPolls.map((poll) => (
          <div key={poll._id} className="border-b py-2">
            <p className="font-medium">{poll.question}</p>
            <ul className="ml-4 list-disc">
              {poll.options.map((opt, idx) => (
                <li key={idx}>
                  {opt.text} - {opt.votes} votes
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
