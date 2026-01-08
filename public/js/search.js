// public/js/search.js

import { app } from './firebaseConfig.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Global cache for all pages ---
const db = getFirestore(app);
let allPages = [];

// --- Get Elements from the HTML ---
const searchInput = document.getElementById('search-input');
const welcomeMessage = document.getElementById('welcome-message');
const searchResultsContainer = document.getElementById('search-results');

/**
 * 1. Fetches all pages from Firestore on page load.
 */
async function fetchAllPages() {
    try {
        const querySnapshot = await getDocs(collection(db, 'pages'));


        querySnapshot.forEach((doc) => {
            const data = doc.data();

            if (data.type !== 'redirection') {
                allPages.push({
                    title: data.title, // The new human-readable title
                    path: data.fullPath, // The full URL path
                    // Only add content if it's text, not a file list
                    content: (data.type === 'markdown' || data.type === 'html') ? data.content.toLowerCase() : ''
                });
            }
        });

        console.log(`Loaded ${allPages.length} pages for search.`);
        searchInput.placeholder = "Hledej v zápisech...";
        searchInput.disabled = false;

    } catch (err) {
        console.error("Failed to fetch pages:", err);
        searchInput.placeholder = "Chyba při načítání...";
    }
}

/**
 * 2. Handles the search as the user types
 */
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();

    if (searchTerm.length < 1) {
        welcomeMessage.style.display = 'block';
        searchResultsContainer.style.display = 'none';
        searchResultsContainer.innerHTML = '';
        return;
    }

    const results = allPages.filter(page =>
        page.title.toLowerCase().includes(searchTerm) || // Search the title
        page.content.includes(searchTerm) // Search the content
    );

    welcomeMessage.style.display = 'none';
    searchResultsContainer.style.display = 'block';
    renderResults(results);
}

/**
 * 3. Renders the list of results
 */
function renderResults(results) {
    searchResultsContainer.innerHTML = '';

    if (results.length === 0) {
        searchResultsContainer.innerHTML = '<h3>Nebyly nalezeny žádné výsledky.</h3>';
        return;
    }

    const resultList = document.createElement('div');
    resultList.className = 'search-result-list';

    results.forEach(page => {
        // We no longer need to format the title, just use it
        const title = page.title;

        // Create a clickable link
        const link = document.createElement('a');
        link.href = `/${page.path}`; // Use the fullPath for the link
        link.className = 'search-result list-group-item list-group-item-action';
        link.textContent = title;

        resultList.appendChild(link);
    });

    searchResultsContainer.appendChild(resultList);
}

// --- 4. Initialize the search functionality ---
fetchAllPages();
searchInput.addEventListener('input', handleSearch);