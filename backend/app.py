from fastapi import FastAPI, HTTPException
from sqlmodel import Field, SQLModel, create_engine, Session, select
from typing import Optional, List
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI()

# CORS (for localhost and 127.0.0.1)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB Model
class Food(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    protein: float
    fat: float
    carbs: float
    calories: float
    grams: float = Field(default=100)
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

sqlite_file_name = "aina.db"
engine = create_engine(f"sqlite:///{sqlite_file_name}")

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# --- Fineli integration for fallback/autofill ---
def extract_nutrient(nutrients, nutrient_id):
    val = next((c.get("valuePer100g") for c in nutrients if c["nutrientId"] == nutrient_id), None)
    return float(val) if val is not None else 0.0

def get_food_from_fineli(food_name):
    url = f"https://fineli.fi/fineli/api/v1/foods?q={food_name}"
    response = requests.get(url)
    if not response.ok:
        print("Fineli API error:", response.status_code, response.text)
        return None
    try:
        foods = response.json()
    except Exception as e:
        print("Fineli API did not return JSON:", response.text)
        return None
    if not foods:
        print("No foods found for", food_name)
        return None
    food = foods[0]
    food_id = food['id']
    detail_response = requests.get(f"https://fineli.fi/fineli/api/v1/foods/{food_id}")
    if not detail_response.ok:
        print("Fineli food detail error:", detail_response.status_code, detail_response.text)
        return None
    detail = detail_response.json()
    nutrients = detail.get("nutrients", [])
    return {
        'name': detail["name"]["fi"] if "fi" in detail["name"] else detail["name"]["en"],
        'protein': extract_nutrient(nutrients, 79),
        'fat': extract_nutrient(nutrients, 80),
        'carbs': extract_nutrient(nutrients, 82),
        'calories': extract_nutrient(nutrients, 106),
    }

# --- API endpoints for your frontend ---

@app.get("/foods/", response_model=List[Food])
def get_foods():
    with Session(engine) as session:
        foods = session.exec(select(Food).order_by(Food.created_at.desc())).all()
        return foods

@app.post("/foods/", response_model=Food)
def create_food(food: Food):
    with Session(engine) as session:
        # Fill missing macros from Fineli if necessary
        if not all([food.protein, food.fat, food.carbs, food.calories]):
            fineli_data = get_food_from_fineli(food.name)
            if fineli_data:
                food.protein = food.protein or fineli_data['protein']
                food.fat = food.fat or fineli_data['fat']
                food.carbs = food.carbs or fineli_data['carbs']
                food.calories = food.calories or fineli_data['calories']
            else:
                raise HTTPException(status_code=404, detail="Food not found in Fineli")

        if not food.grams:
            food.grams = 100  # Default to 100g if not set

        # --- NEW: parse string created_at to datetime if needed ---
        if isinstance(food.created_at, str):
            try:
                # Accept "YYYY-MM-DDTHH:mm"
                food.created_at = datetime.fromisoformat(food.created_at)
            except Exception:
                try:
                    # Accept if missing seconds by adding ":00"
                    food.created_at = datetime.fromisoformat(food.created_at + ":00")
                except Exception:
                    raise HTTPException(status_code=422, detail="Invalid created_at format")

        if not food.created_at:
            food.created_at = datetime.utcnow()

        session.add(food)
        session.commit()
        session.refresh(food)
        return food
