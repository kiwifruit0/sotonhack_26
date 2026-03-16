# Echo
Our submission to [SotonHack 2026](https://sotonhack.org/), winning the "Best use of ElevenLabs" track.

Echo is a voice-based social media, bridging the semi-anonymous forum style of Reddit and Quora with the daily interaction between friends seen in BeReal.

Users interact with the app through a voice of their choosing from ElevenLabs, and can ask or answer public questions, create daily notes for friends and more! Friends hear each other's actual daily voice recordings, whereas public forum answers are read in each user's chosen voice for anonymity.
The forum questions shown for each user are determined by their "interests" which they choose when registering, and are automatically updated from the type of questions they ask.

We built the frontend with React and Tailwind, the backend with FastAPI in Python, and used ElevenLabs for voices, Gemini's API for text classification and MongoDB Atlas for storing our data.

## App Preview
This is the main screen through which users interact with their voice:
![Main Screen](docs/main_screen.png)


When users ask questions or have questions matching their interests they appear here:
![Forum Screen](docs/forum_screen.png)


Friends are displayed in a connected graph, where users can see which of their friends are connected:
![Friends Screen](docs/friends_screen.png)


Interests are chosen after registering, and are automatically updated based on the content of the questions the user asks. They can be seen and updated manually here:
![Profile Screen](docs/profile_screen.png)


And of course, a page to login or register:
![Login Screen](docs/login_screen.png)


## Setup and Running It Yourself

### Project Setup

To set up the backend:
1. `cd backend`
2. `uv sync`

To set up the frontend:
1. `cd frontend`
2. `npm install`

### Running the App
You need 2 terminals, one for the fastapi server and one for the frontend.

1. Backend terminal (from project root directory):
  ```uv run --project backend uvicorn backend.main:app```

2. Frontend terminal (from `frontend` directory):
  ```npm run dev```

3. Go to [localhost port 5173](http://localhost:5173/) on a browser to see the web app
