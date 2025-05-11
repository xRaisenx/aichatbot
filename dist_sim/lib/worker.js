"use strict";
// lib/worker.ts
addEventListener('message', (event) => {
    const { data } = event;
    // Process the message (e.g., chat request)
    const response = `Worker received: ${data}`;
    // Send the response back to the main thread
    postMessage(response);
});
