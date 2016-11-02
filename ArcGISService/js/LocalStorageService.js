// LocalStorageService.js
// Bureau of Economic Geology - The University of Texas at Austin
// 2016-11-02
// Aaron Averett
// This is a service that provides access to the browser's local storage feature.  You can use it to store app state information across multiple sessions.
// 
// Subject to MIT license - see LICENSE file included in the GitHub Repo

var localStorageServiceModule = angular.module('localStorageServiceModule', []);

localStorageServiceModule.factory('LocalStorageService', ['$window', function ($window) {
    var appStorages = {};

    if($window.localStorage)
    {
        api = {
            set: function(name, value)
            {
                $window.localStorage.setItem(name, JSON.stringify(value));
            },

            get: function(name)
            {
                var str = $window.localStorage.getItem(name);
                var val = null;
                try
                {
                    val = str ? JSON.parse(str) : {};
                }
                catch(ex)
                {

                }

                return val;
            },

            clear: function () {
                $window.localStorage.clear();
            }
        };
    }

    return  function (appName, property, scope) {
        if(appName === undefined)
        {
            throw new Error('appName is required');
        }

        var appStorage = appStorages[appName];

        var update = function () {
            api.set(appName, appStorage);
        };

        var clear = function () {
            api.clear(appName);
        };

        if (!appStorage) {
            appStorage = api.get(appName);
            appStorages[appName] = appStorage;
            update();
        }

        var bind = function (property, scope) {
            scope[property] = appStorage;
            scope.$watch(property, function () {
                update();
            }, true);
        };

        if(property !== undefined && scope !== undefined)
        {
            bind(property, scope);
        }

        return {
            get: function (name) {
                return appStorage[name];
            },
            set: function (name, value) {
                appStorage[name] = value;

                update();
            },
            clear: clear
        };
    };
}]);