const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect('mongodb+srv://mwasilah:wasil123@erp.17pmb.mongodb.net/ps3rental?retryWrites=true&w=majority&appName=erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch(err => {
  console.log('MongoDB connection failed:', err.message);
  console.log('Server will run without database (sessions will be stored in memory only)');
});

// Schema untuk session rental
const sessionSchema = new mongoose.Schema({
  tvId: { type: Number, required: true },
  startTime: { type: Date, default: Date.now },
  duration: { type: Number, required: true }, // dalam menit
  remainingTime: { type: Number, required: true }, // dalam detik
  status: { type: String, enum: ['active', 'paused', 'stopped'], default: 'active' },
  totalCost: { type: Number, default: 0 }
});

const Session = mongoose.model('Session', sessionSchema);

// State management
let activeSessions = new Map(); // tvId -> session data
let intervals = new Map(); // tvId -> interval ID
let tvLockStatus = new Map(); // tvId -> locked status

// Initialize all TVs as locked
for (let i = 1; i <= 5; i++) {
  tvLockStatus.set(i, true);
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/tv/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tv.html'));
});

// API Routes
app.post('/api/start-session', async (req, res) => {
  const { tvId, duration } = req.body; // duration dalam menit
  
  try {
    // Stop existing session if any
    if (activeSessions.has(tvId)) {
      await stopSession(tvId);
    }

    const session = new Session({
      tvId,
      duration,
      remainingTime: duration * 60 // convert to seconds
    });

    if (mongoose.connection.readyState === 1) {
      await session.save();
    }
    
    activeSessions.set(tvId, {
      sessionId: session._id,
      remainingTime: duration * 60,
      status: 'active'
    });

    // Unlock TV when session starts
    tvLockStatus.set(tvId, false);
    io.emit('tv-lock-update', {
      tvId,
      locked: false
    });

    startTimer(tvId);
    
    io.emit('session-update', {
      tvId,
      remainingTime: duration * 60,
      status: 'active'
    });

    res.json({ success: true, sessionId: session._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pause-session', async (req, res) => {
  const { tvId } = req.body;
  
  try {
    const sessionData = activeSessions.get(tvId);
    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }

    clearInterval(intervals.get(tvId));
    sessionData.status = 'paused';
    
    if (mongoose.connection.readyState === 1) {
      await Session.findByIdAndUpdate(sessionData.sessionId, {
        remainingTime: sessionData.remainingTime,
        status: 'paused'
      });
    }

    io.emit('session-update', {
      tvId,
      remainingTime: sessionData.remainingTime,
      status: 'paused'
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/resume-session', async (req, res) => {
  const { tvId } = req.body;
  
  try {
    const sessionData = activeSessions.get(tvId);
    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }

    sessionData.status = 'active';
    startTimer(tvId);
    
    if (mongoose.connection.readyState === 1) {
      await Session.findByIdAndUpdate(sessionData.sessionId, {
        status: 'active'
      });
    }

    io.emit('session-update', {
      tvId,
      remainingTime: sessionData.remainingTime,
      status: 'active'
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/extend-session', async (req, res) => {
  const { tvId, additionalMinutes } = req.body;
  
  try {
    const sessionData = activeSessions.get(tvId);
    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }

    sessionData.remainingTime += additionalMinutes * 60;
    
    if (mongoose.connection.readyState === 1) {
      await Session.findByIdAndUpdate(sessionData.sessionId, {
        remainingTime: sessionData.remainingTime,
        duration: { $inc: additionalMinutes }
      });
    }

    io.emit('session-update', {
      tvId,
      remainingTime: sessionData.remainingTime,
      status: sessionData.status
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stop-session', async (req, res) => {
  const { tvId } = req.body;
  
  try {
    await stopSession(tvId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions', (req, res) => {
  const sessions = [];
  for (let [tvId, data] of activeSessions) {
    sessions.push({
      tvId,
      remainingTime: data.remainingTime,
      status: data.status
    });
  }
  res.json(sessions);
});

// Lock/Unlock TV
app.post('/api/lock-tv', (req, res) => {
  const { tvId } = req.body;
  tvLockStatus.set(tvId, true);
  
  io.emit('tv-lock-update', {
    tvId,
    locked: true
  });
  
  res.json({ success: true });
});

app.post('/api/unlock-tv', (req, res) => {
  const { tvId } = req.body;
  tvLockStatus.set(tvId, false);
  
  io.emit('tv-lock-update', {
    tvId,
    locked: false
  });
  
  res.json({ success: true });
});

app.get('/api/tv-status', (req, res) => {
  const status = [];
  for (let i = 1; i <= 5; i++) {
    status.push({
      tvId: i,
      locked: tvLockStatus.get(i) || false,
      hasSession: activeSessions.has(i)
    });
  }
  res.json(status);
});

// Helper functions
function startTimer(tvId) {
  const sessionData = activeSessions.get(tvId);
  if (!sessionData) return;

  const intervalId = setInterval(async () => {
    if (sessionData.status !== 'active') return;
    
    sessionData.remainingTime--;
    
    if (sessionData.remainingTime <= 0) {
      await stopSession(tvId);
      return;
    }

    // Update database every 30 seconds
    if (sessionData.remainingTime % 30 === 0 && mongoose.connection.readyState === 1) {
      await Session.findByIdAndUpdate(sessionData.sessionId, {
        remainingTime: sessionData.remainingTime
      });
    }

    io.emit('timer-update', {
      tvId,
      remainingTime: sessionData.remainingTime
    });
  }, 1000);

  intervals.set(tvId, intervalId);
}

async function stopSession(tvId) {
  const sessionData = activeSessions.get(tvId);
  if (!sessionData) return;

  clearInterval(intervals.get(tvId));
  intervals.delete(tvId);
  activeSessions.delete(tvId);

  // Lock TV when session stops
  tvLockStatus.set(tvId, true);
  
  if (mongoose.connection.readyState === 1) {
    await Session.findByIdAndUpdate(sessionData.sessionId, {
      status: 'stopped',
      remainingTime: 0
    });
  }

  io.emit('session-update', {
    tvId,
    remainingTime: 0,
    status: 'stopped'
  });
  
  io.emit('tv-lock-update', {
    tvId,
    locked: true
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('register-tv', (tvId) => {
    socket.join(`tv-${tvId}`);
    
    // Send current session data if exists
    const sessionData = activeSessions.get(parseInt(tvId));
    if (sessionData) {
      socket.emit('session-update', {
        tvId: parseInt(tvId),
        remainingTime: sessionData.remainingTime,
        status: sessionData.status
      });
    }
    
    // Send current lock status
    socket.emit('tv-lock-update', {
      tvId: parseInt(tvId),
      locked: tvLockStatus.get(parseInt(tvId)) || false
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin Dashboard: http://localhost:${PORT}`);
  console.log(`TV Display: http://localhost:${PORT}/tv/[1-5]`);
});