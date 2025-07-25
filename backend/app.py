from fastapi import FastAPI, HTTPException, Query
from sqlmodel import Field, SQLModel, create_engine, Session, select
from typing import Optional, List
from datetime import datetime, date
from fastapi.middleware.cors import CORSMiddleware
from collections import defaultdict
import requests
from pydantic import BaseModel

class RecipeUpdateRequest(BaseModel):
    name: str
    protein_100g: float
    fat_100g: float
    carbs_100g: float
    calories_100g: float

app = FastAPI()

# CORS
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

# DB Models
class Food(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name_fi: Optional[str] = None
    name_en: Optional[str] = None
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

sqlite_file_name = "aina.db"
engine = create_engine(f"sqlite:///{sqlite_file_name}")

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# --- Fineli integration ---
def extract_nutrient(nutrients, nutrient_id):
    val = next((c.get("valuePer100g") for c in nutrients if c["nutrientId"] == nutrient_id), None)
    return float(val) if val is not None else 0.0

def get_food_from_fineli(food_name, lang='fi'):
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/91.0.4472.124 Safari/537.36"
        )
    }
    url = f"https://fineli.fi/fineli/api/v1/foods?q={food_name}&lang={lang}"
    response = requests.get(url, headers=headers)
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
    detail_response = requests.get(f"https://fineli.fi/fineli/api/v1/foods/{food_id}", headers=headers)
    if not detail_response.ok:
        print("Fineli food detail error:", detail_response.status_code, detail_response.text)
        return None
    detail = detail_response.json()
    nutrients = detail.get("nutrients", [])
    name_fi = detail["name"].get("fi", "")
    name_en = detail["name"].get("en", name_fi)
    return {
        'name_fi': name_fi,
        'name_en': name_en,
        'protein': extract_nutrient(nutrients, 79),
        'fat': extract_nutrient(nutrients, 80),
        'carbs': extract_nutrient(nutrients, 82),
        'calories': extract_nutrient(nutrients, 106),
        'protein_100g': extract_nutrient(nutrients, 79),
        'fat_100g': extract_nutrient(nutrients, 80),
        'carbs_100g': extract_nutrient(nutrients, 82),
        'calories_100g': extract_nutrient(nutrients, 106),
    }

# --- Fineli search endpoint ---
@app.get("/search/foods/")
def search_foods(q: str = Query(...), lang: str = Query('fi')):
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/91.0.4472.124 Safari/537.36"
        )
    }
    url = f"https://fineli.fi/fineli/api/v1/foods?q={q}&lang={lang}"
    response = requests.get(url, headers=headers)
    if not response.ok:
        print("Fineli API error:", response.status_code, response.text)
        raise HTTPException(status_code=404, detail="Food not found in Fineli")
    try:
        foods = response.json()
    except Exception as e:
        print("Fineli API did not return JSON:", response.text)
        raise HTTPException(status_code=500, detail="Fineli API error")
    result = []
    for food in foods[:10]:
        food_id = food['id']
        detail_response = requests.get(f"https://fineli.fi/fineli/api/v1/foods/{food_id}", headers=headers)
        if not detail_response.ok:
            continue
        detail = detail_response.json()
        name_fi = detail["name"].get("fi", "")
        name_en = detail["name"].get("en", name_fi)
        result.append({
            "id": food_id,
            "name_fi": name_fi,
            "name_en": name_en,
        })
    if not result:
        raise HTTPException(status_code=404, detail="No foods found")
    return result

# --- Foods endpoint with search and language ---
@app.get("/foods/", response_model=List[Food])
def get_foods(q: Optional[str] = Query(None), lang: str = Query('fi')):
    with Session(engine) as session:
        stmt = select(Food).order_by(Food.created_at.desc())
        if q:
            if lang == 'en':
                stmt = stmt.where(Food.name_en.ilike(f"%{q}%"))
            else:
                stmt = stmt.where(Food.name_fi.ilike(f"%{q}%"))
        foods = session.exec(stmt).all()
        return foods

# --- Recipes endpoint with search ---
@app.get("/recipes/", response_model=List[Recipe])
def list_recipes(q: Optional[str] = Query(None)):
    with Session(engine) as session:
        stmt = select(Recipe).order_by(Recipe.name)
        if q:
            stmt = stmt.where(Recipe.name.ilike(f"%{q}%"))
        recipes = session.exec(stmt).all()
        return recipes

@app.post("/recipes/", response_model=Recipe)
def create_recipe(recipe: Recipe):
    with Session(engine) as session:
        session.add(recipe)
        session.commit()
        session.refresh(recipe)
        return recipe

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
                "name_fi": log.name_fi,
                "name_en": log.name_en,
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
def create_food(food: Food, lang: str = Query('fi')):
    with Session(engine) as session:
        # If any core macros are missing, autofill from Fineli using selected lang
        if not all([food.protein, food.fat, food.carbs, food.calories]):
            fineli_data = get_food_from_fineli(food.name_fi or food.name_en or "", lang=lang)
            if fineli_data:
                food.name_fi = food.name_fi or fineli_data['name_fi']
                food.name_en = food.name_en or fineli_data['name_en']
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
        if not (food.protein_100g and food.fat_100g and food.carbs_100g and food.calories_100g):
            scale = 100.0 / food.grams if food.grams else 1.0
            food.protein_100g = food.protein * scale
            food.fat_100g = food.fat * scale
            food.carbs_100g = food.carbs * scale
            food.calories_100g = food.calories * scale
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

@app.delete("/foods/{food_id}", response_model=Food)
def delete_food(food_id: int):
    with Session(engine) as session:
        food = session.get(Food, food_id)
        if not food:
            raise HTTPException(status_code=404, detail="Food not found")
        session.delete(food)
        session.commit()
        return food

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

@app.get("/logs/by_range")
def get_food_logs_by_range(start: date = Query(...), end: date = Query(...)):
    """
    Returns daily totals of macros between start and end dates (inclusive).
    Output: List of dicts with 'date', 'protein', 'fat', 'carbs', 'calories', 'grams'
    """
    start_datetime = datetime.combine(start, datetime.min.time())
    end_datetime = datetime.combine(end, datetime.max.time())
    with Session(engine) as session:
        logs = session.exec(
            select(Food)
            .where(Food.created_at >= start_datetime, Food.created_at <= end_datetime)
            .order_by(Food.created_at)
        ).all()
    daily = defaultdict(lambda: {"protein": 0, "fat": 0, "carbs": 0, "calories": 0, "grams": 0})
    for log in logs:
        day = log.created_at.date().isoformat()
        daily[day]["protein"] += log.protein
        daily[day]["fat"] += log.fat
        daily[day]["carbs"] += log.carbs
        daily[day]["calories"] += log.calories
        daily[day]["grams"] += log.grams
    return [
        {"date": day, **vals}
        for day, vals in sorted(daily.items())
    ]

@app.get("/logs/summary")
def get_macros_summary(start: date = Query(...), end: date = Query(...)):
    start_datetime = datetime.combine(start, datetime.min.time())
    end_datetime = datetime.combine(end, datetime.max.time())
    with Session(engine) as session:
        logs = session.exec(
            select(Food)
            .where(Food.created_at >= start_datetime, Food.created_at <= end_datetime)
        ).all()
    protein = sum(log.protein for log in logs)
    fat = sum(log.fat for log in logs)
    carbs = sum(log.carbs for log in logs)
    total = protein + fat + carbs
    perc = {
        "protein": round(100 * protein / total, 1) if total else 0,
        "carbs": round(100 * carbs / total, 1) if total else 0,
        "fat": round(100 * fat / total, 1) if total else 0,
    }
    return {
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
        "percentages": perc
    }

# --- NEW: AGGREGATE ENDPOINT ---
@app.get("/logs/aggregate")
def get_macros_aggregate(
    start: date = Query(...),
    end: date = Query(...),
    group_by: str = Query("day", pattern="^(day|week|month)$")
):
    start_datetime = datetime.combine(start, datetime.min.time())
    end_datetime = datetime.combine(end, datetime.max.time())
    with Session(engine) as session:
        logs = session.exec(
            select(Food)
            .where(Food.created_at >= start_datetime, Food.created_at <= end_datetime)
            .order_by(Food.created_at)
        ).all()

    if group_by == "day":
        daily = defaultdict(lambda: {"protein": 0, "fat": 0, "carbs": 0, "calories": 0, "grams": 0})
        for log in logs:
            day = log.created_at.date().isoformat()
            daily[day]["protein"] += log.protein
            daily[day]["fat"] += log.fat
            daily[day]["carbs"] += log.carbs
            daily[day]["calories"] += log.calories
            daily[day]["grams"] += log.grams
        return [
            {"date": day, **vals}
            for day, vals in sorted(daily.items())
        ]

    elif group_by == "week":
        weekly = defaultdict(lambda: {"protein": 0, "fat": 0, "carbs": 0, "calories": 0, "grams": 0, "dates": set()})
        for log in logs:
            iso = log.created_at.isocalendar()
            week_key = f"{iso[0]}-W{str(iso[1]).zfill(2)}"
            weekly[week_key]["protein"] += log.protein
            weekly[week_key]["fat"] += log.fat
            weekly[week_key]["carbs"] += log.carbs
            weekly[week_key]["calories"] += log.calories
            weekly[week_key]["grams"] += log.grams
            weekly[week_key]["dates"].add(log.created_at.date())
        result = []
        for week_key, vals in sorted(weekly.items()):
            dates = sorted(vals["dates"])
            start_date = dates[0].isoformat() if dates else None
            end_date = dates[-1].isoformat() if dates else None
            item = { "week": week_key, "start": start_date, "end": end_date }
            item.update({k: v for k, v in vals.items() if k != "dates"})
            result.append(item)
        return result

    elif group_by == "month":
        monthly = defaultdict(lambda: {"protein": 0, "fat": 0, "carbs": 0, "calories": 0, "grams": 0, "dates": set()})
        for log in logs:
            m_key = log.created_at.strftime("%Y-%m")
            monthly[m_key]["protein"] += log.protein
            monthly[m_key]["fat"] += log.fat
            monthly[m_key]["carbs"] += log.carbs
            monthly[m_key]["calories"] += log.calories
            monthly[m_key]["grams"] += log.grams
            monthly[m_key]["dates"].add(log.created_at.date())
        result = []
        for m_key, vals in sorted(monthly.items()):
            dates = sorted(vals["dates"])
            start_date = dates[0].isoformat() if dates else None
            end_date = dates[-1].isoformat() if dates else None
            item = { "month": m_key, "start": start_date, "end": end_date }
            item.update({k: v for k, v in vals.items() if k != "dates"})
            result.append(item)
        return result

    else:
        raise HTTPException(status_code=400, detail="Invalid group_by parameter (day|week|month)")
