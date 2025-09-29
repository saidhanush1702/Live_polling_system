require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const Poll = require('./models/Poll');

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// --- In-memory state ---
let currentPoll = null;
const connectedStudents = new Map(); // socketId -> { name, answered }

// --- Helper: format poll ---
function pollToClient(pollDoc) {
  if (!pollDoc) return null;
  return {
    _id: pollDoc._id,
    question: pollDoc.question,
    options: pollDoc.options.map((o) => ({ text: o.text, votes: o.votes || 0 })),
    duration: pollDoc.duration,
    startedAt: pollDoc.startedAt,
    ended: pollDoc.ended,
  };
}

// =========================
// Socket.io logic
// =========================
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join', ({ name, role }) => {
    if (role === 'student') {
      connectedStudents.set(socket.id, { name, answered: false });
      io.emit('updateParticipants', Array.from(connectedStudents.values()).map((s) => s.name));
    } else if (role === 'teacher') {
      if (currentPoll) socket.emit('newPoll', pollToClient(currentPoll));
    }
  });

  socket.on('createPoll', async ({ question, options, duration = 60 }) => {
    try {
      if (!question || !options || options.length < 2) {
        socket.emit('errorMessage', 'Invalid poll data');
        return;
      }
      if (currentPoll && !currentPoll.ended) {
        socket.emit('errorMessage', 'A poll is already active');
        return;
      }

      const poll = new Poll({
        question,
        options: options.map((opt) => ({ text: opt, votes: 0 })),
        duration,
        startedAt: new Date(),
        ended: false,
      });

      await poll.save();
      currentPoll = poll;

      for (const student of connectedStudents.values()) student.answered = false;

      io.emit('newPoll', pollToClient(poll));

      setTimeout(async () => {
        try {
          const p = await Poll.findById(poll._id);
          if (!p || p.ended) return;
          p.ended = true;
          p.endedAt = new Date();
          await p.save();
          currentPoll = null;
          io.emit('pollEnded', pollToClient(p));
        } catch (err) {
          console.error('Auto-end error:', err);
        }
      }, duration * 1000);
    } catch (err) {
      console.error('Create poll error:', err);
      socket.emit('errorMessage', 'Server error creating poll');
    }
  });

  socket.on('submitAnswer', async ({ pollId, optionIndex }) => {
    try {
      const poll = await Poll.findById(pollId);
      if (!poll || poll.ended) return socket.emit('errorMessage', 'Poll ended or not found');

      const student = connectedStudents.get(socket.id);
      if (student?.answered) return socket.emit('errorMessage', 'Already answered');

      const name = student?.name || 'Anonymous';
      poll.answers.push({ studentName: name, optionIndex });
      poll.options[optionIndex].votes = (poll.options[optionIndex].votes || 0) + 1;
      await poll.save();

      if (student) student.answered = true;

      io.emit('pollResults', pollToClient(poll));

      const totalStudents = connectedStudents.size;
      if (totalStudents > 0 && poll.answers.length >= totalStudents) {
        poll.ended = true;
        poll.endedAt = new Date();
        await poll.save();
        currentPoll = null;
        io.emit('pollEnded', pollToClient(poll));
      }
    } catch (err) {
      console.error('Submit answer error:', err);
      socket.emit('errorMessage', 'Server error submitting answer');
    }
  });

  socket.on('kickStudent', (data) => {
    const { studentName } = data;
    const entry = Array.from(connectedStudents.entries()).find(([id, s]) => s.name === studentName);
    if (entry) {
      const [sockId] = entry;
      connectedStudents.delete(sockId);
      io.to(sockId).emit('kicked');
      io.emit('updateParticipants', Array.from(connectedStudents.values()).map((s) => s.name));
    }
  });

  socket.on('disconnect', () => {
    connectedStudents.delete(socket.id);
    io.emit('updateParticipants', Array.from(connectedStudents.values()).map((s) => s.name));
  });
});

// ===================
// REST API
// ===================

// Get all polls
app.get('/api/polls', async (req, res) => {
  try {
    const polls = await Poll.find().sort({ createdAt: -1 });
    res.json(polls.map(pollToClient));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get latest poll
app.get('/api/polls/latest', async (req, res) => {
  try {
    const poll = await Poll.findOne().sort({ createdAt: -1 });
    if (!poll) return res.json(null);
    res.json(pollToClient(poll));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get poll by id
app.get('/api/polls/:id', async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ error: 'Not Found' });
    res.json(pollToClient(poll));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create poll via REST
app.post('/api/polls', async (req, res) => {
  try {
    const { question, options, duration = 60 } = req.body;
    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'Poll must have a question and at least 2 options' });
    }
    if (currentPoll && !currentPoll.ended) {
      return res.status(409).json({ error: 'An active poll is already running' });
    }

    const poll = new Poll({
      question,
      options: options.map((opt) => ({ text: opt, votes: 0 })),
      duration,
      startedAt: new Date(),
      ended: false,
    });

    await poll.save();
    currentPoll = poll;

    for (const student of connectedStudents.values()) student.answered = false;

    io.emit('newPoll', pollToClient(poll));

    setTimeout(async () => {
      const p = await Poll.findById(poll._id);
      if (!p || p.ended) return;
      p.ended = true;
      p.endedAt = new Date();
      await p.save();
      currentPoll = null;
      io.emit('pollEnded', pollToClient(p));
    }, duration * 1000);

    res.status(201).json(pollToClient(poll));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating poll' });
  }
});

// ===================
// Mongo + server start
// ===================
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    const port = process.env.PORT || 5000;
    server.listen(port, () => console.log(`Server listening on port ${port}`));
  })
  .catch((err) => console.error('MongoDB connection error:', err));
