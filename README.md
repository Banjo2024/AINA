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
- **Future plans:** Glucose tracking, AI-powered meal suggestions, and more!

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

Features
- Log foods with portion size and date/time

- See daily, weekly, monthly macro trends

- Compare periods (days, weeks, months)

- Set and track macro goals

- See macro percentages for any period (pie chart)

- Flexible graph visualizations (bar/line/pie)

- (Coming soon) CGM (glucose) integration & AI meal suggestions

## Customization

- Edit macro goals in the app UI
- Add local foods or fetch from Fineli database
- Update front/backend as needed for your workflow

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you’d like to change.

##Licence

MIT

Repository: https://github.com/Banjo2024/AINA








   

  





