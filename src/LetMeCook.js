//LetMeCook test file
// test commit for azure static (3)
// A simple calorie tracker object
const calorieTracker = {
  totalCalories: 0,
  entries: [],

  // Add a food entry
  addEntry: function (name, calories) {
    this.entries.push({ name, calories });
    this.totalCalories += calories;
    console.log(`${name} added: +${calories} calories`);
  },

  // Remove an entry by name
  removeEntry: function (name) {
    const index = this.entries.findIndex(e => e.name === name);
    if (index !== -1) {
      this.totalCalories -= this.entries[index].calories;
      console.log(`${name} removed: -${this.entries[index].calories} calories`);
      this.entries.splice(index, 1);
    } else {
      console.log(`No entry found for "${name}"`);
    }
  },

  // Show summary
  showSummary: function () {
    console.log("---- Daily Summary ----");
    this.entries.forEach(e => {
      console.log(`${e.name}: ${e.calories} calories`);
    });
    console.log(`Total: ${this.totalCalories} calories`);
  }
};

// Example usage:
calorieTracker.addEntry("Apple", 95);
calorieTracker.addEntry("Chicken Sandwich", 420);
calorieTracker.removeEntry("Apple");
calorieTracker.showSummary();

