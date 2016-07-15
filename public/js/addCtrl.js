// Creates the addCtrl Module and Controller. Note that it depends on the 'geolocation' module and service.
var addCtrl = angular.module('addCtrl', ['geolocation', 'gservice', 'ngMaterial']);
addCtrl.controller('addCtrl', function($scope, $http, $rootScope, $mdDialog, $mdMedia, geolocation, gservice) {

  // Initializes Variables
  // ----------------------------------------------------------------------------
  $scope.formData = {};
  var coords = {};
  var lat = 0;
  var long = 0;

  $scope.searchData = {};
  $scope.pokemon = Pokemon.names;

  $scope.addCtrl = {};
  $scope.addCtrl.states        = loadAll();
  $scope.addCtrl.querySearch   = querySearch;
  $scope.addCtrl.selectedItemChange = selectedItemChange;
  $scope.addCtrl.searchTextChange   = searchTextChange;

  // Set initial coordinates to the center of the US
  $scope.formData.latitude = 39.500;
  $scope.formData.longitude = -98.350;

  // Get User's actual coordinates based on HTML5 at window load
  geolocation.getLocation().then(function(data) {

    // Set the latitude and longitude equal to the HTML5 coordinates
    coords = {
      lat: data.coords.latitude,
      long: data.coords.longitude
    };

    // Display coordinates in location textboxes rounded to three decimal points
    $scope.formData.longitude = parseFloat(coords.long).toFixed(3);
    $scope.formData.latitude = parseFloat(coords.lat).toFixed(3);

    // Display message confirming that the coordinates verified.
    //$scope.formData.gps = true;

    gservice.refresh(parseFloat($scope.formData.latitude), parseFloat($scope.formData.longitude), 11);


  });

  // Functions
  // ----------------------------------------------------------------------------

  // Get coordinates based on mouse click. When a click event is detected....
  $rootScope.$on("clicked", function() {

    // Run the gservice functions associated with identifying coordinates
    $scope.$apply(function() {
      $scope.formData.latitude = parseFloat(gservice.clickLat).toFixed(3);
      $scope.formData.longitude = parseFloat(gservice.clickLong).toFixed(3);
      //$scope.formData.gps = false;
    });
  });

  // Creates a new user based on the form fields
  $scope.createUser = function() {
    //Encode geohash with 8 characters of accuracy
    //We can display them with fewer as we wish
    let ghash = Geohash.encode($scope.formData.latitude,$scope.formData.longitude, 8);
    console.log(ghash);
    // Grabs all of the text box fields
    var userData = {
      pokemon: $scope.addCtrl.searchText,
      time: $scope.formData.time,
      location: [$scope.formData.longitude, $scope.formData.latitude],
      geohash: ghash
        //gps: $scope.formData.gps
    };

    console.log(userData);
    // Saves the user data to the db
    $http.post('/users', userData)
      .success(function(data) {
        // Refresh the map with new data
        $scope.search(true);
      })
      .error(function(data) {
        console.log('Error: ' + data);
      });
  };

  $scope.search = function(maintainZoom) {
    maintainZoom = maintainZoom || false;
    //Grab box input
    let query = $scope.addCtrl.searchText || "";
    let resultA = _.find(Pokemon.names, {
      name: query.toLowerCase()
    });

    let resultB = _.filter(Pokemon.names, function (value, key) {
      if(value.types.indexOf(query.toLowerCase()) !== -1) {
        return true;
      }
    });

    result = resultA ? resultA : resultB;
    //No matches found
    if (query && !result) {
      result = {error: 'No matches found'};
    }

    let previousZoom = $rootScope.zoom || 11;
    let zoom = maintainZoom ? previousZoom : 11;
    gservice.refresh($scope.formData.latitude, $scope.formData.longitude, zoom, result);
  };


  function querySearch(query) {
      var results = query ? $scope.addCtrl.states.filter( createFilterFor(query) ) : $scope.addCtrl.states,
          deferred;
      if ($scope.addCtrl.simulateQuery) {
        deferred = $q.defer();
        $timeout(function () { deferred.resolve( results ); }, Math.random() * 1000, false);
        return deferred.promise;
      } else {
        return results;
      }
    }
    function searchTextChange(text) {
      //console.log('Text changed to ' + text);
    }
    function selectedItemChange(item) {
      console.log('Item changed to ' + JSON.stringify(item));
      $scope.search();
    }
    /**
     * Build `states` list of key/value pairs
     */
    function loadAll() {
      var a = Pokemon.names.map( function (pokemon) {
        return {
          value: pokemon.name.toLowerCase(),
          display: _.capitalize(pokemon.name)
        };
      });

      var secondTypes = [];
      var b = Pokemon.names.map(function (pokemon) {
        if(pokemon.types.length === 2) {
          secondTypes.push({
            value: pokemon.types[1].toLowerCase(),
            display: _.capitalize(pokemon.types[1])
          });
        };

        return {
          value: pokemon.types[0].toLowerCase(),
          display: _.capitalize(pokemon.types[0])
        };
      });

      var types = b.concat(secondTypes).filter(function(value, index, self) {
        var idx = _.chain(self).map("value").indexOf(value.value).value();
        return idx === index;
      });

      return a.concat(types);
    }
    /**
     * Create filter function for a query string
     */
    function createFilterFor(query) {
      var lowercaseQuery = angular.lowercase(query);
      return function filterFn(state) {
        return (state.value.indexOf(lowercaseQuery) === 0);
      };
    }

    $scope.customFullscreen = $mdMedia('xs');
    $scope.showAdvanced = function(ev) {
      var useFullScreen = $mdMedia('xs')  && $scope.customFullscreen;
      $mdDialog.show({
        controller: DialogController,
        scope: this.$new(),
        templateUrl: 'dialog1.tmpl.html',
        parent: angular.element(document.body),
        targetEvent: ev,
        clickOutsideToClose:true,
        fullscreen: useFullScreen
      })
      .then(function(answer) {
        $scope.createUser();
        $scope.status = 'You said the information was "' + answer + '".';
      }, function() {
        $scope.status = 'You cancelled the dialog.';
      });
      $scope.$watch(function() {
        return $mdMedia('xs');
      }, function(wantsFullScreen) {
        $scope.customFullscreen = (wantsFullScreen === true);
      });
    };
    function DialogController($scope, $mdDialog) {
      $scope.hide = function() {
        $mdDialog.hide();
      };
      $scope.cancel = function() {
        $mdDialog.cancel();
      };
      $scope.answer = function(answer) {
        $mdDialog.hide(answer);
      };
    }
});
