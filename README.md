# 🥗 Personal Nutrition & Health Tracker

A user-friendly web app for logging your meals, tracking macros (calories, protein, carbs, fat), and visualizing your nutrition trends over time.  
Built with **React** (frontend) and **FastAPI** (backend).

---

## Features

- **Easy Food Logging:** Add foods by portion, get instant macro breakdowns.
- **Macro & Calorie Tracking:** Visual charts for daily, weekly, monthly trends.
- **Custom Goals:** Set and edit personal nutrition goals.
- **Compare Periods:** See your progress over different weeks or months.
- **Interactive Graphs:** Toggle which macros to view, filter by time range.
- **Fineli Integration:** Pull nutrition info from Finland’s national food database.
- **Nightscout Integration:** Import and view your glucose readings.

---

## Technologies Used

- **Frontend:** React, Recharts
- **Backend:** FastAPI, SQLModel, SQLite
- **API Integration:** Fineli.fi

---

## Project structure

<pre> AINA/
├── backend/                # FastAPI backend (Python)
│   ├── app.py
│   ├── aina.db
│
├── frontend/               # React frontend (Node.js)
│
├── node_modules/
├── .gitignore
├── git_commands.md
├── package.json
├── package-lock.json
├── text.txt
├── README.md
 </pre>

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Banjo2024/AINA.git
cd AINA
```
### 2. Install dependencies
  Backend

```bash
cd backend
pip install -r requirements.txt
```
   Frontend

```bash
cd ../frontend
npm install
```

### 3. Set up database
```bash
# From the backend directory:
python app.py
```

### 4. Run the application

Start the backend server

```bash
cd backend
uvicorn app:app --reload
```

Start the frontend development server

```bash
cd ../frontend
npm start
```

### 5. Nightscout integration

Create a `.env` file in the project root based on `.env.example` and provide your Nightscout URL and API token:

```bash
cp .env.example .env
echo "NIGHTSCOUT_URL=https://<your-nightscout>" >> .env
echo "NIGHTSCOUT_TOKEN=<api-token>" >> .env
```

To import the latest glucose readings run:

```bash
curl -X POST http://127.0.0.1:8000/import/glucose
```

## Customization

- Edit macro goals in the app UI
- Add local foods or fetch from Fineli database
- Update front/backend as needed for your workflow

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you’d like to change.

## Licence

MIT License

Copyright (c) 2024 Viktor Zaitsev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


##

Repository: https://github.com/Banjo2024/AINA








   

  





