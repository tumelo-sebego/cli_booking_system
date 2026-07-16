import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TOTAL_PCS = 50;

app.use(express.json());

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas & Models ---
const studentSchema = new mongoose.Schema({
    surname: { type: String, required: true },
    studentNumber: { type: String, required: true, unique: true }
});

const bookingSchema = new mongoose.Schema({
    studentNumber: { type: String, required: true },
    day: { type: String, required: true },
    pcNumber: { type: Number, required: true }
});

const Student = mongoose.model('Student', studentSchema);
const Booking = mongoose.model('Booking', bookingSchema);

// --- API Endpoints ---

// 1. Student Registration
app.post('/api/register', async (req, res) => {
    const { surname } = req.body;
    if (!surname || !surname.trim()) {
        return res.status(400).json({ error: 'Surname is required' });
    }

    try {
        const prefix = surname.slice(0, 3).toLowerCase().padEnd(3, 'x');
        let studentNumber = '';
        let attempts = 0;
        let isUnique = false;

        while (attempts < 1000 && !isUnique) {
            const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
            studentNumber = `${prefix}${randomDigits}`;
            
            const existing = await Student.findOne({ studentNumber });
            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            return res.status(500).json({ error: 'Could not generate a unique Student ID.' });
        }

        const newStudent = new Student({ surname, studentNumber });
        await newStudent.save();

        res.json({ studentNumber, surname });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Student Login
app.post('/api/login', async (req, res) => {
    const { studentNumber } = req.body;
    const cleanId = (studentNumber || '').trim().toLowerCase();

    try {
        const student = await Student.findOne({ studentNumber: cleanId });
        if (!student) {
            return res.status(404).json({ error: 'Student Number not found.' });
        }
        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Fetch Dashboard details (All bookings + configuration)
app.get('/api/dashboard', async (req, res) => {
    try {
        const bookings = await Booking.find({});
        res.json({
            bookings,
            totalPcs: TOTAL_PCS,
            days: DAYS
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Create Booking
app.post('/api/book', async (req, res) => {
    const { studentNumber, day, pcNumber } = req.body;
    const pc = parseInt(pcNumber, 10);

    try {
        // Enforce student rules
        const studentBookings = await Booking.find({ studentNumber });
        if (studentBookings.length >= 3) {
            return res.status(400).json({ error: 'Weekly limit of 3 bookings reached.' });
        }
        if (studentBookings.some(b => b.day === day)) {
            return res.status(400).json({ error: `You already have a booking on ${day}.` });
        }

        // Check if specific PC is already booked on that day
        const isTaken = await Booking.findOne({ day, pcNumber: pc });
        if (isTaken) {
            return res.status(400).json({ error: `PC ${pc} is already booked on ${day}.` });
        }

        const newBooking = new Booking({ studentNumber, day, pcNumber: pc });
        await newBooking.save();

        res.json({ message: `Successfully booked PC #${pc} for ${day}.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Cancel Booking
app.post('/api/cancel', async (req, res) => {
    const { studentNumber, day, pcNumber } = req.body;

    try {
        const result = await Booking.findOneAndDelete({ 
            studentNumber, 
            day, 
            pcNumber: parseInt(pcNumber, 10) 
        });

        if (!result) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        res.json({ message: 'Booking cancelled.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));