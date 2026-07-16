import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { promises as fs } from 'fs';
import path from 'path';

const rl = readline.createInterface({ input, output });
const DB_FILE = path.join(process.cwd(), 'db.json');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TOTAL_PCS = 50;

// --- ANSI Color Codes ---
const COLORS = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    bold: '\x1b[1m'
};

// Helper function to colorize text
const color = (text, colorCode) => `${colorCode}${text}${COLORS.reset}`;

// --- Navigation Helper ---
let currentUser = null; // Track current user for navigation
let historyStack = []; // Stack for navigation history

async function pushHistory(fn, args) {
    historyStack.push({ fn, args });
}

async function handleNav(input, fallbackFn) {
    const cmd = input.trim();
    if (cmd === '/home') {
        historyStack = []; // Reset history on home
        if (currentUser) {
            await studentDashboard(currentUser);
        } else {
            await mainMenu();
        }
        return true;
    }
    if (cmd === '/back') {
        if (historyStack.length > 1) {
            historyStack.pop(); // pop current
            const last = historyStack[historyStack.length - 1];
            await last.fn(...last.args);
        } else {
            await fallbackFn();
        }
        return true;
    }
    return false;
}

// --- Database Helper Functions ---
async function loadData() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        return {
            students: new Map(Object.entries(parsed.students || {})),
            bookings: parsed.bookings || []
        };
    } catch (error) {
        return { students: new Map(), bookings: [] };
    }
}

async function saveData(studentsMap, bookingsArray) {
    const dataToSave = {
        students: Object.fromEntries(studentsMap),
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
    await pushHistory(mainMenu, []);
    console.log(color('\n====================================', COLORS.cyan));
    console.log(color('   COMPUTER CENTER BOOKING SYSTEM   ', COLORS.cyan + COLORS.bold));
    console.log(color('====================================', COLORS.cyan));
    console.log('1. Student Registration');
    console.log('2. Student Login');
    console.log('3. Exit');
    
    const promptText = color('\nSelect an option (1-3): ', COLORS.yellow);
    const input = await rl.question(promptText);
    
    if (await handleNav(input, mainMenu)) return;
    const choice = input;
    
    switch (choice.trim()) {
        case '1':
            await registerStudent();
            break;
        case '2':
            await loginStudent();
            break;
        case '3':
            console.log(color('\nGoodbye!', COLORS.cyan));
            rl.close();
            process.exit(0);
        default:
            console.log(color('❌ Invalid option. Try again.', COLORS.red));
            await mainMenu();
    }
}

async function registerStudent() {
    await pushHistory(registerStudent, []);
    console.log(color('\n--- Student Registration ---', COLORS.cyan));
    const promptText = color('Enter your surname: ', COLORS.yellow);
    const surname = await rl.question(promptText);
    
    if (await handleNav(surname, mainMenu)) return;
    
    if (!surname.trim()) {
        console.log(color('❌ Surname cannot be empty.', COLORS.red));
        return mainMenu();
    }
    
    const { students, bookings } = await loadData();
    
    try {
        const studentNumber = generateStudentId(surname, students);
        students.set(studentNumber, { surname, studentNumber, active: false });
        await saveData(students, bookings);
        
        console.log(color(`\n✅ Registration Successful!`, COLORS.green));
        console.log(`Your Unique Student Number is: ${color(studentNumber, COLORS.green + COLORS.bold)}`);
    } catch (error) {
        console.log(color(`❌ Error: ${error.message}`, COLORS.red));
    }
    await mainMenu();
}

async function loginStudent() {
    await pushHistory(loginStudent, []);
    console.log(color('\n--- Student Login ---', COLORS.cyan));
    const promptText = color('Enter your Student Number (e.g., sib1054): ', COLORS.yellow);
    const input = await rl.question(promptText);
    
    if (await handleNav(input, mainMenu)) return;
    const studentNumber = input.trim().toLowerCase();
    
    const { students, bookings } = await loadData();
    
    if (!students.has(studentNumber)) {
        console.log(color('❌ Student Number not found. Please register first.', COLORS.red));
        return mainMenu();
    }
    
    const student = students.get(studentNumber);
    if (student.active) {
        console.log(color('❌ This student account is already logged in.', COLORS.red));
        return mainMenu();
    }
    student.active = true;
    await saveData(students, bookings);
    
    currentUser = student; // Set current user
    console.log(color(`\nWelcome back, ${student.surname}!`, COLORS.green));
    await studentDashboard(student);
}

async function studentDashboard(student) {
    await pushHistory(studentDashboard, [student]);
    console.log(color(`\n--- Dashboard (${student.studentNumber}) ---`, COLORS.cyan));
    console.log('1. Book a PC Session');
    console.log('2. View My Bookings');
    console.log('3. Cancel a Booking');
    console.log('4. Logout');
    
    const promptText = color('\nSelect an option (1-4): ', COLORS.yellow);
    const input = await rl.question(promptText);
    
    if (await handleNav(input, mainMenu)) return;
    const choice = input;
    
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
            const { students, bookings } = await loadData();
            students.get(student.studentNumber).active = false;
            await saveData(students, bookings);
            currentUser = null; // Clear current user
            console.log(color('Logged out successfully.', COLORS.green));
            await mainMenu();
            break;
        default:
            console.log(color('❌ Invalid option.', COLORS.red));
            await studentDashboard(student);
    }
}

async function bookSession(student) {
    await bookSessionChooseDay(student);
}

async function bookSessionChooseDay(student) {
    await pushHistory(bookSessionChooseDay, [student]);
    console.log(color('\n--- Book a PC Session (8 Hours) ---', COLORS.cyan));
    
    const { students, bookings } = await loadData();
    const studentBookings = bookings.filter(b => b.studentNumber === student.studentNumber);
    
    if (studentBookings.length >= 3) {
        console.log(color('❌ Booking Limit Reached! You can only book up to 3 sessions per week (Mon-Fri).', COLORS.red));
        return studentDashboard(student);
    }
    
    console.log(color('Select a day:', COLORS.cyan));
    DAYS.forEach((day, index) => {
        const studentHasBooking = studentBookings.some(b => b.day === day);
        const status = studentHasBooking ? color('[Already Booked by You]', COLORS.yellow) : '';
        console.log(`${index + 1}. ${day} ${status}`);
    });
    
    const dayPrompt = color('\nSelect Day (1-5): ', COLORS.yellow);
    const dayInput = await rl.question(dayPrompt);
    
    if (await handleNav(dayInput, () => studentDashboard(student))) return;
    const dayChoice = parseInt(dayInput, 10);
    
    if (isNaN(dayChoice) || dayChoice < 1 || dayChoice > 5) {
        console.log(color('❌ Invalid day selection.', COLORS.red));
        return bookSessionChooseDay(student);
    }
    
    const selectedDay = DAYS[dayChoice - 1];
    
    if (studentBookings.some(b => b.day === selectedDay)) {
        console.log(color(`❌ You already have a booking on ${selectedDay}.`, COLORS.red));
        return bookSessionChooseDay(student);
    }
    
    await bookSessionChoosePC(student, selectedDay);
}

async function bookSessionChoosePC(student, selectedDay) {
    await pushHistory(bookSessionChoosePC, [student, selectedDay]);
    
    const { students, bookings } = await loadData();
    const dayBookings = bookings.filter(b => b.day === selectedDay);
    const occupiedPcs = dayBookings.map(b => b.pcNumber);
    
    console.log(color(`\n--- PC Availability for ${selectedDay} ---`, COLORS.cyan));
    console.log(`Key: ${color('[#]', COLORS.green)} = Available | ${color('[X] (Red)', COLORS.red)} = Occupied\n`);
    
    let row = '';
    for (let i = 1; i <= TOTAL_PCS; i++) {
        let status;
        if (occupiedPcs.includes(i)) {
            status = color('[X]', COLORS.red);
        } else {
            status = color(`[${i}]`, COLORS.green);
        }
        
        row += status.padEnd(15);
        if (i % 10 === 0) {
            console.log(row);
            row = '';
        }
    }
    
    const pcPrompt = color('\nEnter PC number to book: ', COLORS.yellow);
    const pcInput = await rl.question(pcPrompt);
    
    if (await handleNav(pcInput, () => bookSessionChooseDay(student))) return;
    const pcChoice = parseInt(pcInput, 10);
    
    if (isNaN(pcChoice) || pcChoice < 1 || pcChoice > TOTAL_PCS) {
        console.log(color('❌ Invalid PC selection.', COLORS.red));
        return bookSessionChoosePC(student, selectedDay);
    }
    
    if (occupiedPcs.includes(pcChoice)) {
        console.log(color(`❌ PC ${pcChoice} is already booked on ${selectedDay} by another student. Please pick an open green slot.`, COLORS.red));
        return bookSessionChoosePC(student, selectedDay);
    }
    
    bookings.push({
        studentNumber: student.studentNumber,
        pcNumber: pcChoice,
        day: selectedDay
    });
    
    await saveData(students, bookings);
    
    console.log(color(`\n✅ Booking Confirmed! PC ${pcChoice} is reserved for you on ${selectedDay}.`, COLORS.green));
    await studentDashboard(student);
}

async function viewBookings(student) {
    await pushHistory(viewBookings, [student]);
    const { bookings } = await loadData();
    const myBookings = bookings.filter(b => b.studentNumber === student.studentNumber);
    
    console.log(color('\n--- Your Bookings ---', COLORS.cyan));
    if (myBookings.length === 0) {
        console.log(color('You have no active bookings.', COLORS.yellow));
    } else {
        myBookings.forEach((b, index) => {
            console.log(`${index + 1}. ${color(b.day, COLORS.cyan)}: PC #${color(b.pcNumber, COLORS.green)} (8 Hours)`);
        });
    }
}

async function cancelBooking(student) {
    await pushHistory(cancelBooking, [student]);
    const { students, bookings } = await loadData();
    const myBookings = bookings.filter(b => b.studentNumber === student.studentNumber);
    
    console.log(color('\n--- Cancel a Booking ---', COLORS.cyan));
    
    if (myBookings.length === 0) {
        console.log(color('You have no active bookings to cancel.', COLORS.yellow));
        return studentDashboard(student);
    }
    
    myBookings.forEach((b, index) => {
        console.log(`${index + 1}. ${b.day}: PC #${b.pcNumber}`);
    });
    
    const cancelPrompt = color('\nSelect booking to cancel (or 0 to go back): ', COLORS.yellow);
    const cancelInput = await rl.question(cancelPrompt);
    
    if (await handleNav(cancelInput, () => studentDashboard(student))) return;
    const choice = parseInt(cancelInput, 10);
    
    if (choice === 0) return studentDashboard(student);
    
    if (isNaN(choice) || choice < 1 || choice > myBookings.length) {
        console.log(color('❌ Invalid choice.', COLORS.red));
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
        await saveData(students, bookings);
        console.log(color(`\n✅ Successfully cancelled booking for PC #${targetBooking.pcNumber} on ${targetBooking.day}.`, COLORS.green));
    }
    
    await studentDashboard(student);
}

// Start the Application
mainMenu();