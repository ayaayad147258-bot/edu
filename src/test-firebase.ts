// Firebase Connection Test
// Run this in browser console to test Firebase

import { db } from './services/firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';

async function testFirebaseConnection() {
    console.log('🔥 Testing Firebase Connection...');

    // Test 1: Check if db is initialized
    console.log('1. DB Object:', db);
    if (!db) {
        console.error('❌ Firebase DB is NULL!');
        return;
    }
    console.log('✅ DB object exists');

    // Test 2: Try to read from Firestore
    try {
        console.log('2. Attempting to read grades...');
        const gradesSnapshot = await getDocs(collection(db, 'grades'));
        console.log('✅ Read successful! Document count:', gradesSnapshot.size);
        gradesSnapshot.forEach(doc => {
            console.log('  -', doc.id, doc.data());
        });
    } catch (error) {
        console.error('❌ Read failed:', error);
    }

    // Test 3: Try to write to Firestore
    try {
        console.log('3. Attempting to write test document...');
        const testDoc = await addDoc(collection(db, 'test'), {
            message: 'Connection test',
            timestamp: new Date().toISOString()
        });
        console.log('✅ Write successful! Doc ID:', testDoc.id);
    } catch (error) {
        console.error('❌ Write failed:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message
        });
    }
}

// Run the test
testFirebaseConnection();
