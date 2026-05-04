test("file loads without crashing", () => {
  document.body.innerHTML = `
    <form id="suggestion-form"></form>
    <button id="submit-btn"></button>
    <span id="btn-content"></span>
    <div id="results-card"></div>
    <div id="suggestions"></div>
    <div id="toast"></div>
  `;

  expect(() => {
    require("../AI_Suggestions.js");
  }).not.toThrow();
});