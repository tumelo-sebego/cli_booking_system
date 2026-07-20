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
// Explicitly load the .env file from the backend folder
dotenv.config({ path: 'backend/.env' });

mongoose.connect(process.env.MONGODB_URI)
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas & Models ---
const studentSchema = new mongoose.Schema({
    surname: { type: String, required: true },
    studentNumber: { type: String, required: true, unique: true },
    isLoggedIn: { type: Boolean, default: false }
});

const bookingSchema = new mongoose.Schema({
    studentNumber: { type: String, required: true },
    day: { type: String, required: true },
    pcNumber: { type: Number, required: true }
});

const adminSchema = new mongoose.Schema({
    adminName: { type: String, required: true },
    adminNumber: { type: String, required: true, unique: true },
    isLoggedIn: { type: Boolean, default: false }
});

const Student = mongoose.model('Student', studentSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const Admin = mongoose.model('Admin', adminSchema);

// --- Admin Endpoints ---

// 1. Admin Registration
app.post('/api/admin/register', async (req, res) => {
    const { adminName } = req.body;
    if (!adminName || !adminName.trim()) {
        return res.status(400).json({ error: 'Admin name is required' });
    }

    try {
        const prefix = 'a-' + adminName.slice(0, 3).toLowerCase();
        const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
        const adminNumber = `${prefix}${randomDigits}`;

        const newAdmin = new Admin({ adminName, adminNumber });
        await newAdmin.save();

        res.json({ adminNumber, adminName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Admin Login
app.post('/api/admin/login', async (req, res) => {
    const { adminNumber } = req.body;
    const cleanId = (adminNumber || '').trim().toLowerCase();

    try {
        const admin = await Admin.findOne({ adminNumber: cleanId });
        if (!admin) {
            return res.status(404).json({ error: 'Admin Number not found.' });
        }
        if (admin.isLoggedIn) {
            return res.status(403).json({ error: 'Admin is already logged in elsewhere.' });
        }
        
        admin.isLoggedIn = true;
        await admin.save();
        res.json(admin);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Admin Logout
app.post('/api/admin/logout', async (req, res) => {
    const { adminNumber } = req.body;
    const cleanId = (adminNumber || '').trim().toLowerCase();

    try {
        const admin = await Admin.findOne({ adminNumber: cleanId });
        if (!admin) {
            return res.status(404).json({ error: 'Admin Number not found.' });
        }
        
        admin.isLoggedIn = false;
        await admin.save();
        res.json({ message: 'Admin logged out successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Admin Dashboard Data
app.get('/api/admin/dashboard', async (req, res) => {
    try {
        const loggedInStudents = await Student.find({ isLoggedIn: true });
        const allBookings = await Booking.find({});
        // Assuming we need to track today's logins - since we don't have a login log,
        // we can filter students who have an active session or similar if we added a lastLogin field.
        // For now, returning logged in students + total bookings.
        res.json({
            loggedInStudents,
            totalBookings: allBookings.length,
            bookings: allBookings
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Admin Cancel Booking
app.post('/api/admin/cancel', async (req, res) => {
    const { bookingId } = req.body;
    try {
        const result = await Booking.findByIdAndDelete(bookingId);
        if (!result) return res.status(404).json({ error: 'Booking not found.' });
        res.json({ message: 'Booking cancelled by admin.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
        if (student.isLoggedIn) {
            return res.status(403).json({ error: 'Student is already logged in elsewhere.' });
        }
        
        student.isLoggedIn = true;
        await student.save();
        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2.5 Student Logout
app.post('/api/logout', async (req, res) => {
    const { studentNumber } = req.body;
    const cleanId = (studentNumber || '').trim().toLowerCase();

    try {
        const student = await Student.findOne({ studentNumber: cleanId });
        if (!student) {
            return res.status(404).json({ error: 'Student Number not found.' });
        }
        
        student.isLoggedIn = false;
        await student.save();
        res.json({ message: 'Logged out successfully.' });
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