You are a senior full-stack engineer and product-minded developer.

Your task is to generate a COMPLETE, WORKING MVP web application based on the following specification.
You must produce clean, minimal, production-style code, prioritizing clarity, separation of concerns and simplicity.

The project must run LOCALLY using Docker.

────────────────────────────────────────
PROJECT CONCEPT
────────────────────────────────────────

This is a minimalist social web app designed for small groups of friends.

Core idea:
Users can create groups and add “things they want to tell” other members, but the CONTENT is hidden until they meet in person and activate a ritual mode together.

The app is NOT a chat, NOT a feed, NOT a social network.
It focuses on anticipation, waiting, and in-person moments.

────────────────────────────────────────
FUNCTIONAL SCOPE (MVP)
────────────────────────────────────────

✔ Web application (responsive)
✔ User registration & login
✔ Group creation and management
✔ Add “things to tell” (hidden content)
✔ Ritual mode to reveal things together
✔ No gamification, no achievements (section disabled but prepared)

────────────────────────────────────────
USERS & AUTHENTICATION
────────────────────────────────────────

- Registration with:
  - name
  - nickname (displayed everywhere instead of name)
  - email
  - avatar (URL or uploaded file)
  - password

- Authentication using JWT
- All API routes protected except auth
- Comments in Spanish, code identifiers in English

────────────────────────────────────────
GROUPS
────────────────────────────────────────

- A user can belong to up to 20 groups
- A group can have up to 20 members
- Group has:
  - name
  - creator
  - creation date

Permissions:
- Creator can invite members
- ANY group member can also invite other users
- No roles beyond this

────────────────────────────────────────
THINGS TO TELL (CORE ENTITY)
────────────────────────────────────────

Each group member can add items with:
- text (required, hidden until ritual)
- type (enum: anecdote / important / difficult)
- emotional weight (normal / important / difficult)
- creation date
- author (visible)
- status: pending / told

Rules:
- The content text is NEVER visible while pending
- Other users see:
  - who added something
  - how many pending items they have
- Items can be edited or deleted while pending
- Items CAN be added even during ritual mode

────────────────────────────────────────
GROUP VIEW (UX LOGIC)
────────────────────────────────────────

Inside a group:
- Show list of members
- For each member:
  - nickname
  - number of pending items
  - emotional weight indicator (icon or color)
- No titles, no previews, no dates of items

────────────────────────────────────────
RITUAL MODE (“WE ARE TOGETHER”)
────────────────────────────────────────

Entering ritual mode requires:
- A live vote by group members
- Simple majority to activate

Once active:
- Dark / minimal UI
- Items are revealed ONE BY ONE
- Order of reveal is decided at ritual start
- Each reveal shows:
  - author nickname
  - how long the item waited (days)
  - emotional type
- The text content is revealed ONLY AFTER marking as “told”
- Ritual session can be paused and resumed later

After all items are told:
- Show a closure screen summarizing:
  - number of days since last ritual
  - number of items told

────────────────────────────────────────
HISTORY
────────────────────────────────────────

- Each group has its own history
- History shows:
  - items told
  - how long they waited
  - date of ritual
- No global or personal history outside group

────────────────────────────────────────
DESIGN REQUIREMENTS
────────────────────────────────────────

- Minimalist UI
- Modern sans-serif typography
- No animations for now
- No colors screaming for attention
- Focus on whitespace and calm visuals

Frontend must use Vue components (Composition API).
No UI framework unless strictly necessary.

────────────────────────────────────────
TECH STACK
────────────────────────────────────────

Backend:
- Node.js
- Express
- JWT authentication
- MySQL
- Clean MVC structure

Frontend:
- Vue (components)
- Plain CSS

Infrastructure:
- Docker
- docker-compose with exactly 3 containers:
  1. frontend
  2. backend
  3. mysql

The app must start with:
  docker compose up --build

────────────────────────────────────────
DELIVERABLES
────────────────────────────────────────

Generate:
- Full folder structure
- Backend API routes
- Database schema & migrations/init SQL
- Frontend Vue components
- Auth flow
- docker-compose.yml
- README.md explaining how to run locally

You are allowed to decide minor implementation details,
but you MUST strictly follow the product logic above.

The result should be a functional MVP ready to extend.

