import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const rl = readline.createInterface({ input, output });

// --- Mock Database ---
const students = new Map(); // Key: studentNumber, Value: { surname, studentNumber }
const bookings = [];        // Array of { studentNumber, pcNumber, day }
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TOTAL_PCS = 50;

// --- Helper Functions ---
function generateStudentId(surname) {
    const prefix = surname.slice(0, 3).toLowerCase().padEnd(3, 'x');
    let uniqueId = '';
    let attempts = 0;
    
    while (attempts < 1000) {
        const randomDigits = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits
        uniqueId = `${prefix}${randomDigits}`;
        if (!students.has(uniqueId)) {
            return uniqueId;
        }
        attempts++;
    }
    throw new Error("Could not generate a unique Student ID. Database full.");
}

// Get bookings for a specific day
function getBookingsByDay(day) {
    return bookings.filter(b => b.day === day);
}

// Get bookings for a specific student
function getBookingsByStudent(studentNumber) {
    return bookings.filter(b => b.studentNumber === studentNumber);
}

// --- CLI Views & Navigation ---
async function mainMenu() {
    console.log('\n====================================');
    console.log('   COMPUTER CENTER BOOKING SYSTEM   ');
    console.log('====================================');
    console.log('1. Student Registration');
    console.log('2. Student Login');
    console.log('3. Exit');
    
    const choice = await rl.question('\nSelect an option (1-3): ');
    
    switch (choice.trim()) {
        case '1':
            await registerStudent();
            break;
        case '2':
            await loginStudent();
            break;
        case '3':
            console.log('Goodbye!');
            rl.close();
            process.exit(0);
        default:
            console.log('❌ Invalid option. Try again.');
            await mainMenu();
    }
}

async function registerStudent() {
    console.log('\n--- Student Registration ---');
    const surname = await rl.question('Enter your surname: ');
    
    if (!surname.trim()) {
        console.log('❌ Surname cannot be empty.');
        return mainMenu();
    }
    
    try {
        const studentNumber = generateStudentId(surname);
        students.set(studentNumber, { surname, studentNumber });
        console.log(`\n✅ Registration Successful!`);
        console.log(`Your Unique Student Number is: ${studentNumber}`);
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    await mainMenu();
}

async function loginStudent() {
    console.log('\n--- Student Login ---');
    const studentNumber = (await rl.question('Enter your Student Number (e.g., sib1054): ')).trim().toLowerCase();
    
    if (!students.has(studentNumber)) {
        console.log('❌ Student Number not found. Please register first.');
        return mainMenu();
    }
    
    const student = students.get(studentNumber);
    console.log(`\nWelcome back, ${student.surname}!`);
    await studentDashboard(student);
}

async function studentDashboard(student) {
    console.log(`\n--- Dashboard (${student.studentNumber}) ---`);
    console.log('1. Book a PC Session');
    console.log('2. View My Bookings');
    console.log('3. Cancel a Booking');
    console.log('4. Logout');
    
    const choice = await rl.question('\nSelect an option (1-4): ');
    
    switch (choice.trim()) {
        case '1':
            await bookSession(student);
            break;
        case '2':
            viewBookings(student);
            await studentDashboard(student);
            break;
        case '3':
            await cancelBooking(student);
            break;
        case '4':
            console.log('Logged out successfully.');
            await mainMenu();
            break;
        default:
            console.log('❌ Invalid option.');
            await studentDashboard(student);
    }
}

async function bookSession(student) {
    console.log('\n--- Book a PC Session (8 Hours) ---');
    
    // Rule 1: Max 3 bookings per week
    const studentBookings = getBookingsByStudent(student.studentNumber);
    if (studentBookings.length >= 3) {
        console.log('❌ Booking Limit Reached! You can only book up to 3 sessions per week (Mon-Fri).');
        return studentDashboard(student);
    }
    
    // Choose Day
    console.log('Select a day:');
    DAYS.forEach((day, index) => {
        const studentHasBooking = studentBookings.some(b => b.day === day);
        console.log(`${index + 1}. ${day} ${studentHasBooking ? '[Already Booked by You]' : ''}`);
    });
    
    const dayChoice = parseInt(await rl.question('\nSelect Day (1-5): '), 10);
    if (isNaN(dayChoice) || dayChoice < 1 || dayChoice > 5) {
        console.log('❌ Invalid day selection.');
        return studentDashboard(student);
    }
    
    const selectedDay = DAYS[dayChoice - 1];
    
    // Rule 2: Max 1 booking per day for the student
    if (studentBookings.some(b => b.day === selectedDay)) {
        console.log(`❌ You already have a booking on ${selectedDay}.`);
        return studentDashboard(student);
    }
    
    // Show PC Availability for that day
    const dayBookings = getBookingsByDay(selectedDay);
    const occupiedPcs = dayBookings.map(b => b.pcNumber);
    
    console.log(`\n--- PC Availability for ${selectedDay} ---`);
    let row = '';
    for (let i = 1; i <= TOTAL_PCS; i++) {
        const status = occupiedPcs.includes(i) ? '[X]' : `[${i}]`;
        row += status.padEnd(6);
        if (i % 10 === 0) {
            console.log(row);
            row = '';
        }
    }
    
    const pcChoice = parseInt(await rl.question('\nEnter PC number to book: '), 10);
    
    if (isNaN(pcChoice) || pcChoice < 1 || pcChoice > TOTAL_PCS) {
        console.log('❌ Invalid PC selection.');
        return studentDashboard(student);
    }
    
    // Rule 3: Ensure PC is free
    if (occupiedPcs.includes(pcChoice)) {
        console.log(`❌ PC ${pcChoice} is already booked on ${selectedDay} by another student.`);
        return studentDashboard(student);
    }
    
    // Confirm booking
    bookings.push({
        studentNumber: student.studentNumber,
        pcNumber: pcChoice,
        day: selectedDay
    });
    
    console.log(`\n✅ Booking Confirmed! PC ${pcChoice} is reserved for you on ${selectedDay} (8-hour session).`);
    await studentDashboard(student);
}

function viewBookings(student) {
    const myBookings = getBookingsByStudent(student.studentNumber);
    console.log('\n--- Your Bookings ---');
    if (myBookings.length === 0) {
        console.log('You have no active bookings.');
    } else {
        myBookings.forEach((b, index) => {
            console.log(`${index + 1}. ${b.day}: PC #${b.pcNumber} (8 Hours)`);
        });
    }
}

async function cancelBooking(student) {
    const myBookings = getBookingsByStudent(student.studentNumber);
    console.log('\n--- Cancel a Booking ---');
    
    if (myBookings.length === 0) {
        console.log('You have no active bookings to cancel.');
        return studentDashboard(student);
    }
    
    myBookings.forEach((b, index) => {
        console.log(`${index + 1}. ${b.day}: PC #${b.pcNumber}`);
    });
    
    const choice = parseInt(await rl.question('\nSelect booking to cancel (or 0 to go back): '), 10);
    
    if (choice === 0) return studentDashboard(student);
    
    if (isNaN(choice) || choice < 1 || choice > myBookings.length) {
        console.log('❌ Invalid choice.');
        return studentDashboard(student);
    }
    
    const targetBooking = myBookings[choice - 1];
    const targetIndex = bookings.findIndex(b => 
        b.studentNumber === targetBooking.studentNumber && 
        b.day === targetBooking.day && 
        b.pcNumber === targetBooking.pcNumber
    );
    
    if (targetIndex !== -1) {
        bookings.splice(targetIndex, 1);
        console.log(`\n✅ Successfully cancelled booking for PC #${targetBooking.pcNumber} on ${targetBooking.day}.`);
    }
    
    await studentDashboard(student);
}

// Start the Application
mainMenu();