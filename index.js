const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors'); 
require('dotenv').config();


const app = express();
const PORT = 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
});

// Booked Seat Schema
const bookedSeatSchema = new mongoose.Schema({
    seatNumber: {
        type: Number,
        required: true,
        unique: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const BookedSeat = mongoose.model('BookedSeat', bookedSeatSchema);

app.use(bodyParser.json());
app.use(cors()); 

// Get available seats
app.get('/seats', async (req, res) => {
    let availableSeats = Array(80).fill(true);

    try {
        const bookedSeats = await BookedSeat.find({}, 'seatNumber -_id');
        
        bookedSeats.forEach(seat => {
            availableSeats[seat.seatNumber - 1] = false; // Seat numbers are 1-based
        });

        res.json(availableSeats);
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Reserve seats
app.post('/reserve', async (req, res) => {
    const { numSeats } = req.body;

    if (numSeats <= 0 || numSeats > 7) {
        return res.status(400).json({ message: 'Invalid number of seats' });
    }

    let startIdx = -1;

    try {
        // Check for consecutive seats in one row
        for (let i = 0; i <= 80 - numSeats; i++) {
            let consecutive = true;
            for (let j = 0; j < numSeats; j++) {
                if (await BookedSeat.exists({ seatNumber: i + j + 1 }) || 
                    (i + j + 1) % 7 === 0 || 
                    ((i + j + 1) % 7 === 4 && (i + j + 1) % 7 === 5)) {
                    consecutive = false;
                    break;
                }
            }

            if (consecutive) {
                startIdx = i + 1; // Seat numbers are 1-based
                break;
            }
        }

        // If no consecutive seats in one row, book nearby seats
        if (startIdx === -1) {
            for (let i = 0; i < 80; i++) {
                if (!await BookedSeat.exists({ seatNumber: i + 1 })) {
                    startIdx = i + 1;
                    for (let j = startIdx; j < startIdx + numSeats; j++) {
                        const newSeat = new BookedSeat({ seatNumber: j });
                        await newSeat.save();
                    }
                    break;
                }
            }
        } else {
            for (let i = startIdx; i < startIdx + numSeats; i++) {
                const newSeat = new BookedSeat({ seatNumber: i });
                await newSeat.save();
            }
        }

        if (startIdx === -1) {
            return res.status(400).json({ message: 'No consecutive or nearby seats available' });
        }

        res.json({ 
            message: `Successfully booked seats ${startIdx} to ${startIdx + numSeats - 1}`,
            bookedSeatNumbers: Array.from({ length: numSeats }, (_, i) => startIdx + i) // Generate booked seat numbers array
        });
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/reset', async (req, res) => {
    try {
      await BookedSeat.deleteMany({}); // Delete all booked seats
      res.json({ message: 'All seats have been reset' });
    } catch (err) {
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
