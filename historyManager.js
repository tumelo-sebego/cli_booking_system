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

export async function logStep(userId, stepName, args) {
    const data = await getHistoryData();
    const sessionId = new Date().toISOString();
    
    if (!data[userId]) {
        data[userId] = [];
    }

    // Find or create current session
    let session = data[userId].find(s => !s.endTime);
    if (!session) {
        session = { startTime: sessionId, steps: [] };
        data[userId].push(session);
    }

    session.steps.push({
        name: stepName,
        args,
        timestamp: sessionId
    });

    await saveHistoryData(data);
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
