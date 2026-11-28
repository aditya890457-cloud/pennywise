# PENNYWISE EXPENSE TRACKER
========================

Requirements:
- Java JDK 11 or newer
- VS Code (optional)
- Internet connection for Chart.js and Google Fonts CDN

PROJECT FILES
- index.html: frontend page
- style.css: design and responsive layout
- script.js: browser interactions and API requests
- src/Main.java: Java HTTP backend and JSON file storage

HOW TO RUN
1. Open the PennyWise folder in VS Code.
2. Open Terminal in VS Code.
3. Compile the Java backend:
   ```bash
   javac -d out src/Main.java
   ```
4. Start the backend:
   ```bash
   java -cp out Main
   ```
5. Keep that terminal running.
6. Open a second terminal in the project folder and start a local web server:
   ```bash
   python3 -m http.server 5500
   ```
7. Open this address in your browser:
   ```text
   http://localhost:5500
   ```

Your browser will call the Java API at http://localhost:8080.
