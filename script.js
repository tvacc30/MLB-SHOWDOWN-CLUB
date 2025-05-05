// **Firebase config and init (Modular SDK)**
// Ensure you have the Firebase modular SDK imported in your HTML before this script
// e.g., <script type="module" src="https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js"></script>
//       <script type="module" src="https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js"></script>
//       <script type="module" src="https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js"></script> // ADDED Storage SDK
//       <script type="module" src="./script.js"></script>


// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
// Import the functions for the Realtime Database
import {
    getDatabase,
    ref,
    child, // Use child() for getting child references
    set, // Use set() for writing data
    update, // Use update() for updating data at multiple paths atomically
    onValue, // Use onValue() for real-time listeners
    push, // Use push() for generating unique IDs
    remove, // Use remove() for deleting data
    serverTimestamp // Import serverTimestamp for reliable timestamps
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";
// Import the functions for Firebase Storage
import {
    getStorage,
    ref as storageRef, // Alias ref from storage to avoid name conflict with database ref
    uploadBytes, // Use uploadBytes for uploading File or Blob
    getDownloadURL, // Use getDownloadURL to get the public URL
    deleteObject // Use deleteObject to remove files from storage
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";


// Your web app's Firebase configuration for mlb-showdown-club
const firebaseConfig = {
  apiKey: "AIzaSyAJJPKsrMtM9q6GyoikoJuhdsWFzD6f4xg",
  authDomain: "mlb-showdown-club.firebaseapp.com",
  databaseURL: "https://mlb-showdown-club-default-rtdb.firebaseio.com",
  projectId: "mlb-showdown-club",
  storageBucket: "mlb-showdown-club.firebasestorage.app", // Ensure this is correct for your project
  messagingSenderId: "764684351084",
  appId: "1:764684351084:web:228e15b4288da0b1688a49"
};


// --- GLOBAL VARIABLES ---
// Map imageId to the actual DOM element reference to avoid querying issues
const renderedElements = {};
// Firebase database reference for the current game
let gameRef = null;
// Firebase Storage reference
let storage = null; // Initialize storage reference
// latestScoreboardState will hold the most recent scoreboard data from Firebase
let latestScoreboardState = null;
// isTopInning is derived from scoreboardState but kept for convenience in button logic
let isTopInning = true;


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get a reference to the database service using the modular function
const db = getDatabase(app); // Pass the initialized app instance
// Get a reference to the storage service
storage = getStorage(app); // Pass the initialized app instance

console.log("Firebase initialized, database and storage references obtained.");

// **Game Loading from URL** - Get this early, but process in DOMContentLoaded
const urlParams = new URLSearchParams(window.location.search);
let gameId = urlParams.get('gameId');


// --- FUNCTION DEFINITIONS ---
// Define all your functions here so they are available when the DOMContentLoaded listener runs

// Helper function to update the last activity timestamp in Firebase
function updateLastActivity() {
    if (gameRef) {
        // Use Firebase serverTimestamp() for a reliable timestamp
        const updates = {
            lastActivity: serverTimestamp()
        };
        update(gameRef, updates)
            .then(() => console.log("Last activity timestamp updated."))
            .catch(error => console.error("Error updating last activity timestamp:", error));
    }
}


function handleNewGameClick() {
    console.log("Attempting to create a new game...");
    // Warn if clicking "New Game" when a game is already loaded
    if (gameRef) {
        console.warn("A game is already loaded. Starting a new one will replace the URL.");
        // Optionally add a confirmation dialog here before proceeding
    }

    // Create a new unique key for the game under the 'games' node using push()
    const gamesListRef = ref(db, 'games'); // Modular reference to the games list
    const newGameRef = push(gamesListRef); // Use push on the list reference

    // Define the initial state for a new game
    const initialScoreboardState = {
        currentInning: 1,
        currentOuts: 0,
        isTopInning: true, // Added isTopInning state for game flow
        // inningScores array length determines max innings displayed initially.
        // Add more 0s if you want to display more than 9 innings initially.
        // IMPORTANT: inningScores should be nested under awayTeam and homeTeam
        awayTeam: {
            name: "Away",
            inningScores: [0, 0, 0, 0, 0, 0, 0, 0, 0],
            runs: 0,
            hits: 0,
            errors: 0
        },
        homeTeam: {
            name: "Home",
            inningScores: [0, 0, 0, 0, 0, 0, 0, 0, 0],
            runs: 0,
            hits: 0,
            errors: 0
        }
    };

    const initialGameState = {
         boardState: {}, // Empty initial board state for spots
         fieldImages: {}, // Empty initial field images state (free-floating)
         diceResults: { dice1: null, dice2: null }, // Empty initial dice results
         scoreboardState: initialScoreboardState, // Set initial scoreboard state
         lastActivity: serverTimestamp() // Add initial last activity timestamp
    };


    // Set the initial data for the new game in Firebase using set()
    set(newGameRef, initialGameState) // Use set() with the modular reference
        .then(() => {
            const newGameId = newGameRef.key; // Get the unique ID of the newly created game
            console.log(`New game created with ID: ${newGameId}`);
            // Construct the URL for the new game
            const newGameUrl = `${window.location.origin}${window.location.pathname}?gameId=${newGameId}`;

            // Navigate the browser to the new game URL
            window.location.href = newGameUrl;

        }).catch(error => {
            console.error("Error creating new game:", error);
            alert("Failed to start a new game. Check console for details.");
        });
}

// Function to simulate rolling a D20 and save the result to Firebase
function rollDice(diceId) {
    if (!gameRef) {
        console.warn("Cannot roll dice: No game loaded.");
        alert("Start or load a game to roll dice.");
        return;
    }
    const result = Math.floor(Math.random() * 20) + 1; // Generate a random number between 1 and 20

    // Save the roll result to Firebase using update for just the diceResults node
    const updates = {};
    updates[`diceResults/${diceId}`] = result;
    updates['lastActivity'] = serverTimestamp(); // Update last activity

    update(gameRef, updates) // Use update() on the gameRef
        .then(() => console.log(`${diceId} rolled: ${result}`))
        .catch(error => console.error("Error rolling dice:", error));

    // Add a 'rolling' class for CSS animation (assuming you have CSS for this)
    const diceElement = document.getElementById(diceId);
    if (diceElement) {
        diceElement.classList.add('rolling');
        // Remove the class after a short delay
        setTimeout(() => {
            diceElement.classList.remove('rolling');
        }, 500); // Duration should match your CSS animation duration
    }
}

function handleSpotClick(event) {
    const spot = event.target.closest('.spot'); // Ensure we clicked a spot or something inside it
    if (!spot) return; // Not a spot

    console.log(`Spot clicked: ${spot.id}`);

    // Check if the clicked spot is a base or mound - DO NOT allow upload here
    // This check is for the *initial click* to upload, not for dragging/dropping
    if (spot.classList.contains('base') || spot.classList.contains('mound')) {
        console.log(`Clicked spot ${spot.id} is a base or mound. Not allowing image upload.`);
        // Optionally provide user feedback like a message box
        alert("You can only upload images to lineup, bench, or pitcher spots, not bases or the mound.");
        return; // Stop the function if it's a base or mound
    }


    if (!gameRef) {
         console.warn("Cannot place image: No game loaded.");
         alert("Start or load a game first.");
         return;
    }

    // Get the hidden file input element
    const fileInput = document.getElementById('fileInput');

    if (fileInput) {
        // Store the ID of the clicked spot on the file input element
        fileInput.dataset.spotId = spot.id;
        // Trigger the file input's click event programmatically
        fileInput.click();
    } else {
        console.error("Hidden file input with id 'fileInput' not found in the HTML. Cannot upload images to spots.");
    }
}


// **MODIFIED handleImageUpload function to use Firebase Storage and update timestamp**
async function handleImageUpload(event) {
    // Get the selected file
    const file = event.target.files[0];
    if (!file) {
        console.log("No file selected or selection cancelled.");
        return;
    }

    // Get the spot ID that was stored when the spot was clicked
    const spotId = event.target.dataset.spotId;
    if (!spotId) {
        console.error("Spot ID not found in file input dataset. Cannot place image.");
        event.target.value = ''; // Clear the file input
        return;
    }
    console.log(`Handling image upload for spot: ${spotId}`);

    // IMPORTANT: Re-check if the target spot is a base or mound here as a safety measure,
    // although handleSpotClick should prevent this code from running for bases/mounds.
    const targetSpotElement = document.getElementById(spotId);
     if (targetSpotElement && (targetSpotElement.classList.contains('base') || targetSpotElement.classList.contains('mound'))) {
         console.error(`Attempted to upload image to base/mound spot ${spotId}. Upload aborted.`);
         alert("Error: Cannot upload images directly to bases or the mound.");
         event.target.value = ''; // Clear the file input
         return; // Stop the function
     }


    if (!gameRef || !storage) {
         console.warn("Cannot upload image: No game or storage loaded.");
         alert("Start or load a game first.");
         event.target.value = ''; // Clear the file input
         return;
    }

    // --- Compression Options ---
    // Adjust these values to balance quality and file size
    const options = {
        maxSizeMB: 0.5,          // Compress to max 500KB (adjust as needed)
        maxWidthOrHeight: 800,   // Resize the longer side to 800px (adjust as needed)
        useWebWorker: true,      // Use Web Worker for performance (recommended)
        initialQuality: 0.7      // Initial quality setting (0 to 1)
      }
      // --- End Compression Options ---

      try {
        console.log(`Compressing image ${file.name}...`);
        // Compress the image using the library
        const compressedFile = await imageCompression(file, options); // Use await
        console.log(`Image compressed successfully. New size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

        // Now proceed with the upload using the compressedFile (which is a Blob)

        const uniqueImageId = push(child(gameRef, 'images')).key;
        if (!uniqueImageId) {
            console.error("Cannot generate unique image ID.");
            alert("Cannot upload image: Error generating ID.");
            return;
        }

        // Use the original file name for storage path clarity, but upload the compressed blob
        const imageStorageRef = storageRef(storage, `game_images/${gameId}/${uniqueImageId}_${file.name}`);

        console.log(`Uploading compressed image ${file.name} with ID ${uniqueImageId} to Firebase Storage...`);

        // Upload the COMPRESSED file (Blob) to Firebase Storage
        uploadBytes(imageStorageRef, compressedFile) // Pass compressedFile here
            .then((snapshot) => {
                console.log('Compressed image uploaded successfully to Storage!', snapshot);
                getDownloadURL(snapshot.ref)
                    .then((downloadURL) => {
                        console.log('Image download URL:', downloadURL);
                        const updates = {};
                        updates[`boardState/${spotId}`] = {
                            imgUrl: downloadURL,
                            imageId: uniqueImageId
                        };
                        updates['lastActivity'] = serverTimestamp();
                        update(gameRef, updates)
                            .then(() => console.log(`Image URL saved to Firebase DB for spot: ${spotId}`))
                            .catch(error => console.error("Error saving image URL:", error));
                    })
                    .catch(error => console.error("Error getting download URL:", error));
            })
            .catch((error) => {
                console.error("Error uploading compressed image to Firebase Storage:", error);
                alert("Failed to upload compressed image. Check console for details.");
            });

    } catch (error) {
        console.error("Error during image compression:", error);
        alert(`Failed to compress image. Error: ${error.message}. Please try a different image or check console.`);
    } finally {
        // Clear the file input regardless of success or failure
        event.target.value = '';
    }

    // Generate a unique ID for the image. This will be used for both the Storage filename and the Database key.
    const uniqueImageId = push(child(gameRef, 'images')).key; // Use a general 'images' node for ID generation

    if (!uniqueImageId) {
         console.error("Cannot generate unique image ID.");
         alert("Cannot upload image: Error generating ID.");
         return;
    }

    event.target.value = ''; // Clear the file input after processing so the same file can be selected again
}


// **MODIFIED handleScoreboardControlClick to update timestamp**
function handleScoreboardControlClick(event) {
     // Check if the clicked element is a button
     const clickedButton = event.target.closest('button');

     if (!clickedButton || clickedButton.disabled) {
         // If the clicked element is not a button or is disabled, do nothing
         return;
     }

     // Get the action and optional team from the button's data attributes
     const action = clickedButton.dataset.action; // Declare action here
     const team = clickedButton.dataset.team; // Declare team here


     // Check if a game is loaded and state is available before processing action
     if (!gameRef || !latestScoreboardState) {
         console.warn("Cannot process scoreboard action: No game loaded or state not available.");
         alert("Please start or load a game first.");
         return;
     }

     // Create a deep copy of the state to modify safely
     const newState = JSON.parse(JSON.stringify(latestScoreboardState));

     console.log(`Scoreboard action: ${action} for team: ${team || 'N/A'}`);

     // --- Perform actions based on data-action attribute ---
     switch (action) {
         case 'add-run':
             if (team === 'away') {
                 addRunToTeam(newState.awayTeam, newState); // Use helper
             } else if (team === 'home') {
                 addRunToTeam(newState.homeTeam, newState); // Use helper
             }
             break;
         case 'add-hit':
              if (team === 'away') {
                 newState.awayTeam.hits++;
             } else if (team === 'home') {
                 newState.homeTeam.hits++;
             }
             break;
         case 'add-error':
              if (team === 'away') {
                 newState.awayTeam.errors++;
             } else if (team === 'home') {
                 newState.homeTeam.errors++;
             }
             break;
         case 'add-out':
             newState.currentOuts++;

             // --- Basic 3-Out Logic ---
             if (newState.currentOuts >= 3) {
                 console.log("Three outs recorded. Advancing game state.");
                 newState.currentOuts = 0; // Reset outs to 0

                 // Check the current half-inning state (using the state *before* this update)
                 if (latestScoreboardState.isTopInning) {
                     // If it was the top of the inning, switch to the bottom
                      console.log("End of Top inning. Switching to Bottom.");
                     newState.isTopInning = false;
                 } else {
                     // If it was the bottom of the inning, advance to the next full inning
                     console.log("End of Bottom inning. Advancing to next inning.");
                     newState.isTopInning = true; // Next inning starts at the top
                     newState.currentInning++; // Increment the inning number

                      // Optional: Add game end logic here (e.g., if currentInning > 9 and homeTeam leading)
                      // This basic logic doesn't cover all game end conditions (ties, extra innings finishes, etc.)
                      if (newState.currentInning > 9 && !newState.isTopInning && newState.homeTeam.runs > newState.awayTeam.runs) {
                           console.log("Game over - Home team wins after 9 innings!");
                           // You'd typically add UI to show winner and winner and disable controls here
                           // For now, controls remain enabled but inning number increases
                      } else if (newState.currentInning > 9 && newState.awayTeam.runs > latestScoreboardState.homeTeam.runs && newState.isTopInning) {
                           console.log("Game over - Away team wins in extra innings!");
                            // You'd typically add UI to show winner and disable controls here
                      }

                     // Ensure inningScores arrays are long enough if needed for extra innings
                      // Check both team's inningScores arrays
                      if (newState.currentInning > newState.awayTeam.inningScores.length) {
                           newState.awayTeam.inningScores.push(0);
                           console.log("Away team inningScores array extended.");
                      }
                       if (newState.currentInning > newState.homeTeam.inningScores.length) {
                           newState.homeTeam.inningScores.push(0);
                           console.log("Home team inningScores array extended.");
                       }
                 }
             }
             break;
         case 'next-inning': // Manual advance button
              console.log("Manually advancing to next inning...");
              newState.currentOuts = 0; // Reset outs
              newState.isTopInning = true; // Force to top of next inning
              newState.currentInning++; // Increment inning

              // Ensure inningScores arrays are long enough if manually skipping ahead
               while (newState.currentInning > newState.awayTeam.inningScores.length) {
                   newState.awayTeam.inningScores.push(0);
                   console.log("Away team inningScores array extended for manual inning advance.");
               }
               while (newState.currentInning > newState.homeTeam.inningScores.length) {
                   newState.homeTeam.inningScores.push(0);
                   console.log("Home team inningScores array extended for manual inning advance.");
               }
             // Optional: Add game end checks here too.
             break;
         default:
             console.warn(`Unhandled scoreboard action: ${action}`);
             return; // Don't update Firebase for unhandled actions
     }

     // Sync the updated state to Firebase after performing the action
     updateScoreboardStateInFirebase(newState); // Use helper - this function will also update the timestamp
}


function handleCopyUrlClick(event) {
    const clickedButton = event.target.closest('button#copyUrlButton'); // Target the specific button
    if (clickedButton) {
        const input = document.getElementById('gameUrlInput');
        if (input) {
            input.select(); // Select the text in the input field
            // Use the modern Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(input.value)
                    .then(() => alert('Game URL copied to clipboard!'))
                    .catch(err => console.error('Could not copy text: ', err));
            } else {
                // Fallback method
                try {
                    document.execCommand('copy');
                    alert('Game URL copied to clipboard!');
                } catch (err) {
                    console.error('Fallback: Could not copy text: ', err);
                    alert('Failed to copy URL using fallback method.');
                }
            }
        } else {
            console.warn("Game URL input with id 'gameUrlInput' not found for copy button.");
        }
    }
}

function toggleStrategyList() { // Renamed from toggleList
    const list = document.getElementById('strategyList');
     if (list) {
         list.style.display = (list.style.display === 'block') ? 'none' : 'block';
     } else {
         console.warn("Strategy list with id 'strategyList' not found.");
     }
}

function handleClickOutsideStrategyList(event) {
     const bar = document.querySelector('.strategy-bar');
     const list = document.getElementById('strategyList');
     if (list && bar) { // Check if elements exist
         // Check if the click is outside both the bar and the list
         if (!bar.contains(event.target) && !list.contains(event.target)) {
           list.style.display = 'none';
         }
     }
}


// **MODIFIED renderDraggableImage helper function** - Now uses imgUrl from Firebase and added logging
function renderDraggableImage(containerElement, imageData, position = null) {
    // imageData now contains { imgUrl, imageId } for spots or { imgUrl, left, top, imageId } for fieldImages
    const imgUrl = imageData.imgUrl;
    const imageId = imageData.imageId;

    if (!imgUrl || !imageId) {
        console.warn("renderDraggableImage: Missing imgUrl or imageId in data. Cannot render.", imageData);
        removeImageElement(imageId);
        return;
    }

    console.log(`renderDraggableImage called for ID ${imageId} using URL ${imgUrl} in ${containerElement.id || containerElement.tagName || 'document.body'} with position:`, position);
    // ADDED LOG: Check if the container is a spot and its ID
    if (containerElement.classList && containerElement.classList.contains('spot')) {
        console.log(`renderDraggableImage: Target container is a spot: ${containerElement.id}. Position parameter:`, position);
    } else if (containerElement === document.body) {
         console.log(`renderDraggableImage: Target container is document.body. Position parameter:`, position);
    } else {
         console.log(`renderDraggableImage: Target container is neither spot nor body. Container:`, containerElement);
    }


    let existingElement = renderedElements[imageId];

    if (existingElement) {
        console.log(`renderDraggableImage: Found existing image ${imageId} in JS map. Reference:`, existingElement);

        // Update the src in case the URL changed (less common but good practice)
        if (existingElement.src !== imgUrl) {
             console.log(`renderDraggableImage: Updating src for image ${imageId} from ${existingElement.src} to ${imgUrl}.`);
             existingElement.src = imgUrl;
        }


        // If the element exists but its parent is different from the target container, move it
        if (existingElement.parentElement !== containerElement) {
             console.log(`renderDraggableImage: Element ${imageId} found in map but in wrong container (parent: ${existingElement.parentElement?.id || existingElement.parentElement?.tagName || 'none'}). Moving it.`);
             // Remove from old parent if it has one (it should if it was in the DOM)
             if (existingElement.parentElement) {
                 existingElement.parentElement.removeChild(existingElement);
                 console.log(`renderDraggableImage: Removed element ${imageId} from old parent.`);
             }

             // If the target is a spot, clear it first before appending the existing image
             if (containerElement.classList && containerElement.classList.contains('spot')) {
                  containerElement.innerHTML = ''; // Clear contents to ensure only one image
                  console.log(`renderDraggableImage: Cleared target spot ${containerElement.id}.`);
             }

             containerElement.appendChild(existingElement);
             console.log(`renderDraggableImage: Appended element ${imageId} to new container.`);

             // Re-apply draggable behavior (it's idempotent, safe to call again)
             makeDraggable(existingElement); // Ensure draggability is active after moving

        } else {
             console.log(`renderDraggableImage: Element ${imageId} from map already in correct container ${containerElement.id || containerElement.tagName || 'document.body'}.`);
             // Element is already in the right place, no need to move or re-create
        }

        // Regardless of whether it was moved or already in place, update its style/position
        // ADDED LOGGING here to see which positioning block is hit
        if (containerElement === document.body && position) {
             console.log(`renderDraggableImage: Applying absolute positioning to element ${imageId} on body.`);
             // Apply absolute positioning and position if dropped on the body (field)
             existingElement.style.position = 'absolute';
             existingElement.style.left = position.left;
             existingElement.style.top = position.top;
             existingElement.classList.add('on-field'); // Add class for styling on field
             existingElement.style.zIndex = 8; // Ensure z-index is appropriate when on field
         } else if (containerElement.classList && containerElement.classList.contains('spot')) {
             console.log(`renderDraggableImage: Applying spot positioning to element ${imageId} in spot ${containerElement.id}.`);
             // Reset styles if placed in a spot
             existingElement.style.position = ''; // <-- Should be static/relative within the spot
             existingElement.style.left = '';
             existingElement.style.top = '';
             existingElement.classList.remove('on-field');
             existingElement.style.zIndex = ''; // Reset z-index
         } else {
             console.log(`renderDraggableImage: Applying default positioning to element ${imageId}. Container:`, containerElement);
             // Handle other potential containers if needed, reset styles
              existingElement.style.position = '';
              existingElement.style.left = '';
              existingElement.style.top = '';
              existingElement.classList.remove('on-field');
              existingElement.style.zIndex = '';
         }
         console.log(`renderDraggableImage: Finished updating styles/position for element ${imageId}.`);


    } else {
        // 2. Element not found in the map - Create brand new
        console.log(`renderDraggableImage: Element ${imageId} not in map. Creating brand new element.`);
        const img = document.createElement("img");
        img.src = imgUrl; // Use the provided imgUrl (Storage URL)
        img.alt = `Player image ${imageId}`;
        img.classList.add("draggable-image"); // Add a class for styling and selection
        img.dataset.imageId = imageId; // Store the unique ID on the element

        // Apply initial styles/position based on target container and position
        // ADDED LOGGING here to see which positioning block is hit
        if (containerElement === document.body && position) {
            console.log(`renderDraggableImage: Applying absolute positioning to NEW element ${imageId} on body.`);
            img.style.position = 'absolute';
            img.style.left = position.left;
            img.style.top = position.top;
            img.classList.add('on-field');
            img.style.zIndex = 8;
        } else if (containerElement.classList && containerElement.classList.contains('spot')) {
             console.log(`renderDraggableImage: Applying spot positioning to NEW element ${imageId} in spot ${containerElement.id}.`);
            img.style.position = ''; // Default static/relative positioning in spot
            img.style.left = '';
            img.style.top = '';
            img.classList.remove('on-field');
            img.style.zIndex = '';
        } else {
             console.log(`renderDraggableImage: Applying default positioning to NEW element ${imageId}. Container:`, containerElement);
             // Default styles for other potential containers
              img.style.position = '';
              img.style.left = '';
              img.style.top = '';
              img.classList.remove('on-field');
              img.style.zIndex = '';
        }


        // Make the new element draggable
        makeDraggable(img);

        // If the target is a spot, clear it first before appending the new image
        if (containerElement.classList && containerElement.classList.contains('spot')) {
             containerElement.innerHTML = ''; // Clear contents to ensure only one image
              console.log(`renderDraggableImage: Cleared target spot ${containerElement.id} before appending new element.`);
        }
        // Append the new element to the target container
        containerElement.appendChild(img);
        console.log(`Appended brand new image with ID ${imageId} to ${containerElement.id || containerElement.tagName || 'document.body'}.`);

        // Add the newly created element to the map so we track it
        renderedElements[imageId] = img;
        console.log(`renderDraggableImage: Added new element ${imageId} to JS map.`);
    }
    // ... (rest of function)
}


// **Scoreboard HTML Update Function**
// This function is responsible for taking the scoreboard state object
// and updating the corresponding HTML elements to display the game status.
function updateScoreboardHTML(scoreboardState) {
    // Update the global state variable with the latest data
    latestScoreboardState = scoreboardState;

    console.log("Scoreboard state received and local state updated:", latestScoreboardState);

    // Check if the received scoreboardState is valid
    if (!scoreboardState || typeof scoreboardState !== 'object') {
        console.log("Scoreboard state is null or undefined. Clearing scoreboard display.");
        // If state is invalid, clear the display
        document.querySelectorAll('.baseball-scoreboard td.inning-score, .baseball-scoreboard td.total-runs, .baseball-scoreboard td.total-hits, .baseball-scoreboard td.total-errors').forEach(cell => cell.textContent = '0');

        // Reset inning/outs display to default
        const currentInningSpan = document.getElementById('current-inning');
        const currentOutsSpan = document.getElementById('current-outs');
        const inningHalfSpan = document.getElementById('inning-half');

        if (currentInningSpan) currentInningSpan.textContent = '1';
        if (currentOutsSpan) currentOutsSpan.textContent = '0';
        if (inningHalfSpan) inningHalfSpan.textContent = 'Top';

        // Remove any inning highlighting
        document.querySelectorAll('.baseball-scoreboard td.current-inning-cell').forEach(cell => {
            cell.classList.remove('current-inning-cell');
        });

        // Disable scoreboard controls if there's no valid state
        console.log("Disabling scoreboard controls because state is null.");
        document.querySelectorAll('.scoreboard-controls button').forEach(button => {
            button.disabled = true;
        });

        return; // Stop the function execution
    }

    // Safely update the global isTopInning variable based on the state
    if (typeof scoreboardState.isTopInning === 'boolean') {
        isTopInning = scoreboardState.isTopInning;
        console.log("Local isTopInning state updated:", isTopInning);
    } else {
        // If isTopInning is missing or invalid, default it and log a warning
        isTopInning = true;
        console.warn("scoreboardState received without a valid 'isTopInning' property. Defaulting to true.");
    }


    // Destructure the state object for easier access
    const { currentInning, currentOuts, awayTeam, homeTeam } = scoreboardState; // Removed inningScores from top level destructure

    // Get references to inning cells for both teams
    const awayInningCells = document.querySelectorAll('.away-team-row .inning-score');
    const homeInningCells = document.querySelectorAll('.home-team-row .inning-score'); // Declared here

    // Update Away Team Row
    // Iterate through away team inning scores and update corresponding cells
    // Use Math.min to prevent errors if inningScores array is shorter than HTML cells
    const inningsToDisplayAway = Math.min(awayTeam.inningScores.length, awayInningCells.length);
    for(let i = 0; i < inningsToDisplayAway; i++) {
        if (awayTeam.inningScores && awayTeam.inningScores[i] !== undefined) {
             awayInningCells[i].textContent = awayTeam.inningScores[i];
        } else {
             awayInningCells[i].textContent = '--';
        }
    }
    // Clear any extra inning cells in HTML if the array shrunk
    for(let i = inningsToDisplayAway; i < awayInningCells.length; i++) {
         awayInningCells[i].textContent = '--';
    }


    // Update total stats for the Away team
    const awayTotalRunsElement = document.querySelector('.away-team-row .total-runs');
    if (awayTotalRunsElement) awayTotalRunsElement.textContent = awayTeam.runs;
    const awayTotalHitsElement = document.querySelector('.away-team-row .total-hits');
    if (awayTotalHitsElement) awayTotalHitsElement.textContent = awayTeam.hits;
    const awayTotalErrorsElement = document.querySelector('.away-team-row .total-errors');
    if (awayTotalErrorsElement) awayTotalErrorsElement.textContent = awayTeam.errors;


    // Update Home Team Row (using homeTeam's inningScores)
    const inningsToDisplayHome = Math.min(homeTeam.inningScores.length, homeInningCells.length);
     for(let i = 0; i < inningsToDisplayHome; i++) {
         if (homeTeam.inningScores && homeTeam.inningScores[i] !== undefined) {
              homeInningCells[i].textContent = homeTeam.inningScores[i];
         } else {
              homeInningCells[i].textContent = '--';
         }
     }
    // Clear any extra inning cells in HTML if the array shrunk
    for(let i = inningsToDisplayHome; i < homeInningCells.length; i++) {
         homeInningCells[i].textContent = '--';
    }

    const homeTotalRunsElement = document.querySelector('.home-team-row .total-runs');
    if (homeTotalRunsElement) homeTotalRunsElement.textContent = homeTeam.runs;
    const homeTotalHitsElement = document.querySelector('.home-team-row .total-hits');
    if (homeTotalHitsElement) homeTotalHitsElement.textContent = homeTeam.hits;
    const homeTotalErrorsElement = document.querySelector('.home-team-row .total-errors');
    if (homeTotalErrorsElement) homeTotalErrorsElement.textContent = homeTeam.errors;


    // Update Current Inning, Outs, and Half-Inning Display
    const currentInningSpan = document.getElementById('current-inning');
    const currentOutsSpan = document.getElementById('current-outs');
    const inningHalfSpan = document.getElementById('inning-half');

    if (currentInningSpan) currentInningSpan.textContent = currentInning;
    if (currentOutsSpan) currentOutsSpan.textContent = currentOuts;
    if (inningHalfSpan) inningHalfSpan.textContent = isTopInning ? 'Top' : 'Bottom';


    // Update Current Inning Highlighting
    // First, remove highlight from all cells
    document.querySelectorAll('.baseball-scoreboard td.current-inning-cell').forEach(cell => {
        cell.classList.remove('current-inning-cell');
    });

    // Then, add highlight to the current inning column for both teams
    // Check if currentInning is a valid number and within the displayed range (1 to max inning cells)
    // In Firebase, inning number is 1-based, array index is 0-based
    const currentInningIndex = currentInning - 1;
    if (typeof currentInning === 'number' && currentInning >= 1 && currentInning <= awayInningCells.length) {
        // Select cells that have the data-inning attribute matching the current inning
        const currentInningCells = document.querySelectorAll(`.baseball-scoreboard td.inning-score[data-inning="${currentInning}"]`);
        currentInningCells.forEach(cell => {
            cell.classList.add('current-inning-cell');
        });
    } else {
        console.warn(`Invalid or out-of-range currentInning value received: ${currentInning}. No inning cell will be highlighted.`);
    }


    // Enable scoreboard controls now that state is loaded and displayed
    console.log("Scoreboard state loaded. Enabling controls.");
    document.querySelectorAll('.scoreboard-controls button').forEach(button => {
        button.disabled = false;
    });

    console.log("Scoreboard HTML updated successfully.");
}


// **Function to Update Scoreboard State in Firebase (Modular) - Now updates timestamp**
// This function takes a new state object and pushes it to Firebase.
function updateScoreboardStateInFirebase(newState) {
    if (!gameRef) {
        console.warn("Cannot update scoreboard state: No game loaded.");
        alert("Start or load a game first.");
        return;
    }
    // Perform basic validation on the state object before saving
    if (!newState || typeof newState !== 'object' || !newState.awayTeam || !newState.homeTeam || typeof newState.currentInning !== 'number' || typeof newState.currentOuts !== 'number' || typeof newState.isTopInning !== 'boolean') {
         console.error("Attempted to save invalid scoreboard state:", newState);
         alert("Error: Invalid scoreboard state structure. State not saved.");
         return;
    }

    // Get a modular reference to the scoreboardState node
    const scoreboardStateRef = child(gameRef, 'scoreboardState'); // Modular reference

    // Use update for combined operation: set scoreboard state and update last activity
    const updates = {};
    updates['scoreboardState'] = newState;
    updates['lastActivity'] = serverTimestamp(); // Update last activity

    update(gameRef, updates) // Use update() on the gameRef
        .then(() => console.log("Scoreboard state saved to Firebase and last activity updated."))
        .catch(error => console.error("Error saving scoreboard state and updating last activity:", error));
}


// **Setup Firebase Listeners (Modular)**
// This function sets up real-time listeners for changes in Firebase for the current game.
function setupListeners() {
    if (!gameRef) {
        console.warn("Cannot set up listeners: No game reference available.");
        return;
    }

    console.log("Setting up Firebase listeners...");

    // Listener for Dice Results (`/games/{gameId}/diceResults`)
    // Use onValue() and child()
    const diceResultsRef = child(gameRef, 'diceResults');
    onValue(diceResultsRef, (snapshot) => {
        const results = snapshot.val(); // Get the data at the node
        console.log("Dice results updated from Firebase:", results); // Keep this log

        const diceResult1Element = document.getElementById('diceResult1');
        const diceResult2Element = document.getElementById('diceResult2');

        // Debugging logs to check if elements are found
        if (!diceResult1Element) {
            console.warn("Dice result element with ID 'diceResult1' not found in the DOM.");
        }
        if (!diceResult2Element) {
            console.warn("Dice result element with ID 'diceResult2' not found in the DOM.");
        }


        // Update the HTML elements displaying the dice results
        if (results) {
            if (diceResult1Element) {
                console.log(`Updating diceResult1Element with: Roll result: ${results.dice1 || '--'}`); // Debug log
                diceResult1Element.textContent = `Roll result: ${results.dice1 || '--'}`;
            }
            if (diceResult2Element) {
                 console.log(`Updating diceResult2Element with: Roll result: ${results.dice2 || '--'}`); // Debug log
                diceResult2Element.textContent = `Roll result: ${results.dice2 || '--'}`;
            }
        } else {
            // Reset display if the diceResults node is null or empty
            if (diceResult1Element) {
                console.log("Clearing diceResult1Element text."); // Debug log
                diceResult1Element.textContent = `Roll result: --`;
            }
            if (diceResult2Element) {
                 console.log("Clearing diceResult2Element text."); // Debug log
                diceResult2Element.textContent = `Roll result: --`;
            }
        }
        // No need to update last activity here, as rolling dice already does it.
    }, (error) => {
        console.error("Firebase diceResults listener error:", error);
         // Optionally update UI to show error loading dice results
         const diceResult1Element = document.getElementById('diceResult1');
         const diceResult2Element = document.getElementById('diceResult2'); // Corrected typo here

         if (diceResult1Element) diceResult1Element.textContent = `Roll result: ERROR`;
         if (diceResult2Element) diceResult2Element.textContent = `Roll result: ERROR`; // Corrected typo here
    });


    // Listener for Board State (`/games/{gameId}/boardState`) - Handles images in spots
    // Now expects { imgUrl, imageId }
    const boardStateRef = child(gameRef, 'boardState');
    onValue(boardStateRef, (snapshot) => {
        const spotsData = snapshot.val(); // Get the data (an object mapping spotId to { imgUrl, imageId })
        console.log("Board state updated from Firebase (spots):", spotsData); // ADDED LOG

        const allSpots = document.querySelectorAll('.spot');
        const spotIdsInData = spotsData ? Object.keys(spotsData) : []; // Get array of spot IDs that HAVE data

        // Process spots that have data in Firebase
        spotIdsInData.forEach(spotId => {
             const spot = document.getElementById(spotId); // Find the corresponding HTML spot element
             if (spot) {
                 const imageData = spotsData[spotId]; // Get the image data object for this spot
                 // Ensure the spot is NOT a base or mound before rendering an image into it
                 if (!spot.classList.contains('base') && !spot.classList.contains('mound') && imageData && imageData.imgUrl && imageData.imageId) {
                     // If there is valid image data, render it in the spot
                     // Use the helper function to create/update and append the image to the spot
                     renderDraggableImage(spot, imageData, { top: 'auto', left: 'auto' }); // Pass the whole imageData object, reset position for spots
                 } else {
                     // If data for this spot is invalid/empty in Firebase, or if it's a base/mound with data (which shouldn't happen with current upload logic),
                     // ensure it's cleared locally and from map
                     console.warn(`Invalid data for spot ${spotId} received or spot is base/mound. Clearing spot locally and removing associated image from map if tracked.`, imageData);
                     clearSpotElement(spot); // Use helper to clear spot and remove from map
                 }
             } else {
                 console.warn(`Spot element with ID '${spotId}' found in Firebase boardState but not in HTML.`);
             }
        });

        // Clear spots in the HTML that were removed from Firebase
        allSpots.forEach(spot => {
             // Check if the HTML spot currently contains a draggable image AND
             // if this spot's ID is NOT in the data received from Firebase
             // Check parentElement to be sure the image is truly *in* the spot and not just a stray element
             const imgElementInSpot = spot.querySelector('img.draggable-image[data-imageId]');
             const imageIdInSpot = imgElementInSpot?.dataset.imageId;

             if (spot.id && imgElementInSpot && imgElementInSpot.parentElement === spot && imageIdInSpot) {
                 if (!spotIdsInData.includes(spot.id)) {
                     console.log(`BOARDSTATE CLEANUP: Clearing spot ${spot.id} for image ${imageIdInSpot} as its state is missing from Firebase boardState.`);
                     clearSpotElement(spot); // Use helper to clear spot and remove from map
                 }
                  // Safety check: If it's in the spot and in the data, ensure it's in the map
                 if (spotIdsInData.includes(spot.id) && !renderedElements[imageIdInSpot]) {
                      console.warn(`BOARDSTATE CLEANUP: Found image ${imageIdInSpot} in spot ${spot.id} but not in map. Adding to map.`);
                      renderedElements[imageIdInSpot] = imgElementInSpot;
                 }
             } else if (spot.id && spot.innerHTML.trim() !== '' && !imgElementInSpot) {
                  // Optional: Log if a spot has *other* content that wasn't cleared
                  // console.log(`BOARDSTATE CLEANUP CHECK: Spot ${spot.id} has non-draggable content, skipping cleanup.`);
             } else if (spot.id && imgElementInSpot && imgElementInSpot.parentElement !== spot) {
                  // Optional: Log if a draggable image is found but not parented to this spot (stray?)
                  // console.log(`BOARDSTATE CLEANUP CHECK: Draggable Image ${imageIdInSpot} found in DOM but not parented to spot ${spot.id}. Parent: ${imgElementInSpot.parentElement?.id || imgElementInSpot.parentElement?.tagName || 'none'}.`);
             }
        });

        console.log("Field images listener callback complete.");

    }, (error) => {
        console.error("Firebase boardState listener error:", error);
        // On error loading state, clear display and notify user
        document.querySelectorAll('.spot').forEach(spot => clearSpotElement(spot)); // Use helper
        alert("Error loading board state. See console.");
    });


    // Listener for fieldImages (`/games/{gameId}/fieldImages`) - Handles images dragged to the field or anywhere else off-spot
    // Now expects { imgUrl, left, top, imageId }
    const fieldImagesRef = child(gameRef, 'fieldImages');
    onValue(fieldImagesRef, (snapshot) => {
        const fieldImagesData = snapshot.val(); // Object of { imageId: { imgUrl, left, top } }
        console.log("Field images updated from Firebase:", fieldImagesData); // ADDED LOG

        const imageIdsOnFieldData = fieldImagesData ? Object.keys(fieldImagesData) : []; // Get array of image IDs that SHOULD be on field

        // Process images that should be on the field according to Firebase data
        imageIdsOnFieldData.forEach(imageId => {
            const imageData = fieldImagesData[imageId];
            if (imageData && imageData.imgUrl && typeof imageData.top === 'string' && typeof imageData.left === 'string' && imageData.imageId) {
                // Use the renderDraggableImage helper to create/update and position the image on the body
                renderDraggableImage(document.body, imageData, { top: imageData.top, left: imageData.left }); // Pass the whole imageData object
            } else {
                 console.warn(`Invalid or incomplete field/off-field image data for ID ${imageId} in Firebase.`, imageData);
                 // If data is invalid, we should remove the element from DOM/map if it exists
                 removeImageElement(imageId); // Use helper to remove element and from map
            }
        });


        // Remove field/off-field images from the DOM that are no longer in the Firebase data
        // We select ALL draggable images in the DOM and check if they should still exist on the body based on Firebase data
        document.querySelectorAll('img.draggable-image[data-imageId]').forEach(imgElement => {
             const imageId = imgElement.dataset.imageId;
             const isDragging = imgElement.classList.contains('dragging');
             const isCurrentlyOnBody = imgElement.parentElement === document.body;

             if (imageId && isCurrentlyOnBody && !isDragging) { // Consider images on body that aren't currently being dragged
                 if (!imageIdsOnFieldData.includes(imageId)) {
                      console.log(`FIELDIMAGES CLEANUP: Removing image ${imageId} from body as its data is missing from Firebase fieldImages.`);
                      removeImageElement(imageId); // Use helper to remove element and from map
                 }
                 // Safety check: If it's on the body and in the data, ensure it's in the map
                 if (imageIdsOnFieldData.includes(imageId) && !renderedElements[imageId]) {
                      console.warn(`FIELDIMAGES CLEANUP: Found image ${imageId} on body but not in map. Adding to map.`);
                      renderedElements[imageId] = imgElement;
                 }
             } else if (imageId && isCurrentlyOnBody && isDragging) {
                  // console.log(`FIELDIMAGES CLEANUP CHECK: Image ${imageId} on body is currently being dragged. Skipping cleanup.`);
                  // Ensure element being dragged is in the map
                  if (imageId && imgElement && imgElement.classList.contains('draggable-image') && !renderedElements[imageId]) {
                       console.warn(`FIELDIMAGES CLEANUP CHECK: Dragging image ${imageId} found but not in map. Adding to map.`);
                       renderedElements[imageId] = imgElement;
                  }
             } else if (imageId && !isCurrentlyOnBody && imgElement.classList.contains('draggable-image')) { // Check if it's a draggable image, but not on body
                  // Safety check: If it's a draggable image found in the DOM but not on the body
                  // (meaning it must be in a spot) AND it's not in our map, add it.
                   // console.log(`FIELDIMAGES CLEANUP CHECK: Draggable Image ${imageId} found but not on body (parent: ${imgElement.parentElement?.id || imgElement.parentElement?.tagName || 'none'}). Skipping field cleanup.`);
                   if (!renderedElements[imageId]) {
                        console.warn(`FIELDIMAGES CLEANUP CHECK: Draggable Image ${imageId} found in DOM (in spot?) but not in map. Adding to map.`);
                        renderedElements[imageId] = imgElement;
                   }
             } else {
                 // Catch any other elements the selector might find unexpectedly, or non-draggable elements matching the selector
                 // console.log(`FIELDIMAGES CLEANUP CHECK: Found element not meeting fieldImages criteria (imageId: ${imageId}, parentIsBody: ${isCurrentlyOnBody}, isDragging: ${isDragging}, parent: ${imgElement.parentElement?.id || imgElement.parentElement?.tagName || 'none'}).`);
                 // Safety check: If it's a draggable image found in a weird state and not in our map, add it.
                  if (imageId && imgElement && imgElement.classList.contains('draggable-image') && !renderedElements[imageId]) {
                       console.warn(`FIELDIMAGES CLEANUP CHECK: Draggable Image ${imageId} found in weird state and not in map. Adding to map.`);
                       renderedElements[imageId] = imgElement;
                  }
             }
        });

        console.log("Field images listener callback complete.");

    }, (error) => {
        console.error("Firebase fieldImages listener error:", error);
        // On error loading state, clear display and notify user
         document.querySelectorAll('img.draggable-image[data-imageId]').forEach(imgElement => {
             if (imgElement.parentElement === document.body) {
                 removeImageElement(imgElement.dataset.imageId); // Use helper
             } else if (imgElement.dataset.imageId && renderedElements[imgElement.dataset.imageId]) {
                  // If it's a draggable image not on the body, ensure it's still in our map
                  // console.log(`FIELDIMAGES ERROR CLEANUP CHECK: Draggable Image ${imgElement.dataset.imageId} not on body, found in map.`);
             } else if (imgElement.dataset.imageId && !renderedElements[imgElement.dataset.imageId]) {
                  // If it's a draggable image not on the body, and not in our map, log
                  console.warn(`FIELDIMAGES ERROR CLEANUP CHECK: Draggable Image ${imgElement.dataset.imageId} not on body and NOT in map. Parent: ${imgElement.parentElement?.id || imgElement.parentElement?.tagName || 'none'}.`);
                  renderedElements[imgElement.dataset.imageId] = imgElement; // Add it to map as safety
             }
         });
        alert("Error loading field images state. See console.");
    });


    // Listener for Scoreboard State (`/games/{gameId}/scoreboardState`)
    // Use onValue() and child()
    const scoreboardStateRef = child(gameRef, 'scoreboardState');
    onValue(scoreboardStateRef, (snapshot) => {
        const scoreboardState = snapshot.val(); // Get the scoreboard state object
        console.log("Scoreboard state updated from Firebase:", scoreboardState);
        // Call the function to update the HTML display
        updateScoreboardHTML(scoreboardState);
        // No need to update last activity here, as scoreboard control clicks already do it.

    }, (error) => {
        console.error("Firebase scoreboardState listener error:", error);
        // On error loading state, clear display and notify user
        latestScoreboardState = null; // Clear local state
        isTopInning = true; // Reset local inning state default
        updateScoreboardHTML(null); // Call with null to clear display
        alert("Error loading scoreboard state. See console.");
    });

    // Optional: Listener for lastActivity - could be used to display inactivity warnings
    // const lastActivityRef = child(gameRef, 'lastActivity');
    // onValue(lastActivityRef, (snapshot) => {
    //     const timestamp = snapshot.val();
    //     if (timestamp) {
    //         console.log("Last activity timestamp from Firebase:", new Date(timestamp));
    //         // You could add logic here to show a warning if timestamp is old
    //     }
    // });


    // Enable controls after listeners are set up.
    console.log("Listeners set up. Attempting to enable scoreboard controls.");
    document.querySelectorAll('.scoreboard-controls button').forEach(button => {
        button.disabled = false;
    });
}


// Helper function to safely add a run to a team's score and current inning's score
function addRunToTeam(team, state) {
    // Ensure currentInning is a valid index (1-based in state, 0-based in array)
    const inningIndex = state.currentInning - 1;

    // Ensure inningScores array is large enough for the current inning
    // If not, extend it with zeros. Assumes inningScores should grow if needed.
    while (team.inningScores.length <= inningIndex) { // Use team's inningScores
        team.inningScores.push(0); // Update team's scores
        console.log(`${team.name} inningScores array extended to ${team.inningScores.length} innings.`);
    }

    // Increment the run score for the current inning
    if (inningIndex >= 0 && inningIndex < team.inningScores.length) {
        team.inningScores[inningIndex]++; // Update team's scores
    } else {
        console.error(`Logic Error: Attempted to add run to invalid inning index: ${inningIndex}`);
        // This should ideally not happen with the while loop above, but good practice to check.
    }
    // Increment the total runs
    team.runs++;
}

// **Updated makeDraggable function (Modular) - Now updates timestamp**
// Makes an HTML element (presumably an image) draggable.
function makeDraggable(element) {
     // Avoid re-applying if already draggable
     if (element.classList.contains('is-draggable')) {
         // Update stored field position if needed (though listeners handle initial pos)
          const fieldArea = document.querySelector('.field-area');
          if (fieldArea) {
               const fieldRect = fieldArea.getBoundingClientRect();
               element.dataset.fieldLeft = fieldRect.left; // Store field position for drop calculation
               element.dataset.fieldTop = fieldRect.top;
               element.dataset.fieldWidth = fieldRect.width;
               element.dataset.fieldHeight = fieldRect.height;
           }
         return;
     }

     element.classList.add('is-draggable'); // Mark as draggable


    // Find the container element within which dragging is allowed (for drop target checking)
    const fieldArea = document.querySelector('.field-area');

    // Store field position if found (needed for drop on field calculation)
    if (fieldArea) {
        const fieldRect = fieldArea.getBoundingClientRect();
        element.dataset.fieldLeft = fieldRect.left; // Store field position for drop calculation
        element.dataset.fieldTop = fieldRect.top;
        element.dataset.fieldWidth = fieldRect.width;
        element.dataset.fieldHeight = fieldRect.height;
    } else {
        console.warn("Warning: '.field-area' element not found. Field drop zone detection disabled.");
    }


    // Prevent the default browser drag-and-drop behavior for the element
    element.ondragstart = function() {
        return false;
    };

    // Handle mouse down event to start dragging
    element.onmousedown = function(event) {
        // Only start dragging with the left mouse button
        if (event.button !== 0) return;

        event.preventDefault(); // Prevent default browser actions like image dragging

        if (!gameRef) {
             console.warn("Cannot drag image: No game loaded.");
             // Don't start dragging
             return;
        }

        // Get the original parent element (where the image was before dragging started)
        const originalParent = element.parentElement;
        // Determine the original spot ID if the parent is a '.spot' element
        const originalSpotId = (originalParent && originalParent.classList && originalParent.classList.contains('spot') && originalParent.id) ? originalParent.id : null;
        const imageId = element.dataset.imageId; // Get the unique image ID early

        if (!imageId) {
            console.error("makeDraggable onmousedown: Dragged element is missing unique data-imageId attribute.");
            return; // Cannot drag if no ID
        }


        if (originalSpotId) {
            console.log(`makeDraggable onmousedown: Dragging image ${imageId} from spot: ${originalSpotId}`);
            // We DON'T remove from spot HTML here. The Firebase listener reacting to the state change
            // when the image is dropped *out* of the spot will handle removing the element from the spot.
            // This prevents flicker if you quickly drag and drop within the same spot area.
            // Alternatively, you could remove here and rely on the listener to re-add it if it goes back to a spot.
            // Removing here: originalParent.removeChild(element);
        } else if (originalParent === document.body) {
            console.log(`makeDraggable onmousedown: Dragging image ${imageId} already on body.`);
         } else {
            console.log(`makeDraggable onmousedown: Dragging image ${imageId} from unknown location (parent: ${originalParent?.id || originalParent?.tagName || 'none'}).`);
         }


        // Calculate the offset of the mouse cursor relative to the element's top-left corner
        let shiftX = event.clientX - element.getBoundingClientRect().left;
        let shiftY = event.clientY - element.getBoundingClientRect().top;

        // Prepare the element for absolute positioning and dragging
        element.classList.add('dragging'); // Add class for styling while dragging
        element.style.position = 'absolute'; // Ensure absolute positioning while dragging
        element.style.zIndex = 1000; // Ensure the dragged element is on top

        // Append the element to the document body if it's not already there.
        // This allows it to be dragged freely outside of its original container without being clipped.
        // This also ensures its position is relative to the viewport for absolute positioning.
        if (element.parentElement !== document.body) {
             // Temporarily remove from its current parent BEFORE appending to body
             if (element.parentElement) {
                  element.parentElement.removeChild(element);
                  // console.log(`makeDraggable onmousedown: Temporarily removed image ${imageId} from original parent before appending to body.`);
             }
             document.body.appendChild(element);
             // console.log(`makeDraggable onmousedown: Appended element ${imageId} to body for dragging.`);
        }
         // Set initial position relative to the viewport based on where the mouse clicked it
         // This ensures it doesn't jump when it becomes position: absolute
         element.style.left = event.pageX - shiftX + 'px';
         element.style.top = event.pageY - shiftY + 'px';


        // Function to update the element's position
        function moveAt(pageX, pageY) {
            element.style.left = pageX - shiftX + 'px';
            element.style.top = pageY - shiftY + 'px';
        }

        // Mousemove event handler: keeps moving the element as the mouse moves
        function onMouseMove(event) {
            moveAt(event.pageX, event.pageY);
        }

        // Add the mousemove listener to the document
        document.addEventListener('mousemove', onMouseMove);

        // Mouseup event handler: executed when the mouse button is released
        function onMouseUp(event) {
            console.log("onmouseup triggered. Cleaning up listeners.");
            // Remove the mousemove and mouseup listeners to stop dragging
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp); // Crucially, remove this listener too!

            element.classList.remove('dragging'); // Remove the dragging class
            element.style.zIndex = ''; // Reset z-index after drop

            // Get the bounding rectangles of the dragged element
            let elementRect = element.getBoundingClientRect();

             // Retrieve stored field position and dimensions for field drop check
             const fieldLeft = parseFloat(element.dataset.fieldLeft);
             const fieldTop = parseFloat(element.dataset.fieldTop);
             const fieldWidth = parseFloat(element.dataset.fieldWidth);
             const fieldHeight = parseFloat(element.dataset.fieldHeight);

             // Determine if fieldArea details were successfully retrieved (i.e., fieldArea existed)
             const fieldAreaFound = !isNaN(fieldLeft) && !isNaN(fieldTop) && !isNaN(fieldWidth) && !isNaN(fieldHeight);


            // Calculate the center coordinates of the dragged element
            let elementCenterX = elementRect.left + elementRect.width / 2;
            let elementCenterY = elementRect.top + elementRect.height / 2;

            // Check if the center of the element is within the bounds of the field area
            // Only check if fieldArea details were found (i.e., fieldArea existed)
            let droppedOnField = fieldAreaFound && (
                 elementCenterX > fieldLeft &&
                 elementCenterX < (fieldLeft + fieldWidth) &&
                 elementCenterY > fieldTop &&
                 elementCenterY < (fieldTop + fieldHeight)
             );


            // Check if dropped on a spot using the elementFromPoint method at the mouse cursor location
            console.log(`Drop coordinates (clientX, clientY): ${event.clientX}, ${event.clientY}`);
            const elementAtDropPoint = document.elementFromPoint(event.clientX, event.clientY);
            console.log("Element at drop point:", elementAtDropPoint);

            // --- MODIFIED DROP TARGET LOGIC ---
            // Find the closest ancestor with the class 'spot'.
            const potentialSpot = elementAtDropPoint?.closest('.spot');

            // A valid drop target is NOWHERE that is a '.spot'.
            // So, if potentialSpot is found, targetSpot is null.
            const targetSpot = null; // Explicitly set targetSpot to null, disabling all spot drops
            // --- END MODIFIED DROP TARGET LOGIC ---

            const targetSpotId = targetSpot ? targetSpot.id : null;

            const imageId = element.dataset.imageId; // Get the unique image ID

             // Ensure we have a valid imageId before attempting Firebase operations
             if (!imageId) {
                 console.error("makeDraggable onmouseup: Image is missing unique data-imageId attribute. Cannot save position.");
                 // Remove the element from the DOM as we can't track it
                 removeImageElement(imageId); // Use helper
                 return; // Stop here
             }
            console.log(`makeDraggable onmouseup: Image ID ${imageId} dropped. Target Spot ID: ${targetSpotId}, Dropped on Field: ${droppedOnField}. Original Spot ID: ${originalSpotId}`);


            // --- Handle Drop Scenarios - Use Firebase update for atomic changes ---

            // Prepare the updates object for Firebase
            const updates = {};
            // When saving to fieldImages, we need the image URL, not Base64 data
            const imgUrl = element.src; // Get the Storage URL from the element's src

            if (!gameRef || !imgUrl || !imgUrl.startsWith('http')) { // Check for http/https URL
                 console.error("Cannot save drop position: Game not loaded or invalid image URL.");
                 // If game not loaded or data is bad, revert position to original if possible?
                 // For now, just log error. The element is currently on the body where it was dropped.
                 // If it came from a spot, its state in Firebase is still in the spot.
                 return;
            }


            // Scenario: Dropped ON a valid spot (targetSpotId is found) - This branch is now effectively disabled
            if (targetSpotId) {
                 // This code block will not be reached with the updated logic above
                 console.log(`makeDraggable onmouseup: Image ${imageId} dropped ON valid spot: ${targetSpotId}. (This should not happen with current logic)`);

                 // Remove 'on-field' class if it was previously on the field/body
                 element.classList.remove('on-field');

                 const gameUpdatesRef = gameRef;
                 if (gameUpdatesRef) {
                      const imgUrl = element.src;
                      if (imgUrl.startsWith('http')) {
                          const updates = {};
                          updates[`boardState/${targetSpotId}`] = {
                              imgUrl: imgUrl, // Save URL
                              imageId: imageId
                          };
                          if (originalSpotId && originalSpotId !== targetSpotId) {
                              updates[`boardState/${originalSpotId}`] = null;
                          } else if (originalParent === document.body) {
                                updates[`fieldImages/${imageId}`] = null;
                          }
                          if (Object.keys(updates).length > 0) {
                              updates['lastActivity'] = serverTimestamp(); // Update last activity
                              update(gameUpdatesRef, updates)
                              .then(() => console.log(`makeDraggable onmouseup: Firebase update successful for image ${imageId} drop on spot ${targetSpotId} and last activity updated.`))
                              .catch(error => console.error(`makeDraggable onmouseup: Error during Firebase update for image ${imageId} drop on spot ${targetSpotId}:`, error));
                          }
                      } else {
                          console.error(`makeDraggable onmouseup: Cannot save image ${imageId} to spot ${targetSpotId}: invalid src URL.`, imgUrl);
                      }
                  } else {
                      console.warn(`makeDraggable onmouseup: Cannot save image ${imageId} to spot ${targetSpotId}: game not loaded.`);
                  }
                  element.remove();
                  console.log(`makeDraggable onmouseup: Image element ${imageId} removed from DOM.`);
                  if (renderedElements[imageId]) {
                      console.log(`makeDraggable onmouseup: Removing image ${imageId} from renderedElements map.`);
                      delete renderedElements[imageId];
                  }
              }
              // Scenario 2 & 3: Dropped NOT on a valid spot (which is now always the case if dropped anywhere)
              else {
                 console.log(`makeDraggable onmouseup: Image ${imageId} dropped NOT on a spot. Dropped on Field: ${droppedOnField}.`);

                 if (droppedOnField) {
                      element.classList.add('on-field');
                      element.style.zIndex = 8;
                 } else {
                      element.classList.remove('on-field');
                      element.style.zIndex = '';
                 }

                  // Save the *current* screen position to fieldImages in Firebase
                  const finalPosition = {
                      left: element.style.left, // These are already in px because moveAt set them
                      top: element.style.top
                  };
                    console.log(`makeDraggable onmouseup: Saving final position {left: ${finalPosition.left}, top: ${finalPosition.top}} to fieldImages/${imageId}.`);

                  // Save image URL AND its position to fieldImages in Firebase
                  const gameUpdatesRef = gameRef; // Using the existing gameRef
                  if (gameUpdatesRef) {
                      const imgUrl = element.src; // Get the Storage URL from the element's src
                      if (imgUrl.startsWith('http')) { // Ensure it's valid URL
                          const updates = {}; // Use updates for potential combined removal/set
                           updates[`fieldImages/${imageId}`] = { // Always set/update in fieldImages if not in a spot
                               imgUrl: imgUrl, // Save the Storage URL
                               left: finalPosition.left, // Save screen coordinates
                               top: finalPosition.top,
                               imageId: imageId // Save the imageId
                           };

                          // If it came from a spot, remove data from the original spot
                          if (originalSpotId) {
                              console.log(`makeDraggable onmouseup: Preparing Firebase removal from original spot ${originalSpotId} after dropping off-spot.`);
                              updates[`boardState/${originalSpotId}`] = null; // Setting to null removes the key
                          }
                          // If it was already a field image, its data is just being updated in fieldImages, no separate removal needed from fieldImages.

                          // Execute the combined update operation (or just set if no removal needed)
                          if (Object.keys(updates).length > 0) {
                               updates['lastActivity'] = serverTimestamp(); // Update last activity
                              update(gameUpdatesRef, updates)
                              .then(() => console.log(`makeDraggable onmouseup: Firebase update successful for image ${imageId} drop off-spot and last activity updated.`))
                              .catch(error => console.error(`makeDraggable onmouseup: Error during Firebase update for image ${imageId} drop off-spot:`, error));
                          }


                      } else {
                          console.error(`makeDraggable onmouseup: Cannot save off-spot image ${imageId}: invalid src URL.`, imgUrl);
                      }
                  } else {
                      console.warn(`makeDraggable onmouseup: Cannot save off-spot image ${imageId}: game not loaded.`);
                  }

                   // This image element remains on the body in the current window. Its position was updated
                   // directly by moveAt during the drag. The fieldImages listener will simply re-apply
                   // the position from Firebase, effectively synchronizing it.

              }

              // No need to set element.onmouseup = null; when using addEventListener/removeEventListener
          }

          // Attach the mouseup listener to the DOCUMENT to capture the drop event anywhere
          document.addEventListener('mouseup', onMouseUp);
      };
}


// **Helper function to clear a spot element and remove its image from the map**
// This function is called when Firebase data indicates an image should be removed from a spot.
// It should also handle deleting the image from Firebase Storage.
function clearSpotElement(spotElement) {
    if (spotElement) {
        const imgElement = spotElement.querySelector('img.draggable-image[data-imageId]');
        if (imgElement && imgElement.dataset.imageId) {
            const imageId = imgElement.dataset.imageId;
             console.log(`Clearing spot ${spotElement.id} and removing image ${imageId} from map.`);

             // Attempt to delete the image from Firebase Storage
             // We need the original filename or a way to construct the storage path.
             // A robust solution would store the storage path in the database along with the URL.
             // For now, we'll make a simplified assumption that the imageId is part of the filename.
             // This part needs refinement based on your Storage file naming convention.
             // A safer approach is to store the Storage path (e.g., `game_images/${gameId}/${filename}`)
             // in the Realtime Database along with the imgUrl and imageId.
             // For this example, we'll just log a warning that Storage cleanup is needed.
             console.warn(`Manual Firebase Storage cleanup might be needed for image with ID: ${imageId}. Consider storing Storage path in DB.`);
             // To implement Storage deletion:
             // const imageStoragePath = `game_images/${gameId}/${imageId}_${original_filename}`; // You need the filename
             // const imageStorageRefToDelete = storageRef(storage, imageStoragePath);
             // deleteObject(imageStorageRefToDelete).then(() => {
             //     console.log('Image deleted from Storage successfully');
             // }).catch((error) => {
             //     console.error('Error deleting image from Storage:', error);
             // });


            if (renderedElements[imageId]) {
                delete renderedElements[imageId];
            }
            // Remove the element from the DOM
            imgElement.remove(); // Or spotElement.innerHTML = '';
        } else if (spotElement.innerHTML.trim() !== '') {
             // If there's non-draggable content, just clear the HTML
             spotElement.innerHTML = '';
             console.log(`Cleared non-draggable content from spot ${spotElement.id}.`);
        }
    }
}

// **Helper function to remove an image element from the DOM and map by imageId**
// This function is called when Firebase data indicates an image should be removed from fieldImages.
// It should also handle deleting the image from Firebase Storage.
function removeImageElement(imageId) {
     if (!imageId) return;
     console.log(`Attempting to remove image element with ID ${imageId} from DOM and map.`);
     // Try getting from map first, fallback to DOM query
     const element = renderedElements[imageId] || document.querySelector(`img.draggable-image[data-imageId="${imageId}"]`);

     if (element) {
         // Attempt to delete the image from Firebase Storage
         // Similar to clearSpotElement, a robust solution needs the Storage path.
         // For this example, we'll just log a warning.
         console.warn(`Manual Firebase Storage cleanup might be needed for image with ID: ${imageId}. Consider storing Storage path in DB.`);
         // To implement Storage deletion:
         // const imageStoragePath = `game_images/${gameId}/${imageId}_${original_filename}`; // You need the filename
         // const imageStorageRefToDelete = storageRef(storage, imageStoragePath);
         // deleteObject(imageStorageRefToDelete).then(() => {
         //     console.log('Image deleted from Storage successfully');
         // }).catch((error) => {
         //     console.error('Error deleting image from Storage:', error);
         // });


         // If the element is currently being dragged, maybe defer removal?
         // For simplicity here, we'll remove it, which might stop the drag.
          if (element.parentElement) {
              element.parentElement.removeChild(element);
              console.log(`Removed image element ${imageId} from DOM.`);
          }
          if (renderedElements[imageId]) {
              delete renderedElements[imageId];
               console.log(`Removing image ${imageId} from renderedElements map.`);
          }
     } else {
         console.log(`Image element with ID ${imageId} not found in DOM or map.`);
     }
}


// --- END FUNCTION DEFINITIONS ---


// **Initial setup based on URL and DOM Ready**
// This runs when the script loads (i.e., when the page loads)
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded. Checking for game ID in URL.");

     // **!! INSECURE PASSWORD PROTECTION EXAMPLE !!**
     // This will hide the page content until a password is entered.
     // Anyone can view the source code and find the password.
     // Consider more secure methods for real-world applications.
     const correctPassword = "MLBSHOWDOWN"; // <-- This password is visible in source code!
     const gameContent = document.getElementById('gameContent'); // Get the main content div

     // Hide content initially using CSS (e.g., body { display: none; } initially in CSS, then JS changes it)
     // Or apply a class that hides it
     if (gameContent) {
         gameContent.classList.add('hidden-content'); // Assuming you have CSS like .hidden-content { display: none; }

         const enteredPassword = prompt("Please enter the password to access this game:");

         if (enteredPassword === correctPassword) {
             gameContent.classList.remove('hidden-content'); // Show the content
             gameContent.style.display = ''; // Clear any inline style
             console.log("Password correct. Access granted.");
             // Optional: Use localStorage or sessionStorage to remember the user for the session
             // Optional: Redirect to the actual game URL without the prompt if you have a landing page
         } else {
             alert("Incorrect password. Access denied.");
             // Optional: Leave content hidden or redirect
             // window.location.href = "https://yourusername.github.io/your-repo/access-denied.html";
         }
     } else {
         console.error("Main game content div with id 'gameContent' not found. Password protection cannot be applied.");
     }
     // **!! END INSECURE PASSWORD PROTECTION EXAMPLE !!**


    // Get HTML elements that need to be accessed early or have initial states
    const newGameButton = document.getElementById('newGameButton');
    const gameUrlSectionOnLoad = document.getElementById('gameUrlSection');
    const scoreboardControlsButtons = document.querySelectorAll('.scoreboard-controls button');


    if (!gameId) {
        console.log("No game ID found in URL. Showing New Game button, hiding URL section, disabling controls.");

        // Show the new game button if it exists
        if (newGameButton) newGameButton.style.display = 'block';
        // Hide game URL section if no game is loaded
        if (gameUrlSectionOnLoad) gameUrlSectionOnLoad.style.display = 'none';

        // Disable scoreboard controls initially until a game is loaded or created
        console.log("Disabling scoreboard controls because no game is loaded.");
        scoreboardControlsButtons.forEach(button => {
            button.disabled = true;
        });

    } else {
        console.log(`Loading game with ID: ${gameId}`);
        // Get a modular reference to the specific game
        gameRef = ref(db, `games/${gameId}`); // Set gameRef here if gameId exists
        setupListeners(); // Setup Firebase listeners to load game data
         // Listeners will call updateScoreboardHTML which enables controls once data loads

        // Hide the new game button if it exists
        if (newGameButton) newGameButton.style.display = 'none';

        // Show the game URL section and populate it if a game is loaded via URL
        const gameUrlInputOnLoad = document.getElementById('gameUrlInput');
        if (gameUrlSectionOnLoad && gameUrlInputOnLoad) {
             gameUrlSectionOnLoad.style.display = 'flex'; // Use flex as defined in CSS
             gameUrlInputOnLoad.value = `${window.location.origin}${window.location.pathname}?gameId=${gameId}`;
        } else {
             console.warn("Could not find HTML elements for game URL section on load (gameUrlSection, gameUrlInput).");
        }
         // Initial copy button logic is handled by the delegated listener below
         // Scoreboard controls will be enabled once state is loaded via listener
    }

     // **New Game Button Logic**
     if (newGameButton) {
         newGameButton.addEventListener('click', handleNewGameClick); // handleNewGameClick is defined above
     } else {
         console.warn("New game button with id 'newGameButton' not found in the HTML.");
     }

     // **Dice Rolling Logic Setup**
     const dice1Button = document.getElementById('dice1');
     const dice2Button = document.getElementById('dice2'); // Corrected ID
     if (dice1Button) {
         dice1Button.addEventListener('click', () => rollDice('dice1')); // rollDice is defined above
     } else {
         console.warn("Dice button with id 'dice1' not found.");
     }
     if (dice2Button) {
          dice2Button.addEventListener('click', () => rollDice('dice2')); // rollDice is defined above
     } else {
         console.warn("Dice button with id 'dice2' not found.");
     }

     // **Board Spot Click / Image Upload Logic Setup**
     // Assumes you have elements with the class 'spot' that represent board positions
     document.querySelectorAll('.spot').forEach(spot => {
         spot.addEventListener('click', handleSpotClick); // handleSpotClick is defined above
     });

     // Get the hidden file input element
     const fileInput = document.getElementById('fileInput');
     if (fileInput) {
         // Add a change listener to the file input to handle file selection
         fileInput.addEventListener('change', handleImageUpload); // handleImageUpload is defined above
     } else {
         console.error("Hidden file input with id 'fileInput' not found. Image uploads will not work.");
     }

    // **Scoreboard Control Button Delegation Setup**
    // Use event delegation on the parent container for efficiency.
    const scoreboardControlsDiv = document.querySelector('.scoreboard-controls');
    if (scoreboardControlsDiv) {
        scoreboardControlsDiv.addEventListener('click', handleScoreboardControlClick); // handleScoreboardControlClick is defined above
    } else {
        console.error("Scoreboard controls container with class 'scoreboard-controls' not found.");
        // If controls container isn't found, keep all buttons disabled
        scoreboardControlsButtons.forEach(button => {
            button.disabled = true;
        });
    }

     // **Copy URL Button Delegation Setup**
     const gameUrlSection = document.getElementById('gameUrlSection');
     if (gameUrlSection) {
         gameUrlSection.addEventListener('click', handleCopyUrlClick); // handleCopyUrlClick is defined above
     } else {
          console.warn("Game URL section with id 'gameUrlSection' not found. Copy URL functionality might be limited.");
     }

      // **Strategy List Toggle Setup**
      const strategyBar = document.querySelector('.strategy-bar');
      if (strategyBar) {
          strategyBar.addEventListener('click', toggleStrategyList); // toggleStrategyList is defined above
      } else {
           console.warn("Strategy bar with class 'strategy-bar' not found.");
      }

      // **Close Strategy List Panel when clicking outside Setup**
      document.addEventListener('click', handleClickOutsideStrategyList); // handleClickOutsideStrategyList is defined above

}); // End of DOMContentLoaded listener - this should be the very last thing in the script



