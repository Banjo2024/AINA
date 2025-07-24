import React, { useEffect, useState } from "react";
import '../App.css';

function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    protein_100g: "",
    fat_100g: "",
    carbs_100g: "",
    calories_100g: ""
  });

  // Add Recipe form state
  const [form, setForm] = useState({
    name: "",
    protein_100g: "",
    fat_100g: "",
    carbs_100g: "",
    calories_100g: ""
  });
  const [addStatus, setAddStatus] = useState("");

  // Load recipes from backend
  useEffect(() => {
    fetch("http://127.0.0.1:8000/recipes/")
      .then(res => res.json())
      .then(data => setRecipes(data))
      .catch(() => setError("Failed to load recipes"))
      .finally(() => setLoading(false));
  }, []);

  // Delete recipe handler
  async function handleDelete(id) {
    if (!window.confirm("Delete this recipe?")) return;
    setDeletingId(id);
    const res = await fetch(`http://127.0.0.1:8000/recipes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRecipes(recipes => recipes.filter(r => r.id !== id));
    } else {
      alert("Failed to delete recipe.");
    }
    setDeletingId(null);
  }

  // Save (update) recipe handler
  async function handleSaveEdit(recipe) {
    const res = await fetch(`http://127.0.0.1:8000/recipes/${recipe.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        protein_100g: Number(editForm.protein_100g),
        fat_100g: Number(editForm.fat_100g),
        carbs_100g: Number(editForm.carbs_100g),
        calories_100g: Number(editForm.calories_100g),
      })
    });
    if (res.ok) {
      setRecipes(recipes =>
        recipes.map(r =>
          r.id === recipe.id
            ? { ...r, ...editForm }
            : r
        )
      );
      setEditId(null);
    } else {
      alert("Failed to save recipe.");
    }
  }

  // Add Recipe submit handler
  async function handleAddRecipe(e) {
    e.preventDefault();
    setAddStatus("Saving…");
    const res = await fetch("http://127.0.0.1:8000/recipes/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        protein_100g: Number(form.protein_100g),
        fat_100g: Number(form.fat_100g),
        carbs_100g: Number(form.carbs_100g),
        calories_100g: Number(form.calories_100g),
      })
    });
    if (res.ok) {
      const newRecipe = await res.json();
      setRecipes(recipes => [...recipes, newRecipe]);
      setForm({
        name: "",
        protein_100g: "",
        fat_100g: "",
        carbs_100g: "",
        calories_100g: ""
      });
      setAddStatus("Recipe added!");
      setTimeout(() => setAddStatus(""), 2000);
    } else {
      setAddStatus("Failed to add recipe.");
    }
  }

  if (loading) return <div>Loading recipes…</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <div className="page-container">
      <h2 className="heading-main">Custom Recipes</h2>

      {/* Add Recipe Form */}
      <div className="section-card" style={{ background: "#f4f8ee", border: "1px solid #d7e5ce" }}>
        <h4>Add New Recipe</h4>
        <form onSubmit={handleAddRecipe} className="flex-row" style={{ flexWrap: "wrap", gap: 8 }}>
          <input
            className="input"
            placeholder="Recipe name"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={{ width: 140 }}
          />
          <input
            className="input"
            placeholder="Protein"
            type="number"
            min="0"
            required
            value={form.protein_100g}
            onChange={e => setForm(f => ({ ...f, protein_100g: e.target.value }))}
            style={{ width: 90 }}
          />
          <input
            className="input"
            placeholder="Fat"
            type="number"
            min="0"
            required
            value={form.fat_100g}
            onChange={e => setForm(f => ({ ...f, fat_100g: e.target.value }))}
            style={{ width: 90 }}
          />
          <input
            className="input"
            placeholder="Carbs"
            type="number"
            min="0"
            required
            value={form.carbs_100g}
            onChange={e => setForm(f => ({ ...f, carbs_100g: e.target.value }))}
            style={{ width: 90 }}
          />
          <input
            className="input"
            placeholder="Calories"
            type="number"
            min="0"
            required
            value={form.calories_100g}
            onChange={e => setForm(f => ({ ...f, calories_100g: e.target.value }))}
            style={{ width: 90 }}
          />
          <button type="submit" className="btn-main" style={{ marginLeft: 10 }}>Add</button>
          {addStatus && <span style={{ color: "#159b4b", marginLeft: 8 }}>{addStatus}</span>}
        </form>
      </div>

      {/* Recipe List */}
      {recipes.length === 0 ? (
        <div>No recipes yet.</div>
      ) : (
        <div>
          {recipes.map(recipe => (
            <div key={recipe.id} className="section-card" style={{ marginBottom: 16 }}>
              {editId === recipe.id ? (
                // Edit Form
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSaveEdit(recipe);
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 8,
                    marginTop: 4,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={{ fontSize: 13 }}>Name</label>
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      required
                      style={{ width: "95%" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={{ fontSize: 13 }}>Protein</label>
                    <input
                      type="number"
                      value={editForm.protein_100g}
                      onChange={e => setEditForm(f => ({ ...f, protein_100g: e.target.value }))}
                      min={0}
                      required
                      style={{ width: "80%" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={{ fontSize: 13 }}>Fat</label>
                    <input
                      type="number"
                      value={editForm.fat_100g}
                      onChange={e => setEditForm(f => ({ ...f, fat_100g: e.target.value }))}
                      min={0}
                      required
                      style={{ width: "80%" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={{ fontSize: 13 }}>Carbs</label>
                    <input
                      type="number"
                      value={editForm.carbs_100g}
                      onChange={e => setEditForm(f => ({ ...f, carbs_100g: e.target.value }))}
                      min={0}
                      required
                      style={{ width: "80%" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={{ fontSize: 13 }}>Calories</label>
                    <input
                      type="number"
                      value={editForm.calories_100g}
                      onChange={e => setEditForm(f => ({ ...f, calories_100g: e.target.value }))}
                      min={0}
                      required
                      style={{ width: "90%" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button type="submit" style={{ marginBottom: 2 }}>Save</button>
                    <button type="button" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <b>{recipe.name}</b><br/>
                  Protein: <b>{recipe.protein_100g}g</b>,&nbsp;
                  Fat: <b>{recipe.fat_100g}g</b>,&nbsp;
                  Carbs: <b>{recipe.carbs_100g}g</b>,&nbsp;
                  Calories: <b>{recipe.calories_100g}</b>
                  <div style={{ marginTop: 4 }}>
                    <button
                      onClick={() => {
                        setEditId(recipe.id);
                        setEditForm({
                          name: recipe.name,
                          protein_100g: recipe.protein_100g,
                          fat_100g: recipe.fat_100g,
                          carbs_100g: recipe.carbs_100g,
                          calories_100g: recipe.calories_100g
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(recipe.id)}
                      disabled={deletingId === recipe.id}
                      style={{ marginLeft: 5 }}
                    >
                      {deletingId === recipe.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecipesPage;
