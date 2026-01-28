import { app } from './firebaseConfig.js';
// 1. Add Auth imports
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const db = getFirestore(app);
const auth = getAuth(app); // 2. Initialize Auth

const form = document.getElementById('feedback-form');
const submitBtn = document.getElementById('submit-btn');
const statusMsg = document.getElementById('status-message');
const pageInput = document.getElementById('feedback-page');

// Pre-fill page context if available in URL
const urlParams = new URLSearchParams(window.location.search);
const relatedPage = urlParams.get("page");
if (relatedPage) pageInput.value = relatedPage;

// 3. Listen for User Login State to Autofill & Lock
onAuthStateChanged(auth, (user) => {
    const emailInput = document.getElementById('feedback-contact');
    const nameInput = document.getElementById('feedback-name');

    if (user) {
        // User is logged in
        if (user.email) {
            emailInput.value = user.email;
            emailInput.readOnly = true; // Locks the field
            emailInput.style.backgroundColor = "var(--root-bg-clr)"; // Optional: Visual cue (matches your theme variables)
            emailInput.style.opacity = "0.7";
            emailInput.title = "Přihlášeno jako " + user.email; // Tooltip
        }

        // Optional: Autofill name if available (but don't lock it, they might want to change it)
        if (user.displayName && !nameInput.value) {
            nameInput.value = user.displayName;
        }
    } else {
        // User is not logged in (or logged out)
        // We unlock the field so they can type manually
        emailInput.readOnly = false;
        emailInput.style.opacity = "1";
        emailInput.value = '';
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Odesílání...'; // Translated to match your Czech UI
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
            title: document.getElementById('feedback-title').value,
            page: document.getElementById('feedback-page').value,
            name: document.getElementById('feedback-name').value || 'Anonymous',
            contact: document.getElementById('feedback-contact').value || 'Not provided',
            message: document.getElementById('feedback-message').value,
            relatedPage: pageInput.value || 'General',
            ip: ipAddress,
            userAgent: navigator.userAgent,
            timestamp: serverTimestamp(),
            // Store the actual UID if available for easier admin lookup later
            uid: auth.currentUser ? auth.currentUser.uid : null,
            resolved: false
        });

        statusMsg.className = 'text-success font-weight-bold';
        statusMsg.textContent = 'Zpětná vazba byla úspěšně odeslána!';
        form.reset();

        // If user is logged in, re-fill the email after reset because form.reset() clears it
        if (auth.currentUser && auth.currentUser.email) {
            document.getElementById('feedback-contact').value = auth.currentUser.email;
        }

        setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Odeslat zpětnou vazbu';
            window.location.href = '/';
        }, 2000);

    } catch (error) {
        console.error('Error:', error);
        statusMsg.className = 'text-danger';
        statusMsg.textContent = 'Chyba při odesílání.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Odeslat zpětnou vazbu';
    }
});