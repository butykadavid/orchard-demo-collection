import { createStore } from "@orchardapp/sdk";

const store = createStore("state", { lastInteraction: null, count: 0 });

const clicks = document.querySelector("#clicks");
const lastInteraction = document.querySelector("#lastInteraction");
const btn = document.querySelector("#btn");

let currentState = { lastInteraction: null, count: 0 };

store.subscribe((s) => {
    currentState = s;
    const timePassed = Date.now() - (s.lastInteraction || Date.now());
    clicks.textContent = JSON.stringify(s.count, null, 2);
    lastInteraction.textContent = formatTime(timePassed);
});

btn.onclick = () => {
    store.update((s) => ({ count: s.count + 1, lastInteraction: Date.now() }));
};

setInterval(() => {
    const timePassed = Date.now() - (currentState.lastInteraction || Date.now());
    lastInteraction.textContent = formatTime(timePassed);
}, 500);

function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

    return parts.join(", ");
}