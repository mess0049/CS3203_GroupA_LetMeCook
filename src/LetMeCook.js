// Basic calorie tracker object
const calorieTracker = {
  totalCalories: 0,
  entries: [],

  addEntry(name, calories) {
    this.entries.push({ name, calories });
    this.totalCalories += calories;
    updateSummary();
  },

  removeEntry(name) {
    const index = this.entries.findIndex(e => e.name === name);
    if (index !== -1) {
      this.totalCalories -= this.entries[index].calories;
      this.entries.splice(index, 1);
      updateSummary();
    } else {
      alert(`No entry found for "${name}"`);
    }
  }
};

// UI FUNCTIONS
function addSelectedFood() {
  const select = document.getElementById("foodSelect");
  const name = select.value;
  const calories = parseInt(select.selectedOptions[0].dataset.cal);

  calorieTracker.addEntry(name, calories);
}

function removeFood() {
  const name = document.getElementById("removeName").value.trim();
  if (!name) return alert("Enter a food name to remove");

  calorieTracker.removeEntry(name);
  document.getElementById("removeName").value = "";
}

function updateSummary() {
  const summaryDiv = document.getElementById("summary");

  if (calorieTracker.entries.length === 0) {
    summaryDiv.innerHTML = "No entries yet.";
    return;
  }

  let html = "<ul>";
  calorieTracker.entries.forEach(e => {
    html += `<li>${e.name}: ${e.calories} calories</li>`;
  });
  html += "</ul>";
  html += `<strong>Total: ${calorieTracker.totalCalories} calories</strong>`;

  summaryDiv.innerHTML = html;
}
