import { app } from './firebaseConfig.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const db = getFirestore(app);

const form = document.getElementById('feedback-form');
const submitBtn = document.getElementById('submit-btn');
const statusMsg = document.getElementById('status-message');
const pageInput = document.getElementById('feedback-page');

// Pre-fill page context if available in URL
const urlParams = new URLSearchParams(window.location.search);
const relatedPage = urlParams.get('page');
if (relatedPage) pageInput.value = relatedPage;

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    statusMsg.textContent = '';

    try {
        // 1. Fetch IP Address
        let ipAddress = 'Unknown';
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            ipAddress = ipData.ip;
        } catch (err) {
            console.warn("Could not fetch IP:", err);
        }

        // 2. Save to Firestore
        await addDoc(collection(db, 'feedback'), {
            name: document.getElementById('feedback-name').value || 'Anonymous',
            contact: document.getElementById('feedback-contact').value || 'Not provided',
            type: document.getElementById('feedback-type').value,
            message: document.getElementById('feedback-message').value,
            relatedPage: pageInput.value || 'General',
            ip: ipAddress,
            userAgent: navigator.userAgent,
            timestamp: serverTimestamp(),
            resolved: false
        });

        statusMsg.className = 'text-success font-weight-bold';
        statusMsg.textContent = 'Feedback sent successfully!';
        form.reset();

        setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Feedback';
            window.location.href = '/';
        }, 2000);

    } catch (error) {
        console.error('Error:', error);
        statusMsg.className = 'text-danger';
        statusMsg.textContent = 'Error sending feedback.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Feedback';
    }
});