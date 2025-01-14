/*
  Copyright 2021 David Healey

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

app.OpenFoodFacts = {
  search: function(query) {
    return new Promise(async function(resolve, reject) {
      if (navigator.connection.type !== "none") {
        //Build search string
        let url;

        // If query is a number, assume it's a barcode
        if (isNaN(query))
          url = "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(query) + "&search_simple=1&page_size=50&sort_by=last_modified_t&action=process&json=1";
        else
          url = "https://world.openfoodfacts.org/api/v0/product/" + encodeURIComponent(query) + ".json";

        //Get country name
        let country = app.Settings.get("integration", "search-country") || undefined;

        //Limit search to selected country
        if (country && country != "All")
          url += "&tagtype_0=countries&tag_contains_0=contains&tag_0=" + encodeURIComponent(country);

        //Get language
        let language = app.Settings.get("integration", "search-language") || undefined;

        if (language != undefined && language != "Default")
          url += "&lang=" + encodeURIComponent(language) + "&lc=" + encodeURIComponent(language);

        let response = await fetch(url, {
          headers: {
            "User-Agent": "Waistline - Android - Version " + app.version + " - https://github.com/davidhealey/waistline"
          }
        });

        if (response) {
          let data = await response.json();
          let result = [];

          // Multiple results (hide results where all nutrition values are undefined)
          if (data.products !== undefined) {
            data.products.forEach((x) => {
              let item = app.OpenFoodFacts.parseItem(x);
              if (item != undefined) {
                let nutritionValues = Object.values(item.nutrition).filter((v) => {return v != undefined});
                if (nutritionValues.length != 0) result.push(item);
              }
            });
          }

          // Single result (presumably from a barcode)
          if (data.product !== undefined) {
            let item = app.OpenFoodFacts.parseItem(data.product);
            if (item != undefined) result.push(item);
          }

          resolve(result);
        }
      } else {
        resolve(undefined);
      }
    }).catch(err => {
      throw (err);
    });
  },

  parseItem: function(item) {
    const nutriments = app.nutriments; // Array of OFF nutriment names
    const units = app.nutrimentUnits;

    let result = {
      "nutrition": {}
    };

    // Search for all keys containing 'item_name' to include local item names
    for (let k in item) {
      if (k.includes("product_name") && item[k].length > 1) {
        result.name = he.decode(item[k]);
        break;
      }
    }

    if (result.name == undefined || result.name == "")
      result.name = item.code;

    result.image_url = escape(item.image_url);
    result.barcode = item.code;

    // Get first brand if there is more than one
    let brands = item.brands || "";
    let n = brands.indexOf(",");
    let brand = brands.substring(0, n != -1 ? n : brands.length);
    result.brand = he.decode(brand);

    let perTag = "";
    if (item.serving_size && (item.nutriments.energy_serving || item.nutriments.energy_prepared_serving)) {
      result.portion = parseFloat(item.serving_size.replace(",", "."));
      let itemUnit = item.serving_size.replace(/ *\([^)]*\) */g, "").replace(app.Utils.nonLettersRegExp(), "");
      result.unit = app.strings["unit-symbols"][itemUnit.toLowerCase()] || itemUnit;
      if (item.nutriments.energy_serving) {
        result.nutrition.calories = (item.nutriments["energy-kcal_serving"]) ?
          parseInt(item.nutriments["energy-kcal_serving"]) :
          app.Utils.convertUnit(item.nutriments.energy_serving, units.kilojoules, units.calories, true);
        result.nutrition.kilojoules = item.nutriments.energy_serving;
        perTag = "_serving";
      } else if (item.nutriments.energy_prepared_serving) {
        result.nutrition.calories = (item.nutriments["energy-kcal_prepared_serving"]) ?
          parseInt(item.nutriments["energy-kcal_prepared_serving"]) :
          app.Utils.convertUnit(item.nutriments.energy_prepared_serving, units.kilojoules, units.calories, true);
        result.nutrition.kilojoules = item.nutriments.energy_prepared_serving;
        perTag = "_prepared_serving";
      }
    } else if (item.nutrition_data_per == "100g" && (item.nutriments.energy_100g || item.nutriments.energy_prepared_100g)) {
      result.portion = "100";
      result.unit = app.strings["unit-symbols"]["g"] || "g";
      if (item.nutriments.energy_100g) {
        result.nutrition.calories = (item.nutriments["energy-kcal_100g"]) ?
          item.nutriments["energy-kcal_100g"] :
          app.Utils.convertUnit(item.nutriments.energy_100g, units.kilojoules, units.calories, true);
        result.nutrition.kilojoules = item.nutriments.energy_100g;
        perTag = "_100g";
      } else if (item.nutriments.energy_prepared_100g) {
        result.nutrition.calories = (item.nutriments["energy-kcal_prepared_100g"]) ?
          item.nutriments["energy-kcal_prepared_100g"] :
          app.Utils.convertUnit(item.nutriments.energy_prepared_100g, units.kilojoules, units.calories, true);
        result.nutrition.kilojoules = item.nutriments.energy_prepared_100g;
        perTag = "_prepared_100g";
      }
    } else if (item.quantity) { // If all else fails
      result.portion = parseFloat(item.quantity.replace(",", "."));
      result.unit = item.quantity.replace(app.Utils.nonLettersRegExp(), "");
      result.nutrition.calories = (item.nutriments["energy-kcal"]) ?
        item.nutriments["energy-kcal"] :
        item.nutriments.energy;
      result.nutrition.kilojoules = item.nutriments.energy;
    }

    // Each nutriment
    for (let i = 0; i < nutriments.length; i++) {
      let x = nutriments[i];
      if (x != "calories" && x != "kilojoules") {
        let value = item.nutriments[x + perTag];
        result.nutrition[x] = app.Utils.convertUnit(value, "g", units[x]);
      }
    }

    if (result.portion == undefined || isNaN(result.portion))
      result = undefined;

    return result;
  },

  upload: function(data) {
    return new Promise(async function(resolve, reject) {
      let s = app.OpenFoodFacts.getUploadString(data);

      // Make request to OFF
      let endPoint;
      if (app.mode != "release")
        endPoint = "https://world.openfoodfacts.net/cgi/product_jqm2.pl?"; // Testing server
      else
        endPoint = "https://world.openfoodfacts.org/cgi/product_jqm2.pl?"; // Real server

      let headers = {
        'content-type': 'text/html; charset=UTF-8'
      };

      if (app.mode != "release")
        headers.Authorization = "Basic " + btoa("off:off");

      let response = await fetch(endPoint + s, {
          credentials: 'include',
          headers: headers
        })
        .catch((error) => {
          console.error('Error:', error);
          return reject();
        });

      if (response) {
        let result = await response.json();
        if (result.status == 1) {

          if (data.images !== undefined) {
            let count = data.images.filter(x => x == undefined).length;

            if (data.images.length > 0 && count < 2) {

              await app.OpenFoodFacts.uploadImages(data.images, data.barcode);

              // Get image URL from OFF
              let result = await app.OpenFoodFacts.search(data.barcode);

              if (result.length > 0 && result[0] !== undefined && result[0].image_url !== undefined)
                return resolve(result[0].image_url);
            }
          }
        }
      }
      resolve();
    });
  },

  getUploadString: function(data) {
    const nutriments = app.nutriments; // Array of OFF nutriment names
    const units = app.nutrimentUnits;

    let string = "";

    // Gather additional data
    let username = app.Settings.get("integration", "off-username") || "waistline-app";
    let password = app.Settings.get("integration", "off-password") || "waistline";

    // Organise data for upload 
    string += "code=" + encodeURIComponent(data.barcode);
    string += "&user_id=" + encodeURIComponent(username);
    string += "&password=" + encodeURIComponent(password);

    // Product language
    let language = app.Settings.get("integration", "search-language") || undefined;
    let lang = "en";

    if (language != undefined && language != "Default")
      lang = language;
    else
      lang = app.getLanguage(app.Settings.get("appearance", "locale")).substring(0, 2);

    string += "&lang=" + encodeURIComponent(lang);

    // Product information
    string += "&product_name_" + encodeURIComponent(lang) + "=" + encodeURIComponent(data.name);
    if (data.brand !== undefined) string += "&brands=" + encodeURIComponent(data.brand);
    string += data.nutrition_per;
    string += "&serving_size=" + encodeURIComponent(data.portion + data.unit);

    // Energy
    if (data.nutrition.kilojoules !== undefined) {
      string += "&nutriment_energy=" + data.nutrition.kilojoules;
      string += "&nutriment_energy_unit=" + units.kilojoules;
    } else if (data.nutrition.calories !== undefined) {
      string += "&nutriment_energy=" + data.nutrition.calories;
      string += "&nutriment_energy_unit=" + units.calories;
    }

    // Nutrition
    for (let n in data.nutrition) {
      if (n == "calories" || n == "kilojoules") continue;
      if (!nutriments.includes(n)) continue;

      string += "&nutriment_" + n + "=" + data.nutrition[n];
      string += "&nutriment_" + n + "_unit=" + (units[n] || "g");
    }

    // Tags
    let countries = app.Settings.get("integration", "upload-country");

    if (countries != undefined && countries != "Auto")
      string += "&countries=" + countries;

    return string;
  },

  uploadImages: function(imageURIs, barcode) {
    return new Promise(async function(resolve, reject) {
      let username = app.Settings.get("integration", "off-username") || "waistline-app";
      let password = app.Settings.get("integration", "off-password") || "waistline";
      let promises = [];

      for (let i = 0; i < imageURIs.length; i++) {
        let x = imageURIs[i];
        if (x != undefined) {
          let data = await app.OpenFoodFacts.getImageData(x, i);
          data.append("code", barcode);
          data.append("user_id", username);
          data.append("password", password);
          promises.push(app.OpenFoodFacts.postImage(data));
        }
      }

      await Promise.all(promises).then((values) => {
        console.log(values);
        resolve();
      });
    });
  },

  getImageData: function(uri, index) {
    return new Promise(function(resolve, reject) {
        window.resolveLocalFileSystemURL(uri, (fileEntry) => {
          fileEntry.file((file) => {
            console.log("Reading file");

            const imagefields = ["front", "nutrition"];
            let reader = new FileReader();

            reader.onloadend = function() {
              // Create a blob based on the FileReader "result", which we asked to be retrieved as an ArrayBuffer
              let blob = new Blob([new Uint8Array(this.result)], {
                type: "image/png"
              });

              let data = new FormData();
              data.append("imgupload_" + imagefields[index], blob);
              data.append("imagefield", imagefields[index]);

              resolve(data);
            };

            reader.readAsArrayBuffer(file);

          }, (err) => {
            console.error("Error getting file entry", err);
          });
        }, (err) => {
          console.error("Error getting file", err);
        });
      })
      .catch(function(err) {
        console.error('Error!', err.statusText);
        reject();
      });
  },

  postImage: function(data) {
    let endPoint;
    if (app.mode == "development")
      endPoint = "https://world.openfoodfacts.net/cgi/product_image_upload.pl"; // Testing server
    else
      endPoint = "https://world.openfoodfacts.org/cgi/product_image_upload.pl"; // Real server

    let headers = {};
    if (app.mode == "development")
      headers.Authorization = "Basic " + btoa("off:off");

    headers["Content-Type"] = "multipart/form-data";

    let response = fetch(endPoint, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: data
    }).catch((error) => {
      console.error('Error:', error);
    });

    return response;
  },

  testCredentials: function(username, password) {
    return new Promise(async function(resolve, reject) {

      let url = "https://world.openfoodfacts.org/cgi/session.pl?user_id=" + encodeURIComponent(username) + "&password=" + encodeURIComponent(password);

      let response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Waistline - Android - Version " + app.version + " - https://github.com/davidhealey/waistline"
        },
      });

      if (response) {
        let html = await response.text();
        if (html == null || html.includes("Incorrect user name or password.") || html.includes("See you soon!")) {
          resolve(false);
        }
      }
      resolve(true);
    }).catch(err => {
      throw (err);
    });
  }
};