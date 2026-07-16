import axios from 'axios';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import * as historyManager from './historyManager.js';

const rl = readline.createInterface({ input, output });
const API_BASE = 'http://localhost:3000/api';

// --- API Client ---
const apiClient = axios.create({ baseURL: API_BASE });

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
const DB_FILE = path.join(process.cwd(), 'backend', 'db.json');

// --- Navigation Helper ---
let currentUser = null; // Track current user for navigation

async function pushHistory(fn, args) {
    const userId = currentUser ? currentUser.studentNumber : 'anonymous';
    await historyManager.logStep(userId, fn.name, args);
}

async function handleNav(input, fallbackFn) {
    const cmd = input.trim();
    if (cmd === '/home') {
        if (currentUser) {
            await studentDashboard(currentUser);
        } else {
            await mainMenu();
        }
        return true;
    }
    if (cmd === '/back') {
        const userId = currentUser ? currentUser.studentNumber : 'anonymous';
        const lastStep = await historyManager.popStep(userId);
        if (lastStep) {
            await executeStep(lastStep.name, lastStep.args);
        } else {
            await fallbackFn();
        }
        return true;
    }
    return false;
}

async function executeStep(name, args) {
    const steps = {
        mainMenu,
        registerStudent,
        loginStudent,
        studentDashboard,
        bookSessionChooseDay,
        bookSessionChoosePC,
        viewBookings,
        cancelBooking
    };
    if (steps[name]) {
        await steps[name](...args);
    }
}

// --- Logic Helper Functions ---
// (Logic moved to backend)

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
            await historyManager.endSession('anonymous');
            rl.close();
            process.exit(0);
        default:
            console.log(color('❌ Invalid option. Try again.', COLORS.red));
            await mainMenu();
    }
}

async function registerStudent() {
    console.log(color('\n--- Student Registration ---', COLORS.cyan));
    const promptText = color('Enter your surname: ', COLORS.yellow);
    const surname = await rl.question(promptText);
    
    await pushHistory(registerStudent, [surname]);
    
    if (await handleNav(surname, mainMenu)) return;
    
    if (!surname.trim()) {
        console.log(color('❌ Surname cannot be empty.', COLORS.red));
        return mainMenu();
    }
    
    try {
        const { data } = await apiClient.post('/register', { surname });
        console.log(color(`\n✅ Registration Successful!`, COLORS.green));
        console.log(`Your Unique Student Number is: ${color(data.studentNumber, COLORS.green + COLORS.bold)}`);
    } catch (error) {
        console.log(color(`❌ Error: ${error.response?.data?.error || error.message}`, COLORS.red));
    }
    await mainMenu();
}

inasync function loginStudent() {
    console.log(color('\n--- Student Login ---', COLORS.cyan));
    const promptText = color('Enter your Student Number (e.g., sib1054): ', COLORS.yellow);
    const input = await rl.question(promptText);
    
    await pushHistory(loginStudent, [input]);
    
    if (await handleNav(input, mainMenu)) return;
    const studentNumber = input.trim().toLowerCase();
    
    try {
        const { data } = await apiClient.post('/login', { studentNumber });
        await historyManager.startSession(data.studentNumber);
        currentUser = data; // Set current user
        console.log(color(`\nWelcome back, ${data.surname}!`, COLORS.green));
        await studentDashboard(data);
    } catch (error) {
        console.log(color(`❌ ${error.response?.data?.error || error.message}`, COLORS.red));
        await mainMenu();
    }
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
            await historyManager.endSession(student.studentNumber);
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
    
    try {
        const { data } = await apiClient.get('/dashboard');
        const { bookings, days } = data;
        const studentBookings = bookings.filter(b => b.studentNumber === student.studentNumber);
        
        if (studentBookings.length >= 3) {
            console.log(color('❌ Booking Limit Reached! You can only book up to 3 sessions per week (Mon-Fri).', COLORS.red));
            return studentDashboard(student);
        }
        
        console.log(color('Select a day:', COLORS.cyan));
        days.forEach((day, index) => {
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
        
        const selectedDay = days[dayChoice - 1];
        
        if (studentBookings.some(b => b.day === selectedDay)) {
            console.log(color(`❌ You already have a booking on ${selectedDay}.`, COLORS.red));
            return bookSessionChooseDay(student);
        }
        
        await bookSessionChoosePC(student, selectedDay);
    } catch (error) {
        console.log(color(`❌ ${error.response?.data?.error || error.message}`, COLORS.red));
        await studentDashboard(student);
    }
}

async function bookSessionChoosePC(student, selectedDay) {
    await pushHistory(bookSessionChoosePC, [student, selectedDay]);
    
    try {
        const { data } = await apiClient.get('/dashboard');
        const { bookings, totalPcs } = data;
        const dayBookings = bookings.filter(b => b.day === selectedDay);
        const occupiedPcs = dayBookings.map(b => b.pcNumber);
        
        console.log(color(`\n--- PC Availability for ${selectedDay} ---`, COLORS.cyan));
        console.log(`Key: ${color('[#]', COLORS.green)} = Available | ${color('[X] (Red)', COLORS.red)} = Occupied\n`);
        
        let row = '';
        for (let i = 1; i <= totalPcs; i++) {
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
        
        if (isNaN(pcChoice) || pcChoice < 1 || pcChoice > totalPcs) {
            console.log(color('❌ Invalid PC selection.', COLORS.red));
            return bookSessionChoosePC(student, selectedDay);
        }
        
        if (occupiedPcs.includes(pcChoice)) {
            console.log(color(`❌ PC ${pcChoice} is already booked on ${selectedDay}. Please pick an open green slot.`, COLORS.red));
            return bookSessionChoosePC(student, selectedDay);
        }
        
        await apiClient.post('/book', { 
            studentNumber: student.studentNumber,
            pcNumber: pcChoice,
            day: selectedDay
        });
        
        console.log(color(`\n✅ Booking Confirmed! PC ${pcChoice} is reserved for you on ${selectedDay}.`, COLORS.green));
        await studentDashboard(student);
    } catch (error) {
        console.log(color(`❌ ${error.response?.data?.error || error.message}`, COLORS.red));
        await studentDashboard(student);
    }
}

async function viewBookings(student) {
    await pushHistory(viewBookings, [student]);
    try {
        const { data } = await apiClient.get('/dashboard');
        const myBookings = data.bookings.filter(b => b.studentNumber === student.studentNumber);
        
        console.log(color('\n--- Your Bookings ---', COLORS.cyan));
        if (myBookings.length === 0) {
            console.log(color('You have no active bookings.', COLORS.yellow));
        } else {
            myBookings.forEach((b, index) => {
                console.log(`${index + 1}. ${color(b.day, COLORS.cyan)}: PC #${color(b.pcNumber, COLORS.green)} (8 Hours)`);
            });
        }
    } catch (error) {
        console.log(color(`❌ ${error.response?.data?.error || error.message}`, COLORS.red));
    }
}

async function cancelBooking(student) {
    await pushHistory(cancelBooking, [student]);
    try {
        const { data } = await apiClient.get('/dashboard');
        const myBookings = data.bookings.filter(b => b.studentNumber === student.studentNumber);
        
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
        
        await apiClient.post('/cancel', {
            studentNumber: student.studentNumber,
            day: targetBooking.day,
            pcNumber: targetBooking.pcNumber
        });
        
        console.log(color(`\n✅ Successfully cancelled booking for PC #${targetBooking.pcNumber} on ${targetBooking.day}.`, COLORS.green));
    } catch (error) {
        console.log(color(`❌ ${error.response?.data?.error || error.message}`, COLORS.red));
    }
    
    await studentDashboard(student);
}

// Start anonymous session
historyManager.startSession('anonymous');

// Start the Application
mainMenu();