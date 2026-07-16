import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { promises as fs } from 'fs';
import path from 'path';

const rl = readline.createInterface({ input, output });
const DB_FILE = path.join(process.cwd(), 'db.json');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TOTAL_PCS = 50;

// --- Database Helper Functions ---

// 1. Read state from the shared JSON file
async function loadData() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        // Convert the parsed students object back to a Map
        return {
            students: new Map(Object.entries(parsed.students || {})),
            bookings: parsed.bookings || []
        };
    } catch (error) {
        // If file doesn't exist, return empty initial state
        return { students: new Map(), bookings: [] };
    }
}

// 2. Save state back to the shared JSON file
async function saveData(studentsMap, bookingsArray) {
    const dataToSave = {
        students: Object.fromEntries(studentsMap), // Convert Map to plain object for JSON
        bookings: bookingsArray
    };
    await fs.writeFile(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
}

// --- Logic Helper Functions ---
function generateStudentId(surname, studentsMap) {
    const prefix = surname.slice(0, 3).toLowerCase().padEnd(3, 'x');
    let uniqueId = '';
    let attempts = 0;
    
    while (attempts < 1000) {
        const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
        uniqueId = `${prefix}${randomDigits}`;
        if (!studentsMap.has(uniqueId)) {
            return uniqueId;
        }
        attempts++;
    }
    throw new Error("Could not generate a unique Student ID.");
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
    
    // Fetch latest data from shared db.json
    const { students, bookings } = await loadData();
    
    try {
        const studentNumber = generateStudentId(surname, students);
        students.set(studentNumber, { surname, studentNumber });
        
        // Write instantly back to shared file
        await saveData(students, bookings);
        
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
    
    // Fetch latest data from shared db.json
    const { students } = await loadData();
    
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
            await viewBookings(student);
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
    
    // Fetch fresh data from shared file right before booking logic runs
    const { students, bookings } = await loadData();
    
    const studentBookings = bookings.filter(b => b.studentNumber === student.studentNumber);
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
    
    if (studentBookings.some(b => b.day === selectedDay)) {
        console.log(`❌ You already have a booking on ${selectedDay}.`);
        return studentDashboard(student);
    }
    
    // Check available PCs based on the latest saved file
    const dayBookings = bookings.filter(b => b.day === selectedDay);
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
    
    if (occupiedPcs.includes(pcChoice)) {
        console.log(`❌ PC ${pcChoice} is already booked on ${selectedDay} by another student.`);
        return studentDashboard(student);
    }
    
    // Add booking and write to the shared JSON file
    bookings.push({
        studentNumber: student.studentNumber,
        pcNumber: pcChoice,
        day: selectedDay
    });
    
    await saveData(students, bookings);
    
    console.log(`\n✅ Booking Confirmed! PC ${pcChoice} is reserved for you on ${selectedDay}.`);
    await studentDashboard(student);
}

async function viewBookings(student) {
    const { bookings } = await loadData();
    const myBookings = bookings.filter(b => b.studentNumber === student.studentNumber);
    
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
    const { students, bookings } = await loadData();
    const myBookings = bookings.filter(b => b.studentNumber === student.studentNumber);
    
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
        // Persist the changes back to db.json
        await saveData(students, bookings);
        console.log(`\n✅ Successfully cancelled booking for PC #${targetBooking.pcNumber} on ${targetBooking.day}.`);
    }
    
    await studentDashboard(student);
}

// Start the Application
mainMenu();