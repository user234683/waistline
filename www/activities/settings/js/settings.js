/*
  Copyright 2020, 2021 David Healey

  This file is part of Waistline.

  Waistline is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  Waistline is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with app.  If not, see <http://www.gnu.org/licenses/>.
*/

// After a breaking change to the settings schema, increment this constant
// and implement the migration in the migrateSettings() function below
const currentSettingsSchemaVersion = 4;

var s;
app.Settings = {

  settings: {},

  init: function() {
    s = this.settings; //Assign settings object
    if (!s.ready) {
      s.ready = true;
    }
    app.Settings.bindUIActions();

    const inputs = Array.from(document.querySelectorAll("input, select"));
    app.Settings.restoreInputValues(inputs);
  },

  put: function(field, setting, value) {
    let settings = JSON.parse(window.localStorage.getItem("settings")) || {};
    settings[field] = settings[field] || {};
    settings[field][setting] = value;
    window.localStorage.setItem("settings", JSON.stringify(settings));
  },

  get: function(field, setting) {
    let settings = JSON.parse(window.localStorage.getItem("settings"));
    if (settings && settings[field] && settings[field][setting] !== undefined) {
      return settings[field][setting];
    }
    return undefined;
  },

  getField: function(field) {
    let settings = JSON.parse(window.localStorage.getItem("settings"));
    if (settings && settings[field] !== undefined) {
      return settings[field];
    }
    return undefined;
  },

  putField: function(field, value) {
    let settings = JSON.parse(window.localStorage.getItem("settings")) || {};
    settings[field] = settings[field] || {};
    settings[field] = value;
    window.localStorage.setItem("settings", JSON.stringify(settings));
  },

  restoreInputValues: function(inputs) {
    for (let i = 0; i < inputs.length; i++) {
      let x = inputs[i];
      let field = x.getAttribute("field");
      let setting = x.getAttribute("name");

      if (field && setting) {
        let value = this.get(field, setting); // Get value from storage

        if (value) {
          if (Array.isArray(value)) { // Deal with array values
            value.forEach((y, j) => {
              if (setting == "meal-names") // Meal names must be localized
                y = app.strings.diary["default-meals"][y.toLowerCase()] || y;

              for (let k = 0; k < inputs.length; k++) {
                let z = inputs[k];

                if (z.name == x.name) { // If the input matches the name of the original input
                  if (z.type == "checkbox")
                    z.checked = y;
                  else
                    z.value = y;

                  inputs.splice(k, 1); // Remove input from array because we've done this one
                  break; // Exit inner loop
                }
              }
            });
          } else {
            if (x.type == "checkbox")
              x.checked = value;
            else
              x.value = value;
          }
        }
      }
    }
  },

  bindUIActions: function() {

    // Input fields (including selects)
    const inputs = Array.from(document.querySelectorAll("input:not(.manual-bind), select"));

    inputs.forEach((x, i) => {
      if (x.hasAttribute("field") && x.hasAttribute("name") && !x.hasChangeEvent) {
        x.addEventListener("change", (e) => {
          app.Settings.saveInputs(inputs);
          app.Settings.resetModuleReadyStates(); //Reset modules for changes to take effect
        });
        x.hasChangeEvent = true;
      }
    });

    // Open food facts credentials login button
    let offLogin = document.getElementById("off-login");
    if (offLogin) {
      offLogin.addEventListener("click", function(e) {
        let username = document.querySelector(".off-login #off-username").value;
        let password = document.querySelector(".off-login #off-password").value;
        app.Settings.saveOFFCredentials(username, password);
      });
    }

    // USDA API Key save link
    let usdaSave = document.getElementById("usda-save");
    if (usdaSave) {
      usdaSave.addEventListener("click", function(e) {
        let key = document.querySelector(".usda-login #usda-key").value;
        app.Settings.saveUSDAKey(key);
      });
    }

    // Import/Export 
    let exportDb = document.getElementById("export-db");
    if (exportDb) {
      exportDb.addEventListener("click", function(e) {
        app.Settings.exportDatabase();
      });
    }

    let importDb = document.getElementById("import-db");
    if (importDb) {
      importDb.addEventListener("click", function(e) {
        app.Settings.importDatabase();
      });
    }

    // Dark mode
    let darkMode = document.querySelector(".page[data-name='settings-appearance'] #dark-mode");

    if (darkMode != undefined && !darkMode.hasClickEvent) {
      darkMode.addEventListener("click", (e) => {
        app.Settings.changeTheme(e.target.checked, themeSelect.value);
      });
      darkMode.hasClickEvent = true;
    }

    // Theme
    let themeSelect = document.querySelector(".page[data-name='settings-appearance'] #theme");

    if (themeSelect != undefined && !themeSelect.hasChangeEvent) {
      themeSelect.addEventListener("change", (e) => {
        app.Settings.changeTheme(darkMode.checked, e.target.value);
      });
      themeSelect.hasChangeEvent = true;
    }

    // Preferred Language
    let locale = document.querySelector(".page[data-name='settings-appearance'] #locale");

    if (locale != undefined && !locale.hasChangeEvent) {
      locale.addEventListener("change", (e) => {
        let msg = app.strings.settings["needs-restart"] || "Restart app to apply changes.";
        app.Utils.toast(msg);
      });
      locale.hasChangeEvent = true;
    }

    // Animations 
    let toggleAnimations = document.getElementById("toggle-animations");
    if (toggleAnimations != undefined) {
      toggleAnimations.addEventListener("click", (e) => {
        let msg = app.strings.settings["needs-restart"] || "Restart app to apply changes.";
        app.Utils.toast(msg);
      });
    }

    // Nutriment list 
    let nutrimentList = document.getElementById("nutriment-list");
    if (nutrimentList != undefined) {
      nutrimentList.addEventListener("sortable:sort", (li) => {
        let items = nutrimentList.getElementsByTagName("li");
        let newOrder = [];
        for (let i = 0; i < items.length - 1; i++) {
          newOrder.push(items[i].id);
        }
        app.Settings.put("nutriments", "order", newOrder);
      });
    }

    // Food labels/categories list
    let categoriesList = document.getElementById("food-categories-list");
    if (categoriesList != undefined) {
      categoriesList.addEventListener("sortable:sort", (li) => {
        let items = categoriesList.getElementsByTagName("li");
        let newOrder = [];
        for (let i = 0; i < items.length - 1; i++) {
          newOrder.push(items[i].id);
        }
        app.Settings.put("foodlist", "labels", newOrder);
      });
    }
  },

  changeTheme: function(darkMode, colourTheme) {
    let body = document.getElementsByTagName("body")[0];
    let panel = document.getElementById("app-panel");

    if (darkMode === true) {
      body.className = colourTheme + " theme-dark";
      panel.style["background-color"] = "black";
      Chart.defaults.global.defaultFontColor = 'white';
    } else {
      body.className = colourTheme;
      panel.style["background-color"] = "white";
      Chart.defaults.global.defaultFontColor = 'black';
    }
  },

  saveInputs: function(inputs) {
    inputs.forEach((x) => {
      // If input has same name as other inputs group them into an array
      let value = inputs.reduce((result, y) => {
        if (y.name == x.name) {
          if (y.type == "checkbox")
            result.push(y.checked);
          else if ((y.type == "radio" && y.checked) || y.type != "radio")
            result.push(y.value);
        }
        return result;
      }, []);

      // Input is not part of an array so just get first element
      if (value.length == 1) value = value[0];

      let field = x.getAttribute("field");
      let setting = x.getAttribute("name");

      app.Settings.put(field, setting, value);
    });
  },

  resetModuleReadyStates: function() {
    app.Diary.setReadyState(false);
  },

  saveOFFCredentials: async function(username, password) {
    let screen = document.querySelector(".off-login");
    if (app.Utils.isInternetConnected()) {
      if ((username == "" && password == "") || await app.OpenFoodFacts.testCredentials(username, password)) {
        this.put("integration", "off-username", username);
        this.put("integration", "off-password", password);
        app.f7.loginScreen.close(screen);
        let msg = app.strings.settings.integration["login-success"] || "Login Successful";
        app.Utils.toast(msg);
      } else {
        let msg = app.strings.settings.integration["invalid-credentials"] || "Invalid Credentials";
        app.Utils.toast(msg);
      }
    }
  },

  saveUSDAKey: async function(key) {
    let screen = document.querySelector(".usda-login");
    if (app.Utils.isInternetConnected()) {
      if (key == "" || await app.USDA.testApiKey(key)) {
        this.put("integration", "usda-key", key);
        app.f7.loginScreen.close(screen);
        let msg = app.strings.settings.integration["login-success"] || "Login Successful";
        app.Utils.toast(msg);
      } else {
        let msg = app.strings.settings.integration["invalid-api-key"] || "API Key Invalid";
        app.Utils.toast(msg);
      }
    }
  },

  exportDatabase: async function() {
    app.f7.preloader.show("red");

    let data = await dbHandler.export();
    data.settings = JSON.parse(window.localStorage.getItem("settings"));
    let json = JSON.stringify(data);

    let filename = "waistline_export.json";
    let path = await app.Utils.writeFile(json, filename);

    app.f7.preloader.hide();

    if (path !== undefined) {
      let msg = app.strings.settings.integration["export-success"] || "Database Exported";
      app.Utils.notify(msg + ": " + path);
    } else {
      let msg = app.strings.settings.integration["export-fail"] || "Export Failed";
      app.Utils.toast(msg);
    }
  },

  importDatabase: async function() {
    let file = await chooser.getFile();

    if (file !== undefined && file.data !== undefined) {
      let data;
      try {
        let content = new TextDecoder("utf-8").decode(file.data);
        data = JSON.parse(content);
      } catch (e) {
        let msg = app.strings.settings.integration["import-fail"] || "Import Failed";
        app.Utils.toast(msg);
      }

      if (data !== undefined) {
        let title = app.strings.settings.integration.import || "Import";
        let text = app.strings.settings.integration["confirm-import"] || "Are you sure? This will overwrite your current database.";

        let div = document.createElement("div");
        div.className = "dialog-text";
        div.innerText = text;

        let dialog = app.f7.dialog.create({
          title: title,
          content: div.outerHTML,
          buttons: [{
              text: app.strings.dialogs.cancel || "Cancel",
              keyCodes: [27]
            },
            {
              text: app.strings.dialogs.ok || "OK",
              keyCodes: [13],
              onClick: async () => {
                await dbHandler.import(data);

                if (data.settings !== undefined) {
                  let settings = app.Settings.migrateSettings(data.settings, false);
                  window.localStorage.setItem("settings", JSON.stringify(settings));
                  this.changeTheme(settings.appearance["dark-mode"], settings.appearance["theme"]);
                }
              }
            }
          ]
        }).open();
      }
    }
  },

  firstTimeSetup: function() {
    let defaults = {
      statistics: {
        "y-zero": false,
        "average-line": true,
        "goal-line": true
      },
      diary: {
        "meal-names": ["Breakfast", "Lunch", "Dinner", "Snacks", "", "", ""],
        timestamps: false,
        "show-thumbnails": false,
        "wifi-thumbnails": true,
        "show-all-nutriments": false,
        "show-nutrition-units": false,
        "prompt-add-items": false
      },
      foodlist: {
        labels: app.FoodsCategories.defaultLabels,
        categories: app.FoodsCategories.defaultCategories,
        sort: "alpha",
        "show-category-labels": false,
        "show-thumbnails": false,
        "wifi-thumbnails": true,
        "show-images": true,
        "wifi-images": true,
        "show-notes": false
      },
      integration: {
        "barcode-sound": false,
        "edit-images": false,
        "search-language": "Default",
        "search-country": "All",
        "upload-country": "Auto",
        usda: false
      },
      appearance: {
        "dark-mode": false,
        theme: "color-theme-red",
        animations: false,
        locale: "auto",
        "start-page": "/settings/"
      },
      units: {
        energy: "kcal",
        weight: "kg",
        length: "cm"
      },
      goals: {
        "first-day-of-week": "0",
        "average-goal-base": "week",
        calories: ["2000", "", "", "", "", "", ""],
        "calories-shared-goal": true,
        "calories-show-in-diary": true,
        "calories-show-in-stats": true,
        kilojoules: ["8400", "", "", "", "", "", ""],
        "kilojoules-shared-goal": true,
        "kilojoules-show-in-diary": true,
        "kilojoules-show-in-stats": true,
        proteins: ["50", "", "", "", "", "", ""],
        "proteins-shared-goal": true,
        "proteins-show-in-diary": true,
        "proteins-show-in-stats": true,
        carbohydrates: ["250", "", "", "", "", "", ""],
        "carbohydrates-shared-goal": true,
        "carbohydrates-show-in-diary": true,
        "carbohydrates-show-in-stats": true,
        fat: ["65", "", "", "", "", "", ""],
        "fat-shared-goal": true,
        "fat-show-in-diary": true,
        "fat-show-in-stats": true,
      },
      nutriments: {
        order: ["kilojoules", "calories", "fat", "saturated-fat", "carbohydrates", "sugars", "fiber", "proteins", "salt", "monounsaturated-fat", "polyunsaturated-fat", "trans-fat", "omega-3-fat", "omega-6-fat", "omega-9-fat", "cholesterol", "sodium", "vitamin-a", "vitamin-d", "vitamin-e", "vitamin-k", "vitamin-c", "vitamin-b1", "vitamin-b2", "vitamin-pp", "pantothenic-acid", "vitamin-b6", "biotin", "vitamin-b9", "vitamin-b12", "potassium", "chloride", "calcium", "phosphorus", "iron", "magnesium", "zinc", "copper", "manganese", "fluoride", "selenium", "iodine", "caffeine", "alcohol", "sucrose", "glucose", "fructose", "lactose"],
        units: {}
      },
      nutrimentVisibility: {
        "fat": true,
        "saturated-fat": true,
        "carbohydrates": true,
        "sugars": true,
        "proteins": true,
        "salt": true
      },
      firstTimeSetup: true,
      schemaVersion: currentSettingsSchemaVersion
    };

    window.localStorage.setItem("settings", JSON.stringify(defaults));
  },

  migrateSettings: function(settings, saveChanges = true) {
    if (settings !== undefined && (settings.schemaVersion === undefined || settings.schemaVersion < currentSettingsSchemaVersion)) {

      // Theme settings must be renamed to Appearance
      if (settings.theme !== undefined && settings.appearance === undefined) {
        settings.appearance = settings.theme;
        delete settings.theme;
      }

      // New nutriments must be added
      if (settings.nutriments !== undefined && settings.nutriments.order !== undefined) {
        app.nutriments.forEach((x) => {
          if (!settings.nutriments.order.includes(x))
            settings.nutriments.order.push(x);
        });
      }

      // Default food labels and categories must be added
      if (settings.foodlist !== undefined && settings.foodlist.labels === undefined && settings.foodlist.categories === undefined) {
        settings.foodlist.labels = app.FoodsCategories.defaultLabels;
        settings.foodlist.categories = app.FoodsCategories.defaultCategories;
      }

      // First Day of Week and Average Base settings must be added
      if (settings.goals !== undefined && settings.goals["first-day-of-week"] === undefined && settings.goals["average-goal-base"] === undefined) {
        settings.goals["first-day-of-week"] = "0";
        settings.goals["average-goal-base"] = "week";
      }

      settings.schemaVersion = currentSettingsSchemaVersion;

      if (saveChanges)
        window.localStorage.setItem("settings", JSON.stringify(settings));
    }

    return settings;
  }
};

document.addEventListener("page:init", async function(e) {
  const pageName = e.target.attributes["data-name"].value;

  if (pageName == "settings-nutriments")
    app.Nutriments.populateNutrimentList();

  if (pageName == "settings-foods-categories")
    app.FoodsCategories.populateFoodCategoriesList();

  //Settings and all settings subpages
  if (pageName.indexOf("settings") != -1) {
    app.Settings.init();
  }
});