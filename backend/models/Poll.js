const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: { type: Number, default: 0 },
});

const AnswerSchema = new mongoose.Schema({
  studentName: String,
  optionIndex: Number,
  answeredAt: { type: Date, default: Date.now },
});

const PollSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [OptionSchema],
    answers: [AnswerSchema],
    duration: { type: Number, default: 60 }, // seconds
    startedAt: Date,
    ended: { type: Boolean, default: false },
    endedAt: Date,
  },
  { timestamps: true } // adds createdAt, updatedAt
);

module.exports = mongoose.model('Poll', PollSchema);
