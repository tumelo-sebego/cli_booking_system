import { promises as fs } from 'fs';
import path from 'path';

const HISTORY_FILE = path.join(process.cwd(), 'flowHistory.json');

async function getHistoryData() {
    try {
        const data = await fs.readFile(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {}; // Start fresh if no file
    }
}

async function saveHistoryData(data) {
    await fs.writeFile(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export async function startSession(userId) {
    const data = await getHistoryData();
    if (!data[userId]) data[userId] = [];
    
    // End any existing dangling sessions just in case
    data[userId].forEach(s => { if (!s.endTime) s.endTime = new Date().toISOString(); });
    
    data[userId].push({ startTime: new Date().toISOString(), steps: [] });
    await saveHistoryData(data);
}

export async function endSession(userId) {
    const data = await getHistoryData();
    if (data[userId]) {
        const session = data[userId].find(s => !s.endTime);
        if (session) {
            session.endTime = new Date().toISOString();
            await saveHistoryData(data);
        }
    }
}

export async function logStep(userId, stepName, args) {
    const data = await getHistoryData();
    
    // Ensure anonymous user has a session
    if (userId === 'anonymous') {
        if (!data['anonymous']) data['anonymous'] = [{ startTime: new Date().toISOString(), steps: [] }];
    }
    
    const session = data[userId]?.find(s => !s.endTime);
    if (session) {
        session.steps.push({
            name: stepName,
            args,
            timestamp: new Date().toISOString()
        });
        await saveHistoryData(data);
    }
}

export async function updateLastStep(userId, newArgs) {
    const data = await getHistoryData();
    const session = data[userId]?.find(s => !s.endTime);
    if (session && session.steps.length > 0) {
        const lastStep = session.steps[session.steps.length - 1];
        lastStep.args = [...(lastStep.args || []), ...newArgs];
        await saveHistoryData(data);
    }
}

export async function popStep(userId) {
    const data = await getHistoryData();
    const userSessions = data[userId] || [];
    const currentSession = userSessions.find(s => !s.endTime);
    
    if (currentSession && currentSession.steps.length > 0) {
        currentSession.steps.pop(); // remove current
        const lastStep = currentSession.steps.pop(); // remove and get last
        await saveHistoryData(data);
        return lastStep;
    }
    return null;
}
