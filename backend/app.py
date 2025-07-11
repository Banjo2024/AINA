from fastapi import FastAPI, HTTPException, Query
from sqlmodel import Field, SQLModel, create_engine, Session, select
from typing import Optional, List
from datetime import datetime, date
from fastapi.middleware.cors import CORSMiddleware
import requests
from pydantic import BaseModel
class RecipeUpdateRequest(BaseModel):
    name: str
    protein_100g: float
    fat_100g: float
    carbs_100g: float
    calories_100g: float

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
    protein_100g: Optional[float] = None
    fat_100g: Optional[float] = None
    carbs_100g: Optional[float] = None
    calories_100g: Optional[float] = None

class Recipe(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    protein_100g: float
    fat_100g: float
    carbs_100g: float
    calories_100g: float
    # Optionally: add fields like description, author, ingredients later


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
        # Also return per-100g values
        'protein_100g': extract_nutrient(nutrients, 79),
        'fat_100g': extract_nutrient(nutrients, 80),
        'carbs_100g': extract_nutrient(nutrients, 82),
        'calories_100g': extract_nutrient(nutrients, 106),
    }

# --- API endpoints for your frontend ---

@app.get("/foods/", response_model=List[Food])
def get_foods():
    with Session(engine) as session:
        foods = session.exec(select(Food).order_by(Food.created_at.desc())).all()
        return foods

# Create a recipe
@app.post("/recipes/", response_model=Recipe)
def create_recipe(recipe: Recipe):
    with Session(engine) as session:
        session.add(recipe)
        session.commit()
        session.refresh(recipe)
        return recipe

# List/search recipes
@app.get("/recipes/", response_model=List[Recipe])
def list_recipes():
    with Session(engine) as session:
        recipes = session.exec(select(Recipe).order_by(Recipe.name)).all()
        return recipes

# (Optional) Delete a recipe
@app.delete("/recipes/{recipe_id}", response_model=Recipe)
def delete_recipe(recipe_id: int):
    with Session(engine) as session:
        recipe = session.get(Recipe, recipe_id)
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        session.delete(recipe)
        session.commit()
        return recipe


@app.get("/logs/by_day")
def get_food_logs_by_day(date: date = Query(...)):
    start_datetime = datetime.combine(date, datetime.min.time())
    end_datetime = datetime.combine(date, datetime.max.time())
    with Session(engine) as session:
        logs = session.exec(
            select(Food)
            .where(Food.created_at >= start_datetime, Food.created_at <= end_datetime)
            .order_by(Food.created_at)
        ).all()
        totals = {
            "protein": sum(log.protein for log in logs),
            "fat": sum(log.fat for log in logs),
            "carbs": sum(log.carbs for log in logs),
            "calories": sum(log.calories for log in logs),
            "grams": sum(log.grams for log in logs)
        }
        foods = [
            {
                "id": log.id,
                "name": log.name,
                "protein": log.protein,
                "fat": log.fat,
                "carbs": log.carbs,
                "calories": log.calories,
                "grams": log.grams,
                "created_at": log.created_at
            }
            for log in logs
        ]
        return {
            "date": str(date),
            "foods": foods,
            "totals": totals
        }

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
                food.protein_100g = fineli_data['protein_100g']
                food.fat_100g = fineli_data['fat_100g']
                food.carbs_100g = fineli_data['carbs_100g']
                food.calories_100g = fineli_data['calories_100g']
            else:
                raise HTTPException(status_code=404, detail="Food not found in Fineli")

        if not food.grams:
            food.grams = 100  # Default to 100g if not set

        # Set per-100g fields if not already set
        if not (food.protein_100g and food.fat_100g and food.carbs_100g and food.calories_100g):
            scale = 100.0 / food.grams if food.grams else 1.0
            food.protein_100g = food.protein * scale
            food.fat_100g = food.fat * scale
            food.carbs_100g = food.carbs * scale
            food.calories_100g = food.calories * scale

        # --- NEW: parse string created_at to datetime if needed ---
        if isinstance(food.created_at, str):
            try:
                food.created_at = datetime.fromisoformat(food.created_at)
            except Exception:
                try:
                    food.created_at = datetime.fromisoformat(food.created_at + ":00")
                except Exception:
                    raise HTTPException(status_code=422, detail="Invalid created_at format")

        if not food.created_at:
            food.created_at = datetime.utcnow()

        session.add(food)
        session.commit()
        session.refresh(food)
        return food

# --- NEW: DELETE endpoint ---
@app.delete("/foods/{food_id}", response_model=Food)
def delete_food(food_id: int):
    with Session(engine) as session:
        food = session.get(Food, food_id)
        if not food:
            raise HTTPException(status_code=404, detail="Food not found")
        session.delete(food)
        session.commit()
        return food
    
# --- NEW: Edit Recipe endpoint ---

@app.put("/recipes/{recipe_id}", response_model=Recipe)
def update_recipe(recipe_id: int, update: RecipeUpdateRequest):
    with Session(engine) as session:
        recipe = session.get(Recipe, recipe_id)
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        recipe.name = update.name
        recipe.protein_100g = update.protein_100g
        recipe.fat_100g = update.fat_100g
        recipe.carbs_100g = update.carbs_100g
        recipe.calories_100g = update.calories_100g
        session.add(recipe)
        session.commit()
        session.refresh(recipe)
        return recipe

# --- NEW: PUT endpoint for editing grams ---
class UpdateGramsRequest(BaseModel):
    grams: float

@app.put("/foods/{food_id}", response_model=Food)
def update_food_grams(food_id: int, update: UpdateGramsRequest):
    with Session(engine) as session:
        food = session.get(Food, food_id)
        if not food:
            raise HTTPException(status_code=404, detail="Food not found")
        scale = update.grams / 100.0
        food.grams = update.grams
        food.protein = (food.protein_100g or 0) * scale
        food.fat = (food.fat_100g or 0) * scale
        food.carbs = (food.carbs_100g or 0) * scale
        food.calories = (food.calories_100g or 0) * scale
        session.add(food)
        session.commit()
        session.refresh(food)
        return food
