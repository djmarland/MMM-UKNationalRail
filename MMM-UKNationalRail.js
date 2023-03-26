/* Timetable for Trains Module */

/* Magic Mirror
 * Module: UK National Rail
 *
 * By Nick Wootton
 * based on SwissTransport module by Benjamin Angst http://www.beny.ch
 * MIT Licensed.
 */

Module.register("MMM-UKNationalRail", {
  // Define module defaults
  defaults: {
    updateInterval: 5 * 60 * 1000, // Update every 5 minutes.
    animationSpeed: 2000,
    fade: true,
    fadePoint: 0.25, // Start on 1/4th of the list.
    initialLoadDelay: 0, // start delay seconds.

    apiBase:
      "https://huxley2.azurewebsites.net/departures/{from}/to/{to}?accessToken={token}",

    app_key: "", // TransportAPI App Key
    app_id: "", // TransportAPI App ID
    from: "",
    to: "",

    maxResults: 5, //Maximum number of results to display
    showOrigin: false, //Show origin of train
    showPlatform: false, //Show departure platform of train
    showActualDeparture: true, //Show real-time departure time

    debug: false,
  },

  // Define required scripts.
  getStyles: function () {
    return ["trains.css", "font-awesome.css"];
  },

  // Define required scripts.
  getScripts: function () {
    return ["moment.js", this.file("titleCase.js")];
  },

  //Define header for module.
  getHeader: function () {
    return this.data.header;
  },

  // Define start sequence.
  start: function () {
    Log.info("Starting module: " + this.name);

    // Set locale.
    moment.locale(config.language);

    this.trains = {};
    this.loaded = false;

    this.url = encodeURI(
      this.config.apiBase
        .replace("{token}", this.config.app_key)
        .replace("{from}", this.config.from)
        .replace("{to}", this.config.to)
    );

    if (this.config.debug) {
      Log.warn("URL Request is: " + this.url);
    }

    // Initial start up delay via a timeout
    this.updateTimer = setTimeout(() => {
      this.fetchTrainInfo();

      // Now we've had our initial delay, re-fetch our train information at the interval given in the config
      this.updateTimer = setInterval(() => {
        this.fetchTrainInfo();
      }, this.config.updateInterval);
    }, this.config.initialLoadDelay);
  },

  // Trigger an update of our train data
  fetchTrainInfo: function () {
    if (!this.hidden) {
      this.sendSocketNotification("GET_TRAININFO", { url: this.url });
    }
  },

  // Override dom generator.
  getDom: function () {
    var wrapper = document.createElement("div");

    if (this.config.app_key === "") {
      wrapper.innerHTML =
        "Please set the application key: " + this.app_key + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.innerHTML = "Loading trains ...";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    //Dump train data
    if (this.config.debug) {
      Log.info(this.trains);
    }

    // *** Start Building Table
    var table = document.createElement("table");
    table.className = "small";

    //With data returned
    if (this.trains.data.length > 0) {
      for (var t in this.trains.data) {
        var myTrain = this.trains.data[t];

        //Create row for data item
        var row = document.createElement("tr");
        table.appendChild(row);

        //If platform is required, create first table cell
        if (this.config.showPlatform) {
          if (myTrain.platform) {
            platform = myTrain.platform;
          } else {
            platform = "-";
          }

          var trainPlatformCell = document.createElement("td");
          trainPlatformCell.innerHTML = " " + platform + " ";
          trainPlatformCell.className = "platform";
          row.appendChild(trainPlatformCell);
        }

        //Train destination cell
        var trainDestCell = document.createElement("td");
        trainDestCell.innerHTML = myTrain.destination;
        trainDestCell.className = "bright dest";
        row.appendChild(trainDestCell);

        //If required train origin cell
        if (this.config.showOrigin) {
          var trainOriginCell = document.createElement("td");
          trainOriginCell.innerHTML = myTrain.origin;
          trainOriginCell.className = "trainOrigin";
          row.appendChild(trainOriginCell);
        }

        //Timetabled departure time
        var plannedDepCell = document.createElement("td");
        plannedDepCell.innerHTML = myTrain.plannedDeparture;
        plannedDepCell.className = "timeTabled";
        row.appendChild(plannedDepCell);

        //If required, live departure time
        if (this.config.showActualDeparture) {
          var actualDepCell = document.createElement("td");
          if (myTrain.actualDeparture != null) {
            // Only display actual time if it exists
            actualDepCell.innerHTML = "(" + myTrain.actualDeparture + ")";
            if (myTrain.actualDeparture?.toLowerCase == "on time") {
              actualDepCell.className = "bright nonews status";
            } else {
              actualDepCell.className = "bright late status";
            }
          } else {
            actualDepCell.innerHTML = "&nbsp;";
          }
          actualDepCell.className = "actualTime";
          row.appendChild(actualDepCell);
        }

        if (this.config.fade && this.config.fadePoint < 1) {
          if (this.config.fadePoint < 0) {
            this.config.fadePoint = 0;
          }
          var startingPoint = this.trains.length * this.config.fadePoint;
          var steps = this.trains.length - startingPoint;
          if (t >= startingPoint) {
            var currentStep = t - startingPoint;
            row.style.opacity = 1 - (1 / steps) * currentStep;
          }
        }
      }
    } else {
      var row1 = document.createElement("tr");
      table.appendChild(row1);

      var messageCell = document.createElement("td");
      messageCell.innerHTML = " " + this.trains.message + " ";
      messageCell.className = "bright";
      row1.appendChild(messageCell);

      var row2 = document.createElement("tr");
      table.appendChild(row2);

      var timeCell = document.createElement("td");
      timeCell.innerHTML = " " + this.trains.timestamp + " ";
      timeCell.className = "bright";
      row2.appendChild(timeCell);
    }

    wrapper.appendChild(table);
    // *** End building results table

    return wrapper;
  },

  /* processTrains(data)
   * Uses the received data to set the various values.
   *
   * argument data object - Weather information received form openweather.org.
   */
  processTrains: function (data) {
    //Check we have data back from API
    if (typeof data !== "undefined" && data !== null) {
      //define object to hold train info
      this.trains = {};
      //Define array of departure data
      this.trains.data = [];
      //Define timestamp of current data
      this.trains.timestamp = new Date();
      //Define message holder
      this.trains.message = null;

      //Figure out Station Name
      //Define empty name
      var stationName = "";

      if (
        typeof data.locationName !== "undefined" &&
        data.locationName !== null
      ) {
        //Populate with stop name returned by TransportAPI info
        stationName = data.locationName;
      } else {
        //Default
        stationName = "Departures";
      }
      //Set value
      this.trains.stationName = stationName;

      //Check we have route info
      if (
        typeof data.trainServices !== "undefined" &&
        data.trainServices !== null &&
        data.trainServices.length > 0
      ) {
        //Figure out how long the results are
        var counter = 0;
        if (this.config.maxResults > data.trainServices.length) {
          counter = data.trainServices.length;
        } else {
          counter = this.config.maxResults;
        }

        for (var i = 0; i < counter; i++) {
          var thisTrain = data.trainServices[i];

          this.trains.data.push({
            plannedDeparture: thisTrain.std,
            actualDeparture: thisTrain.etd,
            origin: thisTrain.origin.locationName,
            destination:
              thisTrain.destination[thisTrain.destination.length - 1]
                .locationName,
            platform: thisTrain.platform,
          });
        }
      } else {
        //No departures info returned - set message
        this.trains.message = "No departure info found";
        if (this.config.debug) {
          Log.error("=======LEVEL 4=========");
          Log.error(this.trains);
          Log.error("^^^^^^^^^^^^^^^^^^^^^^^");
        }
      }
    } else {
      //No data returned - set message
      this.trains.message = "No data returned";
      if (this.config.debug) {
        Log.error("=======LEVEL 1=========");
        Log.error(this.trains);
        Log.error("^^^^^^^^^^^^^^^^^^^^^^^");
      }
    }

    this.loaded = true;
    this.updateDom(this.config.animationSpeed);
  },

  // Process data returned
  socketNotificationReceived: function (notification, payload) {
    if (notification === "TRAIN_DATA" && payload.url === this.url) {
      this.processTrains(payload.data);
    }
  },
});
