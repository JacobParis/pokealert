// Creates the gservice factory. This will be the primary means by which we interact with Google Maps
angular.module('gservice', [])
  .factory('gservice', function($rootScope, $http) {

    // Initialize Variables
    // -------------------------------------------------------------
    // Service our factory will return
    var googleMapService = {};
    // Handling Clicks and location selection
    googleMapService.clickLat = 0;
    googleMapService.clickLong = 0;
    // Array of locations obtained from API calls
    var locations = [];

    // Selected Location (initialize to center of America)
    var selectedLat = 39.50;
    var selectedLong = -98.35;


    // Functions
    // --------------------------------------------------------------
    // Refresh the Map with new data. Function will take new latitude and longitude coordinates.
    googleMapService.refresh = function(latitude, longitude, zoom, query) {
      if(query && query.error) {
        console.log(query.error);
      }
      // Clears the holding array of locations
      locations = [];

      // Set the selected lat and long equal to the ones provided on the refresh() call
      selectedLat = parseFloat(latitude);
      selectedLong = parseFloat(longitude);

      // Perform an AJAX call to get all of the records in the db.
      $http.get('/users').success(function(response) {

        // Convert the results into Google Map Format
        locations = convertToMapPoints(response, query);
        codes = getGeocodes(response, query, zoom);
        // Then initialize the map.
        initialize(latitude, longitude, zoom, query);

      }).error(function() {});
    };

    // Private Inner Functions
    // --------------------------------------------------------------
    // Convert a JSON of users into map points
    var convertToMapPoints = function(response, query) {
      query = query || [{}];
      query = query.length ? query : [query];
      // Clear the locations holder
      var locations = [];

      // Loop through all of the JSON entries provided in the response
      for (var i = 0; i < response.length; i++) {
        var user = response[i];

        if(!user.pokemon) continue;
        if(query.error) continue;

        // More than one pokemon has been returned, check all of them
        if(query.length) {
          _.each(query, function (doc) {
            if(!doc.name || user.pokemon.toLowerCase() == doc.name.toLowerCase()) {
              // Converts each of the JSON records into Google Maps Heatmap format (Note [Lat, Lng] format).
              locations.push(new google.maps.LatLng(user.location[1], user.location[0]));
            }
          });
        }
      }
      // location is now an array populated with records in Google Maps format
      return locations;
    };

    // Generate markers for the centers of crowds of pokemon
    var getGeocodes = function(response, query, zoom) {
      query = query || [{display: "all"}];
      query = query.length ? query : [query];

      //Clear the geocodes holder
      var codes = [];
      zoom = zoom || 11;
      zoomDepth = [4,4,4,4,4,4,4,6,6,6,6,6,8,8,8,8,8,8,8,8];

      // Loop through the JSON
      for (var i = 0; i < response.length; i++) {
        var user = response[i];

        if(!user.pokemon) continue;
        if(query.error) continue;

        // More than one pokemon has been returned, check all of them
        if(query.length) {
          //No query, show all pokemon nearby
          if(query[0].display == "all") {
            // Converts each of the JSON records into Google Maps Heatmap format (Note [Lat, Lng] format).
            let latlon = Geohash.decode(user.geohash.substring(0, zoomDepth[zoom]));

            let contentString = '<strong> '+user.pokemon+'</strong> <br /><a href="#' + user.geohash + '" >Link here</a>';
            if(user.time) contentString += '<br /> <p>Found at ' + user.time ? "daytime" : "nighttime."
            let object = {
              pokemon: user.pokemon.toLowerCase(),
              geohash: user.geohash,
              latlon: new google.maps.LatLng(latlon.lat, latlon.lon),
              message: new google.maps.InfoWindow({
                    content: contentString,
                    maxWidth: 320
                }),
            };
            codes.push(object);
          } else {
            _.each(query, function (doc) {
              if(doc.name && user.geohash && user.pokemon.toLowerCase() == doc.name.toLowerCase()) {
                // Converts each of the JSON records into Google Maps Heatmap format (Note [Lat, Lng] format).
                let latlon = Geohash.decode(user.geohash.substring(0, zoomDepth[zoom]));
                console.log(user);
                let contentString = '<strong> '+user.pokemon+'</strong> <br /><a href="#' + user.geohash + '" >Link here</a>';
                if(user.time) contentString += '<br /> <p>Found at ' + user.time ? "daytime" : "nighttime."
                let object = {
                  pokemon: user.pokemon.toLowerCase(),
                  geohash: user.geohash,
                  latlon: new google.maps.LatLng(latlon.lat, latlon.lon),
                  message: new google.maps.InfoWindow({
                        content: contentString,
                        maxWidth: 320
                    }),
                };
                codes.push(object);
              }
            });
          }

        }
      }
      // location is now an array populated with records in Google Maps format
      _.uniqWith(codes, function (a, b) {
        return a.pokemon == b.pokemon && a.geohash == b.geohash;
      });
      return codes;
    };

    var clearMarkers = function(markers) {
      _.each(markers, function(mark) {
        mark.setMap(null);
      });

      return null;
    };
    var displayMarkers = function (map, codes) {
      var markers = [];
      codes.forEach(function(n, i) {
        let point = Pokemon.nameToSprite(n.pokemon);
        var marker = new google.maps.Marker({
          position: n.latlon,
          map: map,
          title: "Pokemon",
          icon: new google.maps.MarkerImage(
            "img/kantosprites.png",
            new google.maps.Size(32, 25),
            new google.maps.Point(point.x, point.y)
          )
        });

        markers.push(marker);
        // For each marker created, add a listener that checks for clicks
        google.maps.event.addListener(marker, 'click', function(e) {

          // When clicked, open the selected marker's message
          currentSelectedMarker = n;
          n.message.open(map, marker);
        });
      });
      return markers;
    };


    // Initializes the map
    var initialize = function(latitude, longitude, zoom, query) {

      // Uses the selected lat, long as starting point
      let lat = selectedLat;
      let lng = selectedLong;

      var myLatLng = {
        lat: selectedLat,
        lng: selectedLong
      };

      zoom = zoom || 11;
      // If map has not been created already...
      if (!map) {

        // Create a new map and place in the index.html page
        var map = new google.maps.Map(document.getElementById('map'), {
          zoom: zoom,
          center: myLatLng
        });

        heatmap = new google.maps.visualization.HeatmapLayer({
          data: locations,
          map: map
        });

        heatmap.set('radius', 20);
      }

      // Loop through each location in the array and place a marker
      var markers = displayMarkers(map, codes);

      // Set initial location as a bouncing red marker
      var initialLocation = new google.maps.LatLng(latitude, longitude);

      let point = {x: 0, y: 0};
      if(query) {
        let sample = query.length ? query[0] : query;
        point = Pokemon.nameToSprite(sample.name);
      }

      var marker = new google.maps.Marker({
        position: initialLocation,
        animation: google.maps.Animation.BOUNCE,
        map: map,
        icon: new google.maps.MarkerImage(
          "img/kantosprites.png",
          new google.maps.Size(32, 25),
          new google.maps.Point(point.x, point.y)
        )
      });
      lastMarker = marker;

      // Function for moving to a selected location
      map.panTo(new google.maps.LatLng(latitude, longitude));

      // Clicking on the Map moves the bouncing red marker
      google.maps.event.addListener(map, 'click', function(e) {
        let point = {x: 0, y: 0};
        if(query) {
          let sample = query.length ? query[0] : query;
          point = Pokemon.nameToSprite(sample.name);
        }

        var marker = new google.maps.Marker({
          position: e.latLng,
          animation: google.maps.Animation.BOUNCE,
          map: map,
          icon: new google.maps.MarkerImage(
            "img/kantosprites.png",
            new google.maps.Size(32, 25),
            new google.maps.Point(point.x, point.y)
          )
        });

        // When a new spot is selected, delete the old red bouncing marker
        if (lastMarker) {
          lastMarker.setMap(null);
        }

        // Create a new red bouncing marker and move to it
        lastMarker = marker;
        map.panTo(marker.position);

        // Update Broadcasted Variable (lets the panels know to change their lat, long values)
        googleMapService.clickLat = marker.getPosition().lat();
        googleMapService.clickLong = marker.getPosition().lng();
        $rootScope.$broadcast("clicked");
      });

      // Zoom to 13 when clicking on marker
      google.maps.event.addListener(marker,'click',function() {
        map.setCenter(marker.getPosition());
      });

      //Zooming the map updates the scope Variable and redraws markers
      google.maps.event.addListener(map, 'zoom_changed', function(e) {
        console.log(map.getZoom());

        let low = [0,1,2,3,4];
        let med = [7,8,9,10];
        let high = [13,14,15,16,17,18,19,20];
        let oldZoom = $rootScope.zoom;
        let newZoom = map.getZoom();

        //If they are in the same zoom level, we don't need to redraw
        if(!(_.includes(low, oldZoom) && _.includes(low, newZoom))
        && !(_.includes(med, oldZoom) && _.includes(med, newZoom))
        && !(_.includes(high, oldZoom) && _.includes(high, newZoom))) {
          // Perform an AJAX call to get all of the records in the db.
          $http.get('/users').success(function(response) {
            codes = getGeocodes(response, query, map.getZoom());
            // Then initialize the map.
            markers = clearMarkers(markers);
            markers = displayMarkers(map, codes);
          }).error(function() {});
        }

        $rootScope.zoom = map.getZoom();
      });
    };

    zoom = $rootScope.zoom || 11;
    // Refresh the page upon window load. Use the initial latitude and longitude
    google.maps.event.addDomListener(window, 'load',
      googleMapService.refresh(selectedLat, selectedLong, zoom));

    return googleMapService;
  });
