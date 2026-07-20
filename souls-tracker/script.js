const CANVAS = document.getElementById('canvas');
const CONNECTION_SVG = document.getElementById('connectionSvg');
const AREA_INPUT = document.getElementById('areaInput');
const FILE_INPUT = document.getElementById('fileInput');

let elements = [];
let connections = [];
let selectedForConnection = null;
let draggedElement = null;
let offsetX = 0;
let offsetY = 0;
let dragStartX = 0;
let dragStartY = 0;
let elementWasDragged = false;

// Initialize from localStorage
function initialize() {
    const saved = localStorage.getItem('soulsTrackerData');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            elements = data.elements || [];
            connections = data.connections || [];
            render();
        } catch (e) {
            console.error('Failed to load saved data:', e);
        }
    }
}

function addElement() {
    const name = AREA_INPUT.value.trim();
    if (!name) {
        alert('Please enter a zone name');
        return;
    }

    const element = {
        id: Date.now(),
        name: name,
        x: Math.random() * (CANVAS.clientWidth - 150),
        y: Math.random() * (CANVAS.clientHeight - 100)
    };

    elements.push(element);
    AREA_INPUT.value = '';
    saveData();
    render();
}

function deleteElement(id) {
    elements = elements.filter(el => el.id !== id);
    connections = connections.filter(conn => conn.from !== id && conn.to !== id);
    selectedForConnection = null;
    saveData();
    render();
}



function renameElement(id) {
    const element = elements.find(el => el.id === id);
    if (!element) return;

    const newName = prompt('Enter new zone name:', element.name);
    if (newName !== null && newName.trim()) {
        element.name = newName.trim();
        saveData();
        render();
        updateStatus(`Renamed to "${element.name}"`);
    }
}

function selectForConnection(id, event) {
    event.stopPropagation();

    if (selectedForConnection === id) {
        selectedForConnection = null;
        updateStatus('Selection cleared');
    } else if (selectedForConnection === null) {
        selectedForConnection = id;
        updateStatus('Select another zone to create connection');
    } else {
        const from = selectedForConnection;
        const to = id;

        // Check if connection exists
        const exists = connections.find(c => 
            (c.from === from && c.to === to) || (c.from === to && c.to === from)
        );

        if (exists) {
            connections = connections.filter(c => 
                !(c.from === from && c.to === to) || (c.from === to && c.to === from)
            );
            updateStatus('Connection removed');
        } else {
            connections.push({ from, to });
            updateStatus('Connection created!');
        }

        selectedForConnection = null;
        saveData();
    }
    render();
}

function startDrag(id, event) {
    draggedElement = id;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    elementWasDragged = false;
    const element = elements.find(el => el.id === id);
    const rect = event.target.getBoundingClientRect();
    const canvasRect = CANVAS.getBoundingClientRect();
    
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
}

function onDrag(event) {
    if (!draggedElement) return;

    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    if (Math.abs(dx) + Math.abs(dy) > 3) {
        elementWasDragged = true;
    }

    const element = elements.find(el => el.id === draggedElement);
    const canvasRect = CANVAS.getBoundingClientRect();

    element.x = event.clientX - canvasRect.left - offsetX;
    element.y = event.clientY - canvasRect.top - offsetY;

    element.x = Math.max(0, Math.min(element.x, CANVAS.clientWidth - 150));
    element.y = Math.max(0, Math.min(element.y, CANVAS.clientHeight - 50));

    render();
}

function stopDrag() {
    draggedElement = null;
    elementWasDragged = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    saveData();
}



function drawConnections() {
    CONNECTION_SVG.innerHTML = '';

    connections.forEach(conn => {
        const fromEl = elements.find(el => el.id === conn.from);
        const toEl = elements.find(el => el.id === conn.to);

        if (fromEl && toEl) {
            const x1 = fromEl.x + 75;
            const y1 = fromEl.y + 35;
            const x2 = toEl.x + 75;
            const y2 = toEl.y + 35;

            // Line
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', '#c9a962');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('opacity', '0.6');
            CONNECTION_SVG.appendChild(line);
        }
    });
}

function render() {
    CANVAS.querySelectorAll('.element').forEach(el => el.remove());
    drawConnections();

    elements.forEach(el => {
        const div = document.createElement('div');
        div.className = 'element';

        div.style.left = el.x + 'px';
        div.style.top = el.y + 'px';

        const isSelected = selectedForConnection === el.id;
        if (isSelected) {
            div.style.borderColor = '#e0b970';
            div.style.background = 'linear-gradient(135deg, #4a4a3a, #3a3a2a)';
            div.style.boxShadow = '0 0 15px rgba(201, 169, 98, 0.5)';
        }

        div.innerHTML = `
            <div class="element-label">${el.name}</div>
            <div class="element-remove">
                <button class="rename-btn" onclick="renameElement(${el.id})">Rename</button>
                <button class="remove-btn" onclick="deleteElement(${el.id})">Remove</button>
            </div>
        `;

        div.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            startDrag(el.id, e);
        });

        div.addEventListener('click', (e) => {
            if (e.target.closest('button') || elementWasDragged) return;
            selectForConnection(el.id, e);
        });

        CANVAS.appendChild(div);
    });

    document.getElementById('zoneCount').textContent = elements.length;
    document.getElementById('connectionCount').textContent = connections.length;
}

function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

function saveData() {
    const data = { elements, connections };
    localStorage.setItem('soulsTrackerData', JSON.stringify(data));
}

function saveToFile() {
    const data = { elements, connections };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `souls-tracker-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function loadFromFile() {
    FILE_INPUT.click();
}

FILE_INPUT.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            elements = data.elements || [];
            connections = data.connections || [];

            saveData();
            render();
            updateStatus(`Loaded ${elements.length} zones with ${connections.length} connections`);
        } catch (err) {
            alert('Failed to load file: ' + err.message);
        }
    };
    reader.readAsText(file);
    FILE_INPUT.value = '';
});

function clearAll() {
    if (confirm('Are you sure? This will delete all zones and connections.')) {
        elements = [];
        connections = [];
        selectedForConnection = null;
        selectedElements.clear();
        saveData();
        render();
        updateStatus('All data cleared');
    }
}

AREA_INPUT.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addElement();
});

initialize();
render();
