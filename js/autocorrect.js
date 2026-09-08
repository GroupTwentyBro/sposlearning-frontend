/**
 * SPOŠLearning Autocorrect & Spellcheck Engine
 * Supports Czech (Čeština), English, and Dual Mode (Czech + English).
 * Works with CodeMirror 5 markdown editor and HTML form inputs.
 */

// ─── Dictionaries ───────────────────────────────────────────────────────────

// Multi-word Czech verbal phrase corrections (checked when second word completes)
const CZECH_MULTIWORD = [
    { pattern: /^(aby)\s+(jste)$/i, replace: (m1, m2) => matchCase(m1, 'abyste') },
    { pattern: /^(aby)\s+(jsme)$/i, replace: (m1, m2) => matchCase(m1, 'abychom') },
    { pattern: /^(aby)\s+(jsi)$/i, replace: (m1, m2) => matchCase(m1, 'abys') },
    { pattern: /^(by)\s+(jste)$/i, replace: (m1, m2) => matchCase(m1, 'byste') },
    { pattern: /^(by)\s+(jsme)$/i, replace: (m1, m2) => matchCase(m1, 'bychom') },
    { pattern: /^(by)\s+(jsi)$/i, replace: (m1, m2) => matchCase(m1, 'bys') },
    { pattern: /^(kdyby)\s+(jste)$/i, replace: (m1, m2) => matchCase(m1, 'kdybyste') },
    { pattern: /^(kdyby)\s+(jsme)$/i, replace: (m1, m2) => matchCase(m1, 'kdybychom') },
    { pattern: /^(kdyby)\s+(jsi)$/i, replace: (m1, m2) => matchCase(m1, 'kdybys') },
];

// Single word Czech corrections
const CZECH_WORDS = {
    // False consonants & common grammatical misspellings
    'standart': 'standard',
    'standartu': 'standardu',
    'standarty': 'standardy',
    'standartní': 'standardní',
    'standartně': 'standardně',
    'standartni': 'standardní',
    'standartne': 'standardně',
    'vyjímka': 'výjimka',
    'vyjímky': 'výjimky',
    'vyjímkou': 'výjimkou',
    'vyjímek': 'výjimek',
    'vyjímečný': 'výjimečný',
    'vyjímečně': 'výjimečně',
    'vyjimka': 'výjimka',
    'vyjimky': 'výjimky',
    'vyjimecny': 'výjimečný',
    'vyjimecne': 'výjimečně',
    'samozdřejmě': 'samozřejmě',
    'samozdřejmý': 'samozřejmý',
    'samozdrejme': 'samozřejmě',
    'potencionální': 'potenciální',
    'potencionálně': 'potenciálně',
    'potencionalni': 'potenciální',
    'pernamentka': 'permanentka',
    'pernamentní': 'permanentní',
    'pernamentně': 'permanentně',
    'shlédnout': 'zhlédnout',
    'shlédnutí': 'zhlédnutí',
    'shlednout': 'zhlédnout',
    'shlednuti': 'zhlédnutí',
    'zkončit': 'skončit',
    'zkončil': 'skončil',
    'zkončila': 'skončila',
    'zkončilo': 'skončilo',
    'zkončili': 'skončili',
    'zprávce': 'správce',
    'tchýně': 'tchyně',
    'tchyne': 'tchyně',
    'zapoměl': 'zapomněl',
    'zapoměla': 'zapomněla',
    'zapoměli': 'zapomněli',
    'zapomělo': 'zapomnělo',
    'vzpoměl': 'vzpomněl',
    'vzpoměla': 'vzpomněla',
    'vzpoměli': 'vzpomněli',
    'připoměl': 'připomněl',
    'připoměla': 'připomněla',
    'rozumněl': 'rozuměl',
    'rozumněla': 'rozuměla',
    'rozumněli': 'rozuměli',
    'rozumyt': 'rozumět',
    'tamnější': 'tamější',
    'soukromně': 'soukromě',
    'mněkký': 'měkký',
    'mněkce': 'měkce',
    'mňekký': 'měkký',
    'dceřinný': 'dceřiný',

    // Missing diacritics & common study/programming words
    'kvuli': 'kvůli',
    'urcite': 'určitě',
    'vubec': 'vůbec',
    'presto': 'přesto',
    'mozna': 'možná',
    'prosim': 'prosím',
    'dekuji': 'děkuji',
    'dekuju': 'děkuju',
    'diky': 'díky',
    'zatim': 'zatím',
    'casem': 'časem',
    'vzdyt': 'vždyť',
    'zaroven': 'zároveň',
    'porad': 'pořád',
    'poradne': 'pořádně',
    'skvele': 'skvěle',
    'stranka': 'stránka',
    'stranky': 'stránky',
    'clanek': 'článek',
    'clanky': 'články',
    'pocitac': 'počítač',
    'pocitace': 'počítače',
    'programovani': 'programování',
    'priklad': 'příklad',
    'priklady': 'příklady',
    'cviceni': 'cvičení',
    'ukol': 'úkol',
    'ukoly': 'úkoly',
    'ucebna': 'učebna',
    'skola': 'škola',
    'skoly': 'školy',
    'vysledek': 'výsledek',
    'vysledky': 'výsledky',
    'vytvorit': 'vytvořit',
    'pouzit': 'použít',
    'pouziti': 'použití',
    'nastaveni': 'nastavení',
    'reseni': 'řešení',
    'poznamka': 'poznámka',
    'poznamky': 'poznámky',
    'upozorneni': 'upozornění',
    'dulezite': 'důležité',
    'dulezity': 'důležitý',
    'dalsi': 'další',
    'predchozi': 'předchozí',
    'nasledujici': 'následující',
    'promenna': 'proměnná',
    'promenne': 'proměnné',
    'trida': 'třída',
    'tridy': 'třídy',
    'retezce': 'řetězce',
    'retezec': 'řetězec',
    'cislo': 'číslo',
    'cisla': 'čísla',
    'podminka': 'podmínka',
    'podminky': 'podmínky',
    'databaze': 'databáze',
    'prehled': 'přehled',
    'vysvetleni': 'vysvětlení',
    'zadani': 'zadání'
};

// Single word English corrections
const ENGLISH_WORDS = {
    'teh': 'the',
    'adn': 'and',
    'waht': 'what',
    'taht': 'that',
    'thier': 'their',
    'recieve': 'receive',
    'recieved': 'received',
    'recieving': 'receiving',
    'seperate': 'separate',
    'seperated': 'separated',
    'seperation': 'separation',
    'definately': 'definitely',
    'definitly': 'definitely',
    'occured': 'occurred',
    'occuring': 'occurring',
    'untill': 'until',
    'truely': 'truly',
    'beleive': 'believe',
    'beleived': 'believed',
    'wierd': 'weird',
    'accomodate': 'accommodate',
    'accomodation': 'accommodation',
    'goverment': 'government',
    'enviroment': 'environment',
    'recommand': 'recommend',
    'recommanded': 'recommended',
    'neccessary': 'necessary',
    'necesary': 'necessary',
    'sucess': 'success',
    'succesful': 'successful',
    'succesfully': 'successfully',
    'adress': 'address',
    'adresses': 'addresses',
    'tongiht': 'tonight',
    'tommorow': 'tomorrow',
    'tomorow': 'tomorrow',
    'tommorrow': 'tomorrow',
    'alot': 'a lot',
    'becuase': 'because',
    'beacuse': 'because',
    'calender': 'calendar',
    'collegue': 'colleague',
    'concious': 'conscious',
    'curiousity': 'curiosity',
    'embarass': 'embarrass',
    'embarassing': 'embarrassing',
    'existense': 'existence',
    'foriegn': 'foreign',
    'guarentee': 'guarantee',
    'harrass': 'harass',
    'independant': 'independent',
    'intrest': 'interest',
    'intresting': 'interesting',
    'knowlege': 'knowledge',
    'millenium': 'millennium',
    'noticable': 'noticeable',
    'occassion': 'occasion',
    'possesion': 'possession',
    'prefered': 'preferred',
    'priviledge': 'privilege',
    'pronounciation': 'pronunciation',
    'publically': 'publicly',
    'questionaire': 'questionnaire',
    'refered': 'referred',
    'refering': 'referring',
    'religous': 'religious',
    'rember': 'remember',
    'resistence': 'resistance',
    'sensative': 'sensitive',
    'similer': 'similar',
    'suprise': 'surprise',
    'tendancy': 'tendency',
    'tounge': 'tongue',
    'unforseen': 'unforeseen',
    'unfortunatly': 'unfortunately',
    'usefull': 'useful',
    'writting': 'writing',
    'yeild': 'yield',
    'begining': 'beginning',
    'diferent': 'different',
    'experiance': 'experience',
    'freind': 'friend',
    'heigth': 'height',
    'lenght': 'length',
    'mispell': 'misspell',
    'neice': 'niece',
    'peice': 'piece',
    'rythm': 'rhythm',
    'wich': 'which',

    // Missing apostrophes in common contractions
    'dont': "don't",
    'cant': "can't",
    'wont': "won't",
    'didnt': "didn't",
    'isnt': "isn't",
    'arent': "aren't",
    'wasnt': "wasn't",
    'werent': "weren't",
    'hasnt': "hasn't",
    'havent': "haven't",
    'hadnt': "hadn't",
    'couldnt': "couldn't",
    'shouldnt': "shouldn't",
    'wouldnt': "wouldn't",
    'doesnt': "doesn't",
    'youre': "you're",
    'theyre': "they're",
    'weve': "we've",
    'youve': "you've",
    'theyve': "they've"
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Matches casing of replacement text based on source text:
 * - UPPERCASE -> UPPERCASE
 * - Titlecase -> Titlecase
 * - lowercase -> lowercase
 */
function matchCase(source, replacement) {
    if (!source || !replacement) return replacement;
    if (source === source.toUpperCase() && source.length > 1) {
        return replacement.toUpperCase();
    }
    const firstChar = source.charAt(0);
    if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement.toLowerCase();
}

// ─── Autocorrect Engine State ───────────────────────────────────────────────

class AutocorrectState {
    constructor() {
        this.enabled = localStorage.getItem('autocorrect_enabled') !== 'false';
        this.lang = localStorage.getItem('autocorrect_lang') || 'both'; // 'both', 'cs', 'en'
        this.typography = localStorage.getItem('autocorrect_typography') !== 'false';
        this.lastCorrection = null; // for instant undo on Backspace
        this.correctionCount = 0;
        this.listeners = [];
    }

    setEnabled(val) {
        this.enabled = !!val;
        localStorage.setItem('autocorrect_enabled', this.enabled);
        this.notify();
    }

    setLang(val) {
        if (['both', 'cs', 'en'].includes(val)) {
            this.lang = val;
            localStorage.setItem('autocorrect_lang', val);
            this.notify();
        }
    }

    setTypography(val) {
        this.typography = !!val;
        localStorage.setItem('autocorrect_typography', this.typography);
        this.notify();
    }

    addListener(fn) {
        this.listeners.push(fn);
    }

    notify() {
        this.listeners.forEach(fn => fn(this));
    }
}

export const autocorrectState = new AutocorrectState();

// ─── Autocorrect Logic ──────────────────────────────────────────────────────

/**
 * Checks a word against active dictionaries.
 * Returns replacement string or null.
 */
export function getCorrection(word, lang = autocorrectState.lang) {
    if (!word || word.length < 2) return null;
    const lower = word.toLowerCase();

    // Czech check
    if (lang === 'cs' || lang === 'both') {
        if (Object.prototype.hasOwnProperty.call(CZECH_WORDS, lower)) {
            return matchCase(word, CZECH_WORDS[lower]);
        }
    }

    // English check
    if (lang === 'en' || lang === 'both') {
        if (Object.prototype.hasOwnProperty.call(ENGLISH_WORDS, lower)) {
            return matchCase(word, ENGLISH_WORDS[lower]);
        }
    }

    return null;
}

/**
 * Checks multi-word patterns (e.g. "aby jste" -> "abyste").
 * Returns replacement string or null.
 */
export function getMultiWordCorrection(twoWords, lang = autocorrectState.lang) {
    if (lang !== 'cs' && lang !== 'both') return null;
    for (const rule of CZECH_MULTIWORD) {
        const match = twoWords.match(rule.pattern);
        if (match) {
            return rule.replace(match[1], match[2]);
        }
    }
    return null;
}

/**
 * Checks typography rules for a text fragment ending at cursor.
 */
export function getTypographyCorrection(textBeforeCursor, lang = autocorrectState.lang) {
    if (!autocorrectState.typography) return null;

    // Arrow replacements
    if (textBeforeCursor.endsWith('->')) {
        return { matchLength: 2, replacement: '→' };
    }
    if (textBeforeCursor.endsWith('=>')) {
        return { matchLength: 2, replacement: '⇒' };
    }
    if (textBeforeCursor.endsWith('<-')) {
        return { matchLength: 2, replacement: '←' };
    }

    // Dash replacements: " --" or word + "--"
    if (textBeforeCursor.endsWith(' --')) {
        return { matchLength: 3, replacement: ' –' };
    }

    // Ellipsis replacement
    if (textBeforeCursor.endsWith('...')) {
        return { matchLength: 3, replacement: '…' };
    }

    return null;
}

// ─── CodeMirror Integration ─────────────────────────────────────────────────

/**
 * Checks if cursor position is inside code or math blocks where autocorrect should NOT run.
 */
function isCodeOrSyntax(cm, pos) {
    // Check CodeMirror token type
    const token = cm.getTokenAt(pos);
    if (token && token.type) {
        const type = token.type.toLowerCase();
        if (
            type.includes('comment') ||
            type.includes('variable') ||
            type.includes('keyword') ||
            type.includes('atom') ||
            type.includes('property') ||
            type.includes('string') && !type.includes('string-2') ||
            type.includes('code') ||
            type.includes('formatting-code') ||
            type.includes('formatting-link')
        ) {
            return true;
        }
    }

    // Line context check: inside code fences
    const lineText = cm.getLine(pos.line);
    const beforeOnLine = lineText.slice(0, pos.ch);

    // If there is an unclosed inline backtick on this line
    const backticks = (beforeOnLine.match(/`/g) || []).length;
    if (backticks % 2 === 1) return true;

    // Inside math $$
    const dollars = (beforeOnLine.match(/\$\$/g) || []).length;
    if (dollars % 2 === 1) return true;

    return false;
}

/**
 * Attaches autocorrect engine to a CodeMirror 5 instance.
 */
export function attachToCodeMirror(cm) {
    if (!cm) return;

    // Sync native spellcheck attributes on CodeMirror DOM
    function syncDomAttributes() {
        const wrapper = cm.getWrapperElement();
        if (!wrapper) return;
        const inputField = cm.getInputField();
        const targetLang = autocorrectState.lang === 'cs' ? 'cs' : (autocorrectState.lang === 'en' ? 'en' : 'cs, en');

        wrapper.setAttribute('lang', autocorrectState.lang === 'cs' ? 'cs' : 'en');
        if (inputField) {
            inputField.setAttribute('spellcheck', 'true');
            inputField.setAttribute('autocorrect', autocorrectState.enabled ? 'on' : 'off');
            inputField.setAttribute('autocapitalize', 'sentences');
            inputField.setAttribute('lang', targetLang);
        }
    }

    syncDomAttributes();
    autocorrectState.addListener(syncDomAttributes);

    // Listen to keydown to handle instant undo on Backspace
    cm.on('keydown', (cmInst, e) => {
        if (!autocorrectState.enabled) return;

        if (e.key === 'Backspace' && autocorrectState.lastCorrection) {
            const lc = autocorrectState.lastCorrection;
            const now = Date.now();
            const cur = cmInst.getCursor();

            // Only undo if user hits Backspace immediately (within 8 seconds and at correct position)
            if (
                now - lc.timestamp < 8000 &&
                cur.line === lc.to.line &&
                cur.ch === lc.to.ch
            ) {
                e.preventDefault();
                cmInst.replaceRange(lc.original, lc.from, lc.to, '+autocorrect-undo');
                cmInst.setCursor({ line: lc.from.line, ch: lc.from.ch + lc.original.length });
                autocorrectState.lastCorrection = null;
                showUndoToast(lc.original);
                return;
            }
        }

        // Any other navigation clears undo state
        if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') {
            autocorrectState.lastCorrection = null;
        }
    });

    // Listen to change events to trigger autocorrect on word delimiters
    cm.on('change', (cmInst, changeObj) => {
        if (!autocorrectState.enabled) return;
        if (changeObj.origin === '+autocorrect' || changeObj.origin === '+autocorrect-undo') return;

        const insertedText = changeObj.text.join('\n');
        // Trigger on delimiter: space, enter, tab, or punctuation
        const delimiterMatch = insertedText.match(/^([ \t\n.,!?:;])$/);
        if (!delimiterMatch) return;

        const delimiter = delimiterMatch[1];
        const cursor = cmInst.getCursor();

        // Must be on the line where delimiter was typed
        const lineNum = cursor.line;
        const lineText = cmInst.getLine(lineNum);
        if (!lineText) return;

        // Position just before delimiter
        const chBefore = cursor.ch - 1;
        if (chBefore < 0) return;

        // Check if inside code
        if (isCodeOrSyntax(cmInst, { line: lineNum, ch: chBefore })) return;

        const textBeforeDelimiter = lineText.slice(0, chBefore);

        // 1. Check typography first (e.g. "->", " --", "...")
        if (autocorrectState.typography) {
            const typo = getTypographyCorrection(textBeforeDelimiter, autocorrectState.lang);
            if (typo) {
                const from = { line: lineNum, ch: chBefore - typo.matchLength };
                const to = { line: lineNum, ch: chBefore };
                cmInst.replaceRange(typo.replacement, from, to, '+autocorrect');
                autocorrectState.lastCorrection = {
                    from,
                    to: { line: lineNum, ch: from.ch + typo.replacement.length + delimiter.length },
                    original: textBeforeDelimiter.slice(chBefore - typo.matchLength),
                    replacement: typo.replacement,
                    timestamp: Date.now()
                };
                autocorrectState.correctionCount++;
                return;
            }
        }

        // 2. Extract words immediately preceding delimiter
        // Match last two words for multi-word phrases (e.g. "aby jste")
        const multiMatch = textBeforeDelimiter.match(/([a-zA-Zá-žÁ-Ž]+)\s+([a-zA-Zá-žÁ-Ž]+)$/);
        if (multiMatch) {
            const twoWords = multiMatch[0];
            const multiCorrection = getMultiWordCorrection(twoWords, autocorrectState.lang);
            if (multiCorrection && multiCorrection !== twoWords) {
                const wordStartCh = chBefore - twoWords.length;
                const from = { line: lineNum, ch: wordStartCh };
                const to = { line: lineNum, ch: chBefore };
                cmInst.replaceRange(multiCorrection, from, to, '+autocorrect');
                autocorrectState.lastCorrection = {
                    from,
                    to: { line: lineNum, ch: from.ch + multiCorrection.length + delimiter.length },
                    original: twoWords,
                    replacement: multiCorrection,
                    timestamp: Date.now()
                };
                autocorrectState.correctionCount++;
                return;
            }
        }

        // 3. Single word check
        const singleMatch = textBeforeDelimiter.match(/([a-zA-Zá-žÁ-Ž']+|-+)$/);
        if (singleMatch) {
            const word = singleMatch[1];
            const correction = getCorrection(word, autocorrectState.lang);
            if (correction && correction !== word) {
                const wordStartCh = chBefore - word.length;
                const from = { line: lineNum, ch: wordStartCh };
                const to = { line: lineNum, ch: chBefore };
                cmInst.replaceRange(correction, from, to, '+autocorrect');
                autocorrectState.lastCorrection = {
                    from,
                    to: { line: lineNum, ch: from.ch + correction.length + delimiter.length },
                    original: word,
                    replacement: correction,
                    timestamp: Date.now()
                };
                autocorrectState.correctionCount++;
            }
        }
    });
}

// ─── Standard HTML Input Integration ────────────────────────────────────────

/**
 * Attaches autocorrect engine to a standard HTML input or textarea.
 */
export function attachToInput(inputEl) {
    if (!inputEl) return;

    function syncInputAttrs() {
        inputEl.setAttribute('spellcheck', 'true');
        inputEl.setAttribute('autocorrect', autocorrectState.enabled ? 'on' : 'off');
        inputEl.setAttribute('autocapitalize', 'sentences');
        inputEl.setAttribute('lang', autocorrectState.lang === 'cs' ? 'cs' : (autocorrectState.lang === 'en' ? 'en' : 'cs, en'));
    }

    syncInputAttrs();
    autocorrectState.addListener(syncInputAttrs);

    let lastInputCorrection = null;

    inputEl.addEventListener('keydown', (e) => {
        if (!autocorrectState.enabled) return;

        // Instant Undo with Backspace
        if (e.key === 'Backspace' && lastInputCorrection) {
            const now = Date.now();
            const pos = inputEl.selectionStart;
            if (now - lastInputCorrection.timestamp < 8000 && pos === lastInputCorrection.endPos) {
                e.preventDefault();
                const val = inputEl.value;
                const newVal = val.slice(0, lastInputCorrection.startPos) + lastInputCorrection.original + val.slice(lastInputCorrection.endPos);
                inputEl.value = newVal;
                const newPos = lastInputCorrection.startPos + lastInputCorrection.original.length;
                inputEl.setSelectionRange(newPos, newPos);
                lastInputCorrection = null;
                showUndoToast(lastInputCorrection?.original || 'Original text');
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
        }

        if ([' ', 'Enter', '.', ',', '!', '?', ':', ';'].includes(e.key)) {
            const pos = inputEl.selectionStart;
            const textBefore = inputEl.value.slice(0, pos);

            // Multi-word check
            const multiMatch = textBefore.match(/([a-zA-Zá-žÁ-Ž]+)\s+([a-zA-Zá-žÁ-Ž]+)$/);
            if (multiMatch) {
                const twoWords = multiMatch[0];
                const correction = getMultiWordCorrection(twoWords, autocorrectState.lang);
                if (correction && correction !== twoWords) {
                    e.preventDefault();
                    const startPos = pos - twoWords.length;
                    const delimiter = e.key === 'Enter' ? '\n' : e.key;
                    const newVal = inputEl.value.slice(0, startPos) + correction + delimiter + inputEl.value.slice(pos);
                    inputEl.value = newVal;
                    const newPos = startPos + correction.length + delimiter.length;
                    inputEl.setSelectionRange(newPos, newPos);
                    lastInputCorrection = {
                        startPos,
                        endPos: newPos,
                        original: twoWords,
                        replacement: correction,
                        timestamp: Date.now()
                    };
                    autocorrectState.correctionCount++;
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                }
            }

            // Single word check
            const singleMatch = textBefore.match(/([a-zA-Zá-žÁ-Ž']+|-+)$/);
            if (singleMatch) {
                const word = singleMatch[1];
                const correction = getCorrection(word, autocorrectState.lang);
                if (correction && correction !== word) {
                    e.preventDefault();
                    const startPos = pos - word.length;
                    const delimiter = e.key === 'Enter' ? '\n' : e.key;
                    const newVal = inputEl.value.slice(0, startPos) + correction + delimiter + inputEl.value.slice(pos);
                    inputEl.value = newVal;
                    const newPos = startPos + correction.length + delimiter.length;
                    inputEl.setSelectionRange(newPos, newPos);
                    lastInputCorrection = {
                        startPos,
                        endPos: newPos,
                        original: word,
                        replacement: correction,
                        timestamp: Date.now()
                    };
                    autocorrectState.correctionCount++;
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
    });
}

// ─── Subtle Toast / Notification Helper ────────────────────────────────────

let toastEl = null;
let toastTimeout = null;

function showUndoToast(originalText) {
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'autocorrect-undo-toast';
        document.body.appendChild(toastEl);
    }
    toastEl.textContent = `Autocorrect undone: "${originalText}"`;
    toastEl.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('visible');
    }, 2200);
}

// ─── UI Toolbar Popover / Menu ──────────────────────────────────────────────

let activePopover = null;

function createAutocorrectPopover(targetBtn) {
    const popover = document.createElement('div');
    popover.className = 'autocorrect-popover';
    popover.id = 'autocorrect-popover-menu';

    function renderContent() {
        const isEnabled = autocorrectState.enabled;
        const currentLang = autocorrectState.lang;
        const typography = autocorrectState.typography;

        popover.innerHTML = `
            <div class="ac-popover-header">
                <div class="ac-header-title">
                    <span class="icon">spellcheck</span>
                    <strong>Autocorrect & Spellcheck</strong>
                </div>
                <label class="ac-switch" title="Toggle autocorrect">
                    <input type="checkbox" id="ac-toggle-main" ${isEnabled ? 'checked' : ''} />
                    <span class="ac-slider"></span>
                </label>
            </div>

            <div class="ac-popover-section ${isEnabled ? '' : 'disabled'}">
                <div class="ac-section-label">Language / Jazyk</div>
                <div class="ac-lang-pills">
                    <button type="button" class="ac-lang-pill ${currentLang === 'both' ? 'active' : ''}" data-lang="both" title="Czech & English simultaneous autocorrect">
                        <span class="ac-flag">🌐</span> Dual (CS + EN)
                    </button>
                    <button type="button" class="ac-lang-pill ${currentLang === 'cs' ? 'active' : ''}" data-lang="cs" title="Čeština only">
                        <span class="ac-flag">🇨🇿</span> Čeština
                    </button>
                    <button type="button" class="ac-lang-pill ${currentLang === 'en' ? 'active' : ''}" data-lang="en" title="English only">
                        <span class="ac-flag">🇬🇧</span> English
                    </button>
                </div>
            </div>

            <div class="ac-popover-section ${isEnabled ? '' : 'disabled'}">
                <label class="ac-checkbox-row">
                    <input type="checkbox" id="ac-toggle-typo" ${typography ? 'checked' : ''} />
                    <span>Typographical replacements (<span class="ac-sample">→, –, …</span>)</span>
                </label>
            </div>

            <div class="ac-popover-footer">
                <span class="ac-status-text">
                    ${isEnabled ? `Active for ${currentLang === 'both' ? 'Čeština + English' : (currentLang === 'cs' ? 'Čeština' : 'English')}` : 'Autocorrect is turned off'}
                </span>
                <span class="ac-undo-hint" title="Press Backspace right after an autocorrect to undo it">Undo with ⌫</span>
            </div>
        `;

        // Wire events
        popover.querySelector('#ac-toggle-main')?.addEventListener('change', (e) => {
            autocorrectState.setEnabled(e.target.checked);
            renderContent();
        });

        popover.querySelectorAll('.ac-lang-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!autocorrectState.enabled) return;
                const lang = btn.dataset.lang;
                autocorrectState.setLang(lang);
                renderContent();
            });
        });

        popover.querySelector('#ac-toggle-typo')?.addEventListener('change', (e) => {
            autocorrectState.setTypography(e.target.checked);
        });
    }

    renderContent();
    document.body.appendChild(popover);

    // Position dynamically near target button
    function position() {
        const rect = targetBtn.getBoundingClientRect();
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            popover.style.position = 'fixed';
            popover.style.top = `${rect.bottom + 8}px`;
            popover.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 320))}px`;
            popover.style.right = 'auto';
        } else {
            popover.style.position = 'fixed';
            popover.style.top = `${Math.max(60, Math.min(rect.top - 10, window.innerHeight - 340))}px`;
            popover.style.right = `${window.innerWidth - rect.left + 10}px`;
            popover.style.left = 'auto';
        }
    }

    position();
    window.addEventListener('resize', position);

    // Click outside listener
    function handleOutsideClick(e) {
        if (!popover.contains(e.target) && !targetBtn.contains(e.target)) {
            closePopover();
        }
    }

    function closePopover() {
        window.removeEventListener('resize', position);
        document.removeEventListener('mousedown', handleOutsideClick);
        popover.remove();
        activePopover = null;
        targetBtn.classList.remove('active');
    }

    setTimeout(() => {
        document.addEventListener('mousedown', handleOutsideClick);
    }, 50);

    return { close: closePopover };
}

/**
 * Initializes the Autocorrect toolbar button and badge.
 */
export function setupAutocorrectToolbar(btnId = 'btn-autocorrect') {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    // Create or locate badge
    let badge = btn.querySelector('.ac-lang-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ac-lang-badge';
        btn.appendChild(badge);
    }

    function updateBadge() {
        if (!autocorrectState.enabled) {
            badge.textContent = 'OFF';
            badge.className = 'ac-lang-badge off';
            btn.title = 'Autocorrect: OFF (Click to configure)';
        } else if (autocorrectState.lang === 'both') {
            badge.textContent = 'ALL';
            badge.className = 'ac-lang-badge active';
            btn.title = 'Autocorrect: Čeština + English (Click to configure)';
        } else if (autocorrectState.lang === 'cs') {
            badge.textContent = 'CS';
            badge.className = 'ac-lang-badge active cs';
            btn.title = 'Autocorrect: Čeština (Click to configure)';
        } else if (autocorrectState.lang === 'en') {
            badge.textContent = 'EN';
            badge.className = 'ac-lang-badge active en';
            btn.title = 'Autocorrect: English (Click to configure)';
        }
    }

    updateBadge();
    autocorrectState.addListener(updateBadge);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activePopover) {
            activePopover.close();
            activePopover = null;
        } else {
            btn.classList.add('active');
            activePopover = createAutocorrectPopover(btn);
        }
    });
}

/**
 * Main initialization entry point for Add, Edit, and Submit pages.
 */
export function initAutocorrect({ cmEditor = null, titleInputId = 'article-title', toolbarBtnId = 'btn-autocorrect' } = {}) {
    setupAutocorrectToolbar(toolbarBtnId);

    if (cmEditor) {
        attachToCodeMirror(cmEditor);
    }

    if (titleInputId) {
        const titleEl = document.getElementById(titleInputId);
        if (titleEl) {
            attachToInput(titleEl);
        }
    }

    // Attach to disclaimer & link inputs if present
    const disclEl = document.getElementById('discl-text');
    if (disclEl) attachToInput(disclEl);

    const linkTextEl = document.getElementById('link-text');
    if (linkTextEl) attachToInput(linkTextEl);

    const imgAltEl = document.getElementById('img-alt');
    if (imgAltEl) attachToInput(imgAltEl);
}
