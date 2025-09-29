import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";

const socket = io("http://localhost:5000");

export default function Teacher() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState(30);
  const [activePoll, setActivePoll] = useState(null);
  const [results, setResults] = useState([]);
  const [pastPolls, setPastPolls] = useState([]);
  const [showPastPolls, setShowPastPolls] = useState(false);

  const [participants, setParticipants] = useState([]); 
  const [showChat, setShowChat] = useState(false); 

  const [timeLeft, setTimeLeft] = useState(0);

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
      setResults(data.options.map((opt) => ({ option: opt.text, count: opt.votes })));
    });

    socket.on("newPoll", (poll) => {
      setActivePoll(poll);
      setResults(poll.options.map((opt) => ({ option: opt.text, count: opt.votes })));
      setTimeLeft(poll.duration || 30);
    });

    socket.on("pollEnded", () => {
      setActivePoll(null);
      fetchPastPolls();
    });

    socket.on("updateParticipants", (data) => {
      setParticipants(data); 
    });

    return () => {
      socket.off("pollResults");
      socket.off("newPoll");
      socket.off("pollEnded");
      socket.off("updateParticipants");
    };
  }, []);

  // Countdown timer for teacher
  useEffect(() => {
    if (!activePoll || timeLeft <= 0) return;

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);

      if (timeLeft - 1 <= 0) {
        // Poll automatically ends after timer
        setActivePoll(null);
        fetchPastPolls();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, activePoll]);

  const addOption = () => setOptions([...options, ""]);
  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const createPoll = () => {
    if (!question || options.some((opt) => !opt.trim())) return;

    socket.emit("createPoll", { question, options, duration });

    setQuestion("");
    setOptions(["", ""]);
    setDuration(30);
  };

  const kickStudent = (studentName) => {
    socket.emit("kickStudent", { studentName });
  };

  const renderPollResults = (poll) => {
    const totalVotes = poll.options.reduce((sum, r) => sum + r.votes, 0);

    return (
      <div className="bg-[#F2F2F2] p-4 rounded shadow mb-6">
        <h2 className="text-[#373737] text-xl font-semibold mb-2">{poll.question}</h2>
        <div className="space-y-2">
          {poll.options.map((opt, idx) => {
            const percentage = totalVotes ? (opt.votes / totalVotes) * 100 : 0;
            return (
              <div
                key={idx}
                className="relative border rounded p-3 bg-[#EAEAEA] overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 h-full bg-[#7765DA] opacity-50"
                  style={{ width: `${percentage}%` }}
                ></div>
                <span className="relative z-10 font-medium text-[#373737]">{opt.text}</span>
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 text-sm font-medium text-[#6E6E6E]">
                  {Math.round(percentage)}%
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-sm text-[#6E6E6E] font-medium">⏱ {timeLeft}s left</div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-[#4F0DCE] text-3xl font-bold mb-4">Teacher Dashboard</h1>

      {/* Create Poll */}
      {!activePoll && (
        <div className="bg-[#F2F2F2] p-4 rounded shadow mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#373737] text-xl font-semibold">Create New Poll</h2>
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-1 text-[#6E6E6E]">Duration</label>
              <select
                className="border p-2 rounded w-32 text-[#373737]"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
              </select>
            </div>
          </div>

          <input
            className="border p-2 w-full mb-2 rounded text-[#373737]"
            placeholder="Enter question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          {options.map((opt, idx) => (
            <input
              key={idx}
              className="border p-2 w-full mb-2 rounded text-[#373737]"
              placeholder={`Option ${idx + 1}`}
              value={opt}
              onChange={(e) => updateOption(idx, e.target.value)}
            />
          ))}

          <div className="flex items-center space-x-2">
            <button
              onClick={addOption}
              className="bg-[#5767D0] text-white px-3 py-1 rounded"
            >
              + Add Option
            </button>
            <button
              onClick={createPoll}
              className="bg-[#4F0DCE] text-white px-4 py-2 rounded"
            >
              Create Poll
            </button>
          </div>
        </div>
      )}

      {/* Active Poll */}
      {activePoll && renderPollResults(activePoll)}

      {/* Toggle Past Polls */}
      <button
        onClick={() => setShowPastPolls((prev) => !prev)}
        className="bg-[#4F0DCE] text-white px-4 py-2 rounded mb-4"
      >
        {showPastPolls ? "Hide Past Polls" : "View Past Polls"}
      </button>

      {/* Past Polls */}
      {showPastPolls &&
        pastPolls.map((poll) => <div key={poll._id}>{renderPollResults(poll)}</div>)}

      {/* Participants Chat Button */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => setShowChat(!showChat)}
          className="bg-[#7765DA] w-14 h-14 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
        >
          💬
        </button>
      </div>

      {/* Participants Panel */}
      {showChat && (
        <div className="fixed bottom-20 right-6 w-64 bg-[#F2F2F2] rounded shadow p-4">
          <h3 className="text-[#373737] font-semibold mb-2">Participants</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {participants.length === 0 && (
              <p className="text-[#6E6E6E] text-sm">No participants yet</p>
            )}
            {participants.map((p, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-2 bg-[#EAEAEA] rounded"
              >
                <span className="text-[#373737]">{p}</span>
                <button
                  onClick={() => kickStudent(p)}
                  className="bg-[#4F0DCE] text-white px-2 py-1 rounded text-sm"
                >
                  Kick
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
